// VitaLight demo risk engine.
//
// This is a transparent, rule-based stand-in for the ML model planned in the
// Imagine Cup pitch. Each condition starts from a population baseline and is
// multiplied by relative risks (RR) for every factor found in the family file.
// Figures are rounded orders of magnitude from public literature, for
// illustration only: this is NOT a medical device and NOT clinical advice.
// The interface (Family in -> ConditionResult[] out) is what a real model
// served from an API would have to respect, so the UI will not change when we
// swap it. Labels are returned in both languages (Text) and picked by the UI.

import { txt, type Text } from '../i18n/text'

export type ConditionId = 'asthma' | 'eczema' | 't1d' | 'chd' | 'cf' | 'scd' | 'chromo'
export type CarrierId = 'cf' | 'scd'
export type Level = 'low' | 'moderate' | 'elevated' | 'high'

export interface ParentProfile {
  age: number
  conditions: ConditionId[] // diagnosed in the parent
  carriers: CarrierId[] // confirmed by a genetic carrier test
  familyHistory: ConditionId[] // parent's own parents / siblings
  smoker: boolean
}

export interface Pregnancy {
  weeks: number
  consanguinity: boolean
  preexistingDiabetes: boolean
  gestationalDiabetes: boolean
  smokingDuringPregnancy: boolean
  ivf: boolean
}

export interface Family {
  id: string
  name: string
  clinician: string
  createdAt: string // ISO date
  dueDate: string // ISO date
  status: 'new' | 'pending' | 'reviewed'
  consent?: boolean
  mother: ParentProfile
  father: ParentProfile
  pregnancy: Pregnancy
  assessment?: Assessment // set when the file comes from the API
}

export interface Assessment {
  modelVersion: string
  createdAt: string
  results: ConditionResult[]
}

export interface Factor {
  label: Text
  rr: number // relative risk applied (>1 raises, <1 lowers)
}

export interface ConditionResult {
  id: ConditionId
  risk: number // probability 0..1
  baseline: number // population probability 0..1
  rr: number // risk / baseline
  level: Level
  factors: Factor[]
  recommendations: Text[]
  method?: 'ml' | 'genetic' | 'rules' // ml = trained model served by the API
}

export interface ConditionMeta {
  id: ConditionId
  name: Text
  category: Text
  baseline: number
  about: Text
}

const MULTI = txt('Multifactorial', 'Multifactorielle')
const RECESSIVE = txt('Genetic · recessive', 'Génétique · récessive')

