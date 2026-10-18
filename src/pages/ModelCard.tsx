import { BrainCircuit, Dna, FlaskConical, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fmtDate, fmtNum, fmtRR, useLang, type Lang, type Text } from '../i18n'

const LEARNED = ['asthma', 'eczema', 't1d', 'chd'] as const
import { api } from '../lib/api'
import { MODEL } from '../lib/ml'
import { CONDITIONS, type ConditionId } from '../lib/model'
import { useStore } from '../lib/store'

interface Scores {
  auc: number
  brier: number
  meanPredicted: number
  observedRate: number
}
interface Metrics {
  positivesTest: number
  model: Scores
  rules: Scores
  gradientBoosting: Scores
  oracle: Scores
  calibration: { predicted: number; observed: number }[]
  relativeRisks: Record<string, number>
  rulesRelativeRisks: Record<string, number>
}
interface Card {
  version: string
  trainedAt: string
  data: { trainSize: number; testSize: number }
  labels: Record<string, Text>
  metrics: Record<(typeof LEARNED)[number], Metrics>
}

const pct = (p: number, lang: Lang, digits?: number) =>
  `${fmtNum(p * 100, lang, digits ?? (p < 0.1 ? 2 : 1))}${lang === 'fr' ? ' %' : '%'}`
// Tick labels: as few decimals as the value needs (0%, 0.5%, 10%).
const tickPct = (p: number, lang: Lang) => pct(p, lang, p === 0 || Number.isInteger(+(p * 100).toFixed(6)) ? 0 : p * 100 < 1 ? 1 : 0)

// Observed vs predicted risk by decile on the held-out cohort. Points on the diagonal = perfect calibration.
function Calibration({ points, label }: { points: Metrics['calibration']; label: string }) {
  const { t, lang } = useLang()
  const m = t.model
  const [hover, setHover] = useState<number | null>(null)
  const W = 300
  const H = 220
  const pad = { l: 48, r: 12, t: 12, b: 36 }
  const top = Math.max(...points.flatMap((p) => [p.predicted, p.observed]))
  // Round tick step (1, 2 or 5 x 10^n) so the axis reads 0%, 5%, 10% rather than 6.73%.
  const raw = top / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const stepSize = [1, 2, 5, 10].map((k) => k * mag).find((v) => v >= raw)!
  const max = Math.ceil((top * 1.05) / stepSize) * stepSize
  const x = (v: number) => pad.l + (v / max) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: Math.round(max / stepSize) + 1 }, (_, i) => i * stepSize)
  const hp = hover === null ? null : points[hover]
  return (
    <figure className="calib">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={m.calibAria(label)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="calib-grid" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="calib-tick">
              {tickPct(v, lang)}
            </text>
            <text x={x(v)} y={H - pad.b + 16} textAnchor="middle" className="calib-tick">
              {tickPct(v, lang)}
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} className="calib-diag" />
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="calib-axis">
          {m.predicted}
        </text>
        <text x={12} y={pad.t} transform={`rotate(-90 12 ${pad.t})`} textAnchor="end" className="calib-axis">
          {m.observed}
        </text>
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(p.predicted)} cy={y(p.observed)} r={12} fill="transparent" />
            <circle cx={x(p.predicted)} cy={y(p.observed)} r={hover === i ? 6 : 4.5} className="calib-dot" />
          </g>
        ))}
      </svg>
      {hp && (
        <div
          className="calib-tip"
          style={{ left: `${(x(hp.predicted) / W) * 100}%`, top: `${(y(hp.observed) / H) * 100}%` }}
        >
          <strong>{m.decile(hover! + 1)}</strong>
          <span>
            {m.predicted}: {pct(hp.predicted, lang)}
          </span>
          <span>
            {m.observed}: {pct(hp.observed, lang)}
          </span>
        </div>
      )}
    </figure>
  )
}

function ConditionCard({ id, metrics, labels }: { id: ConditionId; metrics: Metrics; labels: Card['labels'] }) {
  const { t, tx, lang } = useLang()
  const m = t.model
  const name = tx(CONDITIONS[id].name)
  const rows: [string, Metrics['model']][] = [
    [m.methods.model, metrics.model],
    [m.methods.rules, metrics.rules],
    [m.methods.gbm, metrics.gradientBoosting],
    [m.methods.oracle, metrics.oracle],
  ]
  const rr = Object.entries(metrics.relativeRisks)
  const rules = metrics.rulesRelativeRisks
  return (
    <section className="card mc-card">
      <h2>{name}</h2>
      <p className="muted small">
        {m.rates(pct(metrics.model.meanPredicted, lang), pct(metrics.model.observedRate, lang), metrics.positivesTest)}
      </p>
      <div className="mc-body">
        <div>
          <h3>{m.calibration}</h3>
          <Calibration points={metrics.calibration} label={name} />
        </div>
        <div>
          <h3>{m.accuracy}</h3>
          <table className="table mc-table">
            <thead>
              <tr>
                <th>{m.method}</th>
                <th>AUC</th>
                <th>Brier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, s], i) => (
                <tr key={label} className={i === 0 ? 'mc-ours' : ''}>
                  <td>{label}</td>
                  <td>{fmtNum(s.auc, lang, 3)}</td>
                  <td>{fmtNum(s.brier, lang, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <h3>{m.effects}</h3>
      <table className="table mc-table">
        <thead>
          <tr>
            <th>{m.factor}</th>
            <th>{m.learned}</th>
            <th>{m.handWritten}</th>
          </tr>
        </thead>
        <tbody>
          {rr
            .sort((a, b) => b[1] - a[1])
            .map(([feat, v]) => (
              <tr key={feat}>
                <td>{tx(labels[feat])}</td>
                <td>
                  <strong>×{fmtRR(v, lang)}</strong>
                </td>
                <td className="muted">{rules[feat] === 1 ? m.notUsed : `×${fmtRR(rules[feat], lang)}`}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ModelCard() {
  const { mode } = useStore()
  const { t, lang } = useLang()
  const m = t.model
  const [card, setCard] = useState<Card>(MODEL as Card)

  // Online, show the card of the model the server actually runs (it may have been retrained).
  useEffect(() => {
    if (mode === 'online') api.model().then((c) => c?.metrics && setCard(c as unknown as Card)).catch(() => {})
  }, [mode])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{m.title}</h1>
          <p className="muted">{m.sub(card.version, fmtDate(card.trainedAt.slice(0, 10), lang))}</p>
        </div>
      </div>

      <section className="kpis mc-kpis">
        <div className="kpi">
          <span className="kpi-icon blue">
            <FlaskConical size={22} />
          </span>
          <span className="kpi-val">{card.data.trainSize.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</span>
          <span className="kpi-label">{m.trainFamilies}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon green">
            <FlaskConical size={22} />
          </span>
          <span className="kpi-val">{card.data.testSize.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</span>
          <span className="kpi-label">{m.testFamilies}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon blue">
            <BrainCircuit size={22} />
          </span>
          <span className="kpi-val">4</span>
          <span className="kpi-label">{m.learnedConditions}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon amber">
            <Dna size={22} />
          </span>
          <span className="kpi-val">3</span>
          <span className="kpi-label">{m.geneticConditions}</span>
        </div>
      </section>

      <section className="card mc-notes">
        <h2>
          <Info size={18} /> {m.howToRead}
        </h2>
        <ul>
          {m.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <div className="mc-grid">
        {LEARNED.map((id) => (
          <ConditionCard key={id} id={id} metrics={card.metrics[id]} labels={card.labels} />
        ))}
      </div>
    </div>
  )
}
