/** Gerador determinístico (mulberry32) — mesma semente, mesmos resultados */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normal padrão via Box–Muller */
export function normal(u: () => number) {
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let x = 0
    while (x === 0) x = u()
    const y = u()
    const r = Math.sqrt(-2 * Math.log(x))
    spare = r * Math.sin(2 * Math.PI * y)
    return r * Math.cos(2 * Math.PI * y)
  }
}

export const mean = (xs: ArrayLike<number>) => {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i]
  return xs.length ? s / xs.length : NaN
}

export function std(xs: ArrayLike<number>) {
  const m = mean(xs)
  let s = 0
  for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2
  return xs.length > 1 ? Math.sqrt(s / (xs.length - 1)) : NaN
}

/** Percentil com interpolação linear; `sorted` precisa estar em ordem crescente */
export function percentileSorted(sorted: ArrayLike<number>, p: number) {
  if (!sorted.length) return NaN
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function linreg(x: number[], y: number[]) {
  const n = x.length
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  const slope = sxx ? sxy / sxx : 0
  const intercept = my - slope * mx
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0
  return { slope, intercept, r2 }
}

/** Retornos logarítmicos de uma série de preços */
export function logReturns(px: number[]) {
  const out: number[] = []
  for (let i = 1; i < px.length; i++) if (px[i - 1] > 0 && px[i] > 0) out.push(Math.log(px[i] / px[i - 1]))
  return out
}