export const CONDITIONS: Record<ConditionId, ConditionMeta> = {
  asthma: {
    id: 'asthma',
    name: txt('Childhood asthma', 'Asthme de l’enfant'),
    category: MULTI,
    baseline: 0.08,
    about: txt(
      'Chronic airway inflammation. Strongly linked to parental asthma and atopy, and to tobacco exposure in pregnancy.',
      'Inflammation chronique des voies respiratoires. Fortement liée à l’asthme et à l’atopie des parents, ainsi qu’au tabac pendant la grossesse.',
    ),
  },
  eczema: {
    id: 'eczema',
    name: txt('Atopic eczema', 'Eczéma atopique'),
    category: MULTI,
    baseline: 0.15,
    about: txt(
      'Inflammatory skin condition of infancy, part of the atopic march with asthma and allergies.',
      'Maladie inflammatoire de la peau du nourrisson, première étape de la « marche atopique » avec l’asthme et les allergies.',
    ),
  },
  t1d: {
    id: 't1d',
    name: txt('Type 1 diabetes', 'Diabète de type 1'),
    category: txt('Autoimmune', 'Auto-immune'),
    baseline: 0.004,
    about: txt(
      'Autoimmune destruction of insulin-producing cells. Risk rises sharply when a parent has T1D, more so through the father.',
      'Destruction auto-immune des cellules productrices d’insuline. Le risque augmente nettement lorsqu’un parent est atteint, davantage par le père.',
    ),
  },
  chd: {
    id: 'chd',
    name: txt('Congenital heart defect', 'Cardiopathie congénitale'),
    category: txt('Structural', 'Structurelle'),
    baseline: 0.008,
    about: txt(
      'Structural heart anomaly present at birth. Linked to parental CHD, maternal pre-existing diabetes and consanguinity.',
      'Anomalie structurelle du cœur présente à la naissance. Liée aux cardiopathies parentales, au diabète maternel préexistant et à la consanguinité.',
    ),
  },
  cf: {
    id: 'cf',
    name: txt('Cystic fibrosis', 'Mucoviscidose'),
    category: RECESSIVE,
    baseline: 0.0004,
    about: txt(
      'Autosomal recessive (CFTR gene). A child is affected only if both parents pass on a variant: 1 in 4 when both are carriers.',
      'Maladie autosomique récessive (gène CFTR). L’enfant n’est atteint que si les deux parents transmettent un variant : 1 sur 4 lorsque les deux sont porteurs.',
    ),
  },
  scd: {
    id: 'scd',
    name: txt('Sickle cell disease', 'Drépanocytose'),
    category: RECESSIVE,
    baseline: 0.0003,
    about: txt(
      'Autosomal recessive haemoglobin disorder. Carrier frequency varies widely by ancestry; 1 in 4 when both parents are carriers.',
      'Maladie autosomique récessive de l’hémoglobine. La fréquence des porteurs varie fortement selon l’origine ; 1 sur 4 lorsque les deux parents sont porteurs.',
    ),
  },
  chromo: {
    id: 'chromo',
    name: txt('Trisomy 21', 'Trisomie 21'),
    category: txt('Chromosomal', 'Chromosomique'),
    baseline: 1 / 700, // all births, all maternal ages
    about: txt(
      'Extra copy of chromosome 21. The main known driver is maternal age; prenatal screening is offered to every pregnancy.',
      'Copie supplémentaire du chromosome 21. Le principal facteur connu est l’âge maternel ; un dépistage prénatal est proposé pour toute grossesse.',
    ),
  },
}

export const CONDITION_ORDER: ConditionId[] = ['asthma', 'eczema', 't1d', 'chd', 'cf', 'scd', 'chromo']

const has = (p: ParentProfile, c: ConditionId) => p.conditions.includes(c)
const fam = (p: ParentProfile, c: ConditionId) => p.familyHistory.includes(c)

function multiplicative(base: number, factors: Factor[], cap: number) {
  const rr = factors.reduce((acc, f) => acc * f.rr, 1)
  return Math.min(base * rr, cap)
}

// Probability that a parent carries a recessive variant, with a gendered label.
function carrierProb(p: ParentProfile, id: CarrierId, population: number, who: 'm' | 'f'): [number, Text | null] {
  const parent = who === 'm' ? txt('Mother', 'Mère') : txt('Father', 'Père')
  const lab = (en: string, frM: string, frF: string) =>
    txt(`${parent.en}: ${en}`, `${parent.fr} : ${who === 'm' ? frM : frF}`)
  if (has(p, id)) return [1, lab('affected', 'atteinte', 'atteint')]
  if (p.carriers.includes(id)) return [1, lab('confirmed carrier', 'porteuse confirmée', 'porteur confirmé')]
  if (fam(p, id)) return [0.5, lab('family history', 'antécédents familiaux', 'antécédents familiaux')]
  return [population, null]
}

const CONSANGUINITY = txt('Consanguinity', 'Consanguinité')

function recessive(f: Family, id: CarrierId, population: number): { risk: number; factors: Factor[] } {
  let [pm, sm] = carrierProb(f.mother, id, population, 'm')
  let [pf, sf] = carrierProb(f.father, id, population, 'f')
  const factors: Factor[] = []
  // Consanguinity raises the chance that the second parent shares the variant.
  if (f.pregnancy.consanguinity) {
    if (pm === population) pm = Math.min(pm * 4, 0.5)
    if (pf === population) pf = Math.min(pf * 4, 0.5)
  }
  if (sm) factors.push({ label: sm, rr: pm / population })
  if (sf) factors.push({ label: sf, rr: pf / population })
  if (f.pregnancy.consanguinity && (pm < 1 || pf < 1)) factors.push({ label: CONSANGUINITY, rr: 4 })
  return { risk: pm * pf * 0.25, factors }
}

