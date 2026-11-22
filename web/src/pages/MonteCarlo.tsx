import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from '../components/Chart'
import { AXIS, TOOLTIP, type ChartOption } from '../components/chartTheme'
import { Disclaimer, Flag, Kpi, Loading, Mark, Panel, SectionTitle, Segmented } from '../components/ui'
import { loadBenchmarks, loadCompany, loadUniverse, useAsync } from '../lib/data'
import { histogram, portfolioMonthlyLogReturns, type McParams, type McResult } from '../lib/finance/montecarlo'
import { mean, std } from '../lib/finance/stats'
import type { PriceSeries, UniverseEntry } from '../lib/finance/types'
import { compact, pct } from '../lib/format'

type Base = 'BRL' | 'USD'
interface Holding {
  key: string // slug da empresa ou ticker de benchmark
  label: string
  country: 'BR' | 'US'
  currency: string
  weight: number
}

const BENCH: Record<string, { label: string; currency: string; country: 'BR' | 'US' }> = {
  '^GSPC': { label: 'S&P 500', currency: 'USD', country: 'US' },
  '^IXIC': { label: 'Nasdaq', currency: 'USD', country: 'US' },
  SOXX: { label: 'SOXX (semis)', currency: 'USD', country: 'US' },
  '^BVSP': { label: 'Ibovespa', currency: 'BRL', country: 'BR' },
}

const DEFAULT: [string, number][] = [
  ['NVDA', 20],
  ['TSM', 15],
  ['MSFT', 15],
  ['ASML', 10],
  ['TOTS3_SA', 15],
  ['MELI', 10],
  ['^BVSP', 15],
]

export default function MonteCarlo() {
  const uni = useAsync(loadUniverse, [])
  const bench = useAsync(loadBenchmarks, [])
  if (!uni.data || !bench.data) return <Loading error={uni.error ?? bench.error} />
  return <Inner companies={uni.data.companies} bench={bench.data} />
}

function toHolding(key: string, weight: number, companies: UniverseEntry[]): Holding | null {
  if (BENCH[key]) return { key, weight, ...BENCH[key] }
  const c = companies.find((x) => x.slug === key)
  return c ? { key, weight, label: c.ticker.replace('.SA', ''), country: c.country, currency: c.currency ?? 'USD' } : null
}

/** Converte série de preços para a moeda base usando USD/BRL diário */
function convert(s: PriceSeries, from: string, base: Base, fx: Map<string, number>, fxDates: string[]): PriceSeries {
  if (from === base) return s
  let j = 0
  let lastFx = fx.get(fxDates[0])!
  const close = s.dates.map((d, i) => {
    while (j < fxDates.length && fxDates[j] <= d) lastFx = fx.get(fxDates[j++])!
    // BRL=X = BRL por 1 USD
    return from === 'USD' ? s.close[i] * lastFx : s.close[i] / lastFx
  })
  return { dates: s.dates, close }
}

