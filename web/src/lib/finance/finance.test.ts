import { describe, expect, it } from 'vitest'
import { applyEdit, buildDcfSheet, defaultAssumptions, runDcf, sensitivity, type DcfAssumptions } from './dcf'
import { add, colLetter, div, evaluate, excelRowIndex, formulaA1, formulaLabel, mul, num, ref, S, sub, type Sheet } from './sheet'
import { histogram, portfolioMonthlyLogReturns, simulate } from './montecarlo'
import { linreg, mean, percentileSorted, std } from './stats'
import type { Company, Macro } from './types'

const macro: Macro = {
  asOf: '2026-11-22',
  us10y: { date: '2026-11-19', value: 0.04 },
  selic: null,
  ipcaFocus: { date: '2026-11-13', byYear: { '2026': 0.05, '2027': 0.04 }, longRun: 0.04 },
  usInflationLongRun: 0.025,
  damodaran: { updated: '2026-01-01', matureErp: 0.0423, usErp: 0.05, brazilCrp: 0.03, brazilTotalErp: 0.08, brazilRating: 'Ba1', source: '' },
  usdbrl: null,
  toUsd: { USD: 1, BRL: 0.2 },
  sources: {},
}

function makeCompany(over: Partial<Company> = {}): Company {
  const y = [2022, 2023, 2024]
  const n = (xs: number[]) => xs as (number | null)[]
  return {
    ticker: 'TEST',
    country: 'US',
    segment: 'semis',
    chain: 'Design',
    asOf: '2026-11-22',
    profile: { currency: 'USD', financialCurrency: 'USD', marketCap: 1000, price: 10, beta: 1, totalDebt: 100, totalCash: 50 },
    prices: { dates: [], close: [] },
    financials: {
      years: y,
      fiscalYearEnd: y.map((x) => `${x}-12-31`),
      is: {
        revenue: n([800, 900, 1000]),
        cogs: n([400, 450, 500]),
        grossProfit: n([400, 450, 500]),
        opex: n([200, 200, 200]),
        ebit: n([160, 200, 250]),
        ebitda: n([200, 245, 300]),
        da: n([40, 45, 50]),
        interestExpense: n([5, 5, 5]),
        pretaxIncome: n([155, 195, 245]),
        tax: n([31, 39, 49]),
        netIncome: n([124, 156, 196]),
      },
      bs: {
        totalAssets: n([1000, 1100, 1200]),
        totalLiabilities: n([500, 500, 500]),
        equity: n([500, 600, 700]),
        cash: n([40, 45, 50]),
        receivables: n([80, 90, 100]),
        inventory: n([40, 45, 50]),
        currentAssets: n([200, 220, 250]),
        payables: n([40, 45, 50]),
        currentLiabilities: n([100, 110, 120]),
        ppe: n([300, 320, 340]),
        totalDebt: n([100, 100, 100]),
      },
      cf: {
        cfo: n([150, 180, 220]),
        capex: n([-60, -65, -70]),
        da: n([40, 45, 50]),
        changeNwc: n([-5, -5, -5]),
        fcf: n([90, 115, 150]),
      },
    },
    ...over,
  }
}

const simple: DcfAssumptions = {
  growth: [0.1, 0.1, 0.1, 0.1, 0.1],
  ebitdaMargin: [0.3, 0.3, 0.3, 0.3, 0.3],
  grossMargin: 0.5,
  daPct: 0.05,
  capexPct: 0.07,
  nwcPct: 0.1,
  taxRate: 0.2,
  rf: 0.04,
  beta: 1,
  erp: 0.05,
  crp: 0,
  inflLocal: 0.025,
  inflUS: 0.025,
  kdUsd: 0.05,
  debtWeight: 0.1,
  g: 0.03,
  exitMultiple: 10,
  tvWeightGordon: 1,
  fx: 1,
  shares: 100,
  price: 10,
}

/** Avaliador A1 independente (simula o Excel) */
function evalA1(sheet: Sheet, valueAt: (row: string, col: number) => number | null) {
  const rowIndex = excelRowIndex(sheet)
  const byRow = new Map([...rowIndex].map(([id, i]) => [i, id]))
  const cells = new Map<string, number | null>()
  const colIdx = (letters: string) => [...letters].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 2
  const lookup = (a1: string): number => {
    if (cells.has(a1)) return cells.get(a1)!
    const m = /^([A-Z]+)(\d+)$/.exec(a1)!
    const id = byRow.get(+m[2])!
    const col = colIdx(m[1])
    const r = sheet.rows.find((x) => x.id === id)!
    const e = r.formula?.(col)
    let v: number | null
    if (e && (!r.scalar || col === 0)) {
      let f = formulaA1(sheet, e, col, rowIndex).slice(1)
      f = f.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2) => {
        const out: string[] = []
        for (let c = colIdx(c1); c <= colIdx(c2); c++) out.push(`(${lookup(`${colLetter(c + 1)}${r1}`) ?? 0})`)
        return `(${out.join('+')})`
      })
      f = f.replace(/[A-Z]+\d+/g, (ref) => `(${lookup(ref)})`).replaceAll('^', '**')
      v = f.includes('null') ? null : (Function(`return ${f}`)() as number)
    } else v = valueAt(id, col)
    cells.set(a1, v)
    return v as number
  }
  return (row: string, col: number) => lookup(`${colLetter(col + 1)}${rowIndex.get(row)}`)
}

