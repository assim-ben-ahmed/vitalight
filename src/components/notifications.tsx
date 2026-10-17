import { Activity, Apple, Ban, Bell, CalendarClock, CheckCircle2, ClipboardCheck, Footprints, Info, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../i18n'
import type { NotifKind } from '../lib/notifications'
import { useStore } from '../lib/store'

const KIND_ICON = {
  eat: Apple,
  avoid: Ban,
  habits: Footprints,
  reminder: CalendarClock,
  personal: Sparkles,
  alert: ClipboardCheck,
  result: Activity,
} satisfies Record<NotifKind, unknown>

export function KindIcon({ kind, size = 16 }: { kind: NotifKind; size?: number }) {
  const Icon = KIND_ICON[kind]
  return (
    <span className={`kind-icon kind-${kind}`}>
      <Icon size={size} />
    </span>
  )
}

export function NotificationBell() {
  const { alerts, markAllRead } = useStore()
  const { t, tx } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = alerts.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" data-shot="bell" aria-label={t.notif.unread(unread)} onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {unread > 0 && <span className="notif-count">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={t.notif.title}>
          <div className="notif-panel-head">
            <strong>{t.notif.title}</strong>
            <button className="link-btn" onClick={markAllRead}>
              {t.notif.markAll}
            </button>
          </div>
          <ul>
            {alerts.length === 0 && <li className="muted small notif-empty">{t.notif.empty}</li>}
            {alerts.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <Link to={n.familyId ? `/app/report/${n.familyId}` : '/app'} onClick={() => setOpen(false)}>
                  <KindIcon kind={n.kind} />
                  <span className="notif-text">
                    <strong>{tx(n.title)}</strong>
                    <small>{tx(n.body)}</small>
                    {n.when && <em>{tx(n.when)}</em>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const TONE_ICON = { info: Info, success: CheckCircle2, alert: Bell }

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  const { t, tx } = useLang()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => {
        const Icon = TONE_ICON[x.tone]
        return (
          <div key={x.id} className={`toast toast-${x.tone}`}>
            <Icon size={18} />
            <div>
              <strong>{tx(x.title)}</strong>
              <span>{tx(x.body)}</span>
            </div>
            <button aria-label={t.notif.dismiss} onClick={() => dismissToast(x.id)}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
