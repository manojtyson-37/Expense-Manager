export interface CurrencyDef {
  code: string
  symbol: string
  label: string
  locale: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'en-IE' },
  { code: 'GBP', symbol: '£', label: 'British Pound', locale: 'en-GB' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', locale: 'en-AU' },
]

export const DEFAULT_CURRENCY = 'INR'

export function getCurrencyDef(code: string): CurrencyDef {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
}
