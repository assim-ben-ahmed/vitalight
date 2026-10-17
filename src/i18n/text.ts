// Language primitives shared by data, model and UI.
export type Lang = 'en' | 'fr'
export type Text = { en: string; fr: string }

export const LOCALE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }

export const txt = (en: string, fr: string): Text => ({ en, fr })

// Decimal number with the right separator ("2.5" / "2,5").
export function fmtNum(x: number, lang: Lang, digits = 1) {
  return x.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// Relative risk as shown on cards: ×25, ×2.5
export function fmtRR(rr: number, lang: Lang) {
  return rr >= 10 ? String(Math.round(rr)) : fmtNum(rr, lang)
}

export function fmtRisk(p: number, lang: Lang) {
  const pct = lang === 'fr' ? ' %' : '%'
  if (p >= 0.1) return `${Math.round(p * 100)}${pct}`
  if (p >= 0.01) return `${fmtNum(p * 100, lang)}${pct}`
  const oneIn = Math.round(1 / p).toLocaleString(LOCALE[lang])
  return lang === 'fr' ? `1 sur ${oneIn}` : `1 in ${oneIn}`
}

export function fmtDate(iso: string, lang: Lang) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE[lang], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
