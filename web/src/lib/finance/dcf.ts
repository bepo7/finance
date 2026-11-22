import type { Company, Macro } from './types'
import { add, div, evaluate, mul, num, pow, ref, S, sub, sumRow, neg, type Evaluated, type RowDef, type Sheet } from './sheet'

export const PROJ_YEARS = 5

export interface DcfAssumptions {
  growth: number[]
  ebitdaMargin: number[]
  grossMargin: number
  daPct: number
  capexPct: number
  nwcPct: number
  taxRate: number
  rf: number
  beta: number
  erp: number
  crp: number
  inflLocal: number
  inflUS: number
  kdUsd: number
  debtWeight: number
  g: number
  exitMultiple: number
  /** 1 = 100% Gordon, 0 = 100% múltiplo de saída */
  tvWeightGordon: number
  /** 1 unidade da moeda das demonstrações em moeda de cotação */
  fx: number
  shares: number
  price: number
}

// ---------- utilidades ----------
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const nn = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null && Number.isFinite(x))
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const last = <T,>(xs: (T | null)[]) => {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return xs[i]
  return null
}
const ratio = (a: (number | null)[], b: (number | null)[]) => a.map((x, i) => (x != null && b[i] ? x / b[i]! : null))

/** Série de EBITDA: usa o reportado ou EBIT + D&A */
export function ebitdaSeries(c: Company): (number | null)[] {
  const f = c.financials!
  return f.is.revenue.map((_, i) => f.is.ebitda[i] ?? (f.is.ebit[i] != null ? f.is.ebit[i]! + (f.is.da[i] ?? f.cf.da[i] ?? 0) : null))
}

export function nwcSeries(c: Company): (number | null)[] {
  const b = c.financials!.bs
  return b.receivables.map((r, i) =>
    r == null && b.inventory[i] == null && b.payables[i] == null ? null : (r ?? 0) + (b.inventory[i] ?? 0) - (b.payables[i] ?? 0),
  )
}

export function impliedShares(c: Company): number {
  const p = c.profile
  if (p.marketCap && p.price) return p.marketCap / p.price
  return p.sharesOutstanding ?? 0
}

export function fxFinToQuote(c: Company, macro: Macro): number {
  const fin = c.profile.financialCurrency ?? c.profile.currency ?? 'USD'
  const quote = c.profile.currency ?? fin
  if (fin === quote) return 1
  const a = macro.toUsd[fin]
  const b = macro.toUsd[quote]
  return a && b ? a / b : 1
}

export function localInflation(c: Company, macro: Macro): number {
  const fin = c.profile.financialCurrency ?? c.profile.currency
  if (fin === 'BRL') {
    const by = macro.ipcaFocus?.byYear
    const v = by ? avg(Object.values(by)) : null
    return v ?? 0.04
  }
  return macro.usInflationLongRun
}

