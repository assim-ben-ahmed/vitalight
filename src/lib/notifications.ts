// Notification engine.
// - Parents get a push schedule keyed to the gestational week (guide tips,
//   check-up reminders) plus messages personalised from their family file.
// - Clinicians get alerts derived from the files they follow.
// In production this schedule would be sent by a backend job through a push
// service (Azure Notification Hubs / Web Push); the demo plays it in the UI.

import { GUIDE } from '../data/guide'
import { fmtRR, txt, type Text } from '../i18n/text'
import { CONDITIONS, flagged, topLevel, type Family } from './model'
import { resultsOf } from './ml'

export type NotifKind = 'eat' | 'avoid' | 'habits' | 'reminder' | 'personal' | 'alert' | 'result'

export interface Notif {
  id: string
  kind: NotifKind
  title: Text
  body: Text
  week?: number // parent push: gestational week it is sent
  when?: Text // clinician alerts: relative time label
  familyId?: string
  read?: boolean
}

const guide = (id: string) => GUIDE.find((g) => g.id === id)!

const tip = (week: number, id: string): Notif => {
  const g = guide(id)
  return { id: `w${week}-${id}`, kind: g.category, week, title: g.title, body: g.short }
}

const reminder = (week: number, id: string, title: Text, body: Text): Notif => ({
  id: `w${week}-${id}`,
  kind: 'reminder',
  week,
  title,
  body,
})

// Generic weekly schedule, same for every pregnancy.
const BASE_SCHEDULE: Notif[] = [
  tip(5, 'folic'),
  tip(6, 'alcohol'),
  tip(7, 'cheese'),
  tip(8, 'meat'),
  tip(9, 'caffeine'),
  tip(10, 'meds'),
  reminder(
    11,
    'scan1',
    txt('First-trimester scan', 'Échographie du 1er trimestre'),
    txt(
      'Your dating scan and combined screening happen around weeks 11 to 14.',
      'L’échographie de datation et le dépistage combiné ont lieu entre 11 et 14 semaines.',
    ),
  ),
  tip(12, 'quality'),
  tip(13, 'liver'),
  tip(14, 'fish'),
  tip(15, 'oily-fish'),
  tip(16, 'active'),
  tip(17, 'iron'),
  tip(18, 'herbal'),
  reminder(
    20,
    'scan2',
    txt('Anomaly scan coming up', 'Échographie morphologique bientôt'),
    txt(
      'The detailed mid-pregnancy scan is usually between weeks 18 and 22.',
      'L’échographie détaillée du 2e trimestre a lieu en général entre 18 et 22 semaines.',
    ),
  ),
  reminder(
    24,
    'ogtt',
    txt('Glucose test window', 'Période du test de glycémie'),
    txt(
      'Screening for gestational diabetes is often done between weeks 24 and 28.',
      'Le dépistage du diabète gestationnel se fait souvent entre 24 et 28 semaines.',
    ),
  ),
  tip(26, 'smoking'),
  reminder(
    32,
    'scan3',
    txt('Third-trimester check-up', 'Bilan du 3e trimestre'),
    txt(
      'Time for your third-trimester scan and a review of your birth plan.',
      'C’est le moment de l’échographie du 3e trimestre et de faire le point sur votre projet de naissance.',
    ),
  ),
  reminder(
    36,
    'bag',
    txt('Get ready', 'Préparez-vous'),
    txt(
      'Pack your maternity bag and keep your care team’s number close.',
      'Préparez votre valise de maternité et gardez le numéro de votre équipe soignante à portée de main.',
    ),
  ),
]

