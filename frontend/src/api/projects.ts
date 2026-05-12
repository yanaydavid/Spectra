import type { ChainExport } from '../utils/chainIO'
import { API } from './base'

const BASE = `${API}/projects`

export interface ProjectMeta {
  name: string
  saved_at: number   // Unix ms
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to list projects')
  return res.json()
}

export async function saveProject(name: string, data: ChainExport): Promise<void> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to save project')
  }
}

export async function loadProject(name: string): Promise<ChainExport> {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Project "${name}" not found`)
  const body = await res.json()
  return body.data as ChainExport
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
}
