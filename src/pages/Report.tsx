import { ArrowLeft, BrainCircuit, CheckCircle2, Dna, Info, Printer, Smartphone, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Disclaimer, FactorBars, LevelBadge, RiskRing } from '../components/ui'
import { fmtDate, fmtRisk, fmtRR, useLang } from '../i18n'
import { resultsOf, completeness, CONDITIONS, flagged, topLevel, type ConditionId, type ParentProfile } from '../lib/model'
import { useStore } from '../lib/store'

function ParentSummary({ who, p }: { who: string; p: ParentProfile }) {
  const { t, tx } = useLang()
  const r = t.report
  const names = (ids: ConditionId[]) => ids.map((c) => tx(CONDITIONS[c].name)).join(', ')
  return (
    <div className="parent-sum">
      <div className="parent-sum-head">
        <strong>{who}</strong>
        <span className="muted small">{t.common.years(p.age)}</span>
      </div>
      <dl>
        <dt>{r.conditions}</dt>
        <dd>{names(p.conditions) || '—'}</dd>
        <dt>{r.carrierTests}</dt>
        <dd>{names(p.carriers) || r.notTested}</dd>
        <dt>{r.familyHistory}</dt>
        <dd>{names(p.familyHistory) || '—'}</dd>
        <dt>{r.smoker}</dt>
        <dd>{p.smoker ? t.common.yes : t.common.no}</dd>
      </dl>
    </div>
  )
}

export default function Report() {
  const { id = '' } = useParams()
  const { getFamily, markReviewed } = useStore()
  const { t, tx, lang } = useLang()
  const r = t.report
  const f = getFamily(id)
  const [selected, setSelected] = useState<ConditionId | null>(null)

  if (!f) {
    return (
      <div className="page">
        <p>{t.common.fileNotFound}</p>
        <Link to="/app/families" className="link">
          {t.common.backToFamilies}
        </Link>
      </div>
    )
  }

  const results = resultsOf(f)
  const flags = flagged(results)
  const level = topLevel(results)
  const current = results.find((x) => x.id === (selected ?? flags[0]?.id ?? results[0].id))!
  const meta = CONDITIONS[current.id]
  const conf = Math.round(completeness(f) * 100)
  const yesNo = (b: boolean) => (b ? t.common.yes : t.common.no)

  return (
    <div className="page">
      <Link to="/app/families" className="back">
        <ArrowLeft size={16} /> {r.families}
      </Link>

      <div className="page-head">
        <div>
          <h1>
            {t.common.familyOf(f.name)} <LevelBadge level={level} />
          </h1>
          <p className="muted">{r.meta(f.id, f.pregnancy.weeks, fmtDate(f.dueDate, lang), f.clinician)}</p>
          <p className="model-line">
            {f.assessment
              ? r.modelLine(f.assessment.modelVersion, fmtDate(f.assessment.createdAt.slice(0, 10), lang))
              : r.localModel}
          </p>
        </div>
        <div className="head-actions">
          <Link to={`/app/parent/${f.id}`} className="btn btn-ghost">
            <Smartphone size={16} /> {r.parentView}
          </Link>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={16} /> {r.export}
          </button>
          {f.status !== 'reviewed' ? (
            <button className="btn btn-primary" onClick={() => markReviewed(f.id)}>
              <CheckCircle2 size={16} /> {r.markReviewed}
            </button>
          ) : (
            <span className="status status-reviewed">
              <CheckCircle2 size={14} /> {r.reviewed}
            </span>
          )}
        </div>
      </div>

      <div className={`summary-banner sb-${level}`}>
        <Sparkles size={20} />
        <div>
          <strong>
            {flags.length === 0
              ? r.noFlags
              : r.flagged(flags.length, flags.map((x) => tx(CONDITIONS[x.id].name)).join(', '))}
          </strong>
          <span>{r.completeness(conf, conf < 80)}</span>
        </div>
      </div>

      <div className="report-grid">
        <section className="cond-grid">
          {results.map((x) => (
            <button
              key={x.id}
              className={`card cond-card${current.id === x.id ? ' selected' : ''}`}
              onClick={() => setSelected(x.id)}
            >
              <div className="cond-ring">
                <RiskRing risk={x.risk} level={x.level} />
                <span className="cond-ring-val">{fmtRisk(x.risk, lang)}</span>
              </div>
              <div className="cond-body">
                <strong>{tx(CONDITIONS[x.id].name)}</strong>
                <small className="muted">{tx(CONDITIONS[x.id].category)}</small>
                <div className="cond-foot">
                  <LevelBadge level={x.level} />
                  <span className="muted small">{r.vsBaseline(fmtRR(x.rr, lang))}</span>
                </div>
              </div>
            </button>
          ))}
        </section>

        <aside className="card detail">
          <div className="detail-head">
            <div>
              <small className="muted">{tx(meta.category)}</small>
              <h2>{tx(meta.name)}</h2>
            </div>
            <LevelBadge level={current.level} />
          </div>

          <div className="compare">
            <div>
              <span className="compare-val">{fmtRisk(current.risk, lang)}</span>
              <span className="muted small">{r.estimated}</span>
            </div>
            <div>
              <span className="compare-val muted">{fmtRisk(current.baseline, lang)}</span>
              <span className="muted small">{r.baseline}</span>
            </div>
          </div>

          <p className="about">
            <Info size={14} /> {tx(meta.about)}
          </p>

          <span className="method">
            {current.method === 'genetic' ? <Dna size={14} /> : <BrainCircuit size={14} />}
            {r.method[current.method ?? 'rules']}
          </span>

          <h3>{r.why}</h3>
          <FactorBars factors={current.factors} />

          <h3>{r.followUp}</h3>
          <ul className="recs">
            {current.recommendations.map((x) => (
              <li key={x.en}>
                <CheckCircle2 size={16} /> {tx(x)}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="card">
        <h2>{r.familyFile}</h2>
        <div className="parents">
          <ParentSummary who={t.common.mother} p={f.mother} />
          <ParentSummary who={t.common.father} p={f.father} />
          <div className="parent-sum">
            <div className="parent-sum-head">
              <strong>{t.common.pregnancy}</strong>
              <span className="muted small">{t.common.weeks(f.pregnancy.weeks)}</span>
            </div>
            <dl>
              <dt>{r.consanguinity}</dt>
              <dd>{yesNo(f.pregnancy.consanguinity)}</dd>
              <dt>{r.diabetes}</dt>
              <dd>
                {f.pregnancy.preexistingDiabetes
                  ? r.preexisting
                  : f.pregnancy.gestationalDiabetes
                    ? r.gestational
                    : t.common.no}
              </dd>
              <dt>{r.smoking}</dt>
              <dd>{yesNo(f.pregnancy.smokingDuringPregnancy)}</dd>
              <dt>{r.ivf}</dt>
              <dd>{yesNo(f.pregnancy.ivf)}</dd>
            </dl>
          </div>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
