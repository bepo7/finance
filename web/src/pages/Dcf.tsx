import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Chart } from '../components/Chart'
import { AXIS, SEG_COLOR, TOOLTIP, type ChartOption } from '../components/chartTheme'
import { SpreadsheetGrid } from '../components/SpreadsheetGrid'
import { Disclaimer, Flag, Kpi, Loading, Mark, Panel, SectionTitle, Segmented } from '../components/ui'
import { loadCompany, loadMacro, loadUniverse, useAsync } from '../lib/data'
import { exportDcfXlsx } from '../lib/excel'
import { applyEdit, defaultAssumptions, isEditable, runDcf, SECTIONS, sensitivity, type DcfAssumptions } from '../lib/finance/dcf'
import type { Company, Macro, Segment, UniverseEntry } from '../lib/finance/types'
import { compact, CUR_SYMBOL, money, pct } from '../lib/format'

const SEG_LABEL: Record<Segment | 'all', string> = { all: 'Todos', semis: 'Semicondutores', ai: 'IA & Cloud', software: 'Software & Internet' }

export default function Dcf() {
  const { slug = 'NVDA' } = useParams()
  const uni = useAsync(loadUniverse, [])
  const macro = useAsync(loadMacro, [])
  const company = useAsync(() => loadCompany(slug), [slug])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <SectionTitle
        kicker="Projeto 01 · DCF valuation model"
        sub="Escolha uma empresa. As premissas iniciais vêm do histórico e do cenário macro; células em azul são editáveis e todo o modelo recalcula na hora. Clique numa célula para ver a fórmula."
      >
        Construa o <Mark>DCF</Mark> do zero: DRE, balanço e fluxo de caixa até o valor por ação.
      </SectionTitle>
      {uni.data ? <Picker companies={uni.data.companies} current={slug} /> : <Loading error={uni.error} />}
      {company.data && macro.data ? (
        <Model key={slug} c={company.data} macro={macro.data} entry={uni.data?.companies.find((x) => x.slug === slug)} />
      ) : (
        <Loading error={company.error ?? macro.error} />
      )}
      <Disclaimer>
        Premissas automáticas são ponto de partida, não opinião. Beta ajustado (Blume), custo de capital em USD convertido para a moeda local pela paridade de
        inflação (Fisher), prêmio de risco-país do Damodaran para empresas brasileiras.
      </Disclaimer>
    </div>
  )
}

