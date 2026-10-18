// Thin client for the VitaLight API (api/vitalight/main.py).
// Same origin by default: in dev Vite proxies /api to the Python server, in production FastAPI serves both.
// VITE_API_URL points the frontend at another host (e.g. an Azure App Service).

import type { ConditionResult, Family, ParentProfile, Pregnancy } from './model'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'
const TOKEN_KEY = 'vitalight-token'

export interface User {
  email: string
  name: string
  initials: string
  role: string
}

export interface FamilyInput {
  name: string
  clinician: string
  dueDate: string
  consent: boolean
  mother: ParentProfile
  father: ParentProfile
  pregnancy: Pregnancy
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function token() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const t = token()
  if (t) headers.set('Authorization', `Bearer ${t}`)
  const res = await fetch(BASE + path, { ...init, headers })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {}
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export interface AuditEntry {
  ts: string
  user: string
  action: string
  familyId: string | null
  detail: string | null
}

export interface Health {
  status: string
  version: string
  model: string
  engine: 'ml' | 'rules'
}

// Resolves to null when no API answers quickly (static hosting such as GitHub Pages).
export async function health(timeoutMs = 2500): Promise<Health | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(BASE + '/health', { signal: ctrl.signal })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  hasToken: () => !!token(),
  login: (email: string, password: string) =>
    call<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => call<User>('/me'),
  families: () => call<Family[]>('/families'),
  createFamily: (f: FamilyInput) => call<Family>('/families', { method: 'POST', body: JSON.stringify(f) }),
  review: (id: string) => call<Family>(`/families/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  reassess: (id: string) => call<Family>(`/families/${encodeURIComponent(id)}/reassess`, { method: 'POST' }),
  remove: (id: string) => call<void>(`/families/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  model: () => call<Record<string, unknown>>('/model'),
  audit: (limit = 200) => call<AuditEntry[]>(`/audit?limit=${limit}`),
  preview: (f: FamilyInput) => call<ConditionResult[]>('/assess', { method: 'POST', body: JSON.stringify(f) }),
}
