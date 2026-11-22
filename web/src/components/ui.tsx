import type { ReactNode } from 'react'

export const Mark = ({ children }: { children: ReactNode }) => <span className="mark">{children}</span>

export function Kpi({ label, value, tone = 'default', hint }: { label: string; value: ReactNode; tone?: 'default' | 'up' | 'down' | 'gold'; hint?: string }) {
  const color = { default: 'text-white', up: 'text-up', down: 'text-down', gold: 'text-gold' }[tone]
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3" title={hint}>
      <div className="text-[10px] tracking-[0.14em] text-muted uppercase">{label}</div>
      <div className={`num mt-1 text-lg font-semibold whitespace-nowrap md:text-xl ${color}`}>{value}</div>
    </div>
  )
}

export function SectionTitle({ kicker, children, sub }: { kicker?: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      {kicker && <div className="num mb-2 text-[11px] tracking-[0.2em] text-muted uppercase">{kicker}</div>}
      <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{children}</h2>
      {sub && <p className="mt-2 max-w-3xl text-sm text-muted">{sub}</p>}
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-panel p-4 md:p-5 ${className}`}>{children}</div>
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-ink p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${value === o.value ? 'bg-royal text-white' : 'text-muted hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const Flag = ({ country }: { country: 'BR' | 'US' }) => (
  <span className={`num rounded px-1.5 py-0.5 text-[10px] font-bold ${country === 'BR' ? 'bg-[#0b3d1f] text-[#5be08f]' : 'bg-[#13235e] text-[#8fb0ff]'}`}>{country}</span>
)

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-10 border-t border-line pt-4 text-xs text-muted">
      {children ?? 'Projeto educacional. Não é recomendação de investimento.'} Dados públicos (Yahoo Finance, FRED, BCB, Damodaran) coletados localmente e
      congelados em JSON — podem conter lacunas ou erros da fonte.
    </p>
  )
}

export function Loading({ error }: { error?: string }) {
  return <div className="py-24 text-center text-sm text-muted">{error ? `Erro ao carregar dados: ${error}` : 'Carregando dados…'}</div>
}