function Picker({ companies, current }: { companies: UniverseEntry[]; current: string }) {
  const nav = useNavigate()
  const [seg, setSeg] = useState<Segment | 'all'>('all')
  const [country, setCountry] = useState<'all' | 'BR' | 'US'>('all')
  const list = companies.filter((c) => (seg === 'all' || c.segment === seg) && (country === 'all' || c.country === country))
  return (
    <div className="mb-8">
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented label="Segmento" value={seg} onChange={setSeg} options={(['all', 'semis', 'ai', 'software'] as const).map((v) => ({ value: v, label: SEG_LABEL[v] }))} />
        <Segmented label="País" value={country} onChange={setCountry} options={[{ value: 'all', label: 'BR + EUA' }, { value: 'BR', label: 'Brasil' }, { value: 'US', label: 'EUA' }]} />
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8">
        {list.map((c) => {
          const first = c.spark[0]
          const lastP = c.spark.at(-1)!
          const ch = first ? lastP / first - 1 : 0
          return (
            <button
              key={c.slug}
              onClick={() => nav(`/dcf/${c.slug}`)}
              aria-pressed={c.slug === current}
              title={c.name}
              className={`min-w-28 shrink-0 snap-start rounded-lg border px-3 py-2 text-left transition sm:min-w-0 ${c.slug === current ? 'border-royal bg-royal/15' : 'border-line bg-panel hover:border-muted'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="num truncate text-sm font-semibold text-white">{c.ticker.replace('.SA', '')}</span>
                <Flag country={c.country} />
              </div>
              <Spark data={c.spark} color={ch >= 0 ? '#2bd99f' : '#ff5a6a'} />
              <div className={`num text-[10px] ${ch >= 0 ? 'text-up' : 'text-down'}`}>{pct(ch, 0)} 12m</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - lo) / (hi - lo || 1)) * 26}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="my-1 h-6 w-full" aria-hidden preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Model({ c, macro, entry }: { c: Company; macro: Macro; entry?: UniverseEntry }) {
  const name = c.profile.longName ?? c.ticker
  if (c.bank || entry?.bank)
    return (
      <Panel>
        <h3 className="text-lg font-semibold text-white">{name} é uma instituição financeira</h3>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Para bancos e fintechs com balanço de crédito, dívida é matéria-prima e não fonte de financiamento — o FCFF não faz sentido. O padrão de mercado é
          avaliar por P/L, P/VPA ou modelo de dividendos (FCFE). Escolha outra empresa para o DCF.
        </p>
      </Panel>
    )
  if (!c.financials || !entry?.hasFinancials) return <Panel>Sem demonstrações financeiras suficientes para {name}.</Panel>
  return <ModelInner c={c} macro={macro} name={name} />
}

function ModelInner({ c, macro, name }: { c: Company; macro: Macro; name: string }) {
  const defaults = useMemo(() => defaultAssumptions(c, macro), [c, macro])
  const [a, setA] = useState<DcfAssumptions>(defaults)
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('DRE')
  const ev = useMemo(() => runDcf(c, a), [c, a])
  const sens = useMemo(() => sensitivity(c, a), [c, a])
  const H = c.financials!.years.length
  const finCur = c.profile.financialCurrency ?? c.profile.currency ?? 'USD'
  const quoteCur = c.profile.currency ?? finCur
  const vps = ev.get('valuePerShare')
  const up = ev.get('upside')
  const changed = JSON.stringify(a) !== JSON.stringify(defaults)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flag country={c.country} />
            <span className="num text-xs text-muted">
              {c.ticker} · {c.chain} · demonstrações em {finCur}
              {finCur !== quoteCur ? `, cotação em ${quoteCur}` : ''}
            </span>
          </div>
          <h3 className="mt-1 text-2xl font-semibold text-white">{name}</h3>
        </div>
        <div className="no-print flex gap-2">
          {changed && (
            <button onClick={() => setA(defaults)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-white">
              Restaurar premissas
            </button>
          )}
          <button
            onClick={() =>
              exportDcfXlsx(ev, {
                ticker: c.ticker,
                name,
                currency: finCur,
                asOf: c.asOf,
                sources: Object.values(macro.sources).concat('Yahoo Finance (yfinance) — demonstrações e preços'),
              })
            }
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream"
          >
            Exportar Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Valor por ação" value={money(vps, quoteCur)} tone="gold" />
        <Kpi label="Preço atual" value={money(a.price, quoteCur)} />
        <Kpi label="Upside / downside" value={pct(up)} tone={up == null ? 'default' : up >= 0 ? 'up' : 'down'} />
        <Kpi label="WACC" value={pct(ev.get('wacc'))} hint="Custo médio ponderado de capital na moeda das demonstrações" />
        <Kpi label="Enterprise value" value={compact(ev.get('ev'), CUR_SYMBOL[finCur] ?? finCur)} hint={`VT = ${pct(ev.get('tvShare'), 0)} do EV`} />
      </div>
      {vps != null && vps < 0 && (
        <p className="mb-4 rounded-lg border border-down/40 bg-down/10 px-4 py-2 text-sm text-[#ffb3ba]">
          Valor negativo: com estas premissas o fluxo de caixa livre projetado é negativo (EBITDA baixo ou capex alto). Ajuste margem, capex ou crescimento.
        </p>
      )}

      <div className="no-print mb-3 overflow-x-auto">
        <Segmented label="Aba do modelo" value={section} onChange={setSection} options={SECTIONS.map((s) => ({ value: s, label: s }))} />
      </div>
      <SpreadsheetGrid
        key={section}
        ev={ev}
        section={section}
        histCols={H}
        editable={(row, col) => isEditable(row, col, H)}
        onEdit={(row, col, v) => setA((prev) => applyEdit(prev, row, col, H, v))}
      />
      <p className="mt-2 text-xs text-muted">
        Valores em milhões de {finCur}. Colunas "A" = histórico; "E" = projeção. <span className="text-[#7da2ff]">Azul</span> = premissa editável (digite 12% ou 0,12).
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h4 className="mb-2 text-sm font-semibold text-white">Receita e crescimento</h4>
          <Chart option={revenueOption(ev, H)} height={300} ariaLabel="Receita histórica e projetada com crescimento anual" />
        </Panel>
        <Panel>
          <h4 className="mb-2 text-sm font-semibold text-white">Do fluxo de caixa ao equity value</h4>
          <Chart option={bridgeOption(ev)} height={300} ariaLabel="Ponte de valor: VP dos fluxos, VP do valor terminal, EV, dívida líquida, equity" />
        </Panel>
      </div>

      <Panel className="mt-6">
        <h4 className="mb-1 text-sm font-semibold text-white">Sensibilidade do valor por ação — WACC × crescimento na perpetuidade</h4>
        <p className="mb-3 text-xs text-muted">Verde = acima do preço atual; vermelho = abaixo.</p>
        <div className="overflow-x-auto">
          <table className="num w-full text-center text-sm">
            <thead>
              <tr className="text-muted">
                <th className="p-2 text-left text-xs font-normal">WACC ↓ / g →</th>
                {sens[0].map((x, i) => (
                  <th key={i} className="p-2 font-normal">
                    {pct(x.g)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sens.map((row, i) => (
                <tr key={i}>
                  <th className="p-2 text-left font-normal text-muted">{pct(row[0].wacc)}</th>
                  {row.map((x, j) => {
                    const r = x.value != null ? x.value / a.price - 1 : null
                    const bg = r == null ? 'transparent' : r >= 0 ? `rgba(43,217,159,${Math.min(0.45, 0.08 + r * 0.4)})` : `rgba(255,90,106,${Math.min(0.45, 0.08 - r * 0.4)})`
                    return (
                      <td key={j} className={`p-2 ${i === 2 && j === 2 ? 'ring-2 ring-gold ring-inset' : ''}`} style={{ background: bg }}>
                        {x.value == null ? 'n/a' : x.value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6">
        <h4 className="mb-2 text-sm font-semibold text-white">Preço histórico (5 anos)</h4>
        <Chart option={priceOption(c, a.price, vps)} height={260} ariaLabel="Preço histórico com valor justo estimado" />
      </Panel>
    </>
  )
}

function revenueOption(ev: ReturnType<typeof runDcf>, H: number): ChartOption {
  const cols = ev.sheet.columns
  const rev = cols.map((_, i) => ev.get('revenue', i))
  const gr = cols.map((_, i) => ev.get('growth', i))
  return {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    tooltip: { ...TOOLTIP, trigger: 'axis', valueFormatter: (v: number) => compact(v) },
    xAxis: { type: 'category', data: cols.map((c) => c.label), ...AXIS },
    yAxis: { type: 'value', ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => compact(v) } },
    series: [
      {
        type: 'bar',
        data: rev.map((v, i) => ({ value: v, itemStyle: { color: i < H ? '#3a3f55' : '#ffffff' } })),
        barWidth: '55%',
        label: { show: true, position: 'top', color: '#8b90a5', fontSize: 10, formatter: (p: { dataIndex: number }) => (gr[p.dataIndex] != null ? pct(gr[p.dataIndex], 0) : '') },
      },
    ],
  }
}

function bridgeOption(ev: ReturnType<typeof runDcf>): ChartOption {
  const sumPv = ev.get('sumPv') ?? 0
  const pvTv = ev.get('pvTv') ?? 0
  const evv = ev.get('ev') ?? 0
  const nd = ev.get('netDebt') ?? 0
  const eq = ev.get('equityValue') ?? 0
  const steps = [
    { name: 'VP FCFF', base: 0, v: sumPv, color: '#3d8bff' },
    { name: 'VP valor terminal', base: sumPv, v: pvTv, color: '#7a5cff' },
    { name: 'Enterprise value', base: 0, v: evv, color: '#ffffff' },
    { name: nd >= 0 ? '(−) Dívida líq.' : '(+) Caixa líq.', base: Math.min(evv, eq), v: Math.abs(nd), color: nd >= 0 ? '#ff5a6a' : '#2bd99f' },
    { name: 'Equity value', base: 0, v: eq, color: '#f6c744' },
  ]
  return {
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    tooltip: { ...TOOLTIP, trigger: 'axis', formatter: (p: { dataIndex: number }[]) => `${steps[p[1]?.dataIndex ?? 0].name}: ${compact(steps[p[1]?.dataIndex ?? 0].v)}` },
    xAxis: { type: 'category', data: steps.map((s) => s.name), ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => compact(v) } },
    series: [
      { type: 'bar', stack: 'w', data: steps.map((s) => s.base), itemStyle: { color: 'transparent' }, silent: true },
      { type: 'bar', stack: 'w', data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.color } })), barWidth: '50%' },
    ],
  }
}

function priceOption(c: Company, price: number, fair: number | null): ChartOption {
  return {
    grid: { left: 50, right: 70, top: 20, bottom: 30 },
    tooltip: { ...TOOLTIP, trigger: 'axis' },
    xAxis: { type: 'category', data: c.prices.dates, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v: string) => v.slice(0, 7) } },
    yAxis: { type: 'value', scale: true, ...AXIS },
    series: [
      {
        type: 'line',
        data: c.prices.close,
        showSymbol: false,
        lineStyle: { color: SEG_COLOR[c.segment], width: 1.5 },
        areaStyle: { color: SEG_COLOR[c.segment], opacity: 0.06 },
        markLine:
          fair != null && fair > 0
            ? {
                symbol: 'none',
                data: [
                  { yAxis: fair, label: { formatter: 'valor DCF', color: '#f6c744' }, lineStyle: { color: '#f6c744', type: 'dashed' } },
                  { yAxis: price, label: { formatter: 'preço', color: '#8b90a5' }, lineStyle: { color: '#8b90a5', type: 'dotted' } },
                ],
              }
            : undefined,
      },
    ],
  }
}
