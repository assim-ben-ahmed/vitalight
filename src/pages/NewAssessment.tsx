import { ArrowLeft, ArrowRight, Check, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Disclaimer } from '../components/ui'
import { useLang } from '../i18n'
import { CONDITIONS, type CarrierId, type ConditionId, type Family, type ParentProfile } from '../lib/model'
import { nextId, useStore } from '../lib/store'

const HISTORY: ConditionId[] = ['asthma', 'eczema', 't1d', 'chd', 'cf', 'scd']
const CARRIERS: CarrierId[] = ['cf', 'scd']
const CHECKS = ['consanguinity', 'preexistingDiabetes', 'gestationalDiabetes', 'smokingDuringPregnancy', 'ivf'] as const

const emptyParent = (age: number): ParentProfile => ({ age, conditions: [], carriers: [], familyHistory: [], smoker: false })

function blank(id: string): Family {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id,
    name: '',
    clinician: 'Dr. L. Moreau',
    createdAt: today,
    dueDate: '2027-04-15',
    status: 'new',
    consent: false,
    mother: emptyParent(30),
    father: emptyParent(32),
    pregnancy: {
      weeks: 12,
      consanguinity: false,
      preexistingDiabetes: false,
      gestationalDiabetes: false,
      smokingDuringPregnancy: false,
      ivf: false,
    },
  }
}

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function ParentForm({ ageLabel, p, set }: { ageLabel: string; p: ParentProfile; set: (p: ParentProfile) => void }) {
  const { t, tx } = useLang()
  const f = t.form
  const carrierLabel: Record<CarrierId, string> = { cf: f.carrierCf, scd: f.carrierScd }
  return (
    <div className="form-grid">
      <label className="field">
        <span>{ageLabel}</span>
        <input type="number" min={15} max={70} value={p.age} onChange={(e) => set({ ...p, age: Number(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={p.smoker} onChange={() => set({ ...p, smoker: !p.smoker })} />
        <span>{f.smoker}</span>
      </label>

      <fieldset className="field wide">
        <legend>{f.diagnosed}</legend>
        <div className="toggles">
          {HISTORY.map((c) => (
            <button
              type="button"
              key={c}
              className={`toggle${p.conditions.includes(c) ? ' on' : ''}`}
              onClick={() => set({ ...p, conditions: toggle(p.conditions, c) })}
            >
              {tx(CONDITIONS[c].name)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field wide">
        <legend>{f.carrierTests}</legend>
        <div className="toggles">
          {CARRIERS.map((c) => (
            <button
              type="button"
              key={c}
              className={`toggle${p.carriers.includes(c) ? ' on' : ''}`}
              onClick={() => set({ ...p, carriers: toggle(p.carriers, c) })}
            >
              {carrierLabel[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field wide">
        <legend>{f.familyHistory}</legend>
        <div className="toggles">
          {HISTORY.map((c) => (
            <button
              type="button"
              key={c}
              className={`toggle${p.familyHistory.includes(c) ? ' on' : ''}`}
              onClick={() => set({ ...p, familyHistory: toggle(p.familyHistory, c) })}
            >
              {tx(CONDITIONS[c].name)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export default function NewAssessment() {
  const { families, addFamily, user } = useStore()
  const { t, tx } = useLang()
  const fm = t.form
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Family>(() => ({ ...blank(nextId(families)), clinician: user?.name ?? 'Dr. L. Moreau' }))
  const [running, setRunning] = useState(false)
  const [triedRun, setTriedRun] = useState(false)

  const loadExample = () =>
    setF({
      ...f,
      name: 'Garnier',
      dueDate: '2027-04-10',
      consent: true,
      mother: { age: 38, conditions: ['asthma'], carriers: [], familyHistory: ['t1d'], smoker: false },
      father: { age: 40, conditions: ['t1d'], carriers: ['cf'], familyHistory: [], smoker: true },
      pregnancy: { ...f.pregnancy, weeks: 13, ivf: true },
    })

  const run = async () => {
    if (!f.consent) {
      setTriedRun(true)
      setStep(0)
      return
    }
    setRunning(true)
    const input = {
      name: f.name || t.common.unnamed,
      clinician: f.clinician,
      dueDate: f.dueDate,
      consent: f.consent,
      mother: f.mother,
      father: f.father,
      pregnancy: f.pregnancy,
    }
    // Keep the analysing screen up for a moment even when the API answers instantly.
    const pause = new Promise((r) => setTimeout(r, 1200))
    try {
      const [id] = await Promise.all([addFamily(input, f.id), pause])
      navigate(`/app/report/${id}`)
    } catch {
      setRunning(false)
    }
  }

  const p = f.pregnancy
  const setP = (patch: Partial<Family['pregnancy']>) => setF({ ...f, pregnancy: { ...p, ...patch } })
  const lastStep = fm.steps.length - 1

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>{fm.title}</h1>
          <p className="muted">{fm.sub(f.id)}</p>
        </div>
        <button className="btn btn-ghost" data-shot="fill-example" onClick={loadExample}>
          <Wand2 size={16} /> {fm.fillExample}
        </button>
      </div>

      <ol className="stepper">
        {fm.steps.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span className="step-dot">{i < step ? <Check size={14} /> : i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <section className="card form-card">
        {step === 0 && (
          <div className="form-grid">
            <label className="field">
              <span>{fm.familyName}</span>
              <input value={f.name} placeholder={fm.familyPh} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label className="field">
              <span>{fm.dueDate}</span>
              <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </label>
            <label className="field">
              <span>{fm.clinician}</span>
              <input value={f.clinician} onChange={(e) => setF({ ...f, clinician: e.target.value })} />
            </label>
            <div className="field">
              <span>{fm.consent}</span>
              <label className={`check consent-check${triedRun && !f.consent ? ' missing' : ''}`}>
                <input type="checkbox" checked={!!f.consent} onChange={() => setF({ ...f, consent: !f.consent })} />
                <span>{fm.consentText}</span>
              </label>
            </div>
            {triedRun && !f.consent && <p className="consent-warn">{fm.consentNeeded}</p>}
          </div>
        )}
        {step === 1 && <ParentForm ageLabel={fm.motherAge} p={f.mother} set={(m) => setF({ ...f, mother: m })} />}
        {step === 2 && <ParentForm ageLabel={fm.fatherAge} p={f.father} set={(d) => setF({ ...f, father: d })} />}
        {step === 3 && (
          <div className="form-grid">
            <label className="field">
              <span>{fm.gestAge}</span>
              <input type="number" min={4} max={42} value={p.weeks} onChange={(e) => setP({ weeks: Number(e.target.value) })} />
            </label>
            <div />
            {CHECKS.map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={p[k]} onChange={() => setP({ [k]: !p[k] })} />
                <span>{fm.checks[k]}</span>
              </label>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="review">
            <div>
              <h3>{t.common.familyOf(f.name || t.common.unnamed)}</h3>
              <p className="muted small">{fm.reviewLine(f.id, f.dueDate, p.weeks)}</p>
            </div>
            {(
              [
                [t.common.mother, f.mother],
                [t.common.father, f.father],
              ] as const
            ).map(([who, x]) => (
              <div key={who} className="review-row">
                <strong>{who}</strong>
                <span>{fm.ageShort(x.age)}</span>
                <span>{x.conditions.map((c) => tx(CONDITIONS[c].name)).join(', ') || fm.noCondition}</span>
                <span>
                  {x.carriers.length ? fm.carrier(x.carriers.map((c) => tx(CONDITIONS[c].name)).join(', ')) : fm.noCarrier}
                </span>
              </div>
            ))}
            <Disclaimer />
          </div>
        )}

        <div className="form-nav">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> {fm.back}
          </button>
          {step < lastStep ? (
            <button className="btn btn-primary" data-shot="continue" onClick={() => setStep(step + 1)}>
              {fm.next} <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={run} disabled={running}>
              <Sparkles size={16} /> {running ? fm.running : fm.run}
            </button>
          )}
        </div>
      </section>

      {running && (
        <div className="overlay">
          <div className="analysing">
            <img src="./logo.jpg" alt="" className="pulse" />
            <strong>{fm.analysing}</strong>
            <span className="muted small">{fm.analysingSub}</span>
            <span className="progress">
              <span />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
