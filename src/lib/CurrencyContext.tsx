import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { CURRENCIES, DEFAULT_CURRENCY, getCurrencyDef } from './currency'

const STORAGE_KEY = 'currency'

interface CurrencyState {
  currency: string
  symbol: string
  setCurrency: (code: string) => Promise<void>
  format: (amount: number, opts?: Intl.NumberFormatOptions) => string
}

const CurrencyContext = createContext<CurrencyState>({
  currency: DEFAULT_CURRENCY,
  symbol: getCurrencyDef(DEFAULT_CURRENCY).symbol,
  setCurrency: async () => {},
  format: (n) => String(n),
})

export function useCurrency() {
  return useContext(CurrencyContext)
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY
  )

  // Pull the saved preference from the user's account metadata once they're
  // known, so a new device picks up the same currency without re-selecting it.
  useEffect(() => {
    const remote = user?.user_metadata?.currency
    if (remote && CURRENCIES.some(c => c.code === remote) && remote !== currency) {
      setCurrencyState(remote)
      localStorage.setItem(STORAGE_KEY, remote)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function setCurrency(code: string) {
    setCurrencyState(code)
    localStorage.setItem(STORAGE_KEY, code)
    if (user) {
      await supabase.auth.updateUser({ data: { currency: code } })
    }
  }

  const def = getCurrencyDef(currency)

  function format(amount: number, opts?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(def.locale, {
      style: 'currency',
      currency: def.code,
      minimumFractionDigits: 2,
      ...opts,
    }).format(amount)
  }

  return (
    <CurrencyContext.Provider value={{ currency, symbol: def.symbol, setCurrency, format }}>
      {children}
    </CurrencyContext.Provider>
  )
}
