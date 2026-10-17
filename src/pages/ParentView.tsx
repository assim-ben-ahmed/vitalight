import {
  ArrowLeft,
  BellRing,
  BookHeart,
  CalendarHeart,
  ChevronRight,
  HeartHandshake,
  Home,
  Inbox,
  MessageCircle,
  Send,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KindIcon } from '../components/notifications'
import { Logo } from '../components/ui'
import { CATEGORY_SHORT, GUIDE, type GuideCategory } from '../data/guide'
import { useLang } from '../i18n'
import { assess, CONDITIONS, flagged, type Family } from '../lib/model'
import { nextPush, parentInbox, type Notif } from '../lib/notifications'
import { useStore } from '../lib/store'

type Tab = 'home' | 'guide' | 'inbox'

function HomeTab({ f, week, latestTip }: { f: Family; week: number; latestTip?: Notif }) {
  const { t, tx } = useLang()
  const pt = t.parent
  const results = assess(f)
  const flags = flagged(results)
  // "Moderate" is not alarming for parents: count it with the calm ones.
  const calm = results.filter((r) => r.level === 'low' || r.level === 'moderate').length
  return (
    <>
      <div className="ph-hero">
        <small>{pt.hello(f.name)}</small>
        <strong>{pt.heroTitle}</strong>
        <span>{pt.heroSub(week, f.clinician)}</span>
      </div>

      {latestTip && (
        <div className="ph-tip">
          <KindIcon kind={latestTip.kind} size={15} />
          <div>
            <small>{pt.thisWeek}</small>
            <strong>{tx(latestTip.title)}</strong>
          </div>
        </div>
      )}

      <div className="ph-calm">
        <HeartHandshake size={18} />
        <span>
          <strong>{pt.calmCount(calm)}</strong> {pt.calmText}
        </span>
      </div>

      {flags.length > 0 && <h4 className="ph-h">{pt.talk}</h4>}
      {flags.map((r) => (
        <div key={r.id} className={`ph-item ph-${r.level}`}>
          <div>
            <strong>{tx(CONDITIONS[r.id].name)}</strong>
            <small>{pt.plain[r.level]}</small>
          </div>
          <ChevronRight size={16} />
        </div>
      ))}

      <div className="ph-next">
        <CalendarHeart size={18} />
        <div>
          <strong>{pt.appointment}</strong>
          <small>{pt.appointmentSub}</small>
        </div>
      </div>
      <button className="ph-btn">
        <MessageCircle size={16} /> {pt.ask}
      </button>
    </>
  )
}

function GuideTab() {
  const { t, tx } = useLang()
  const [cat, setCat] = useState<GuideCategory>('avoid')
  return (
    <>
      <div className="ph-title">
        <strong>{t.parent.guideTitle}</strong>
        <small>{t.parent.guideSub}</small>
      </div>
      <div className="ph-seg">
        {(['eat', 'avoid', 'habits'] as const).map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {tx(CATEGORY_SHORT[c])}
          </button>
        ))}
      </div>
      {GUIDE.filter((g) => g.category === cat).map((g) => (
        <div key={g.id} className="ph-guide">
          <KindIcon kind={g.category} size={15} />
          <div>
            <strong>{tx(g.title)}</strong>
            <small>{tx(g.short)}</small>
          </div>
        </div>
      ))}
      <p className="ph-source">{t.parent.guideSources}</p>
    </>
  )
}

function InboxTab({ inbox, fresh }: { inbox: Notif[]; fresh: Set<string> }) {
  const { t, tx } = useLang()
  return (
    <>
      <div className="ph-title">
        <strong>{t.parent.inboxTitle}</strong>
        <small>{t.parent.inboxCount(inbox.length)}</small>
      </div>
      {inbox.map((n) => (
        <div key={n.id} className={`ph-notif${fresh.has(n.id) ? ' fresh' : ''}`}>
          <KindIcon kind={n.kind} size={15} />
          <div>
            <strong>{tx(n.title)}</strong>
            <small>{tx(n.body)}</small>
            <em>{t.parent.week(n.week ?? 0)}</em>
          </div>
        </div>
      ))}
    </>
  )
}