// Approximate trisomy 21 risk at birth by maternal age (log-interpolated).
const T21: [number, number][] = [
  [20, 1 / 1500], [25, 1 / 1250], [30, 1 / 900], [35, 1 / 350],
  [38, 1 / 175], [40, 1 / 100], [42, 1 / 60], [45, 1 / 30], [48, 1 / 15],
]
function t21ByAge(age: number) {
  if (age <= T21[0][0]) return T21[0][1]
  for (let i = 1; i < T21.length; i++) {
    const [a1, r1] = T21[i]
    const [a0, r0] = T21[i - 1]
    if (age <= a1) {
      const t = (age - a0) / (a1 - a0)
      return Math.exp(Math.log(r0) + t * (Math.log(r1) - Math.log(r0)))
    }
  }
  return T21[T21.length - 1][1]
}

function levelOf(risk: number, rr: number): Level {
  if ((rr >= 10 && risk >= 0.01) || (rr >= 4 && risk >= 0.25)) return 'high'
  if (rr >= 2.5) return 'elevated'
  if (rr >= 1.2) return 'moderate'
  return 'low'
}

const SMOKE_FREE = txt('Smoke-free home and car from birth', 'Domicile et voiture sans tabac dès la naissance')
const EMOLLIENT = txt('Daily emollient from birth', 'Émollient quotidien dès la naissance')
const T1D_SIGNS = txt('Educate parents on early T1D signs', 'Informer les parents des signes précoces du DT1')
const FETAL_ECHO = txt('Fetal echocardiography around 20–22 weeks', 'Échocardiographie fœtale vers 20–22 semaines')
const COUNSELLING = txt('Genetic counselling', 'Conseil génétique')
const COUNSELLING_NOW = txt('Genetic counselling now', 'Conseil génétique dès maintenant')
const PRENATAL_DX = txt('Discuss prenatal diagnosis options', 'Discuter des options de diagnostic prénatal')
const CFDNA = txt('Offer cell-free DNA testing', 'Proposer le dépistage par ADN libre circulant')

const RECS: Record<ConditionId, Partial<Record<Level, Text[]>>> = {
  asthma: {
    moderate: [
      txt('Encourage a smoke-free home', 'Encourager un domicile sans tabac'),
      txt('Discuss breastfeeding benefits at the next visit', 'Aborder les bénéfices de l’allaitement à la prochaine consultation'),
    ],
    elevated: [SMOKE_FREE, txt('Respiratory follow-up at 6 and 12 months', 'Suivi respiratoire à 6 et 12 mois')],
    high: [
      txt('Early paediatric pulmonology referral if wheezing appears', 'Orientation précoce en pneumopédiatrie en cas de sifflements'),
      SMOKE_FREE,
    ],
  },
  eczema: {
    moderate: [txt('Daily emollient advice from the first weeks', 'Conseiller un émollient quotidien dès les premières semaines')],
    elevated: [
      EMOLLIENT,
      txt('Discuss early allergen introduction with the paediatrician', 'Aborder l’introduction précoce des allergènes avec le pédiatre'),
    ],
    high: [EMOLLIENT, txt('Paediatric allergy consultation in the first year', 'Consultation d’allergologie pédiatrique la première année')],
  },
  t1d: {
    moderate: [txt('Inform parents of early T1D signs (thirst, weight loss)', 'Informer les parents des signes précoces du DT1 (soif, perte de poids)')],
    elevated: [
      txt('Offer islet autoantibody screening in early childhood', 'Proposer un dépistage des auto-anticorps anti-îlots dans la petite enfance'),
      T1D_SIGNS,
    ],
    high: [txt('Refer to a T1D risk-screening programme', 'Orienter vers un programme de dépistage du risque de DT1'), T1D_SIGNS],
  },
  chd: {
    moderate: [txt('Standard pulse-oximetry screening at birth', 'Dépistage standard par oxymétrie de pouls à la naissance')],
    elevated: [FETAL_ECHO, txt('Pulse-oximetry screening at birth', 'Oxymétrie de pouls à la naissance')],
    high: [
      FETAL_ECHO,
      txt('Plan delivery in a centre with paediatric cardiology', 'Prévoir l’accouchement dans un centre avec cardiologie pédiatrique'),
    ],
  },
  cf: {
    moderate: [txt('Offer carrier testing to the untested parent', 'Proposer un test de porteur au parent non testé')],
    elevated: [txt('Carrier testing for both parents', 'Test de porteur pour les deux parents'), COUNSELLING],
    high: [
      COUNSELLING_NOW,
      PRENATAL_DX,
      txt('Ensure newborn screening result is followed up', 'Assurer le suivi du résultat du dépistage néonatal'),
    ],
  },
  scd: {
    moderate: [txt('Offer haemoglobinopathy screening to the untested parent', 'Proposer un dépistage des hémoglobinopathies au parent non testé')],
    elevated: [txt('Haemoglobinopathy screening for both parents', 'Dépistage des hémoglobinopathies pour les deux parents'), COUNSELLING],
    high: [COUNSELLING_NOW, PRENATAL_DX, txt('Haematology follow-up from birth', 'Suivi en hématologie dès la naissance')],
  },
  chromo: {
    moderate: [txt('Combined first-trimester screening (standard of care)', 'Dépistage combiné du premier trimestre (prise en charge standard)')],
    elevated: [txt('Combined first-trimester screening', 'Dépistage combiné du premier trimestre'), CFDNA],
    high: [CFDNA, txt('Genetic counselling on diagnostic options', 'Conseil génétique sur les options diagnostiques')],
  },
}

