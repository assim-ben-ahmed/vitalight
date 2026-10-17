import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, fr, type Strings } from './strings'
import type { Lang, Text } from './text'

export * from './text'

const STORAGE_KEY = 'vitalight-lang'
const DICT: Record<Lang, Strings> = { en, fr }

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Strings
  tx: (x: Text) => string
}

const Ctx = createContext<LangCtx | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fr') return saved
  } catch {}
  return 'en' // English first; French is opt-in for now
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l)
        try {
          localStorage.setItem(STORAGE_KEY, l)
        } catch {}
      },
      t: DICT[lang],
      tx: (x) => x[lang],
    }),
    [lang],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLang must be used inside LangProvider')
  return c
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {(['en', 'fr'] as const).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={lang === l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
