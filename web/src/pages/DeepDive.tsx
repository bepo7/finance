import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Chart } from '../components/Chart'
import { AXIS, SPECTRUM, TOOLTIP, type ChartOption } from '../components/chartTheme'
import { Disclaimer, Flag, Kpi, Loading, Mark, Panel, SectionTitle, Segmented } from '../components/ui'
import { INDUSTRIES, type Industry } from '../content/industries'
import { loadBenchmarks, loadMacro, loadUniverse, useAsync } from '../lib/data'
import type { Macro, PriceSeries, Segment, UniverseEntry } from '../lib/finance/types'
import { compact, pct } from '../lib/format'

const SEGS: Segment[] = ['semis', 'ai', 'software']

export default function DeepDive() {
  const { segment = 'semis' } = useParams()
  const seg = (SEGS.includes(segment as Segment) ? segment : 'semis') as Segment
  const nav = useNavigate()
  const uni = useAsync(loadUniverse, [])
  const macro = useAsync(loadMacro, [])
  const bench = useAsync(loadBenchmarks, [])
  const ind = INDUSTRIES[seg]

  return (
    <>
      <section className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <div className="num mb-4 text-[11px] tracking-[0.2em] text-white/70 uppercase">Projeto 03 · Industry deep dive</div>
          <Segmented label="Indústria" value={seg} onChange={(v) => nav(`/deep-dive/${v}`)} options={SEGS.map((s) => ({ value: s, label: INDUSTRIES[s].name }))} />
          <h1 className="mt-8 max-w-4xl text-3xl leading-tight font-semibold text-white md:text-5xl">
            <Mark>{ind.name}</Mark> — {ind.headline}
          </h1>
          <p className="mt-5 max-w-3xl text-white/80">{ind.why}</p>
        </div>
      </section>
      {uni.data && macro.data && bench.data ? (
        <Body key={seg} ind={ind} all={uni.data.companies} macro={macro.data} bench={bench.data} />
      ) : (
        <Loading error={uni.error ?? macro.error ?? bench.error} />
      )}
    </>
  )
}

interface Row extends UniverseEntry {
  mcapUsd: number | null
  revUsd: number | null
  niUsd: number | null
}

