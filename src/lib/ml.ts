// The trained model, running in the browser.
// It reads the same JSON artifact the API serves (api/models/vitalight-model.json), so the offline demo on
// static hosting shows exactly what the server computes. Mirrors api/vitalight/{features,ml}.py; the parity
// test (npm run golden + pytest) checks the two agree.

import card from '../../api/models/vitalight-model.json'
import type { Text } from '../i18n/text'
import { assess, GENETIC, makeResult, type ConditionId, type ConditionResult, type Factor, type Family } from './model'

export const MODEL = card
export const MODEL_VERSION: string = card.version

// Effects weaker than ×1.05 either way are not shown as factors (they still count in the risk).
const MIN_EFFECT = Math.log(1.05)
const MULTIFACTORIAL = ['asthma', 'eczema', 't1d', 'chd'] as const
const LABELS = card.labels as Record<string, Text>

export function extract(f: Family): Record<string, boolean> {
  const { mother: m, father: d, pregnancy: p } = f
  const has = (who: typeof m, c: ConditionId) => who.conditions.includes(c)
  const fh = (c: ConditionId) => m.familyHistory.includes(c) || d.familyHistory.includes(c)
  return {
    m_asthma: has(m, 'asthma'),
    f_asthma: has(d, 'asthma'),
    m_eczema: has(m, 'eczema'),
    f_eczema: has(d, 'eczema'),
    par_eczema: has(m, 'eczema') || has(d, 'eczema'),
    par_asthma: has(m, 'asthma') || has(d, 'asthma'),
    fh_asthma: fh('asthma'),
    fh_eczema: fh('eczema'),
    fh_t1d: fh('t1d'),
    fh_chd: fh('chd'),
    m_t1d: has(m, 't1d'),
    f_t1d: has(d, 't1d'),
    m_chd: has(m, 'chd'),
    f_chd: has(d, 'chd'),
    mat_diabetes: p.preexistingDiabetes || has(m, 't1d'),
    gdm: p.gestationalDiabetes,
    consanguinity: p.consanguinity,
    ivf: p.ivf,
    smoke_preg: p.smokingDuringPregnancy,
    // household smoke only counts when the mother is not already smoking during pregnancy
    smoke_home: (m.smoker || d.smoker) && !p.smokingDuringPregnancy,
    mat_age_40: m.age >= 40,
  }
}

export function predict(f: Family): ConditionResult[] {
  const x = extract(f)
  const learned = MULTIFACTORIAL.map((id) => {
    const m = card.conditions[id]
    const coefs = Object.entries(m.coefs) as [string, number][]
    const eta = m.intercept + coefs.reduce((acc, [feat, c]) => acc + (x[feat] ? c : 0), 0)
    const factors: Factor[] = coefs
      .filter(([feat, c]) => x[feat] && Math.abs(c) >= MIN_EFFECT)
      .map(([feat, c]) => ({ label: LABELS[feat], rr: Math.exp(c) }))
    return makeResult(id, Math.min(Math.exp(eta), m.cap), factors, 'ml')
  })
  const genetics = assess(f).filter((r) => GENETIC.includes(r.id))
  return [...learned, ...genetics]
}

// Results to display: the server's stored assessment when there is one, else the same model run locally.
export function resultsOf(f: Family): ConditionResult[] {
  return f.assessment?.results ?? predict(f)
}
