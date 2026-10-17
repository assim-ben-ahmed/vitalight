import { BellRing, BookOpen, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { KindIcon } from '../components/notifications'
import { CATEGORY_LABEL, GUIDE, RESEARCH, type GuideCategory } from '../data/guide'
import { useLang } from '../i18n'
import { parentSchedule } from '../lib/notifications'
import { useStore } from '../lib/store'

const TABS: ('all' | GuideCategory)[] = ['all', 'eat', 'avoid', 'habits']

export default function Guide() {
  const { getFamily } = useStore()
  const { t, tx } = useLang()
  const g = t.guide
  const [tab, setTab] = useState<'all' | GuideCategory>('all')
  const items = GUIDE.filter((x) => tab === 'all' || x.category === tab)
  // The generic part of the schedule is the same for every family.
  const schedule = parentSchedule(getFamily('VL-1036')!)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{g.title}</h1>
          <p className="muted">{g.sub}</p>
        </div>
        <div className="segmented">
          {TABS.map((x) => (
            <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
              {x === 'all' ? g.all : tx(CATEGORY_LABEL[x])}
            </button>
          ))}
        </div>
      </div>

      <div className="guide-layout">
        <div className="guide-grid">
          {items.map((x) => (
            <article key={x.id} className={`card guide-card gc-${x.category}`}>
              <div className="guide-card-head">
                <KindIcon kind={x.category} />
                <span className={`guide-tag tag-${x.category}`}>{tx(CATEGORY_LABEL[x.category])}</span>
              </div>
              <h3>{tx(x.title)}</h3>
              <p className="muted small">{tx(x.why)}</p>
              <a className="source" href={x.source.url} target="_blank" rel="noreferrer">
                {tx(x.source.label)} <ExternalLink size={12} />
              </a>
            </article>
          ))}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-head">
              <h2>
                <BellRing size={17} /> {g.schedule}
              </h2>
              <span className="pill">{g.pushes(schedule.length)}</span>
            </div>
            <ol className="timeline">
              {schedule.map((n) => (
                <li key={n.id}>
                  <span className="tl-week">
                    {g.weekShort}
                    {n.week}
                  </span>
                  <KindIcon kind={n.kind} size={14} />
                  <span className="tl-title">{tx(n.title)}</span>
                </li>
              ))}
            </ol>
            <p className="tiny muted">{g.scheduleNote}</p>
          </section>

          <section className="card research">
            <h2>
              <BookOpen size={17} /> {g.research}
            </h2>
            <ul>
              {RESEARCH.map((r) => (
                <li key={r.source.url}>
                  <a href={r.source.url} target="_blank" rel="noreferrer">
                    <strong>{r.title}</strong>
                  </a>
                  <small>{tx(r.source.label)}</small>
                  <span className="muted small">{tx(r.note)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
