import { simulate, type McParams } from '../lib/finance/montecarlo'

self.onmessage = (e: MessageEvent<{ id: number; params: McParams }>) => {
  const t0 = performance.now()
  const result = simulate(e.data.params)
  ;(self as unknown as Worker).postMessage({ id: e.data.id, result, ms: performance.now() - t0 }, [result.finals.buffer])
}