function Body({ ind, all, macro, bench }: { ind: Industry; all: UniverseEntry[]; macro: Macro; bench: Record<string, PriceSeries & { label: string }> }) {
  const rows: Row[] = useMemo(
    () =>
      all
        .filter((c) => c.segment === ind.segment)
        .map((c) => {
          const q = macro.toUsd[c.currency ?? 'USD'] ?? 1
          const f = macro.toUsd[c.financialCurrency ?? c.currency ?? 'USD'] ?? 1
          return {
            ...c,
            mcapUsd: c.marketCap != null ? c.marketCap * q : null,
            revUsd: c.revenue != null ? c.revenue * f : null,
            niUsd: c.netIncome != null ? c.netIncome * f : null,
          }
        }),
    [all, ind.segment, macro.toUsd],
  )
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
  const mcap = sum(rows.map((r) => r.mcapUsd))
  const rev = sum(rows.map((r) => r.revUsd))
  const ni = sum(rows.map((r) => r.niUsd))
  const brShare = sum(rows.filter((r) => r.country === 'BR').map((r) => r.mcapUsd)) / (mcap || 1)
  const chainColor = (key: string) => SPECTRUM[(ind.chain.findIndex((s) => s.key === key) * 3 + 6) % SPECTRUM.length]

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Empresas no universo" value={`${rows.length} (${rows.filter((r) => r.country === 'BR').length} BR)`} />
        <Kpi label="Market cap somado" value={compact(mcap, 'US$')} tone="gold" />
        <Kpi label="Receita (último ano)" value={compact(rev, 'US$')} />
        <Kpi label="Margem líquida agregada" value={pct(ni / (rev || 1))} />
        <Kpi label="Peso do Brasil (mkt cap)" value={pct(brShare, 2)} />
      </div>

      {/* 1. cadeia de valor */}
      <section className="mt-16">
        <SectionTitle kicker="01 · Cadeia de valor" sub="Como o dinheiro flui entre os elos — e quem fica com o lucro. Receita e lucro do último ano fiscal, convertidos para dólar.">
          Como a <Mark>cadeia de valor</Mark> funciona
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {ind.chain.map((s, i) => (
            <div key={s.key} className="relative rounded-lg border border-line bg-panel p-4">
              <div className="num text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: chainColor(s.key) }} />
                {s.title}
              </div>
              <p className="mt-2 text-xs text-muted">{s.text}</p>
              {s.outside && <p className="mt-2 text-[11px] text-muted/80 italic">{s.outside}</p>}
              <div className="num mt-3 flex flex-wrap gap-1">
                {rows
                  .filter((r) => r.chain === s.key)
                  .map((r) =>
                    r.bank ? (
                      <span key={r.slug} className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-muted" title={`${r.name} — instituição financeira, sem DCF`}>
                        {r.ticker.replace('.SA', '')}
                      </span>
                    ) : (
                      <Link key={r.slug} to={`/dcf/${r.slug}`} className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-white hover:bg-royal" title={`${r.name} — abrir DCF`}>
                        {r.ticker.replace('.SA', '')}
                      </Link>
                    ),
                  )}
              </div>
            </div>
          ))}
        </div>
        <Panel className="mt-6">
          <h4 className="mb-2 text-sm font-semibold text-white">Participação na receita × participação no lucro</h4>
          <Chart option={shareOption(ind, rows, chainColor)} height={200} ariaLabel="Divisão de receita e lucro entre elos da cadeia" />
          <p className="mt-2 text-xs text-muted">Elos com prejuízo somado aparecem com 0% do lucro. Clique nos tickers acima para abrir o DCF da empresa.</p>
        </Panel>
      </section>

      {/* 2. players */}
      <section className="mt-16">
        <SectionTitle kicker="02 · Major players" sub="Tamanho da bolha = valor de mercado em dólar. Eixo X = crescimento de receita (último trimestre a/a); eixo Y = margem operacional. Contorno dourado = Brasil.">
          Quem são os <Mark>major players</Mark>
        </SectionTitle>
        <Panel>
          <Chart option={playersOption(rows, chainColor)} height={440} ariaLabel="Gráfico de bolhas com crescimento, margem e valor de mercado das empresas" />
        </Panel>
        <PlayersTable rows={rows} />
      </section>

      {/* 3. desempenho */}
      <section className="mt-16">
        <SectionTitle kicker="03 · Desempenho" sub="Carteiras igualmente ponderadas, 12 meses, base 100 (amostragem semanal, em moeda local de cotação).">
          Como o mercado <Mark>precificou</Mark> o último ano
        </SectionTitle>
        <Panel>
          <Chart option={perfOption(rows, bench, ind.benchmark)} height={300} ariaLabel="Desempenho em 12 meses das empresas americanas e brasileiras do segmento contra o índice de referência" />
        </Panel>
      </section>

      {/* 4. regulação */}
      <section className="mt-16">
        <SectionTitle kicker="04 · Regulação" sub="Intensidade da pressão regulatória por tema: avaliação qualitativa do autor (0 = irrelevante, 5 = determinante para o valuation), não um índice oficial.">
          Como a <Mark>regulação</Mark> pesa
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Panel>
            <Chart option={radarOption(ind)} height={360} ariaLabel="Radar de pressão regulatória EUA versus Brasil" />
          </Panel>
          <ol className="space-y-3">
            {ind.regulations.map((r) => (
              <li key={r.title} className="rounded-lg border border-line bg-panel p-4">
                <div className="num flex items-center gap-2 text-[10px] tracking-wider text-muted uppercase">
                  <span className="rounded bg-ink px-1.5 py-0.5 text-white">{r.region}</span>
                  {r.year}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{r.title}</div>
                <p className="mt-1 text-xs text-muted">{r.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. mapa de conceitos */}
      <section className="mt-16">
        <SectionTitle kicker="05 · Vocabulário" sub="O que você precisa falar com fluência para parecer alguém que pertence à sala. Clique num conceito.">
          Fale como quem <Mark>conhece</Mark> a indústria
        </SectionTitle>
        <ConceptMap ind={ind} />
      </section>

      {/* 6. Brasil e o que acompanhar */}
      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-cream p-6 text-ink">
          <div className="num text-[10px] tracking-[0.2em] text-[#6b6f80] uppercase">06 · Brasil na cadeia</div>
          <p className="mt-3 text-[15px] leading-relaxed">{ind.brazil}</p>
        </div>
        <Panel>
          <div className="num text-[10px] tracking-[0.2em] text-muted uppercase">07 · O que acompanhar</div>
          <ul className="mt-3 space-y-2">
            {ind.watch.map((w) => (
              <li key={w} className="flex gap-2 text-sm text-white">
                <span className="text-gold">▸</span>
                {w}
              </li>
            ))}
          </ul>
        </Panel>
      </section>
      <Disclaimer>Classificação das empresas por elo é simplificada (empresas grandes atuam em vários).</Disclaimer>
    </div>
  )
}

function shareOption(ind: Industry, rows: Row[], color: (k: string) => string): ChartOption {
  const agg = ind.chain.map((s) => {
    const rs = rows.filter((r) => r.chain === s.key)
    return { key: s.key, rev: rs.reduce((a, r) => a + (r.revUsd ?? 0), 0), ni: Math.max(0, rs.reduce((a, r) => a + (r.niUsd ?? 0), 0)) }
  })
  const tr = agg.reduce((a, x) => a + x.rev, 0) || 1
  const tn = agg.reduce((a, x) => a + x.ni, 0) || 1
  return {
    grid: { left: 90, right: 20, top: 30, bottom: 10 },
    legend: { top: 0, textStyle: { color: '#8b90a5', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    tooltip: { ...TOOLTIP, trigger: 'item', valueFormatter: (v: number) => pct(v) },
    xAxis: { type: 'value', max: 1, show: false },
    yAxis: { type: 'category', data: ['Lucro', 'Receita'], ...AXIS, axisLine: { show: false } },
    series: agg.map((a) => ({
      name: a.key,
      type: 'bar',
      stack: 's',
      barWidth: 34,
      itemStyle: { color: color(a.key), borderColor: '#10121b', borderWidth: 2 },
      label: { show: true, color: '#0b0d17', fontSize: 11, fontWeight: 600, formatter: (p: { value: number }) => (p.value > 0.06 ? pct(p.value, 0) : '') },
      data: [a.ni / tn, a.rev / tr],
    })),
  }
}

function playersOption(rows: Row[], color: (k: string) => string): ChartOption {
  const pts = rows.filter((r) => r.revenueGrowth != null && r.operatingMargin != null && r.mcapUsd)
  const maxCap = Math.max(...pts.map((r) => r.mcapUsd!))
  const chains = [...new Set(pts.map((r) => r.chain))]
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 44 },
    legend: { top: 0, textStyle: { color: '#8b90a5', fontSize: 11 } },
    tooltip: {
      ...TOOLTIP,
      trigger: 'item',
      formatter: (p: { data: { r: Row } }) => {
        const r = p.data.r
        return `<b>${r.name}</b> (${r.ticker})<br/>Market cap: ${compact(r.mcapUsd, 'US$')}<br/>Cresc. receita: ${pct(r.revenueGrowth)}<br/>Margem operacional: ${pct(r.operatingMargin)}<br/>EV/EBITDA: ${r.evToEbitda?.toFixed(1) ?? '—'}x`
      },
    },
    xAxis: { type: 'value', name: 'crescimento da receita', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: '#8b90a5' }, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => pct(v, 0) } },
    yAxis: { type: 'value', name: 'margem operacional', nameTextStyle: { color: '#8b90a5' }, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => pct(v, 0) } },
    series: chains.map((ch) => ({
      name: ch,
      type: 'scatter',
      itemStyle: { color: color(ch) },
      data: pts
        .filter((r) => r.chain === ch)
        .map((r) => ({
          value: [r.revenueGrowth, r.operatingMargin],
          r,
          symbolSize: 10 + 70 * Math.sqrt(r.mcapUsd! / maxCap),
          itemStyle: { opacity: 0.8, borderColor: r.country === 'BR' ? '#f6c744' : 'rgba(255,255,255,.35)', borderWidth: r.country === 'BR' ? 3 : 1 },
          label: { show: true, formatter: r.ticker.replace('.SA', ''), color: '#fff', fontSize: 10, position: 'top' },
        })),
    })),
  }
}

