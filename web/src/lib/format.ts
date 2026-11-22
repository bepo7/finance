import type { Fmt } from './finance/sheet'

const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${nf(d).format(x * 100)}%`)

export function compact(x: number | null | undefined, cur = '') {
  if (x == null || !Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  const [v, s] = a >= 1e12 ? [x / 1e12, ' tri'] : a >= 1e9 ? [x / 1e9, ' bi'] : a >= 1e6 ? [x / 1e6, ' mi'] : a >= 1e3 ? [x / 1e3, ' mil'] : [x, '']
  return `${cur ? cur + ' ' : ''}${nf(a >= 1e3 ? 1 : 0).format(v)}${s}`
}

export const CUR_SYMBOL: Record<string, string> = { USD: 'US$', BRL: 'R$', EUR: '€', TWD: 'NT$' }
export const money = (x: number | null | undefined, cur = 'USD', d = 2) =>
  x == null || !Number.isFinite(x) ? '—' : `${CUR_SYMBOL[cur] ?? cur} ${nf(d).format(x)}`

/** Formato de planilha financeira: negativos entre parênteses, valores em milhões */
export function cellText(v: number | null, fmt: Fmt, unit = 1e6): string {
  if (v == null || !Number.isFinite(v)) return ''
  switch (fmt) {
    case 'pct':
      return pct(v)
    case 'x':
      return `${nf(1).format(v)}x`
    case 'factor':
      return nf(4).format(v)
    case 'price':
      return nf(2).format(v)
    case 'num':
      return nf(Number.isInteger(v) ? 0 : 2).format(v)
    case 'money': {
      const s = nf(0).format(Math.abs(v / unit))
      return v < 0 ? `(${s})` : s
    }
  }
}

/** Interpreta texto digitado: "12%", "12,5", "0.12", "1.234,5" */
export function parseInput(text: string, fmt: Fmt): number | null {
  let t = text.trim().replace(/\s/g, '')
  const isPct = t.endsWith('%')
  t = t.replace(/[%x]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const v = Number(t)
  if (!Number.isFinite(v)) return null
  if (fmt === 'pct') return isPct || Math.abs(v) > 1.5 ? v / 100 : v
  return v
}