const ROUTINE = txt('Routine care, no specific action', 'Suivi habituel, aucune action spécifique')
const SMOKING_PREG = txt('Smoking during pregnancy', 'Tabac pendant la grossesse')

export function assess(f: Family): ConditionResult[] {
  const { mother: m, father: d, pregnancy: p } = f
  const out: ConditionResult[] = []

  const push = (id: ConditionId, risk: number, factors: Factor[]) => {
    const baseline = CONDITIONS[id].baseline
    const rr = risk / baseline
    const level = levelOf(risk, rr)
    const recommendations = RECS[id][level] ?? [ROUTINE]
    out.push({ id, risk, baseline, rr, level, factors: factors.sort((a, b) => b.rr - a.rr), recommendations })
  }

  // Asthma
  {
    const fs: Factor[] = []
    if (has(m, 'asthma')) fs.push({ label: txt('Mother has asthma', 'Mère asthmatique'), rr: 2.0 })
    if (has(d, 'asthma')) fs.push({ label: txt('Father has asthma', 'Père asthmatique'), rr: 1.7 })
    if (has(m, 'eczema') || has(d, 'eczema'))
      fs.push({ label: txt('Parental atopic eczema', 'Eczéma atopique parental'), rr: 1.25 })
    if (fam(m, 'asthma') || fam(d, 'asthma'))
      fs.push({ label: txt('Asthma in grandparents / siblings', 'Asthme chez les grands-parents / la fratrie'), rr: 1.15 })
    if (p.smokingDuringPregnancy) fs.push({ label: SMOKING_PREG, rr: 1.4 })
    else if (m.smoker || d.smoker) fs.push({ label: txt('Smoker in the household', 'Fumeur au domicile'), rr: 1.2 })
    push('asthma', multiplicative(0.08, fs, 0.6), fs)
  }

  // Atopic eczema
  {
    const fs: Factor[] = []
    if (has(m, 'eczema')) fs.push({ label: txt('Mother has atopic eczema', 'Mère atteinte d’eczéma atopique'), rr: 1.8 })
    if (has(d, 'eczema')) fs.push({ label: txt('Father has atopic eczema', 'Père atteint d’eczéma atopique'), rr: 1.6 })
    if (has(m, 'asthma') || has(d, 'asthma')) fs.push({ label: txt('Parental asthma', 'Asthme parental'), rr: 1.2 })
    if (fam(m, 'eczema') || fam(d, 'eczema'))
      fs.push({ label: txt('Eczema in grandparents / siblings', 'Eczéma chez les grands-parents / la fratrie'), rr: 1.1 })
    push('eczema', multiplicative(0.15, fs, 0.6), fs)
  }

  // Type 1 diabetes
  {
    const fs: Factor[] = []
    if (has(d, 't1d')) fs.push({ label: txt('Father has type 1 diabetes', 'Père atteint de diabète de type 1'), rr: 15 })
    if (has(m, 't1d')) fs.push({ label: txt('Mother has type 1 diabetes', 'Mère atteinte de diabète de type 1'), rr: 8 })
    if (fam(m, 't1d') || fam(d, 't1d'))
      fs.push({ label: txt('T1D in grandparents / siblings', 'DT1 chez les grands-parents / la fratrie'), rr: 1.8 })
    push('t1d', multiplicative(0.004, fs, 0.3), fs)
  }

  // Congenital heart defect
  {
    const fs: Factor[] = []
    if (has(m, 'chd')) fs.push({ label: txt('Mother born with a heart defect', 'Mère née avec une cardiopathie'), rr: 5 })
    if (has(d, 'chd')) fs.push({ label: txt('Father born with a heart defect', 'Père né avec une cardiopathie'), rr: 3 })
    if (p.preexistingDiabetes || has(m, 't1d'))
      fs.push({ label: txt('Maternal pre-existing diabetes', 'Diabète maternel préexistant'), rr: 3.5 })
    if (p.consanguinity) fs.push({ label: CONSANGUINITY, rr: 2 })
    if (fam(m, 'chd') || fam(d, 'chd'))
      fs.push({ label: txt('CHD in grandparents / siblings', 'Cardiopathie chez les grands-parents / la fratrie'), rr: 1.5 })
    if (p.ivf) fs.push({ label: txt('Assisted conception (IVF)', 'Procréation médicalement assistée (FIV)'), rr: 1.3 })
    if (p.smokingDuringPregnancy) fs.push({ label: SMOKING_PREG, rr: 1.2 })
    push('chd', multiplicative(0.008, fs, 0.25), fs)
  }

  // Recessive conditions
  {
    const cf = recessive(f, 'cf', 1 / 25)
    push('cf', cf.risk, cf.factors)
    const scd = recessive(f, 'scd', 1 / 30)
    push('scd', scd.risk, scd.factors)
  }

  // Trisomy 21
  {
    const risk = t21ByAge(m.age)
    const fs: Factor[] = []
    const ageRR = risk / CONDITIONS.chromo.baseline
    if (ageRR > 1.05)
      fs.push({ label: txt(`Maternal age ${m.age}`, `Âge maternel : ${m.age} ans`), rr: ageRR })
    let r = risk
    if (d.age >= 45) {
      fs.push({ label: txt(`Paternal age ${d.age}`, `Âge paternel : ${d.age} ans`), rr: 1.15 })
      r *= 1.15
    }
    push('chromo', r, fs)
  }

  return out
}

