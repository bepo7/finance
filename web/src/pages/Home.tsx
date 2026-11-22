import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { HeroFan } from '../components/HeroFan'
import { Disclaimer, Mark } from '../components/ui'
import { loadMacro, loadUniverse, useAsync } from '../lib/data'
import { pct } from '../lib/format'

const PROJECTS = [
  {
    n: '01',
    to: '/dcf',
    title: 'DCF Valuation Model',
    text: 'DRE, balanço e fluxo de caixa ligados por fórmulas. Projeção, WACC, valor terminal e valor por ação — com exportação para Excel.',
  },
  {
    n: '02',
    to: '/monte-carlo',
    title: 'Monte Carlo Simulation',
    text: 'Milhares de trajetórias para uma carteira de ações BR e EUA: faixas de percentis, distribuição final, VaR e probabilidade de perda.',
  },
  {
    n: '03',
    to: '/deep-dive',
    title: 'Industry Deep Dive',
    text: 'Semicondutores, infraestrutura de IA e software: cadeia de valor, quem fica com o lucro, principais players e regulação.',
  },
]

export default function Home() {
  const macro = useAsync(loadMacro, [])
  const uni = useAsync(loadUniverse, [])
  const m = macro.data
  const n = uni.data?.companies.length
  const nBR = uni.data?.companies.filter((c) => c.country === 'BR').length

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <HeroFan />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/60 to-ink" />
        <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-28 md:px-8 md:pt-36 md:pb-40">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl text-4xl leading-[1.15] font-semibold tracking-tight text-white md:text-6xl"
          >
            Três projetos para o seu <Mark>currículo</Mark> se destacar no mercado financeiro.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 max-w-2xl text-base text-muted md:text-lg">
            Valuation, risco e tese setorial em semicondutores, IA e tech — com {n ?? '…'} empresas do Brasil ({nBR ?? '…'}) e dos EUA, dados públicos e todo o
            cálculo rodando no seu navegador.
          </motion.p>
        </div>
      </section>

      <section className="bg-royal">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 md:grid-cols-3 md:px-8">
          {PROJECTS.map((p, i) => (
            <motion.div key={p.n} initial={{ opacity: 0, y: 24, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3 + i * 0.12 }}>
              <Link
                to={p.to}
                className="group block h-full rounded-xl bg-white p-6 text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.45)] transition hover:-translate-y-1"
              >
                <div className="num text-[10px] tracking-[0.2em] text-[#6b6f80] uppercase">Projeto</div>
                <div className="font-serif text-7xl leading-none italic">{p.n}</div>
                <div className="mt-4 inline-block text-xl font-semibold">
                  <span className="bg-[linear-gradient(transparent_62%,#f6c744_62%)] bg-no-repeat transition-[background-size] [background-size:0%_100%] group-hover:[background-size:100%_100%]">
                    {p.title}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#4a4e5e]">{p.text}</p>
                <div className="mt-6 text-sm font-semibold text-royal">Abrir →</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="num mb-4 text-[11px] tracking-[0.2em] text-muted uppercase">Painel macro · dados de {m?.asOf ?? '…'}</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            ['Treasury 10 anos', pct(m?.us10y?.value, 2), m?.sources.us10y],
            ['Selic meta', pct(m?.selic?.value, 2), m?.sources.selic],
            ['IPCA esperado (Focus)', pct(m && m.ipcaFocus ? (m.ipcaFocus.byYear[String(+m.asOf.slice(0, 4) + 1)] ?? m.ipcaFocus.longRun) : null, 2), m?.sources.ipcaFocus],
            ['USD/BRL', m?.usdbrl ? m.usdbrl.value.toFixed(4) : '—', m?.sources.usdbrl],
            ['ERP EUA (Damodaran)', pct(m?.damodaran?.usErp, 2), m?.sources.damodaran],
            ['Risco-país Brasil', pct(m?.damodaran?.brazilCrp, 2), `${m?.sources.damodaran ?? ''} · rating ${m?.damodaran?.brazilRating ?? ''}`],
          ].map(([label, value, src]) => (
            <div key={label} className="rounded-lg border border-line bg-panel px-4 py-3" title={src}>
              <div className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</div>
              <div className="num mt-1 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <Disclaimer />
      </section>
    </>
  )
}
