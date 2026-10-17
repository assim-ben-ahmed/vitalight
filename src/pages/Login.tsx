import { LockKeyhole, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Logo } from '../components/ui'
import { LangSwitch, useLang } from '../i18n'
import { useStore } from '../lib/store'

const DEMO_ACCOUNTS = ['l.moreau@vitalight.demo', 's.haddad@vitalight.demo', 'a.petit@vitalight.demo']
const DEMO_PASSWORD = 'vitalight-demo'

export default function Login() {
  const { login } = useStore()
  const { t } = useLang()
  const a = t.auth
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      await login(email, password)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-head">
          <Logo size={40} />
          <LangSwitch />
        </div>
        <h1>{a.title}</h1>
        <p className="muted small">
          <LockKeyhole size={14} /> {a.sub}
        </p>
        <label className="field">
          <span>{a.email}</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>{a.password}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </label>
        {error && <p className="login-error">{a.error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          <LogIn size={16} /> {busy ? a.signingIn : a.signIn}
        </button>
        <div className="login-demo">
          <strong>{a.demo}</strong>
          <div className="toggles">
            {DEMO_ACCOUNTS.map((x) => (
              <button type="button" key={x} className={`toggle${email === x ? ' on' : ''}`} onClick={() => setEmail(x)}>
                {x.split('@')[0]}
              </button>
            ))}
          </div>
          <span className="muted small">{a.demoHint(DEMO_PASSWORD)}</span>
        </div>
      </form>
    </div>
  )
}
