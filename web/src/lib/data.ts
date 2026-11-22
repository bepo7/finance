import { useEffect, useState } from 'react'
import type { Company, Macro, PriceSeries, UniverseEntry } from './finance/types'

const BASE = import.meta.env.BASE_URL + 'data/'
const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
        return r.json()
      }),
    )
  }
  return cache.get(path) as Promise<T>
}

export const loadUniverse = () => load<{ asOf: string; companies: UniverseEntry[] }>('universe.json')
export const loadMacro = () => load<Macro>('macro.json')
export const loadCompany = (slug: string) => load<Company>(`companies/${slug}.json`)
export const loadBenchmarks = () => load<Record<string, PriceSeries & { label: string }>>('benchmarks.json')

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: string } {
  const [state, set] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    let alive = true
    set({})
    fn().then(
      (data) => alive && set({ data }),
      (e: Error) => alive && set({ error: e.message }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
