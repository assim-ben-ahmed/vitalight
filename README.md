# VitaLight — demo prototype

**Illuminating Future Health.** A clickable demo of VitaLight, the preventive-health concept for Microsoft Imagine
Cup 2025. Clinicians enter both parents' medical history, and the app estimates newborn health risks with an
explanation for each one.

> Synthetic data only. Risk figures are illustrative orders of magnitude, not a diagnosis and not a medical device.

## Run it

```bash
npm install
npm run dev          # http://localhost:5180
npm run screenshots  # with the dev server running: screenshots/en and screenshots/fr (2880x1800)
# LANGS=fr npm run screenshots   -> one language only
npm run build        # static site in dist/ (relative paths, works on GitHub Pages)
```

## Screens

| Route | What it shows |
|---|---|
| `#/` | Landing page: problem, how it works, technology |
| `#/app` | Clinician dashboard: KPIs, recent assessments, cohort by attention level |
| `#/app/families` | Family files with level filter |
| `#/app/new` | 5-step assessment form ("Fill with example" for demos), then the prediction runs |
| `#/app/report/:id` | Risk report: 7 conditions, risk vs. population baseline, factor breakdown, follow-up |
| `#/app/parent/:id` | Parent mobile app: report in plain language, pregnancy guide, notification inbox, push demo |
| `#/app/guide` | Pregnancy guide (eat well / avoid / habits, with sources) and the weekly push schedule |

The bell in the top bar is the clinician notification centre; toasts appear when a prediction is ready or a
report is shared with the parents.

## Languages

The app is bilingual, with English by default. The EN/FR switch sits in the top bar and on the landing page, and
the choice is saved in localStorage (`vitalight-lang`).
- Interface text: `src/i18n/strings.ts`. TypeScript checks that `fr` has exactly the same keys as `en`.
- Medical content (conditions, risk factors, recommendations, guide, notifications) stores both languages
  side by side as `{ en, fr }`, so a translation can't get out of sync with its source.
- Numbers, percentages and dates follow each language's conventions (2.5 / 2,5 · 25% / 25 % · 1 in 2,500 / 1 sur 2 500).

## Structure

```
src/
  lib/model.ts       risk engine: Family -> ConditionResult[] (the one thing to swap for a real model)
  lib/store.tsx      in-memory state (families, clinician alerts, toasts)
  lib/notifications.ts  push schedule by gestational week + personalised and clinician notifications
  data/guide.ts      pregnancy guide content, each item with its source
  i18n/              language provider, EN/FR switch, UI strings, number/date formatting
  data/families.ts   8 fictional families
  components/        app shell, risk ring, factor bars, badges
  pages/             one file per screen
scripts/screenshots.mjs  portfolio screenshots via installed Edge/Chrome
```

## How the demo model works

Each condition starts from a population baseline and is multiplied by a relative risk for each factor in the
family file (parental diagnosis, family history, pregnancy context). Recessive conditions (cystic fibrosis,
sickle cell) use carrier probabilities: 1 in 4 when both parents are carriers. Trisomy 21 follows maternal age.
Every factor stays visible in the report, which keeps the result explainable.

## Pregnancy guide and notifications

Parents get one push a week, keyed to the gestational week: something to eat, avoid or check. Food-safety
content follows the NHS guidance, and nutrition content follows the research below. Extra pushes are written
from the family file, such as smoking, diabetes, genetic counselling or maternal age. In the demo, the
"Send next push" button plays the schedule, and "Also show in my browser" sends a real browser notification.

Research behind the guide:
- Marshall NE et al. *The importance of nutrition in pregnancy and lactation: lifelong consequences.*
  Am J Obstet Gynecol 2022;226(5):607–632. https://doi.org/10.1016/j.ajog.2021.12.035
- Koletzko B et al. *Nutrition during pregnancy, lactation and early childhood and its implications for maternal
  and long-term child health: the EarlyNutrition project recommendations.* Ann Nutr Metab 2019;74(2):93–106.
  https://doi.org/10.1159/000496471
- MRC Vitamin Study Research Group. *Prevention of neural tube defects.* Lancet 1991;338:131–137.
  https://pubmed.ncbi.nlm.nih.gov/1677062/
- WHO (2016). *Recommendations on antenatal care for a positive pregnancy experience.*
- NHS. *Foods to avoid in pregnancy.* https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/

## Roadmap (next sessions)

1. **Python API:** FastAPI service exposing `POST /assess` with the same contract as `lib/model.ts`.
2. **Real model:** scikit-learn / gradient boosting trained on a public or synthetic cohort, with calibration
   and SHAP values replacing the hand-written factors.
3. **Data and privacy:** FHIR-style input schema, consent flow, audit log, HDS-certified hosting (Azure France).
4. **Real push:** service worker + Web Push for the web app (Azure Notification Hubs or Firebase for mobile),
   with a backend job that sends the weekly schedule and lets parents set quiet hours.
5. **Parent app:** dedicated mobile layout, FR/EN, guide content checked against French guidance
   (Santé publique France).
6. **Deploy** the demo (GitHub Pages or Azure Static Web Apps) and link it from the portfolio.
