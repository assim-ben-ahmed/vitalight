import { ArrowRight, Baby, BrainCircuit, ClipboardList, Cloud, HeartPulse, Lock, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LevelBadge, Logo } from '../components/ui'
import { LangSwitch, useLang } from '../i18n'

const STEP_ICONS = [ClipboardList, BrainCircuit, Stethoscope]

// Keeps hyphenated words ("nouveau-né") on one line in large headings.
function keepHyphenated(s: string) {
  return s.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )
}
const CHIP_ICONS = [BrainCircuit, Cloud, Lock]

export default function Landing() {
  const { t, tx } = useLang()
  const l = t.landing

  return (
    <div className="landing">
      <header className="land-nav">
        <Logo size={40} />
        <nav>
          <a href="#how">{l.navHow}</a>
          <a href="#why">{l.navWhy}</a>
          <a href="#tech">{l.navTech}</a>
        </nav>
        <div className="land-actions">
          <LangSwitch />
          <Link to="/app" className="btn btn-primary">
            {l.openDemo} <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <HeartPulse size={14} /> {l.eyebrow}
          </span>
          <h1>
            {keepHyphenated(l.h1a)} <span className="grad-text">{l.h1b}</span>
          </h1>
          <p className="lead">{keepHyphenated(l.lead)}</p>
          <div className="hero-cta">
            <Link to="/app" className="btn btn-primary btn-lg">
              {l.ctaTry} <ArrowRight size={18} />
            </Link>
            <Link to="/app/report/VL-1042" className="btn btn-ghost btn-lg">
              {l.ctaReport}
            </Link>
          </div>
          <p className="tiny muted">{l.footnote}</p>
        </div>

        <div className="hero-visual" aria-hidden>
          <div className="orb" />
          <div className="float-card c1">
            <Baby size={18} />
            <div>
              <strong>{t.common.familyOf('Martin')}</strong>
              <small>{l.c1Sub}</small>
            </div>
          </div>
          <div className="float-card c2">
            <LevelBadge level="high" />
            <div>
              <strong>{tx({ en: 'Cystic fibrosis', fr: 'Mucoviscidose' })}</strong>
              <small>{l.c2Sub}</small>
            </div>
          </div>
          <div className="float-card c3">
            <LevelBadge level="elevated" />
            <div>
              <strong>{tx({ en: 'Childhood asthma', fr: 'Asthme de l’enfant' })}</strong>
              <small>{l.c3Sub}</small>
            </div>
          </div>
          <img src="./logo.jpg" alt="VitaLight logo" className="hero-logo" />
        </div>
      </section>

      <section id="why" className="land-section">
        <h2>{l.problemTitle}</h2>
        <div className="grid-3">
          {l.problems.map((p) => (
            <div key={p.k} className="card soft">
              <h3>{p.k}</h3>
              <p className="muted">{p.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="land-section">
        <h2>{l.howTitle}</h2>
        <div className="grid-3">
          {l.steps.map(({ title, text }, i) => {
            const Icon = STEP_ICONS[i]
            return (
              <div key={title} className="card step">
                <span className="step-num">{i + 1}</span>
                <span className="step-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="tech" className="land-section tech">
        <div>
          <h2>{l.techTitle}</h2>
          <p className="muted">{l.techText}</p>
        </div>
        <div className="tech-chips">
          {l.chips.map((c, i) => {
            const Icon = CHIP_ICONS[i]
            return (
              <span key={c}>
                <Icon size={16} /> {c}
              </span>
            )
          })}
        </div>
      </section>

      <footer className="land-foot">
        <Logo size={28} />
        <span className="muted small">{l.footer}</span>
      </footer>
    </div>
  )
}
