// End-to-end smoke test of the full system in a real browser (installed Edge or Chrome).
// Start the server first:  npm run build && npm run api   (FastAPI serves dist/ on :8000)
//   node scripts/e2e.mjs                 -> BASE_URL defaults to http://127.0.0.1:8000/
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8000/'
const PASSWORD = process.env.VITALIGHT_DEMO_PASSWORD ?? 'vitalight-demo'

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {}
  }
  throw new Error('Neither Edge nor Chrome found')
}

const step = (msg) => console.log(`  ok  ${msg}`)
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('vitalight-lang', 'en'))

try {
  await page.goto(BASE + '#/app')
  await page.getByRole('heading', { name: 'Clinician sign-in' }).waitFor()
  step('API detected, sign-in required')

  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Wrong email or password.').waitFor()
  step('wrong password rejected')

  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Dr. L. Moreau').first().waitFor()
  await page.getByText(/Live API · model vl-/).waitFor()
  step('signed in, live model shown')

  await page.goto(BASE + '#/app/report/VL-1039')
  await page.getByText(/Model vl-.* · assessed/).waitFor()
  await page.getByRole('button', { name: /Type 1 diabetes/ }).click()
  await page.getByText('Trained model').waitFor()
  step('Benali report comes from the trained model')

  await page.goto(BASE + '#/app/new')
  await page.locator('[data-shot="fill-example"]').click()
  for (let i = 0; i < 4; i++) await page.locator('[data-shot="continue"]').click()
  await page.getByRole('button', { name: 'Run risk prediction' }).click()
  await page.waitForURL(/#\/app\/report\/VL-\d+/, { timeout: 15000 })
  const id = page.url().split('/').pop()
  await page.getByRole('heading', { name: /Garnier family/ }).waitFor()
  step(`new assessment stored as ${id}`)

  await page.getByRole('button', { name: 'Mark as reviewed' }).click()
  await page.getByText('Report shared with the parents').waitFor()
  step('marked as reviewed')

  await page.reload()
  await page.getByRole('heading', { name: /Garnier family/ }).waitFor()
  await page.locator('.status-reviewed').waitFor()
  step('survives a reload (persisted server-side)')

  await page.goto(BASE + '#/app/model')
  await page.getByRole('heading', { name: 'How the model works' }).waitFor()
  if ((await page.locator('.calib svg').count()) !== 4) throw new Error('expected 4 calibration plots')
  step('model card with 4 calibration plots')

  await page.goto(BASE + '#/app/activity')
  await page.getByText('Reviewed and shared').first().waitFor()
  step(`activity log shows the review of ${id}`)

  await page.goto(BASE + '#/app/new')
  for (let i = 0; i < 4; i++) await page.locator('[data-shot="continue"]').click()
  await page.getByRole('button', { name: 'Run risk prediction' }).click()
  await page.getByText('Parental consent is required').waitFor()
  step('consent enforced in the form')

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '))
  console.log('E2E PASSED')
} catch (e) {
  await page.screenshot({ path: 'e2e-failure.png', fullPage: true })
  console.error('E2E FAILED (screenshot: e2e-failure.png):', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