function PlayersTable({ rows }: { rows: Row[] }) {
  const [key, setKey] = useState<'mcapUsd' | 'revenueGrowth' | 'operatingMargin' | 'evToEbitda' | 'trailingPE'>('mcapUsd')
  const sorted = [...rows].sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity))
  const cols: [typeof key, string, (r: Row) => string][] = [
    ['mcapUsd', 'Mkt cap (US$)', (r) => compact(r.mcapUsd)],
    ['revenueGrowth', 'Cresc. receita', (r) => pct(r.revenueGrowth)],
    ['operatingMargin', 'Margem oper.', (r) => pct(r.operatingMargin)],
    ['evToEbitda', 'EV/EBITDA', (r) => (r.evToEbitda != null ? `${r.evToEbitda.toFixed(1)}x` : '—')],
    ['trailingPE', 'P/L', (r) => (r.trailingPE != null ? `${r.trailingPE.toFixed(1)}x` : '—')],
  ]
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
      <table className="num w-full text-sm">
        <thead className="bg-panel text-xs text-muted">
          <tr>
            <th className="p-3 text-left font-normal">Empresa</th>
            <th className="p-3 text-left font-normal">Elo</th>
            {cols.map(([k, label]) => (
              <th key={k} className="p-3 text-right font-normal" aria-sort={key === k ? 'descending' : 'none'}>
                <button onClick={() => setKey(k)} className={key === k ? 'text-white' : 'hover:text-white'}>
                  {label}
                  {key === k ? ' ↓' : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.slug} className="border-t border-line/60">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <Flag country={r.country} />
                  <span className="text-white">{r.ticker.replace('.SA', '')}</span>
                  <span className="hidden truncate text-xs text-muted md:inline">{r.name}</span>
                </div>
              </td>
              <td className="p-3 text-xs text-muted">{r.chain}</td>
              {cols.map(([k, , f]) => (
                <td key={k} className="p-3 text-right text-[#cfd3e3]">
                  {f(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function perfOption(rows: Row[], bench: Record<string, PriceSeries & { label: string }>, bk: string): ChartOption {
  const idx = (series: number[][]) => {
    const n = Math.min(...series.map((s) => s.length))
    if (!Number.isFinite(n) || n < 2) return []
    return Array.from({ length: n }, (_, i) => (series.reduce((a, s) => a + s[s.length - n + i] / s[s.length - n], 0) / series.length) * 100)
  }
  const us = idx(rows.filter((r) => r.country === 'US' && r.spark.length > 10).map((r) => r.spark))
  const br = idx(rows.filter((r) => r.country === 'BR' && r.spark.length > 10).map((r) => r.spark))
  const b = bench[bk]
  const bs = idx([b.close.slice(-260).filter((_, i) => i % 5 === 0)])
  const n = Math.max(us.length, br.length, bs.length)
  return {
    grid: { left: 50, right: 20, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: '#8b90a5' } },
    tooltip: { ...TOOLTIP, trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(1) },
    xAxis: { type: 'category', data: Array.from({ length: n }, (_, i) => `sem ${i + 1}`), ...AXIS },
    yAxis: { type: 'value', scale: true, ...AXIS },
    series: [
      { name: 'Empresas EUA', type: 'line', data: us, showSymbol: false, lineStyle: { color: '#3d8bff', width: 2 } },
      { name: 'Empresas Brasil', type: 'line', data: br, showSymbol: false, lineStyle: { color: '#2bd99f', width: 2 } },
      { name: b.label, type: 'line', data: bs, showSymbol: false, lineStyle: { color: '#8b90a5', width: 1.2, type: 'dashed' } },
    ].filter((s) => s.data.length),
  }
}

function radarOption(ind: Industry): ChartOption {
  return {
    legend: { bottom: 0, textStyle: { color: '#8b90a5' } },
    tooltip: { ...TOOLTIP },
    radar: {
      indicator: ind.pressure.map((p) => ({ name: p.axis, max: 5 })),
      radius: '62%',
      axisName: { color: '#cfd3e3', fontSize: 11 },
      splitLine: { lineStyle: { color: '#232634' } },
      splitArea: { areaStyle: { color: ['#0b0d14', '#10121b'] } },
      axisLine: { lineStyle: { color: '#232634' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          { name: 'EUA', value: ind.pressure.map((p) => p.us), areaStyle: { color: 'rgba(61,139,255,.25)' }, lineStyle: { color: '#3d8bff' }, itemStyle: { color: '#3d8bff' } },
          { name: 'Brasil', value: ind.pressure.map((p) => p.br), areaStyle: { color: 'rgba(43,217,159,.2)' }, lineStyle: { color: '#2bd99f' }, itemStyle: { color: '#2bd99f' } },
        ],
      },
    ],
  }
}

function ConceptMap({ ind }: { ind: Industry }) {
  const [sel, setSel] = useState(ind.concepts[0].term)
  const option: ChartOption = useMemo(() => {
    const nodes = [
      { name: ind.hub, symbolSize: 86, itemStyle: { color: '#f6c744' }, label: { color: '#0b0d17', fontWeight: 800, fontSize: 14 } },
      ...ind.concepts.map((c) => ({
        name: c.term,
        symbolSize: c.term === sel ? 30 : 22,
        itemStyle: { color: c.term === sel ? '#ffffff' : '#1a2fb0', borderColor: '#7da2ff', borderWidth: 1.5 },
        label: { color: '#fff', fontSize: 11, position: 'right' as const },
      })),
    ]
    const terms = new Set(ind.concepts.map((c) => c.term))
    const links = [
      ...ind.concepts.map((c) => ({ source: ind.hub, target: c.term, lineStyle: { color: 'rgba(255,255,255,.35)' } })),
      ...ind.concepts.flatMap((c) => (c.links ?? []).filter((l) => terms.has(l)).map((l) => ({ source: c.term, target: l, lineStyle: { color: 'rgba(125,162,255,.25)', type: 'dashed' as const } }))),
    ]
    return {
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: false,
          draggable: true,
          force: { repulsion: 420, edgeLength: [90, 150], gravity: 0.08 },
          label: { show: true },
          data: nodes,
          links,
          emphasis: { focus: 'adjacency' },
        },
      ],
    }
  }, [ind, sel])
  const cur = ind.concepts.find((c) => c.term === sel)
  return (
    <div className="grid gap-6 overflow-hidden rounded-xl bg-royal-deep lg:grid-cols-[1.6fr_1fr]">
      <Chart option={option} height={460} onClick={(p) => p.name && p.name !== ind.hub && setSel(p.name)} ariaLabel={`Mapa de conceitos de ${ind.name}`} />
      <div className="p-6">
        <div className="num text-[10px] tracking-[0.2em] text-white/60 uppercase">Conceito</div>
        <h4 className="mt-1 text-2xl font-semibold text-white">{cur?.term}</h4>
        <p className="mt-3 text-white/85">{cur?.def}</p>
        {cur?.links && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cur.links.map((l) => (
              <button key={l} onClick={() => setSel(l)} className="rounded-full border border-white/30 px-3 py-1 text-xs text-white hover:bg-white/10">
                {l} →
              </button>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-1.5">
          {ind.concepts.map((c) => (
            <button key={c.term} onClick={() => setSel(c.term)} aria-pressed={c.term === sel} className={`rounded px-2 py-1 text-[11px] ${c.term === sel ? 'bg-white text-ink' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {c.term}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
