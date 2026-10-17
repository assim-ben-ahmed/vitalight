import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { SEED_FAMILIES } from '../data/families'
import { txt, type Text } from '../i18n/text'
import { assess, CONDITIONS, flagged, type Family } from './model'
import { clinicianAlerts, JUST_NOW, type Notif } from './notifications'

export interface Toast {
  id: number
  title: Text
  body: Text
  tone: 'info' | 'success' | 'alert'
}

interface Store {
  families: Family[]
  addFamily: (f: Family) => void
  getFamily: (id: string) => Family | undefined
  markReviewed: (id: string) => void
  alerts: Notif[]
  markAllRead: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const Ctx = createContext<Store | null>(null)
let toastSeq = 0

export function StoreProvider({ children }: { children: ReactNode }) {
  const [families, setFamilies] = useState<Family[]>(SEED_FAMILIES)
  const [alerts, setAlerts] = useState<Notif[]>(() => clinicianAlerts(SEED_FAMILIES))
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++toastSeq
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )

  const pushAlert = useCallback((n: Notif) => setAlerts((prev) => [{ ...n, when: JUST_NOW, read: false }, ...prev]), [])

  const store = useMemo<Store>(
    () => ({
      families,
      getFamily: (id) => families.find((f) => f.id === id),
      addFamily: (f) => {
        setFamilies((prev) => [f, ...prev])
        const top = flagged(assess(f))[0]
        const body = top
          ? txt(`Top flag: ${CONDITIONS[top.id].name.en}.`, `Signalement principal : ${CONDITIONS[top.id].name.fr}.`)
          : txt('No condition flagged above baseline.', 'Aucune affection signalée au-dessus de la référence.')
        const title = txt(`Prediction ready: ${f.name} family`, `Prédiction prête : famille ${f.name}`)
        pushAlert({ id: `c-new-${f.id}`, kind: 'result', familyId: f.id, title, body })
        toast({ title, body, tone: 'info' })
      },
      markReviewed: (id) => {
        setFamilies((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'reviewed' } : f)))
        setAlerts((prev) => prev.filter((n) => n.id !== `c-review-${id}`))
        const name = families.find((x) => x.id === id)?.name ?? ''
        toast({
          title: txt('Report shared with the parents', 'Rapport partagé avec les parents'),
          body: txt(
            `The ${name} family received a push notification on the VitaLight app.`,
            `La famille ${name} a reçu une notification push sur l’application VitaLight.`,
          ),
          tone: 'success',
        })
      },
      alerts,
      markAllRead: () => setAlerts((prev) => prev.map((n) => ({ ...n, read: true }))),
      toasts,
      toast,
      dismissToast,
    }),
    [families, alerts, toasts, toast, dismissToast, pushAlert],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export function nextId(families: Family[]) {
  const max = Math.max(...families.map((f) => Number(f.id.split('-')[1]) || 0))
  return `VL-${max + 1}`
}