/** Premissas iniciais derivadas do histórico — todas editáveis no site */
export function defaultAssumptions(c: Company, macro: Macro): DcfAssumptions {
  const f = c.financials!
  const rev = f.is.revenue
  const yoy = nn(rev.map((r, i) => (i > 0 && r != null && rev[i - 1] ? r / rev[i - 1]! - 1 : null)))
  const inflLocal = localInflation(c, macro)
  const inflUS = macro.usInflationLongRun
  const g = +(inflLocal + 0.005).toFixed(4)

  const start = clamp(avg(yoy.slice(-2)) ?? 0.08, -0.05, 0.4)
  const end = Math.max(g + 0.01, Math.min(start, start * 0.5))
  const growth = Array.from({ length: PROJ_YEARS }, (_, t) => +(start + ((end - start) * t) / (PROJ_YEARS - 1)).toFixed(4))

  const ebitdaM = nn(ratio(ebitdaSeries(c), rev))
  const lastM = clamp(ebitdaM.at(-1) ?? 0.2, -0.3, 0.8)
  const ebitdaMargin = Array(PROJ_YEARS).fill(+lastM.toFixed(4))

  const gm = avg(nn(ratio(f.is.grossProfit, rev)))
  const da = avg(nn(ratio(f.is.da.map((x, i) => x ?? f.cf.da[i]), rev)).map(Math.abs))
  const capex = avg(nn(ratio(f.cf.capex, rev)).map(Math.abs))
  const nwc = last(ratio(nwcSeries(c), rev))
  const taxes = nn(f.is.tax.map((t, i) => (t != null && f.is.pretaxIncome[i] && f.is.pretaxIncome[i]! > 0 ? t / f.is.pretaxIncome[i]! : null)))
  const statutory = c.profile.financialCurrency === 'BRL' ? 0.34 : 0.21

  const rf = macro.us10y?.value ?? 0.043
  const debt = last(f.bs.totalDebt) ?? 0
  const fx = fxFinToQuote(c, macro)
  const equityFin = (c.profile.marketCap ?? 0) / fx
  const intRate = debt > 0 && last(f.is.interestExpense) ? Math.abs(last(f.is.interestExpense)!) / debt : null
  const isBR = c.country === 'BR'
  const kdUsdDefault = rf + 0.015 + (isBR ? (macro.damodaran?.brazilCrp ?? 0.03) * 0.66 : 0)

  const ev = equityFin + debt - (last(f.bs.cash) ?? 0)
  const lastEbitda = last(ebitdaSeries(c))
  const curMult = lastEbitda && lastEbitda > 0 ? ev / lastEbitda : null

  return {
    growth,
    ebitdaMargin,
    grossMargin: +clamp(gm ?? Math.min(1, lastM + 0.3), 0, 1).toFixed(4),
    daPct: +clamp(da ?? 0.04, 0, 0.4).toFixed(4),
    capexPct: +clamp(capex ?? da ?? 0.05, 0, 0.6).toFixed(4),
    nwcPct: +clamp(nwc ?? 0.05, -0.5, 0.8).toFixed(4),
    taxRate: +clamp(avg(taxes) ?? statutory, 0.05, 0.4).toFixed(4),
    rf: +rf.toFixed(4),
    // beta ajustado de Blume (0,67·β + 0,33), como Bloomberg
    beta: +clamp(0.67 * (c.profile.beta ?? 1.2) + 0.33, 0.5, 2.5).toFixed(2),
    erp: macro.damodaran?.usErp ?? 0.045,
    crp: isBR ? (macro.damodaran?.brazilCrp ?? 0.03) : 0,
    inflLocal: +inflLocal.toFixed(4),
    inflUS,
    kdUsd: +(intRate != null ? clamp(intRate, rf + 0.005, rf + 0.08) : kdUsdDefault).toFixed(4),
    debtWeight: +(equityFin + debt > 0 ? clamp(debt / (equityFin + debt), 0, 0.8) : 0).toFixed(4),
    g,
    exitMultiple: +clamp(curMult ?? 15, 5, 40).toFixed(1),
    tvWeightGordon: 0.5,
    fx,
    shares: impliedShares(c),
    price: c.profile.price,
  }
}

/** último ano sem dado vira 0 (ex.: empresa sem dívida reportada) */
const zeroLast = (xs: (number | null)[]) => xs.map((x, i) => (i === xs.length - 1 ? (x ?? 0) : x))

// ---------- planilha ----------
export const SECTIONS = ['Premissas', 'WACC', 'DRE', 'Balanço', 'Fluxo de caixa', 'DCF'] as const

