import { AlertTriangle, ArrowRight, ClipboardCheck, PlusCircle, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Disclaimer, LevelBadge } from '../components/ui'
import { fmtDate, useLang } from '../i18n'
import { assess, CONDITIONS, flagged, LEVEL_LABEL, topLevel, type Level } from '../lib/model'
import { useStore } from '../lib/store'

const LEVELS: Level[] = ['low', 'moderate', 'elevated', 'high']

export default function Dashboard() {
  const { families } = useStore()
  const { t, tx, lang } = useLang()
  const d = t.dashboard
  const rows = families.map((f) => {
    const results = assess(f)
    return { f, results, level: topLevel(results), flags: flagged(results) }
  })

  const high = rows.filter((r) => r.level === 'high').length
  const pending = families.filter((f) => f.status !== 'reviewed').length
  const dist = LEVELS.map((l) => ({ l, n: rows.filter((r) => r.level === l).length }))
  const maxDist = Math.max(...dist.map((x) => x.n), 1)

  // Which conditions are most often flagged across the cohort.
  const condCounts = Object.values(CONDITIONS)
    .map((c) => ({ c, n: rows.filter((r) => r.flags.some((x) => x.id === c.id)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{d.hello}</h1>
          <p className="muted">{d.sub}</p>
        </div>
        <Link to="/app/new" className="btn btn-primary">
          <PlusCircle size={16} /> {t.shell.newAssessment}
        </Link>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-icon blue">
            <Users size={18} />
          </span>
          <span className="kpi-val">{families.length}</span>
          <span className="kpi-label">{d.kpiFamilies}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon red">
            <AlertTriangle size={18} />
          </span>
          <span className="kpi-val">{high}</span>
          <span className="kpi-label">{d.kpiHigh}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon amber">
            <ClipboardCheck size={18} />
          </span>
          <span className="kpi-val">{pending}</span>
          <span className="kpi-label">{d.kpiPending}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon green">
            <ArrowRight size={18} />
          </span>
          <span className="kpi-val">7</span>
          <span className="kpi-label">{d.kpiConditions}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>{d.recent}</h2>
            <Link to="/app/families" className="link">
              {d.seeAll}
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>{d.colFamily}</th>
                <th>{d.colDue}</th>
                <th>{d.colFlags}</th>
                <th>{d.colAttention}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map(({ f, level, flags }) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                    <small className="muted block">{f.id}</small>
                  </td>
                  <td>{fmtDate(f.dueDate, lang)}</td>
                  <td className="flags">
                    {flags.length === 0 ? (
                      <span className="muted small">{d.none}</span>
                    ) : (
                      flags.slice(0, 2).map((x) => (
                        <span key={x.id} className="chip">
                          {tx(CONDITIONS[x.id].name)}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <LevelBadge level={level} />
                  </td>
                  <td>
                    <Link to={`/app/report/${f.id}`} className="link">
                      {d.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="stack">
          <section className="card">
            <h2>{d.cohort}</h2>
            <div className="bars">
              {dist.map(({ l, n }) => (
                <div key={l} className="bar-col">
                  <span className="bar-n">{n}</span>
                  <span className={`bar bar-${l}`} style={{ height: `${(n / maxDist) * 120 + 6}px` }} />
                  <span className="bar-l">{tx(LEVEL_LABEL[l])}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>{d.mostFlagged}</h2>
            <ul className="mini-list">
              {condCounts.map(({ c, n }) => (
                <li key={c.id}>
                  <span>{tx(c.name)}</span>
                  <span className="mini-track">
                    <span style={{ width: `${(n / families.length) * 100}%` }} />
                  </span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}
