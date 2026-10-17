import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SEED_FAMILIES } from '../data/families'
import { txt, type Text } from '../i18n/text'
import { api, ApiError, health, setToken, type FamilyInput, type Health, type User } from './api'
import { CONDITIONS, flagged, resultsOf, type Family } from './model'
import { clinicianAlerts, JUST_NOW, type Notif } from './notifications'

export interface Toast {
  id: number
  title: Text
  body: Text
  tone: 'info' | 'success' | 'alert'
}

// 'online': a VitaLight API answered, data lives in its database and a login is required.
// 'offline': static hosting (e.g. GitHub Pages), the demo runs in the browser on synthetic families.
export type Mode = 'checking' | 'online' | 'offline'

const OFFLINE_USER: User = { email: 'demo', name: 'Dr. L. Moreau', initials: 'LM', role: '' }

interface Store {
  mode: Mode
  server: Health | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  families: Family[]
  addFamily: (f: FamilyInput, localId: string) => Promise<string>
  getFamily: (id: string) => Family | undefined
  markReviewed: (id: string) => Promise<void>
  alerts: Notif[]
  markAllRead: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const Ctx = createContext<Store | null>(null)
let toastSeq = 0

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('checking')
  const [server, setServer] = useState<Health | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [alerts, setAlerts] = useState<Notif[]>([])
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

  const loadFamilies = useCallback((list: Family[]) => {
    setFamilies(list)
    setAlerts(clinicianAlerts(list))
  }, [])

  const startOnline = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api.me(), api.families()])
      setUser(me)
      loadFamilies(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null)
        setUser(null)
      } else throw e
    }
  }, [loadFamilies])

  useEffect(() => {
    let cancelled = false
    health().then(async (h) => {
      if (cancelled) return
      if (!h) {
        setMode('offline')
        setUser(OFFLINE_USER)
        loadFamilies(SEED_FAMILIES)
        return
      }
      setServer(h)
      if (api.hasToken()) await startOnline().catch(() => setUser(null))
      if (!cancelled) setMode('online')
    })
    return () => {
      cancelled = true
    }
  }, [loadFamilies, startOnline])

  const pushAlert = useCallback((n: Notif) => setAlerts((prev) => [{ ...n, when: JUST_NOW, read: false }, ...prev]), [])

  const failed = useCallback(
    (e: unknown) =>
      toast({
        title: txt('The server refused the request', 'Le serveur a refusé la requête'),
        body: txt(String((e as Error).message ?? e), String((e as Error).message ?? e)),
        tone: 'alert',
      }),
    [toast],
  )

  const store = useMemo<Store>(
    () => ({
      mode,
      server,
      user,
      login: async (email, password) => {
        const { token } = await api.login(email, password)
        setToken(token)
        await startOnline()
      },
      logout: () => {
        setToken(null)
        setUser(null)
        setFamilies([])
        setAlerts([])
      },
      families,
      getFamily: (id) => families.find((f) => f.id === id),
      addFamily: async (input, localId) => {
        let f: Family
        if (mode === 'online') {
          try {
            f = await api.createFamily(input)
          } catch (e) {
            failed(e)
            throw e
          }
        } else {
          f = { ...input, id: localId, createdAt: new Date().toISOString().slice(0, 10), status: 'pending' }
        }
        setFamilies((prev) => [f, ...prev])
        const top = flagged(resultsOf(f))[0]
        const body = top
          ? txt(`Top flag: ${CONDITIONS[top.id].name.en}.`, `Signalement principal : ${CONDITIONS[top.id].name.fr}.`)
          : txt('No condition flagged above baseline.', 'Aucune affection signalée au-dessus de la référence.')
        const title = txt(`Prediction ready: ${f.name} family`, `Prédiction prête : famille ${f.name}`)
        pushAlert({ id: `c-new-${f.id}`, kind: 'result', familyId: f.id, title, body })
        toast({ title, body, tone: 'info' })
        return f.id
      },
      markReviewed: async (id) => {
        if (mode === 'online') {
          try {
            const updated = await api.review(id)
            setFamilies((prev) => prev.map((f) => (f.id === id ? updated : f)))
          } catch (e) {
            failed(e)
            return
          }
        } else {
          setFamilies((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'reviewed' } : f)))
        }
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
    [mode, server, user, families, alerts, toasts, toast, dismissToast, pushAlert, startOnline, failed],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export function nextId(families: Family[]) {
  const max = Math.max(1000, ...families.map((f) => Number(f.id.split('-')[1]) || 0))
  return `VL-${max + 1}`
}
