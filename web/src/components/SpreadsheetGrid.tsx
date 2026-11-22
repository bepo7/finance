import { useEffect, useRef, useState } from 'react'
import { colLetter, excelRowIndex, formulaA1, formulaLabel, type Evaluated } from '../lib/finance/sheet'
import { cellText, parseInput } from '../lib/format'

interface Props {
  ev: Evaluated
  section: string
  histCols: number
  editable: (rowId: string, col: number) => boolean
  onEdit: (rowId: string, col: number, value: number) => void
}

/** Grade estilo planilha: azul = entrada editável, branco = fórmula, cinza = histórico */
export function SpreadsheetGrid({ ev, section, histCols, editable, onEdit }: Props) {
  const { sheet } = ev
  const rows = sheet.rows.filter((r) => r.section === section)
  const scalarOnly = rows.every((r) => r.scalar)
  const cols = scalarOnly ? [{ label: 'Valor', hist: false }] : sheet.columns
  const [sel, setSel] = useState<{ row: string; col: number } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing !== null) inputRef.current?.select()
  }, [editing])

  const rowIndex = excelRowIndex(sheet)
  const selCell = sel ? ev.cell(sel.row, sel.col) : null
  const selRow = sel ? sheet.rows.find((r) => r.id === sel.row) : null
  const formula = selCell?.expr ? formulaLabel(sheet, selCell.expr, sel!.col) : null
  const a1 = selCell?.expr ? formulaA1(sheet, selCell.expr, sel!.col, rowIndex) : null

  const commit = (rowId: string, col: number, text: string, fmt: Parameters<typeof parseInput>[1]) => {
    const v = parseInput(text, fmt)
    if (v !== null) onEdit(rowId, col, v)
    setEditing(null)
  }

  const move = (rowId: string, col: number, dRow: number, dCol: number) => {
    const i = rows.findIndex((r) => r.id === rowId)
    const nr = rows[Math.min(rows.length - 1, Math.max(0, i + dRow))]
    const maxCol = nr.scalar ? 0 : cols.length - 1
    setSel({ row: nr.id, col: Math.min(maxCol, Math.max(0, col + dCol)) })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0b0d14]">
      {/* barra de fórmulas */}
      <div className="flex min-h-11 items-center gap-3 border-b border-line px-3 py-2 text-xs">
        <span className="num w-12 shrink-0 rounded bg-panel px-2 py-1 text-center text-muted">
          {sel ? `${colLetter(sel.col + 1)}${rowIndex.get(sel.row)}` : '—'}
        </span>
        <span className="num text-royal italic">fx</span>
        <span className="num truncate text-[#cfd3e3]" title={a1 ?? undefined}>
          {sel
            ? formula ?? (selCell?.kind === 'input' ? `${cellText(selCell.value, selRow!.fmt)}  · entrada — clique duas vezes ou Enter para editar` : `${cellText(selCell?.value ?? null, selRow!.fmt)} · dado histórico`)
            : 'Selecione uma célula para ver a fórmula'}
        </span>
        {a1 && <span className="num ml-auto hidden shrink-0 text-muted md:inline">{a1}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="num w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-muted">
              <th className="sticky left-0 z-10 min-w-56 bg-[#0b0d14] px-3 py-2 text-left font-normal">{section}</th>
              {cols.map((c, i) => (
                <th key={i} className={`min-w-24 px-3 py-2 text-right font-normal ${!scalarOnly && i === histCols ? 'border-l border-royal/50' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line/50">
                <th scope="row" className={`sticky left-0 z-10 bg-[#0b0d14] px-3 py-1.5 text-left font-normal ${r.bold ? 'font-semibold text-white' : 'text-[#b6bbcd]'}`} title={r.note}>
                  {r.label}
                  {r.note && <span className="ml-1 text-muted">ⓘ</span>}
                </th>
                {cols.map((_, col) => {
                  if (r.scalar && col > 0) return <td key={col} />
                  const c = ev.cell(r.id, col)
                  const key = `${r.id}@${col}`
                  const isSel = sel?.row === r.id && sel.col === col
                  const canEdit = editable(r.id, col)
                  const color = canEdit ? 'text-[#7da2ff]' : c.kind === 'hist' ? 'text-[#9aa0b4]' : 'text-white'
                  const neg = c.value != null && c.value < 0 && r.fmt !== 'money' ? 'text-down' : ''
                  return (
                    <td key={col} className={`p-0 text-right ${!scalarOnly && col === histCols ? 'border-l border-royal/50' : ''} ${col >= histCols && !scalarOnly ? 'bg-royal/[0.04]' : ''}`}>
                      {editing === key ? (
                        <input
                          ref={inputRef}
                          defaultValue={c.value == null ? '' : r.fmt === 'pct' ? (c.value * 100).toFixed(2) + '%' : String(+c.value.toPrecision(8))}
                          aria-label={`${r.label} ${cols[col].label}`}
                          className="num w-full bg-white px-3 py-1.5 text-right text-ink outline-none"
                          onBlur={(e) => commit(r.id, col, e.currentTarget.value, r.fmt)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit(r.id, col, e.currentTarget.value, r.fmt)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSel({ row: r.id, col })}
                          onDoubleClick={() => canEdit && setEditing(key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canEdit) setEditing(key)
                            const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]
                            if (d) {
                              e.preventDefault()
                              move(r.id, col, d[0], d[1])
                            }
                          }}
                          ref={(b) => {
                            if (isSel && b && document.activeElement !== b && document.activeElement?.tagName !== 'INPUT') b.focus()
                          }}
                          aria-label={`${r.label} ${cols[col].label}: ${cellText(c.value, r.fmt) || 'vazio'}${canEdit ? ' (editável)' : ''}`}
                          className={`w-full px-3 py-1.5 text-right transition ${color} ${neg} ${r.bold ? 'font-semibold' : ''} ${isSel ? 'outline-2 -outline-offset-2 outline-royal' : 'hover:bg-white/5'} ${canEdit ? 'underline decoration-dotted decoration-[#7da2ff]/40 underline-offset-4' : ''}`}
                        >
                          {cellText(c.value, r.fmt) || <span className="text-line">·</span>}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