export function buildDcfSheet(c: Company, a: DcfAssumptions): Sheet {
  const f = c.financials!
  const H = f.years.length
  const N = H + PROJ_YEARS
  const P0 = H // primeira coluna projetada
  const PN = N - 1
  const isP = (col: number) => col >= P0
  const cols = [
    ...f.years.map((y) => ({ label: `${y}A`, hist: true })),
    ...Array.from({ length: PROJ_YEARS }, (_, i) => ({ label: `${Number(f.years[H - 1]) + i + 1}E`, hist: false })),
  ]
  const hist = (xs: (number | null)[], sign = 1) => [...xs.map((x) => (x == null ? null : sign * x)), ...Array(PROJ_YEARS).fill(null)]
  const proj = (xs: number[]) => [...Array(H).fill(null), ...xs]
  const sc = (v: number) => [v]

  const ebitda = ebitdaSeries(c)
  const daHist = f.is.da.map((x, i) => x ?? f.cf.da[i])
  const gp = f.is.grossProfit.map((x, i) => x ?? (f.is.revenue[i] != null && f.is.cogs[i] != null ? f.is.revenue[i]! - f.is.cogs[i]! : null))

  const rows: RowDef[] = [
    // Premissas
    {
      id: 'growth', label: 'Crescimento da receita', section: 'Premissas', fmt: 'pct', values: proj(a.growth),
      formula: (col) => (!isP(col) && col > 0 ? sub(div(ref('revenue'), ref('revenue', 'prev')), num(1)) : null),
    },
    {
      id: 'ebitdaMargin', label: 'Margem EBITDA', section: 'Premissas', fmt: 'pct', values: proj(a.ebitdaMargin),
      formula: (col) => (!isP(col) ? div(ref('ebitda'), ref('revenue')) : null),
    },
    { id: 'grossMargin', label: 'Margem bruta', section: 'Premissas', fmt: 'pct', scalar: true, values: sc(a.grossMargin) },
    { id: 'daPct', label: 'D&A % receita', section: 'Premissas', fmt: 'pct', scalar: true, values: sc(a.daPct) },
    { id: 'capexPct', label: 'Capex % receita', section: 'Premissas', fmt: 'pct', scalar: true, values: sc(a.capexPct) },
    { id: 'nwcPct', label: 'Capital de giro % receita', section: 'Premissas', fmt: 'pct', scalar: true, values: sc(a.nwcPct) },
    { id: 'taxRate', label: 'Alíquota de imposto', section: 'Premissas', fmt: 'pct', scalar: true, values: sc(a.taxRate) },

    // WACC
    { id: 'rf', label: 'Taxa livre de risco (UST 10a)', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.rf) },
    { id: 'beta', label: 'Beta', section: 'WACC', fmt: 'num', scalar: true, values: sc(a.beta) },
    { id: 'erp', label: 'Prêmio de risco (ERP)', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.erp) },
    { id: 'crp', label: 'Prêmio de risco-país', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.crp) },
    { id: 'keUsd', label: 'Custo do equity (USD)', section: 'WACC', fmt: 'pct', scalar: true, formula: () => add(add(S('rf'), mul(S('beta'), S('erp'))), S('crp')) },
    { id: 'inflLocal', label: 'Inflação moeda local', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.inflLocal) },
    { id: 'inflUS', label: 'Inflação EUA', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.inflUS) },
    {
      id: 'ke', label: 'Custo do equity (moeda local)', section: 'WACC', fmt: 'pct', scalar: true, bold: true,
      formula: () => sub(div(mul(add(num(1), S('keUsd')), add(num(1), S('inflLocal'))), add(num(1), S('inflUS'))), num(1)),
    },
    { id: 'kdUsd', label: 'Custo da dívida pré-IR (USD)', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.kdUsd) },
    {
      id: 'kd', label: 'Custo da dívida (moeda local)', section: 'WACC', fmt: 'pct', scalar: true,
      formula: () => sub(div(mul(add(num(1), S('kdUsd')), add(num(1), S('inflLocal'))), add(num(1), S('inflUS'))), num(1)),
    },
    { id: 'wd', label: 'Peso da dívida D/(D+E)', section: 'WACC', fmt: 'pct', scalar: true, values: sc(a.debtWeight) },
    {
      id: 'wacc', label: 'WACC', section: 'WACC', fmt: 'pct', scalar: true, bold: true,
      formula: () => add(mul(sub(num(1), S('wd')), S('ke')), mul(mul(S('wd'), S('kd')), sub(num(1), S('taxRate')))),
    },

    // DRE
    {
      id: 'revenue', label: 'Receita', section: 'DRE', fmt: 'money', bold: true, values: hist(f.is.revenue),
      formula: (col) => (isP(col) ? mul(ref('revenue', 'prev'), add(num(1), ref('growth'))) : null),
    },
    {
      id: 'cogs', label: 'CPV', section: 'DRE', fmt: 'money', values: hist(f.is.cogs, -1),
      formula: (col) => (isP(col) ? neg(mul(ref('revenue'), sub(num(1), S('grossMargin')))) : null),
    },
    {
      id: 'grossProfit', label: 'Lucro bruto', section: 'DRE', fmt: 'money', values: hist(gp),
      formula: (col) => (isP(col) ? add(ref('revenue'), ref('cogs')) : null),
    },
    {
      id: 'opex', label: 'Despesas operacionais (ex-D&A)', section: 'DRE', fmt: 'money',
      formula: () => sub(ref('ebitda'), ref('grossProfit')),
    },
    {
      id: 'ebitda', label: 'EBITDA', section: 'DRE', fmt: 'money', bold: true, values: hist(ebitda),
      formula: (col) => (isP(col) ? mul(ref('revenue'), ref('ebitdaMargin')) : null),
    },
    {
      id: 'da', label: 'D&A', section: 'DRE', fmt: 'money', values: hist(daHist.map((x) => (x == null ? null : Math.abs(x))), -1),
      formula: (col) => (isP(col) ? neg(mul(ref('revenue'), S('daPct'))) : null),
    },
    { id: 'ebit', label: 'EBIT', section: 'DRE', fmt: 'money', bold: true, formula: () => add(ref('ebitda'), ref('da')) },
    { id: 'taxes', label: 'Impostos sobre EBIT', section: 'DRE', fmt: 'money', formula: () => neg(mul(ref('ebit'), S('taxRate'))) },
    { id: 'nopat', label: 'NOPAT', section: 'DRE', fmt: 'money', bold: true, formula: () => add(ref('ebit'), ref('taxes')) },

    // Balanço
    {
      id: 'nwc', label: 'Capital de giro operacional', section: 'Balanço', fmt: 'money', values: hist(nwcSeries(c)),
      formula: (col) => (isP(col) ? mul(ref('revenue'), S('nwcPct')) : null),
      note: 'Contas a receber + estoques − fornecedores',
    },
    {
      id: 'ppe', label: 'Imobilizado líquido', section: 'Balanço', fmt: 'money', values: hist(f.bs.ppe),
      formula: (col) => (isP(col) ? add(sub(ref('ppe', 'prev'), ref('capex')), ref('da')) : null),
      note: 'Projetado: anterior + capex − D&A',
    },
    { id: 'cash', label: 'Caixa e aplicações', section: 'Balanço', fmt: 'money', values: hist(zeroLast(f.bs.cash)) },
    { id: 'debt', label: 'Dívida total', section: 'Balanço', fmt: 'money', values: hist(zeroLast(f.bs.totalDebt)), note: 'Sem dado no último ano = 0' },
    { id: 'bookEquity', label: 'Patrimônio líquido', section: 'Balanço', fmt: 'money', values: hist(f.bs.equity) },
    { id: 'totalAssets', label: 'Ativo total', section: 'Balanço', fmt: 'money', values: hist(f.bs.totalAssets) },

    // Fluxo de caixa
    { id: 'cfNopat', label: 'NOPAT', section: 'Fluxo de caixa', fmt: 'money', formula: () => ref('nopat') },
    { id: 'cfDa', label: '(+) D&A', section: 'Fluxo de caixa', fmt: 'money', formula: () => neg(ref('da')) },
    {
      id: 'dNwc', label: '(−) Δ Capital de giro', section: 'Fluxo de caixa', fmt: 'money',
      formula: (col) => (col > 0 ? neg(sub(ref('nwc'), ref('nwc', 'prev'))) : null),
    },
    {
      id: 'capex', label: '(−) Capex', section: 'Fluxo de caixa', fmt: 'money', values: hist(f.cf.capex.map((x) => (x == null ? null : -Math.abs(x)))),
      formula: (col) => (isP(col) ? neg(mul(ref('revenue'), S('capexPct'))) : null),
    },
    {
      id: 'fcf', label: 'Fluxo de caixa livre (FCFF)', section: 'Fluxo de caixa', fmt: 'money', bold: true,
      formula: (col) => (col > 0 ? add(add(add(ref('cfNopat'), ref('cfDa')), ref('dNwc')), ref('capex')) : null),
    },
    { id: 'fcfReported', label: 'FCF reportado (CFO − capex)', section: 'Fluxo de caixa', fmt: 'money', values: hist(f.cf.fcf), note: 'Referência histórica' },

    // DCF
    { id: 't', label: 'Período (anos)', section: 'DCF', fmt: 'num', values: proj(Array.from({ length: PROJ_YEARS }, (_, i) => i + 1)) },
    {
      id: 'df', label: 'Fator de desconto', section: 'DCF', fmt: 'factor',
      formula: (col) => (isP(col) ? div(num(1), pow(add(num(1), S('wacc')), ref('t'))) : null),
    },
    { id: 'pvFcf', label: 'VP do FCFF', section: 'DCF', fmt: 'money', formula: (col) => (isP(col) ? mul(ref('fcf'), ref('df')) : null) },
    { id: 'sumPv', label: 'Soma VP dos FCFF', section: 'DCF', fmt: 'money', scalar: true, formula: () => sumRow('pvFcf', P0, PN) },
    { id: 'g', label: 'Crescimento na perpetuidade (g)', section: 'DCF', fmt: 'pct', scalar: true, values: sc(a.g) },
    {
      id: 'tvGordon', label: 'Valor terminal — Gordon', section: 'DCF', fmt: 'money', scalar: true,
      formula: () => div(mul(ref('fcf', PN), add(num(1), S('g'))), sub(S('wacc'), S('g'))),
    },
    { id: 'exitMultiple', label: 'Múltiplo de saída EV/EBITDA', section: 'DCF', fmt: 'x', scalar: true, values: sc(a.exitMultiple) },
    { id: 'tvExit', label: 'Valor terminal — múltiplo', section: 'DCF', fmt: 'money', scalar: true, formula: () => mul(ref('ebitda', PN), S('exitMultiple')) },
    { id: 'tvWeight', label: 'Peso Gordon no VT', section: 'DCF', fmt: 'pct', scalar: true, values: sc(a.tvWeightGordon) },
    {
      id: 'tv', label: 'Valor terminal', section: 'DCF', fmt: 'money', scalar: true,
      formula: () => add(mul(S('tvWeight'), S('tvGordon')), mul(sub(num(1), S('tvWeight')), S('tvExit'))),
    },
    { id: 'pvTv', label: 'VP do valor terminal', section: 'DCF', fmt: 'money', scalar: true, formula: () => mul(S('tv'), ref('df', PN)) },
    { id: 'ev', label: 'Enterprise value', section: 'DCF', fmt: 'money', scalar: true, bold: true, formula: () => add(S('sumPv'), S('pvTv')) },
    { id: 'netDebt', label: '(−) Dívida líquida', section: 'DCF', fmt: 'money', scalar: true, formula: () => sub(ref('debt', H - 1), ref('cash', H - 1)) },
    { id: 'equityValue', label: 'Equity value', section: 'DCF', fmt: 'money', scalar: true, bold: true, formula: () => sub(S('ev'), S('netDebt')) },
    { id: 'fx', label: 'Câmbio (moeda DF → cotação)', section: 'DCF', fmt: 'factor', scalar: true, values: sc(a.fx) },
    { id: 'shares', label: 'Ações (implícitas no market cap)', section: 'DCF', fmt: 'money', scalar: true, values: sc(a.shares) },
    {
      id: 'valuePerShare', label: 'Valor por ação', section: 'DCF', fmt: 'price', scalar: true, bold: true,
      formula: () => div(mul(S('equityValue'), S('fx')), S('shares')),
    },
    { id: 'price', label: 'Preço atual', section: 'DCF', fmt: 'price', scalar: true, values: sc(a.price) },
    { id: 'upside', label: 'Upside / downside', section: 'DCF', fmt: 'pct', scalar: true, bold: true, formula: () => sub(div(S('valuePerShare'), S('price')), num(1)) },
    { id: 'tvShare', label: 'VT como % do EV', section: 'DCF', fmt: 'pct', scalar: true, formula: () => div(S('pvTv'), S('ev')) },
  ]
  return { columns: cols, rows }
}