describe('motor de planilha', () => {
  const sheet: Sheet = {
    columns: [
      { label: '2024', hist: true },
      { label: '2025', hist: false },
    ],
    rows: [
      { id: 'rate', label: 'Taxa', section: 's', fmt: 'pct', scalar: true, values: [0.1] },
      { id: 'a', label: 'A', section: 's', fmt: 'num', values: [100, null], formula: (c) => (c > 0 ? mul(ref('a', 'prev'), add(num(1), S('rate'))) : null) },
      { id: 'b', label: 'B', section: 's', fmt: 'num', formula: () => sub(ref('a'), div(ref('a'), num(4))) },
    ],
  }
  it('avalia referências relativas, escalares e precedência', () => {
    const e = evaluate(sheet)
    expect(e.get('a', 1)).toBeCloseTo(110)
    expect(e.get('b', 1)).toBeCloseTo(82.5)
  })
  it('gera A1 e rótulos legíveis', () => {
    const rowIndex = new Map(sheet.rows.map((r, i) => [r.id, i + 2]))
    expect(formulaA1(sheet, sheet.rows[1].formula!(1)!, 1, rowIndex)).toBe('=B3*(1+B2)')
    expect(formulaA1(sheet, sheet.rows[2].formula!(1)!, 1, rowIndex)).toBe('=C3-C3/4')
    expect(formulaLabel(sheet, sheet.rows[1].formula!(1)!, 1)).toContain('[A 2024]')
  })
  it('subtração encadeada mantém parênteses à direita', () => {
    const s2: Sheet = { columns: [{ label: 'x', hist: false }], rows: [{ id: 'x', label: 'x', section: 's', fmt: 'num', formula: () => sub(num(10), sub(num(4), num(3))) }] }
    expect(evaluate(s2).get('x')).toBe(9)
    expect(formulaA1(s2, s2.rows[0].formula!(0)!, 0, new Map([['x', 2]]))).toBe('=10-(4-3)')
  })
  it('detecta referência circular', () => {
    const s3: Sheet = { columns: [{ label: 'x', hist: false }], rows: [{ id: 'x', label: 'x', section: 's', fmt: 'num', formula: () => ref('x') }] }
    expect(() => evaluate(s3).get('x')).toThrow(/circular/)
  })
})

