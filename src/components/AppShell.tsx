import { BookHeart, BrainCircuit, History, LayoutDashboard, LogOut, PlusCircle, Search, Settings, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LangSwitch, useLang } from '../i18n'
import { useStore } from '../lib/store'
import Login from '../pages/Login'
import { NotificationBell, Toasts } from './notifications'
import { Logo } from './ui'

export default function AppShell() {
  const { pathname } = useLocation()
  const { t } = useLang()
  const isParent = pathname.startsWith('/app/parent')
  const { mode, server, user, logout } = useStore()

  const nav = [
    { to: '/app', label: t.shell.dashboard, icon: LayoutDashboard, end: true },
    { to: '/app/families', label: t.shell.families, icon: Users, end: false },
    { to: '/app/new', label: t.shell.newAssessment, icon: PlusCircle, end: false },
    { to: '/app/guide', label: t.shell.guide, icon: BookHeart, end: false },
    { to: '/app/model', label: t.shell.model, icon: BrainCircuit, end: false },
    ...(mode === 'online' ? [{ to: '/app/activity', label: t.shell.activity, icon: History, end: false }] : []),
  ]

  if (mode === 'checking') return <div className="login muted">{t.shell.checking}</div>
  if (!user) return <Login />

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
          <div className={`azure-chip${mode === 'offline' ? ' offline' : ''}`} title={server?.version}>
            <span className="dot" /> {mode === 'online' && server ? t.shell.online(server.model) : t.shell.offline}
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
              <span className="avatar">{user.initials}</span>
              <span className="user-meta">
                <strong>{user.name}</strong>
                <small>{user.role ? (t.shell.roles[user.role] ?? user.role) + ' · Maternité Saint-Clair' : t.shell.role}</small>
              </span>
            </div>
            {mode === 'online' && (
              <button className="icon-btn" onClick={logout} title={t.shell.logout} aria-label={t.shell.logout}>
                <LogOut size={18} />
              </button>
            )}
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
