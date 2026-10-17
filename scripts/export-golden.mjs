// Runs the TypeScript rule engine (src/lib/model.ts) on the seed families and writes the results to
// api/tests/golden_rules.json. The Python port is tested against this file, so the two engines can't drift.
//   node scripts/export-golden.mjs
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { assess } = await server.ssrLoadModule('/src/lib/model.ts')
  const { SEED_FAMILIES } = await server.ssrLoadModule('/src/data/families.ts')
  // Edge cases on top of the seed families, so every branch of the engine is covered.
  const base = SEED_FAMILIES[3]
  const p = (age, extra = {}) => ({ age, conditions: [], carriers: [], familyHistory: [], smoker: false, ...extra })
  const edge = [
    { mother: p(47, { familyHistory: ['cf', 'asthma'], smoker: true }), father: p(46, { familyHistory: ['scd'] }),
      pregnancy: { ...base.pregnancy, consanguinity: true, smokingDuringPregnancy: true } },
    { mother: p(19, { conditions: ['scd', 'eczema', 't1d'] }), father: p(22, { conditions: ['cf', 'chd'], smoker: true }),
      pregnancy: { ...base.pregnancy, gestationalDiabetes: true, ivf: true } },
    { mother: p(38, { carriers: ['scd'], familyHistory: ['chd', 't1d', 'eczema'] }), father: p(45, { carriers: ['scd'] }),
      pregnancy: { ...base.pregnancy, preexistingDiabetes: true } },
  ].map((x, i) => ({ ...base, id: `EDGE-${i + 1}`, name: `Edge ${i + 1}`, ...x }))
  const out = [...SEED_FAMILIES, ...edge].map((f) => ({ family: f, results: assess(f) }))
  writeFileSync('api/tests/golden_rules.json', JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote api/tests/golden_rules.json (${out.length} families)`)
} finally {
  await server.close()
}
