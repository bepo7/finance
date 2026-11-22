import type { Evaluated } from './finance/sheet'
import { excelRowIndex, formulaA1 } from './finance/sheet'

const FMT: Record<string, string> = {
  pct: '0.0%',
  money: '#,##0,,;(#,##0,,)', // exibe em milhões
  x: '0.0"x"',
  factor: '0.0000',
  price: '#,##0.00',
  num: '0.00',
}

/** Exporta o modelo como .xlsx com fórmulas reais (mesmas que o site avalia) */
export async function exportDcfXlsx(ev: Evaluated, meta: { ticker: string; name: string; currency: string; asOf: string; sources: string[] }) {
  const XLSX = await import('xlsx')
  const { sheet } = ev
  const rowIndex = excelRowIndex(sheet)
  type Cell = { v?: string | number; f?: string; t?: string; z?: string }
  const aoa: (Cell | null)[][] = []

  aoa.push([{ v: `${meta.name} (${meta.ticker}) — DCF · ${meta.currency} milhões`, t: 's' }])
  aoa.push([{ v: 'Linha', t: 's' }, ...sheet.columns.map((c) => ({ v: c.label, t: 's' }))])
  let section = ''
  for (const r of sheet.rows) {
    if (r.section !== section) {
      section = r.section
      aoa[rowIndex.get(r.id)! - 2] = [{ v: section.toUpperCase(), t: 's' }]
    }
  }
  for (const r of sheet.rows) {
    const line = rowIndex.get(r.id)! - 1
    const row: (Cell | null)[] = [{ v: r.label, t: 's' }]
    const n = r.scalar ? 1 : sheet.columns.length
    for (let col = 0; col < n; col++) {
      const { value, expr } = ev.cell(r.id, col)
      const z = FMT[r.fmt]
      if (expr) row.push({ f: formulaA1(sheet, expr, col, rowIndex).slice(1), v: value ?? undefined, t: 'n', z })
      else if (value != null) row.push({ v: value, t: 'n', z })
      else row.push(null)
    }
    aoa[line] = row
  }

  const ws: Record<string, unknown> = {}
  let maxC = 0
  aoa.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      if (!cell) return
      ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = cell
      maxC = Math.max(maxC, ci)
    }),
  )
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: maxC } })
  ws['!cols'] = [{ wch: 36 }, ...sheet.columns.map(() => ({ wch: 12 }))]

  const notes = XLSX.utils.aoa_to_sheet([
    ['Gerado por FinanceLab'],
    ['Dados de', meta.asOf],
    ['Entradas: células com valor fixo; demais células são fórmulas.'],
    ['Valores monetários em unidades da moeda das demonstrações, exibidos em milhões.'],
    [],
    ['Fontes'],
    ...meta.sources.map((s) => [s]),
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws as never, 'Modelo')
  XLSX.utils.book_append_sheet(wb, notes, 'Notas')
  XLSX.writeFile(wb, `DCF_${meta.ticker.replace(/\W/g, '_')}_${meta.asOf}.xlsx`)
}