export default function ParentView() {
  const { id = '' } = useParams()
  const f = useStore().getFamily(id)
  const { t, tx } = useLang()
  const pt = t.parent
  const [tab, setTab] = useState<Tab>('home')
  const [week, setWeek] = useState(f?.pregnancy.weeks ?? 20)
  const [banner, setBanner] = useState<Notif | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  )

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), 4500)
    return () => clearTimeout(timer)
  }, [banner])

  if (!f) return <p>{t.common.fileNotFound}</p>

  const inbox = parentInbox(f, week)
  const latestTip = inbox.find((n) => n.kind === 'eat' || n.kind === 'avoid' || n.kind === 'habits')
  const upcoming = nextPush(f, week)

  const simulate = () => {
    if (!upcoming) return
    setWeek(upcoming.week!)
    setBanner(upcoming)
    setFresh((prev) => new Set(prev).add(upcoming.id))
    if (perm === 'granted') {
      new Notification(`VitaLight · ${tx(upcoming.title)}`, { body: tx(upcoming.body), icon: './logo.jpg' })
    }
  }

  const enableBrowser = async () => {
    if (perm === 'unsupported') return
    setPerm(await Notification.requestPermission())
  }

  const tabs = [
    ['home', pt.tabs.home, Home],
    ['guide', pt.tabs.guide, BookHeart],
    ['inbox', pt.tabs.inbox, Inbox],
  ] as const

  return (
    <div className="page parent-page">
      <Link to={`/app/report/${f.id}`} className="back">
        <ArrowLeft size={16} /> {pt.back}
      </Link>

      <div className="parent-layout">
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            {banner && (
              <button className="push-banner" onClick={() => setTab('inbox')}>
                <img src="./logo.jpg" alt="" />
                <div>
                  <span className="push-app">
                    VitaLight <em>{pt.now}</em>
                  </span>
                  <strong>{tx(banner.title)}</strong>
                  <small>{tx(banner.body)}</small>
                </div>
              </button>
            )}

            <div className="ph-top">
              <Logo size={26} />
              <span className="avatar sm">{f.name.slice(0, 1)}</span>
            </div>

            <div className="ph-body">
              {tab === 'home' && <HomeTab f={f} week={week} latestTip={latestTip} />}
              {tab === 'guide' && <GuideTab />}
              {tab === 'inbox' && <InboxTab inbox={inbox} fresh={fresh} />}
            </div>

            <nav className="ph-tabs">
              {tabs.map(([key, label, Icon]) => (
                <button key={key} data-shot={`tab-${key}`} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
                  <Icon size={19} />
                  <span>{label}</span>
                  {key === 'inbox' && fresh.size > 0 && <i className="ph-badge">{fresh.size}</i>}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="parent-copy">
          <span className="eyebrow">{pt.eyebrow}</span>
          <h1>{pt.h1}</h1>
          <p className="muted">{pt.text}</p>

          <div className="push-demo card">
            <div className="push-demo-head">
              <BellRing size={18} />
              <strong>{pt.demoTitle}</strong>
            </div>
            {upcoming ? (
              <p className="small">
                {pt.nextPush(upcoming.week!)}
                <strong>{tx(upcoming.title)}</strong>
              </p>
            ) : (
              <p className="small muted">{pt.allSent}</p>
            )}
            <div className="push-demo-actions">
              <button className="btn btn-primary" data-shot="send-push" onClick={simulate} disabled={!upcoming}>
                <Send size={16} /> {pt.send}
              </button>
              {perm !== 'unsupported' && perm !== 'granted' && (
                <button className="btn btn-ghost" onClick={enableBrowser} disabled={perm === 'denied'}>
                  <BellRing size={16} /> {perm === 'denied' ? pt.blocked : pt.alsoBrowser}
                </button>
              )}
              {perm === 'granted' && <span className="pill">{pt.browserOn}</span>}
            </div>
          </div>

          <ul className="recs">
            {pt.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
