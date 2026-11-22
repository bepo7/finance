/**
 * Mini motor de planilha: cada linha tem valores (entradas) ou uma fórmula.
 * A mesma fórmula é (1) avaliada aqui, (2) exibida com rótulos na barra de
 * fórmulas e (3) exportada em notação A1 para o Excel.
 */

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'ref'; row: string; col: ColRef }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { k: 'neg'; a: Expr }
  | { k: 'sum'; row: string; from: number; to: number }

/** 'same' = mesma coluna; 'prev' = coluna anterior; number = coluna absoluta; 'scalar' = célula única da linha */
export type ColRef = 'same' | 'prev' | 'scalar' | number

export type RowKind = 'input' | 'calc' | 'hist' | 'header'
export type Fmt = 'money' | 'pct' | 'x' | 'num' | 'price' | 'factor'

export interface RowDef {
  id: string
  label: string
  section: string
  fmt: Fmt
  /** linhas escalares ocupam só a primeira coluna de dados */
  scalar?: boolean
  /** valor fixo (entrada) por coluna; undefined = sem valor */
  values?: (number | null)[]
  /** fórmula por coluna (índice) — sobrescreve values naquela coluna */
  formula?: (col: number) => Expr | null
  bold?: boolean
  note?: string
}

export interface Sheet {
  columns: { label: string; hist: boolean }[]
  rows: RowDef[]
}

export interface Evaluated {
  sheet: Sheet
  get(row: string, col?: number): number | null
  cell(row: string, col: number): { value: number | null; kind: RowKind; expr: Expr | null }
}

// ---------- construtores ----------
export const num = (v: number): Expr => ({ k: 'num', v })
export const ref = (row: string, col: ColRef = 'same'): Expr => ({ k: 'ref', row, col })
export const S = (row: string): Expr => ref(row, 'scalar')
const bin = (op: '+' | '-' | '*' | '/' | '^') => (a: Expr, b: Expr): Expr => ({ k: 'bin', op, a, b })
export const add = bin('+')
export const sub = bin('-')
export const mul = bin('*')
export const div = bin('/')
export const pow = bin('^')
export const neg = (a: Expr): Expr => ({ k: 'neg', a })
export const sumRow = (row: string, from: number, to: number): Expr => ({ k: 'sum', row, from, to })

// ---------- avaliação ----------
export function evaluate(sheet: Sheet): Evaluated {
  const byId = new Map(sheet.rows.map((r) => [r.id, r]))
  const cache = new Map<string, number | null>()
  const visiting = new Set<string>()

  const exprAt = (r: RowDef, col: number): Expr | null => {
    if (r.scalar && col !== 0) return null
    return r.formula ? r.formula(col) : null
  }

  const resolveCol = (c: ColRef, cur: number): number =>
    c === 'same' ? cur : c === 'prev' ? cur - 1 : c === 'scalar' ? 0 : c

  const get = (rowId: string, col = 0): number | null => {
    const r = byId.get(rowId)
    if (!r) throw new Error(`linha inexistente: ${rowId}`)
    if (r.scalar) col = 0
    if (col < 0 || col >= sheet.columns.length) return null
    const key = `${rowId}@${col}`
    if (cache.has(key)) return cache.get(key)!
    if (visiting.has(key)) throw new Error(`referência circular em ${key}`)
    visiting.add(key)
    const e = exprAt(r, col)
    const v = e ? ev(e, col) : (r.values?.[col] ?? null)
    visiting.delete(key)
    const out = v === null || !Number.isFinite(v) ? null : v
    cache.set(key, out)
    return out
  }

  const ev = (e: Expr, col: number): number | null => {
    switch (e.k) {
      case 'num':
        return e.v
      case 'ref':
        return get(e.row, resolveCol(e.col, col))
      case 'neg': {
        const a = ev(e.a, col)
        return a === null ? null : -a
      }
      case 'sum': {
        let s = 0
        for (let c = e.from; c <= e.to; c++) s += get(e.row, c) ?? 0
        return s
      }
      case 'bin': {
        const a = ev(e.a, col)
        const b = ev(e.b, col)
        if (a === null || b === null) return null
        switch (e.op) {
          case '+':
            return a + b
          case '-':
            return a - b
          case '*':
            return a * b
          case '/':
            return b === 0 ? null : a / b
          case '^':
            return a ** b
        }
      }
    }
  }

  return {
    sheet,
    get,
    cell(row, col) {
      const r = byId.get(row)!
      const expr = exprAt(r, col)
      const kind: RowKind = expr
        ? 'calc'
        : r.scalar
          ? 'input'
          : sheet.columns[col]?.hist
            ? 'hist'
            : r.values?.[col] != null
              ? 'input'
              : 'calc'
      return { value: get(row, col), kind, expr }
    },
  }
}

// ---------- renderização ----------
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

function render(e: Expr, col: number, refText: (row: string, col: number) => string, parentPrec = 0): string {
  const rc = (c: ColRef) => (c === 'same' ? col : c === 'prev' ? col - 1 : c === 'scalar' ? 0 : c)
  switch (e.k) {
    case 'num':
      return String(+e.v.toPrecision(10))
    case 'ref':
      return refText(e.row, rc(e.col))
    case 'neg':
      return `-${render(e.a, col, refText, 3)}`
    case 'sum':
      return `SUM(${refText(e.row, e.from)}:${refText(e.row, e.to)})`
    case 'bin': {
      const p = PREC[e.op]
      // '-' e '/' não são associativos à direita: força parênteses no lado direito
      const s = `${render(e.a, col, refText, p)}${e.op}${render(e.b, col, refText, e.op === '-' || e.op === '/' || e.op === '^' ? p + 1 : p)}`
      return p < parentPrec ? `(${s})` : s
    }
  }
}

/** Texto legível para a barra de fórmulas, ex.: =Receita[2027]×Margem EBITDA[2027] */
export function formulaLabel(sheet: Sheet, e: Expr, col: number): string {
  const byId = new Map(sheet.rows.map((r) => [r.id, r]))
  const txt = render(
    e,
    col,
    (row, c) => {
      const r = byId.get(row)!
      return r.scalar ? `[${r.label}]` : `[${r.label} ${sheet.columns[c]?.label ?? '?'}]`
    },
  )
  return '=' + txt.replaceAll('*', ' × ').replaceAll('/', ' ÷ ').replaceAll('+', ' + ').replace(/(?<=[\])\d])-/g, ' − ')
}

/** Notação A1. A coluna A é o rótulo; dados começam em B. rowIndex = linha do Excel (1-based). */
export function formulaA1(sheet: Sheet, e: Expr, col: number, rowIndex: Map<string, number>): string {
  return (
    '=' +
    render(
      e,
      col,
      (row, c) => {
        const r = sheet.rows.find((x) => x.id === row)!
        const cc = r.scalar ? 0 : c
        return `${colLetter(cc + 1)}${rowIndex.get(row)}`
      },
    )
  )
}

export function colLetter(i: number): string {
  let s = ''
  i += 1
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

/**
 * Linha no Excel exportado: 1 = título, 2 = cabeçalho de colunas,
 * depois cada seção ganha uma linha de título antes das suas linhas.
 */
export function excelRowIndex(sheet: Sheet): Map<string, number> {
  const out = new Map<string, number>()
  let idx = 2
  let section = ''
  for (const r of sheet.rows) {
    if (r.section !== section) {
      section = r.section
      idx++
    }
    out.set(r.id, ++idx)
  }
  return out
}
