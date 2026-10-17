import { BookHeart, LayoutDashboard, PlusCircle, Search, Settings, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LangSwitch, useLang } from '../i18n'
import { NotificationBell, Toasts } from './notifications'
import { Logo } from './ui'

export default function AppShell() {
  const { pathname } = useLocation()
  const { t } = useLang()
  const isParent = pathname.startsWith('/app/parent')

  const nav = [
    { to: '/app', label: t.shell.dashboard, icon: LayoutDashboard, end: true },
    { to: '/app/families', label: t.shell.families, icon: Users, end: false },
    { to: '/app/new', label: t.shell.newAssessment, icon: PlusCircle, end: false },
    { to: '/app/guide', label: t.shell.guide, icon: BookHeart, end: false },
  ]

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-brand">
          <Logo size={34} />
        </NavLink>
        <nav>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="nav-item ghost">
            <Settings size={18} />
            <span>{t.shell.settings}</span>
          </div>
          <div className="azure-chip">
            <span className="dot" /> Azure · France Central
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <Search size={16} />
            <input placeholder={t.shell.search} aria-label={t.shell.search} />
          </div>
          <div className="topbar-right">
            {isParent && <span className="pill">{t.shell.parentPreview}</span>}
            <LangSwitch />
            <NotificationBell />
            <div className="user">
              <span className="avatar">LM</span>
              <span className="user-meta">
                <strong>Dr. L. Moreau</strong>
                <small>{t.shell.role}</small>
              </span>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <Toasts />
      </div>
    </div>
  )
}
