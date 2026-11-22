export type Segment = 'semis' | 'ai' | 'software'
export type Country = 'US' | 'BR'

type Series = (number | null)[]

export interface Financials {
  years: (number | string)[]
  fiscalYearEnd: string[]
  is: Record<
    'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'ebit' | 'ebitda' | 'da' | 'interestExpense' | 'pretaxIncome' | 'tax' | 'netIncome',
    Series
  >
  bs: Record<
    | 'totalAssets'
    | 'totalLiabilities'
    | 'equity'
    | 'cash'
    | 'receivables'
    | 'inventory'
    | 'currentAssets'
    | 'payables'
    | 'currentLiabilities'
    | 'ppe'
    | 'totalDebt',
    Series
  >
  cf: Record<'cfo' | 'capex' | 'da' | 'changeNwc' | 'fcf', Series>
}

export interface PriceSeries {
  dates: string[]
  close: number[]
}

export interface Company {
  ticker: string
  country: Country
  segment: Segment
  chain: string
  bank?: boolean
  asOf: string
  profile: {
    longName?: string
    shortName?: string
    sector?: string
    industry?: string
    currency?: string
    financialCurrency?: string
    marketCap?: number | null
    sharesOutstanding?: number | null
    beta?: number | null
    totalDebt?: number | null
    totalCash?: number | null
    price: number
    longBusinessSummary?: string
    fiftyTwoWeekLow?: number | null
    fiftyTwoWeekHigh?: number | null
  }
  financials: Financials | null
  prices: PriceSeries
}

export interface UniverseEntry {
  ticker: string
  slug: string
  country: Country
  segment: Segment
  chain: string
  bank: boolean
  name: string
  currency: string | null
  financialCurrency: string | null
  marketCap: number | null
  price: number | null
  evToEbitda: number | null
  ebitdaMargin: number | null
  grossMargin: number | null
  operatingMargin: number | null
  revenueGrowth: number | null
  trailingPE: number | null
  revenue: number | null
  netIncome: number | null
  hasFinancials: boolean
  spark: number[]
}

export interface Macro {
  asOf: string
  us10y: { date: string; value: number } | null
  selic: { date: string; value: number } | null
  ipcaFocus: { date: string; byYear: Record<string, number>; longRun: number } | null
  usInflationLongRun: number
  damodaran: {
    updated: string
    matureErp: number
    usErp: number
    brazilCrp: number
    brazilTotalErp: number
    brazilRating: string
    source: string
  } | null
  usdbrl: { date: string; value: number } | null
  toUsd: Record<string, number>
  sources: Record<string, string>
}