// Messages generated from this family's own file and risk report.
function personal(f: Family): Notif[] {
  const out: Notif[] = []
  const w = Math.max(5, f.pregnancy.weeks - 1)
  const flags = flagged(resultsOf(f))
  const add = (id: string, week: number, title: Text, body: Text) =>
    out.push({ id, kind: 'personal', week, title, body })

  if (f.mother.smoker || f.pregnancy.smokingDuringPregnancy) {
    add(
      'p-smoke',
      w,
      txt('Support to stop smoking', 'Un accompagnement pour arrêter de fumer'),
      txt(
        'Stopping now lowers your baby’s risk of asthma. Ask your midwife about free support.',
        'Arrêter maintenant réduit le risque d’asthme de votre bébé. Demandez à votre sage-femme un accompagnement gratuit.',
      ),
    )
  } else if (f.father.smoker) {
    add(
      'p-smoke-home',
      w,
      txt('A smoke-free home', 'Un foyer sans tabac'),
      txt(
        'Second-hand smoke matters too: keep the home and car smoke-free from birth.',
        'Le tabagisme passif compte aussi : gardez la maison et la voiture sans tabac dès la naissance.',
      ),
    )
  }
  if (f.pregnancy.preexistingDiabetes || f.mother.conditions.includes('t1d')) {
    add(
      'p-glucose',
      w,
      txt('Your glucose targets matter now', 'Vos objectifs de glycémie comptent maintenant'),
      txt(
        'Good glucose control in pregnancy protects your baby’s heart development. Keep your diabetes appointments.',
        'Un bon équilibre glycémique pendant la grossesse protège le développement du cœur de votre bébé. Gardez vos rendez-vous de diabétologie.',
      ),
    )
  }
  if (f.pregnancy.gestationalDiabetes) {
    add(
      'p-gdm',
      w,
      txt('Eating with gestational diabetes', 'Bien manger avec un diabète gestationnel'),
      txt(
        'Your dietitian can help you plan meals that keep your glucose stable.',
        'Votre diététicienne peut vous aider à composer des repas qui stabilisent votre glycémie.',
      ),
    )
  }
  if (flags.some((r) => r.id === 'cf' || r.id === 'scd')) {
    add(
      'p-genetic',
      f.pregnancy.weeks,
      txt('Genetic counselling appointment', 'Rendez-vous de conseil génétique'),
      txt(
        'Your care team suggests a genetic counselling visit. You can book it from the app.',
        'Votre équipe soignante vous propose une consultation de conseil génétique. Vous pouvez la réserver depuis l’application.',
      ),
    )
  }
  if (flags.some((r) => r.id === 'asthma' || r.id === 'eczema')) {
    add(
      'p-atopy',
      w,
      txt('Breathing and skin: simple habits', 'Respiration et peau : des gestes simples'),
      txt(
        'A smoke-free home and daily moisturising from birth are simple first steps. We will remind you after birth.',
        'Un foyer sans tabac et une crème hydratante chaque jour dès la naissance sont de premiers gestes simples. Nous vous le rappellerons après la naissance.',
      ),
    )
  }
  if (f.mother.age >= 35) {
    add(
      'p-age',
      Math.min(w, 11),
      txt('Screening options', 'Options de dépistage'),
      txt(
        'Ask your doctor about first-trimester screening and the cell-free DNA test.',
        'Parlez à votre médecin du dépistage du premier trimestre et du test ADN libre circulant.',
      ),
    )
  }
  return out
}

export function parentSchedule(f: Family): Notif[] {
  return [...BASE_SCHEDULE, ...personal(f)].sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
}

// Inbox at a given week: everything already sent, newest first.
export function parentInbox(f: Family, week: number): Notif[] {
  return parentSchedule(f)
    .filter((n) => (n.week ?? 0) <= week)
    .reverse()
}

export function nextPush(f: Family, week: number): Notif | undefined {
  return parentSchedule(f).find((n) => (n.week ?? 0) > week)
}

const AGO: Text[] = [
  txt('8 min ago', 'il y a 8 min'),
  txt('1 h ago', 'il y a 1 h'),
  txt('3 h ago', 'il y a 3 h'),
  txt('Yesterday', 'Hier'),
  txt('2 days ago', 'il y a 2 jours'),
  txt('3 days ago', 'il y a 3 jours'),
  txt('Last week', 'La semaine dernière'),
]

export const JUST_NOW = txt('Just now', 'À l’instant')

export function clinicianAlerts(families: Family[]): Notif[] {
  const out: Notif[] = []
  for (const f of families) {
    const results = resultsOf(f)
    if (f.status === 'pending') {
      out.push({
        id: `c-review-${f.id}`,
        kind: 'alert',
        familyId: f.id,
        title: txt(`${f.name} family awaits your review`, `Le dossier ${f.name} attend votre validation`),
        body: txt(
          'Report ready. Parents are notified once you mark it as reviewed.',
          'Rapport prêt. Les parents sont notifiés dès que vous le validez.',
        ),
      })
    }
    if (topLevel(results) === 'high') {
      const top = flagged(results)[0]
      const name = CONDITIONS[top.id].name
      out.push({
        id: `c-high-${f.id}`,
        kind: 'result',
        familyId: f.id,
        title: txt(`High attention: ${f.name}`, `Risque très élevé : ${f.name}`),
        body: txt(
          `${name.en} estimated at ×${fmtRR(top.rr, 'en')} the population baseline.`,
          `${name.fr} estimé à ×${fmtRR(top.rr, 'fr')} la référence de la population.`,
        ),
      })
    }
  }
  return out.slice(0, AGO.length).map((n, i) => ({ ...n, when: AGO[i], read: i > 2 }))
}