export function runDcf(c: Company, a: DcfAssumptions): Evaluated {
  return evaluate(buildDcfSheet(c, a))
}

/** Edição de uma célula de entrada → novas premissas */
const SCALAR_KEYS: Record<string, keyof DcfAssumptions> = {
  grossMargin: 'grossMargin', daPct: 'daPct', capexPct: 'capexPct', nwcPct: 'nwcPct', taxRate: 'taxRate',
  rf: 'rf', beta: 'beta', erp: 'erp', crp: 'crp', inflLocal: 'inflLocal', inflUS: 'inflUS', kdUsd: 'kdUsd',
  wd: 'debtWeight', g: 'g', exitMultiple: 'exitMultiple', tvWeight: 'tvWeightGordon', fx: 'fx', shares: 'shares', price: 'price',
}

export function isEditable(rowId: string, col: number, histCols: number): boolean {
  if (rowId in SCALAR_KEYS) return col === 0
  return (rowId === 'growth' || rowId === 'ebitdaMargin') && col >= histCols
}

export function applyEdit(a: DcfAssumptions, rowId: string, col: number, histCols: number, value: number): DcfAssumptions {
  if (rowId === 'growth' || rowId === 'ebitdaMargin') {
    const arr = [...a[rowId]]
    arr[col - histCols] = value
    return { ...a, [rowId]: arr }
  }
  const k = SCALAR_KEYS[rowId]
  return k ? { ...a, [k]: value } : a
}

