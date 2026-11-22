import { normal, percentileSorted, rng } from './stats'

export interface McParams {
  initial: number
  /** aporte mensal */
  monthly: number
  years: number
  paths: number
  /** 'gbm' usa μ/σ anuais; 'bootstrap' reamostra retornos mensais históricos */
  method: 'gbm' | 'bootstrap'
  /** retorno log anual esperado (gbm) */
  mu: number
  /** volatilidade anual (gbm) */
  sigma: number
  /** retornos log mensais históricos da carteira (bootstrap) */
  history?: number[]
  seed: number
  /** quantas trajetórias completas devolver para desenhar */
  samplePaths: number
}

export interface McResult {
  months: number
  /** percentis por mês: p5, p25, p50, p75, p95 */
  bands: Record<'p5' | 'p25' | 'p50' | 'p75' | 'p95', number[]>
  meanPath: number[]
  invested: number[]
  /** valores finais ordenados */
  finals: Float64Array
  sample: number[][]
  /** percentil final de cada trajetória amostrada (para colorir) */
  sampleRank: number[]
  stats: {
    p5: number
    p50: number
    p95: number
    mean: number
    invested: number
    probLoss: number
    /** VaR e CVaR (5%) do valor final vs. investido */
    var5: number
    cvar5: number
  }
}

export function simulate(p: McParams): McResult {
  const months = Math.round(p.years * 12)
  const u = rng(p.seed)
  const z = normal(u)
  const dtMu = p.mu / 12
  const dtSig = p.sigma / Math.sqrt(12)
  // ajuste de Itô: μ aqui é o retorno log esperado, então não subtraímos σ²/2
  const hist = p.history?.length ? p.history : null
  const useBoot = p.method === 'bootstrap' && hist

  const grid = new Float64Array(p.paths * (months + 1))
  const keep = Math.min(p.samplePaths, p.paths)
  const sample: number[][] = []

  for (let i = 0; i < p.paths; i++) {
    let v = p.initial
    const off = i * (months + 1)
    grid[off] = v
    for (let m = 1; m <= months; m++) {
      const r = useBoot ? hist[Math.floor(u() * hist.length)] : dtMu + dtSig * z()
      v = v * Math.exp(r) + p.monthly
      grid[off + m] = v
    }
    if (i < keep) sample.push(Array.from(grid.subarray(off, off + months + 1)))
  }

  const bands = { p5: [] as number[], p25: [] as number[], p50: [] as number[], p75: [] as number[], p95: [] as number[] }
  const meanPath: number[] = []
  const invested: number[] = []
  const col = new Float64Array(p.paths)
  for (let m = 0; m <= months; m++) {
    let s = 0
    for (let i = 0; i < p.paths; i++) {
      col[i] = grid[i * (months + 1) + m]
      s += col[i]
    }
    col.sort()
    bands.p5.push(percentileSorted(col, 0.05))
    bands.p25.push(percentileSorted(col, 0.25))
    bands.p50.push(percentileSorted(col, 0.5))
    bands.p75.push(percentileSorted(col, 0.75))
    bands.p95.push(percentileSorted(col, 0.95))
    meanPath.push(s / p.paths)
    invested.push(p.initial + p.monthly * m)
  }

  const finals = new Float64Array(p.paths)
  for (let i = 0; i < p.paths; i++) finals[i] = grid[i * (months + 1) + months]
  finals.sort()
  const inv = invested[months]
  let losses = 0
  for (const f of finals) if (f < inv) losses++
  const var5 = inv - percentileSorted(finals, 0.05)
  const tailN = Math.max(1, Math.floor(p.paths * 0.05))
  let tail = 0
  for (let i = 0; i < tailN; i++) tail += finals[i]
  const cvar5 = inv - tail / tailN

  const rankOf = (v: number) => {
    let lo = 0
    let hi = finals.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (finals[mid] < v) lo = mid + 1
      else hi = mid
    }
    return lo / finals.length
  }

  return {
    months,
    bands,
    meanPath,
    invested,
    finals,
    sample,
    sampleRank: sample.map((s) => rankOf(s[months])),
    stats: {
      p5: percentileSorted(finals, 0.05),
      p50: percentileSorted(finals, 0.5),
      p95: percentileSorted(finals, 0.95),
      mean: meanPath[months],
      invested: inv,
      probLoss: losses / p.paths,
      var5,
      cvar5,
    },
  }
}

export function histogram(sorted: ArrayLike<number>, bins: number, lo?: number, hi?: number) {
  const a = lo ?? sorted[0]
  const b = hi ?? sorted[sorted.length - 1]
  const w = (b - a) / bins || 1
  const counts = new Array(bins).fill(0)
  for (let i = 0; i < sorted.length; i++) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor((sorted[i] - a) / w)))
    counts[k]++
  }
  return counts.map((n, i) => ({ from: a + i * w, to: a + (i + 1) * w, n }))
}

/**
 * Série mensal de uma carteira a partir de preços diários.
 * prices[k] = { dates, close } já convertidos para a moeda base.
 * Rebalanceamento mensal para os pesos-alvo. Retorna retornos log mensais.
 */
export function portfolioMonthlyLogReturns(series: { dates: string[]; close: number[] }[], weights: number[]): { months: string[]; returns: number[] } {
  const monthly = series.map((s) => {
    const m = new Map<string, number>()
    s.dates.forEach((d, i) => m.set(d.slice(0, 7), s.close[i])) // último fechamento do mês
    return m
  })
  const common = [...monthly[0].keys()].filter((k) => monthly.every((m) => m.has(k))).sort()
  const wsum = weights.reduce((a, b) => a + b, 0) || 1
  const w = weights.map((x) => x / wsum)
  const returns: number[] = []
  for (let i = 1; i < common.length; i++) {
    let r = 0
    for (let j = 0; j < series.length; j++) r += w[j] * (monthly[j].get(common[i])! / monthly[j].get(common[i - 1])! - 1)
    returns.push(Math.log(1 + r))
  }
  return { months: common.slice(1), returns }
}
