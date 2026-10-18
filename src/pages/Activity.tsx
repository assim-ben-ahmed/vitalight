import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOCALE, useLang } from '../i18n'
import { api, type AuditEntry } from '../lib/api'
import { useStore } from '../lib/store'

export default function Activity() {
  const { mode } = useStore()
  const { t, lang } = useLang()
  const a = t.activity
  const [rows, setRows] = useState<AuditEntry[] | null>(null)

  useEffect(() => {
    if (mode === 'online') api.audit().then(setRows).catch(() => setRows([]))
  }, [mode])

  const when = (iso: string) =>
    new Date(iso).toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{a.title}</h1>
          <p className="muted">{a.sub}</p>
        </div>
      </div>
      <section className="card">
        {mode !== 'online' ? (
          <p className="muted">
            <ShieldCheck size={16} /> {a.offline}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{a.when}</th>
                <th>{a.who}</th>
                <th>{a.action}</th>
                <th>{a.file}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r, i) => (
                <tr key={i}>
                  <td className="muted">{when(r.ts)}</td>
                  <td>{r.user}</td>
                  <td>
                    <span className={`audit-action audit-${r.action}`}>{a.actions[r.action] ?? r.action}</span>
                  </td>
                  <td>
                    {r.familyId && r.action !== 'delete' ? (
                      <Link className="link" to={`/app/report/${r.familyId}`}>
                        {r.familyId}
                      </Link>
                    ) : (
                      (r.familyId ?? '—')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
