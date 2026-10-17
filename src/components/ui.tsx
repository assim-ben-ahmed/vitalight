import { ShieldAlert } from 'lucide-react'
import { fmtRR, useLang } from '../i18n'
import { LEVEL_LABEL, type Factor, type Level } from '../lib/model'

export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="logo">
      <img src="./logo.jpg" alt="" width={size} height={size} style={{ borderRadius: size / 4 }} />
      {withText && (
        <span className="logo-text">
          Vita<span className="grad-text">Light</span>
        </span>
      )}
    </span>
  )
}

export function LevelBadge({ level }: { level: Level }) {
  const { tx } = useLang()
  return <span className={`badge badge-${level}`}>{tx(LEVEL_LABEL[level])}</span>
}

const LEVEL_COLOR: Record<Level, string> = {
  low: 'var(--low)',
  moderate: 'var(--moderate)',
  elevated: 'var(--elevated)',
  high: 'var(--high)',
}

// Ring whose fill is the risk on a log scale, so 1-in-1000 and 25% both read.
export function RiskRing({ risk, level, size = 76 }: { risk: number; level: Level; size?: number }) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const t = Math.min(1, Math.max(0.04, (Math.log10(risk) + 4) / 4)) // 0.01% -> 0, 100% -> 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="7" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={LEVEL_COLOR[level]}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${c * t} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-anim"
      />
    </svg>
  )
}

// Explainability: each factor's share of the log relative risk.
export function FactorBars({ factors }: { factors: Factor[] }) {
  const { t, tx, lang } = useLang()
  if (factors.length === 0) {
    return <p className="muted small">{t.common.noFactor}</p>
  }
  const max = Math.max(...factors.map((f) => Math.log(f.rr)), Math.log(2))
  return (
    <ul className="factors">
      {factors.map((f) => {
        const w = Math.max(4, (Math.log(f.rr) / max) * 100)
        return (
          <li key={f.label.en}>
            <span className="factor-label">{tx(f.label)}</span>
            <span className="factor-track">
              <span className="factor-fill" style={{ width: `${w}%` }} />
            </span>
            <span className="factor-rr">×{fmtRR(f.rr, lang)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Disclaimer() {
  const { t } = useLang()
  return (
    <div className="disclaimer">
      <ShieldAlert size={16} />
      <span>{t.common.disclaimer}</span>
    </div>
  )
}