function Inner({ companies, bench }: { companies: UniverseEntry[]; bench: Record<string, PriceSeries & { label: string }> }) {
  const [holdings, setHoldings] = useState<Holding[]>(() => DEFAULT.map(([k, w]) => toHolding(k, w, companies)).filter((h): h is Holding => !!h))
  const [base, setBase] = useState<Base>('BRL')
  const [initial, setInitial] = useState(100_000)
  const [monthly, setMonthly] = useState(1_000)
  const [years, setYears] = useState(10)
  const [paths, setPaths] = useState(5000)
  const [method, setMethod] = useState<'bootstrap' | 'gbm'>('bootstrap')
  const [muOverride, setMuOverride] = useState<number | null>(null)
  const [seed, setSeed] = useState(42)
  const [series, setSeries] = useState<Record<string, PriceSeries>>({})
  const [res, setRes] = useState<{ r: McResult; ms: number } | null>(null)
  const [running, setRunning] = useState(false)
  const worker = useRef<Worker | null>(null)
  const reqId = useRef(0)

  // carrega preços das empresas da carteira
  useEffect(() => {
    holdings.forEach((h) => {
      if (series[h.key]) return
      if (bench[h.key]) setSeries((s) => ({ ...s, [h.key]: bench[h.key] }))
      else loadCompany(h.key).then((c) => setSeries((s) => ({ ...s, [h.key]: c.prices })))
    })
  }, [holdings, bench, series])

  const fxSeries = bench['BRL=X']
  const fx = useMemo(() => new Map(fxSeries.dates.map((d, i) => [d, fxSeries.close[i]])), [fxSeries])

  const ready = holdings.length > 0 && holdings.every((h) => series[h.key])
  const port = useMemo(() => {
    if (!ready) return null
    const conv = holdings.map((h) => convert(series[h.key], h.currency, base, fx, fxSeries.dates))
    const { months, returns } = portfolioMonthlyLogReturns(conv, holdings.map((h) => h.weight))
    const m = mean(returns) * 12
    const s = std(returns) * Math.sqrt(12)
    return { months, returns, mu: m, sigma: s }
  }, [ready, holdings, series, base, fx, fxSeries.dates])

  const defaultMu = port ? Math.min(port.mu, 0.12) : 0.08
  const mu = muOverride ?? defaultMu

  useEffect(() => {
    worker.current = new Worker(new URL('../workers/mc.worker.ts', import.meta.url), { type: 'module' })
    worker.current.onmessage = (e: MessageEvent<{ id: number; result: McResult; ms: number }>) => {
      if (e.data.id !== reqId.current) return
      setRes({ r: e.data.result, ms: e.data.ms })
      setRunning(false)
    }
    return () => worker.current?.terminate()
  }, [])

  useEffect(() => {
    if (!port || !worker.current) return
    // bootstrap mantém forma/caudas do histórico; o drift é ajustado para μ escolhido
    const m = mean(port.returns)
    const history = port.returns.map((r) => r - m + mu / 12)
    const params: McParams = { initial, monthly, years, paths, method, mu, sigma: port.sigma, history, seed, samplePaths: 160 }
    const id = ++reqId.current
    setRunning(true)
    const t = setTimeout(() => worker.current!.postMessage({ id, params }), 120)
    return () => clearTimeout(t)
  }, [port, initial, monthly, years, paths, method, mu, seed])

  const totalW = holdings.reduce((a, h) => a + h.weight, 0)
  const sym = base === 'BRL' ? 'R$' : 'US$'
  const s = res?.r.stats

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <SectionTitle
        kicker="Projeto 02 · Monte Carlo simulation"
        sub="Monte uma carteira com ações de semis, IA e tech do Brasil e dos EUA. A simulação reamostra os retornos mensais reais da carteira (bootstrap) ou usa um movimento browniano geométrico, e roda num Web Worker para não travar a página."
      >
        Milhares de futuros possíveis para a sua <Mark>carteira</Mark>.
      </SectionTitle>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel className="h-fit">
          <h4 className="mb-3 text-sm font-semibold text-white">Carteira</h4>
          <ul className="space-y-2">
            {holdings.map((h, i) => (
              <li key={h.key} className="flex items-center gap-2">
                <Flag country={h.country} />
                <span className="num w-20 truncate text-sm text-white">{h.label}</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={h.weight}
                  aria-label={`Peso de ${h.label}`}
                  onChange={(e) => setHoldings((hs) => hs.map((x, j) => (j === i ? { ...x, weight: +e.target.value } : x)))}
                  className="flex-1 accent-royal"
                />
                <span className="num w-10 text-right text-xs text-muted">{totalW ? Math.round((h.weight / totalW) * 100) : 0}%</span>
                <button aria-label={`Remover ${h.label}`} onClick={() => setHoldings((hs) => hs.filter((_, j) => j !== i))} className="text-muted hover:text-down">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <select
            aria-label="Adicionar ativo"
            className="mt-3 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm"
            value=""
            onChange={(e) => {
              const h = toHolding(e.target.value, 10, companies)
              if (h && !holdings.some((x) => x.key === h.key)) setHoldings((hs) => [...hs, h])
            }}
          >
            <option value="">+ Adicionar ativo…</option>
            <optgroup label="Índices / ETFs">
              {Object.entries(BENCH).map(([k, b]) => (
                <option key={k} value={k}>
                  {b.label}
                </option>
              ))}
            </optgroup>
            {(['BR', 'US'] as const).map((ct) => (
              <optgroup key={ct} label={ct === 'BR' ? 'Brasil' : 'EUA'}>
                {companies
                  .filter((c) => c.country === ct)
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.ticker} — {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <div className="mt-5 space-y-3 text-sm">
            <Segmented label="Moeda base" value={base} onChange={setBase} options={[{ value: 'BRL', label: 'Reais (R$)' }, { value: 'USD', label: 'Dólares (US$)' }]} />
            <NumField label={`Valor inicial (${sym})`} value={initial} onChange={setInitial} step={10000} />
            <NumField label={`Aporte mensal (${sym})`} value={monthly} onChange={setMonthly} step={500} />
            <NumField label="Horizonte (anos)" value={years} onChange={(v) => setYears(Math.min(40, Math.max(1, v)))} step={1} />
            <NumField label="Trajetórias" value={paths} onChange={(v) => setPaths(Math.min(20000, Math.max(100, v)))} step={1000} />
            <Segmented
              label="Método"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'bootstrap', label: 'Bootstrap histórico' },
                { value: 'gbm', label: 'GBM (normal)' },
              ]}
            />
            <div>
              <label className="flex items-center justify-between text-xs text-muted">
                <span>Retorno esperado (log, a.a.)</span>
                <span className="num text-white">{pct(mu)}</span>
              </label>
              <input type="range" min={-0.05} max={0.3} step={0.005} value={mu} onChange={(e) => setMuOverride(+e.target.value)} className="w-full accent-gold" aria-label="Retorno esperado anual" />
              {port && (
                <p className="mt-1 text-[11px] text-muted">
                  Histórico 5a: μ {pct(port.mu)} · σ {pct(port.sigma)}. O padrão limita μ a 12% — cinco anos de tech não se repetem por garantia.
                </p>
              )}
            </div>
            <button onClick={() => setSeed((x) => x + 1)} className="w-full rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-white">
              Nova semente aleatória (atual: {seed})
            </button>
          </div>
        </Panel>

        <div className="min-w-0">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="P95" value={compact(s?.p95, sym)} tone="up" />
            <Kpi label="Mediana" value={compact(s?.p50, sym)} />
            <Kpi label="P5" value={compact(s?.p5, sym)} tone="gold" />
            <Kpi label="Média" value={compact(s?.mean, sym)} />
            <Kpi label="Total investido" value={compact(s?.invested, sym)} />
            <Kpi label="Prob. de perda" value={pct(s?.probLoss)} tone="down" hint="Valor final abaixo do total investido (nominal)" />
            <Kpi label="CVaR 5%" value={compact(s?.cvar5, sym)} tone="down" hint="Perda média vs. investido nos 5% piores cenários" />
          </div>
          <Panel className="relative">
            <div className="num mb-2 flex items-center justify-between text-[11px] tracking-[0.14em] text-muted uppercase">
              <span>
                Monte Carlo · {paths.toLocaleString('pt-BR')} trajetórias · {years} anos
              </span>
              <span>{running ? 'simulando…' : res ? `${res.ms.toFixed(0)} ms` : ''}</span>
            </div>
            {res ? <Chart option={fanOption(res.r, sym)} height={460} ariaLabel="Leque de trajetórias simuladas com histograma do valor final" /> : <Loading />}
          </Panel>
          {port && (
            <Panel className="mt-6">
              <h4 className="mb-2 text-sm font-semibold text-white">Backtest da carteira (rebalanceada mensalmente, em {base})</h4>
              <Chart option={backtestOption(port.months, port.returns, bench, base, fx, fxSeries.dates)} height={260} ariaLabel="Desempenho histórico da carteira contra índices" />
            </Panel>
          )}
        </div>
      </div>
      <Disclaimer>Simulação ilustrativa: retornos passados não garantem retornos futuros. Valores nominais, sem impostos nem custos.</Disclaimer>
    </div>
  )
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
        className="num mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white"
      />
    </label>
  )
}

function fanOption(r: McResult, sym: string): ChartOption {
  const x = Array.from({ length: r.months + 1 }, (_, m) => +(m / 12).toFixed(2))
  const hue = (rank: number) => `hsla(${rank * 230}, 85%, 58%, 0.28)`
  const hiY = r.bands.p95[r.months] * 1.15
  // histograma alinhado ao eixo do leque: faixas iguais de 0 até o topo do gráfico
  const bins = histogram(r.finals.filter((v) => v <= hiY), 40, 0, hiY)
  return {
    grid: [
      { left: 64, right: '24%', top: 16, bottom: 36 },
      { left: '78%', right: 10, top: 16, bottom: 36 },
    ],
    tooltip: { ...TOOLTIP, trigger: 'axis', valueFormatter: (v: number) => compact(v, sym) },
    xAxis: [
      { type: 'category', data: x, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 11, formatter: (v: string) => `${Math.round(+v)}a` }, boundaryGap: false, gridIndex: 0 },
      { type: 'value', gridIndex: 1, show: false },
    ],
    yAxis: [
      { type: 'value', ...AXIS, max: hiY, min: 0, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => compact(v, sym) }, gridIndex: 0 },
      { type: 'category', gridIndex: 1, data: bins.map((_, i) => i), show: false },
    ],
    series: [
      ...r.sample.map((p, i) => ({
        type: 'line',
        data: p,
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { width: 0.8, color: hue(r.sampleRank[i]) },
        animationDuration: 1400,
        xAxisIndex: 0,
        yAxisIndex: 0,
      })),
      { name: 'P95', type: 'line', data: r.bands.p95, showSymbol: false, lineStyle: { color: '#2bd99f', width: 1.5, type: 'dashed' } },
      { name: 'Mediana', type: 'line', data: r.bands.p50, showSymbol: false, lineStyle: { color: '#fff', width: 2.5 } },
      { name: 'P5', type: 'line', data: r.bands.p5, showSymbol: false, lineStyle: { color: '#ff5a6a', width: 1.5, type: 'dashed' } },
      { name: 'Investido', type: 'line', data: r.invested, showSymbol: false, lineStyle: { color: '#8b90a5', width: 1, type: 'dotted' } },
      {
        name: 'Distribuição final',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        barCategoryGap: '12%',
        tooltip: { show: false },
        data: bins.map((b, i) => ({ value: b.n, itemStyle: { color: `hsl(${(i / bins.length) * 230}, 80%, 58%)` } })),
      },
    ],
  }
}

