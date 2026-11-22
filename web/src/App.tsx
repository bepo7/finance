import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/ui'
import Home from './pages/Home'

const Dcf = lazy(() => import('./pages/Dcf'))
const MonteCarlo = lazy(() => import('./pages/MonteCarlo'))
const DeepDive = lazy(() => import('./pages/DeepDive'))

const LINKS = [
  { to: '/dcf', n: '01', label: 'DCF' },
  { to: '/monte-carlo', n: '02', label: 'Monte Carlo' },
  { to: '/deep-dive', n: '03', label: 'Deep Dive' },
]

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2 focus:text-black">
        Pular para o conteúdo
      </a>
      <nav className="sticky top-0 z-40 border-b border-line/60 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:px-8">
          <NavLink to="/" className="font-serif text-lg italic text-white">
            Finance<span className="text-gold">Lab</span>
          </NavLink>
          <div className="flex gap-1 overflow-x-auto text-sm">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 transition ${isActive ? 'bg-royal text-white' : 'text-muted hover:text-white'}`}
              >
                <span className="num mr-1.5 text-[10px] opacity-70">{l.n}</span>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main id="main" key={pathname}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dcf" element={<Dcf />} />
            <Route path="/dcf/:slug" element={<Dcf />} />
            <Route path="/monte-carlo" element={<MonteCarlo />} />
            <Route path="/deep-dive" element={<DeepDive />} />
            <Route path="/deep-dive/:segment" element={<DeepDive />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
