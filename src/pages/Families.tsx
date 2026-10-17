import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LevelBadge } from '../components/ui'
import { fmtDate, useLang } from '../i18n'
import { assess, CONDITIONS, flagged, LEVEL_LABEL, topLevel, type Level } from '../lib/model'
import { useStore } from '../lib/store'

const FILTERS: ('all' | Level)[] = ['all', 'high', 'elevated', 'moderate', 'low']

export default function Families() {
  const { families } = useStore()
  const { t, tx, lang } = useLang()
  const [filter, setFilter] = useState<'all' | Level>('all')

  const rows = families
    .map((f) => {
      const results = assess(f)
      return { f, level: topLevel(results), flags: flagged(results) }
    })
    .filter((r) => filter === 'all' || r.level === filter)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.families.title}</h1>
          <p className="muted">{t.families.sub(families.length)}</p>
        </div>
        <div className="segmented">
          {FILTERS.map((x) => (
            <button key={x} className={filter === x ? 'on' : ''} onClick={() => setFilter(x)}>
              {x === 'all' ? t.families.all : tx(LEVEL_LABEL[x])}
            </button>
          ))}
        </div>
      </div>

      <div className="family-grid">
        {rows.map(({ f, level, flags }) => (
          <Link key={f.id} to={`/app/report/${f.id}`} className="card family-card">
            <div className="family-top">
              <span className="avatar lg">{f.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{t.common.familyOf(f.name)}</strong>
                <small className="muted block">
                  {f.id} · {t.common.weeks(f.pregnancy.weeks)}
                </small>
              </div>
              <LevelBadge level={level} />
            </div>
            <div className="family-meta">
              <span>
                {t.common.mother} <strong>{f.mother.age}</strong>
              </span>
              <span>
                {t.common.father} <strong>{f.father.age}</strong>
              </span>
              <span>
                {t.families.due} <strong>{fmtDate(f.dueDate, lang)}</strong>
              </span>
            </div>
            <div className="flags">
              {flags.length === 0 ? (
                <span className="muted small">{level === 'low' ? t.families.nothing : t.families.mild}</span>
              ) : (
                flags.map((x) => (
                  <span key={x.id} className={`chip chip-${x.level}`}>
                    {tx(CONDITIONS[x.id].name)}
                  </span>
                ))
              )}
            </div>
            <div className="family-foot">
              <span className={`status status-${f.status}`}>{t.common.status[f.status]}</span>
              <span className="muted small">{f.clinician}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