function backtestOption(
  months: string[],
  returns: number[],
  bench: Record<string, PriceSeries & { label: string }>,
  base: Base,
  fx: Map<string, number>,
  fxDates: string[],
): ChartOption {
  let v = 100
  const port = returns.map((r) => (v *= Math.exp(r)))
  const lines = ['^GSPC', '^BVSP']
    .map((k) => {
      const conv = convert(bench[k], BENCH[k].currency, base, fx, fxDates)
      const mm = new Map<string, number>()
      conv.dates.forEach((d, i) => mm.set(d.slice(0, 7), conv.close[i]))
      // base 100 no mês anterior ao primeiro retorno (mesma base da carteira)
      const prevKey = [...mm.keys()].filter((x) => x < months[0]).at(-1)
      const b0 = (prevKey && mm.get(prevKey)) || mm.get(months[0]) || 1
      return { name: BENCH[k].label, data: months.map((m) => ((mm.get(m) ?? NaN) / b0) * 100) }
    })
  return {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    legend: { textStyle: { color: '#8b90a5' }, top: 0 },
    tooltip: { ...TOOLTIP, trigger: 'axis', valueFormatter: (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '—') },
    xAxis: { type: 'category', data: months, ...AXIS },
    yAxis: { type: 'value', ...AXIS, scale: true },
    series: [
      { name: 'Carteira', type: 'line', data: port, showSymbol: false, itemStyle: { color: '#f6c744' }, lineStyle: { color: '#f6c744', width: 2 } },
      ...lines.map((l, i) => ({ ...l, type: 'line', showSymbol: false, itemStyle: { color: i ? '#2bd99f' : '#3d8bff' }, lineStyle: { color: i ? '#2bd99f' : '#3d8bff', width: 1.2 } })),
    ],
  }
}
