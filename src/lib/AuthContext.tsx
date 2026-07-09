import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { flushOutbox } from './outbox'
import { clearLocalData } from './sync'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  recovery: boolean
  clearRecovery: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  recovery: false,
  clearRecovery: () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    // getSession() silently tries to refresh an expired/near-expired token
    // over the network before resolving. Offline, that fetch doesn't fail
    // fast — it hangs until a long OS-level timeout, so `loading` never
    // clears and the app is stuck on the loading screen. Race it against a
    // short timeout and fall back to the raw cached session in localStorage
    // (read directly, no network) so the app still opens offline.
    let settled = false
    let usedFallback = false
    const timeout = setTimeout(() => {
      if (settled) return
      usedFallback = true
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      const cached = key ? JSON.parse(localStorage.getItem(key) || 'null') : null
      setSession(cached)
      setUser(cached?.user ?? null)
      setLoading(false)
    }, 2500)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        settled = true
        clearTimeout(timeout)
        // A late resolve with session:null after the offline fallback already
        // showed a logged-in user is an expired-refresh failure, not a real
        // sign-out — keep the fallback state instead of bouncing them to Login.
        if (usedFallback && !session) return
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        settled = true
        clearTimeout(timeout)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  // Wipes the local Dexie cache on sign-out — otherwise a second account
  // logging in on the same shared device inherits this account's cached
  // transactions/accounts/etc, and syncFromCloud's merge can push those
  // leftover rows into the new account's cloud data. Best-effort flush first
  // so unsynced local edits aren't silently lost (if offline, they're gone —
  // an accepted trade-off against leaking one account's data into another's,
  // same as the existing offline-outbox trade-off elsewhere in this file).
  // Both the flush and the sign-out call itself are capped — a hung request
  // (flaky network reporting online) must not block sign-out indefinitely
  // and trap the user. The Promise.race only stops *awaiting* flushOutbox;
  // if it's still running past the cap, its own (userId-scoped, so not a
  // cross-account risk) outbox writes can land after clearLocalData()'s
  // db.outbox.clear() below and leave a stray row. Accepted: rare, and the
  // wipe's account-isolation guarantee for every other table still holds.
  async function signOut() {
    if (user && navigator.onLine) {
      await Promise.race([
        flushOutbox(user.id).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 4000)),
      ])
    }

    const TIMED_OUT = Symbol('timed-out')
    const result = await Promise.race([
      supabase.auth.signOut().catch(() => undefined),
      new Promise(resolve => setTimeout(() => resolve(TIMED_OUT), 4000)),
    ])

    // supabase.auth.signOut() only clears the local session (and fires the
    // SIGNED_OUT event this component's onAuthStateChange listener depends
    // on to null out user/session) AFTER its network revoke call resolves —
    // even so, it still makes that network call first. If it's still hung
    // past the cap, that event may never fire: user/session stay populated,
    // App.tsx never drops to the Login screen, and the next reconnect/
    // tab-focus sync calls syncFromCloud with the OLD user's id — pulling
    // their data straight back into the cache clearLocalData() is about to
    // wipe. Force the local session gone ourselves so that can't happen,
    // regardless of whether the network call ever completes.
    if (result === TIMED_OUT) {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (key) localStorage.removeItem(key)
      setSession(null)
      setUser(null)
    }

    await clearLocalData().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, recovery, clearRecovery: () => setRecovery(false), signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