/** Tabela de sensibilidade WACC × g (valor por ação) */
export function sensitivity(c: Company, a: DcfAssumptions, steps = [-0.01, -0.005, 0, 0.005, 0.01]) {
  const base = runDcf(c, a)
  const wacc0 = base.get('wacc')!
  const out: { wacc: number; g: number; value: number | null }[][] = []
  for (const dw of steps) {
    const row: { wacc: number; g: number; value: number | null }[] = []
    for (const dg of steps) {
      // desloca o WACC via custo do equity em USD (ajuste no ERP) preservando a estrutura
      const target = wacc0 + dw
      const g = a.g + dg
      const ev = runWithWacc(c, { ...a, g }, target)
      row.push({ wacc: target, g, value: g < target ? ev : null })
    }
    out.push(row)
  }
  return out
}

function runWithWacc(c: Company, a: DcfAssumptions, target: number): number | null {
  // WACC é linear no ERP (via ke) — resolve por secante (2 avaliações bastam)
  const w = (erp: number) => runDcf(c, { ...a, erp }).get('wacc')!
  const w0 = w(a.erp)
  const w1 = w(a.erp + 0.01)
  const slope = (w1 - w0) / 0.01
  if (!slope) return null
  const erp = a.erp + (target - w0) / slope
  return runDcf(c, { ...a, erp }).get('valuePerShare')
}
