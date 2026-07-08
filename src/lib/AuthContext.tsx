import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
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

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, recovery, clearRecovery: () => setRecovery(false), signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