describe('DCF', () => {
  const c = makeCompany()

  it('bate com cálculo feito à mão', () => {
    const e = runDcf(c, simple)
    // WACC: ke = 4% + 1×5% = 9%; kd = 5%; 0.9×9% + 0.1×5%×0.8 = 8.5%
    expect(e.get('wacc')).toBeCloseTo(0.085, 10)

    let rev = 1000
    let nwcPrev = 100 // 100 + 50 − 50 no último ano histórico
    let sumPv = 0
    let lastFcf = 0
    for (let t = 1; t <= 5; t++) {
      rev *= 1.1
      const ebitda = rev * 0.3
      const ebit = ebitda - rev * 0.05
      const nopat = ebit * 0.8
      const nwc = rev * 0.1
      const fcf = nopat + rev * 0.05 - (nwc - nwcPrev) - rev * 0.07
      nwcPrev = nwc
      sumPv += fcf / 1.085 ** t
      lastFcf = fcf
    }
    const tv = (lastFcf * 1.03) / (0.085 - 0.03)
    const ev = sumPv + tv / 1.085 ** 5
    expect(e.get('sumPv')).toBeCloseTo(sumPv, 6)
    expect(e.get('ev')).toBeCloseTo(ev, 6)
    expect(e.get('equityValue')).toBeCloseTo(ev - 50, 6) // dívida 100 − caixa 50
    expect(e.get('valuePerShare')).toBeCloseTo((ev - 50) / 100, 6)
  })

  it('fórmulas exportadas (A1) dão o mesmo resultado que o site', () => {
    const sheet = buildDcfSheet(c, { ...simple, tvWeightGordon: 0.6 })
    const e = evaluate(sheet)
    const xl = evalA1(sheet, (row, col) => sheet.rows.find((r) => r.id === row)!.values?.[col] ?? null)
    for (const r of sheet.rows) {
      const n = r.scalar ? 1 : sheet.columns.length
      for (let col = 0; col < n; col++) {
        const a = e.get(r.id, col)
        const b = xl(r.id, col)
        if (a === null) expect(b === null || !Number.isFinite(b)).toBe(true)
        else expect(b).toBeCloseTo(a, 6)
      }
    }
  })

  it('premissas padrão são finitas e usam prêmio-país e Fisher para empresa BR', () => {
    const br = makeCompany({ country: 'BR', profile: { ...makeCompany().profile, currency: 'BRL', financialCurrency: 'BRL' } })
    const a = defaultAssumptions(br, macro)
    expect(a.crp).toBe(0.03)
    expect(a.beta).toBeCloseTo(1) // Blume: 0,67×1 + 0,33
    expect(a.inflLocal).toBeCloseTo(0.045)
    const e = runDcf(br, a)
    expect(e.get('ke')!).toBeGreaterThan(e.get('keUsd')!)
    expect(Number.isFinite(e.get('valuePerShare')!)).toBe(true)
  })

  it('converte moeda das demonstrações para a de cotação', () => {
    const adr = makeCompany({ profile: { ...makeCompany().profile, currency: 'USD', financialCurrency: 'BRL' } })
    expect(defaultAssumptions(adr, macro).fx).toBeCloseTo(0.2)
  })

  it('edição de célula altera só a premissa certa', () => {
    const a2 = applyEdit(simple, 'growth', 4, 3, 0.2)
    expect(a2.growth).toEqual([0.1, 0.2, 0.1, 0.1, 0.1])
    expect(applyEdit(simple, 'wd', 0, 3, 0.3).debtWeight).toBe(0.3)
  })

  it('sensibilidade: valor cai com WACC maior e sobe com g maior', () => {
    const t = sensitivity(c, simple)
    expect(t[2][2].value).toBeCloseTo(runDcf(c, simple).get('valuePerShare')!, 6)
    expect(t[0][2].value!).toBeGreaterThan(t[4][2].value!)
    expect(t[2][4].value!).toBeGreaterThan(t[2][0].value!)
  })
})

describe('estatística e Monte Carlo', () => {
  it('percentil, média, desvio e regressão', () => {
    expect(percentileSorted([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentileSorted([0, 10], 0.25)).toBe(2.5)
    expect(mean([1, 2, 3])).toBe(2)
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
    const r = linreg([1, 2, 3, 4], [3, 5, 7, 9])
    expect(r.slope).toBeCloseTo(2)
    expect(r.r2).toBeCloseTo(1)
  })

  it('GBM: mediana converge para exp(μT) e é determinístico pela semente', () => {
    const p = { initial: 100, monthly: 0, years: 10, paths: 20000, method: 'gbm' as const, mu: 0.07, sigma: 0.2, seed: 42, samplePaths: 10 }
    const r = simulate(p)
    expect(r.stats.p50 / (100 * Math.exp(0.7))).toBeGreaterThan(0.97)
    expect(r.stats.p50 / (100 * Math.exp(0.7))).toBeLessThan(1.03)
    expect(r.bands.p5[60]).toBeLessThan(r.bands.p50[60])
    expect(r.bands.p50[60]).toBeLessThan(r.bands.p95[60])
    expect(simulate(p).stats.p50).toBe(r.stats.p50)
  })

  it('σ = 0 vira juros compostos com aportes', () => {
    const r = simulate({ initial: 1000, monthly: 100, years: 1, paths: 10, method: 'gbm', mu: 0, sigma: 0, seed: 1, samplePaths: 0 })
    expect(r.stats.p50).toBeCloseTo(2200)
    expect(r.stats.invested).toBe(2200)
  })

  it('bootstrap usa só retornos históricos', () => {
    const r = simulate({ initial: 100, monthly: 0, years: 1, paths: 100, method: 'bootstrap', mu: 0, sigma: 0, history: [Math.log(1.01)], seed: 3, samplePaths: 0 })
    expect(r.stats.p5).toBeCloseTo(100 * 1.01 ** 12)
  })

  it('histograma conta todos os pontos', () => {
    expect(histogram([1, 2, 3, 4, 5, 6], 3).reduce((a, b) => a + b.n, 0)).toBe(6)
  })

  it('carteira mensal rebalanceada', () => {
    const s1 = { dates: ['2024-01-31', '2024-02-29', '2024-03-29'], close: [100, 110, 121] }
    const s2 = { dates: ['2024-01-31', '2024-02-29', '2024-03-29'], close: [50, 50, 50] }
    const { returns } = portfolioMonthlyLogReturns([s1, s2], [1, 1])
    expect(returns.map(Math.exp)).toEqual([expect.closeTo(1.05), expect.closeTo(1.05)])
  })
})
