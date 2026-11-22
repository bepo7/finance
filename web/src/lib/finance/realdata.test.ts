import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defaultAssumptions, runDcf } from './dcf'
import type { Company, Macro, UniverseEntry } from './types'

const dir = new URL('../../../public/data/', import.meta.url)
const has = existsSync(new URL('universe.json', dir))

describe.skipIf(!has)('dados reais (smoke)', () => {
  it('DCF padrão roda em todas as empresas com demonstrações', () => {
    const macro: Macro = JSON.parse(readFileSync(new URL('macro.json', dir), 'utf8'))
    const uni: { companies: UniverseEntry[] } = JSON.parse(readFileSync(new URL('universe.json', dir), 'utf8'))
    const rows: string[] = []
    for (const u of uni.companies) {
      if (!u.hasFinancials || u.bank) continue
      const c: Company = JSON.parse(readFileSync(new URL(`companies/${u.slug}.json`, dir), 'utf8'))
      const a = defaultAssumptions(c, macro)
      const e = runDcf(c, a)
      const v = e.get('valuePerShare')
      expect(e.get('wacc')).toBeGreaterThan(0.04)
      if (process.env.SHOW) rows.push(`${u.ticker.padEnd(9)} wacc=${(e.get('wacc')! * 100).toFixed(1)}% g=${(a.g * 100).toFixed(1)}% gr0=${(a.growth[0] * 100).toFixed(0)}% m=${(a.ebitdaMargin[0] * 100).toFixed(0)}% px=${a.price.toFixed(2)} v=${v?.toFixed(2)} up=${((e.get('upside') ?? NaN) * 100).toFixed(0)}% tv%=${((e.get('tvShare') ?? NaN) * 100).toFixed(0)}`)
    }
    if (process.env.SHOW) console.log(rows.join('\n'))
  })
})
