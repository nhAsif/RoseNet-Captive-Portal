import { createContext, useContext } from 'react'

// Shares the configured currency symbol (from /admin/settings) across views.
export const CurrencyContext = createContext({
  currency: '$',
  setCurrency: () => {},
})

export const useCurrency = () => useContext(CurrencyContext)