// Results to display: the server's stored assessment when there is one, else the local engine (offline demo).
export function resultsOf(f: Family): ConditionResult[] {
  return f.assessment?.results ?? assess(f)
}

const LEVEL_RANK: Record<Level, number> = { low: 0, moderate: 1, elevated: 2, high: 3 }

export function topLevel(results: ConditionResult[]): Level {
  return results.reduce<Level>((acc, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[acc] ? r.level : acc), 'low')
}

export function flagged(results: ConditionResult[]) {
  return results
    .filter((r) => LEVEL_RANK[r.level] >= 2)
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.rr - a.rr)
}

// Share of optional information that was actually provided.
export function completeness(f: Family) {
  const checks = [
    f.mother.age > 0,
    f.father.age > 0,
    f.mother.carriers.length > 0 || f.mother.conditions.includes('cf'),
    f.father.carriers.length > 0 || f.father.conditions.includes('cf'),
    f.mother.familyHistory.length > 0,
    f.father.familyHistory.length > 0,
    f.pregnancy.weeks > 0,
  ]
  return 0.55 + 0.45 * (checks.filter(Boolean).length / checks.length)
}

export const LEVEL_LABEL: Record<Level, Text> = {
  low: txt('Low', 'Faible'),
  moderate: txt('Moderate', 'Modéré'),
  elevated: txt('Elevated', 'Élevé'),
  high: txt('High', 'Très élevé'),
}
