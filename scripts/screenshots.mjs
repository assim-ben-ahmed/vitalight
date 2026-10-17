// Captures portfolio-ready screenshots of the demo, in English and French.
// Usage: start `npm run dev` in another terminal, then `npm run screenshots`.
//   npm run screenshots          -> screenshots/en and screenshots/fr
//   LANGS=fr npm run screenshots -> French only
// Output: 1440x900 @2x PNGs. Uses the installed Edge or Chrome.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180/'
const LANGS = (process.env.LANGS ?? 'en,fr').split(',')
const ROOT = fileURLToPath(new URL('../screenshots/', import.meta.url))

const SHOTS = [
  { name: '01-landing', hash: '#/' },
  { name: '02-dashboard', hash: '#/app' },
  { name: '03-families', hash: '#/app/families' },
  { name: '04-report-martin', hash: '#/app/report/VL-1042' },
  { name: '05-report-benali', hash: '#/app/report/VL-1039' },
  { name: '06-parent-app', hash: '#/app/parent/VL-1042' },
]

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {}
  }
  throw new Error('Neither Edge nor Chrome found')
}

const browser = await launch()

for (const lang of LANGS) {
  const OUT = `${ROOT}${lang}/`
  mkdirSync(OUT, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  // The app reads its language from localStorage before the first render.
  await context.addInitScript((l) => localStorage.setItem('vitalight-lang', l), lang)
  const page = await context.newPage()
  const shot = async (name, opts = {}) => {
    await page.screenshot({ path: OUT + name + '.png', ...opts })
    console.log(`saved ${lang}/${name}`)
  }

  for (const s of SHOTS) {
    await page.goto(BASE + s.hash, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900) // let entry animations settle
    await shot(s.name)
  }

  // The assessment form, filled with the example, on the "Mother" step.
  await page.goto(BASE + '#/app/new', { waitUntil: 'networkidle' })
  await page.click('[data-shot="fill-example"]')
  await page.click('[data-shot="continue"]')
  await page.waitForTimeout(500)
  await shot('07-new-assessment')

  // Pregnancy guide + push notifications.
  await page.goto(BASE + '#/app/guide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await shot('09-pregnancy-guide')

  await page.goto(BASE + '#/app/parent/VL-1042', { waitUntil: 'networkidle' })
  await page.click('[data-shot="tab-guide"]')
  await page.waitForTimeout(400)
  await shot('10-parent-guide')

  await page.click('[data-shot="tab-home"]')
  await page.click('[data-shot="send-push"]')
  await page.waitForTimeout(700)
  await shot('11-parent-push')

  await page.goto(BASE + '#/app', { waitUntil: 'networkidle' })
  await page.click('[data-shot="bell"]')
  await page.waitForTimeout(400)
  await shot('12-notifications')

  // Mobile view of the report.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE + '#/app/report/VL-1042', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await shot('08-report-mobile', { fullPage: true })

  await context.close()
}

await browser.close()
