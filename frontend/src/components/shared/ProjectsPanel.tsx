/**
 * ProjectsPanel
 *
 * Save and load RF chain designs to/from the Spectra backend (SQLite).
 * Projects survive browser storage clearing and can be loaded from
 * any browser on the same machine.
 *
 * UI is a collapsible section — same pattern as PresetsPanel.
 */

import { useState, useEffect } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { listProjects, saveProject, loadProject, deleteProject } from '../../api/projects'
import type { ProjectMeta } from '../../api/projects'
import type { ChainExport } from '../../utils/chainIO'

function relativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ProjectsPanel() {
  const chain        = useSpectraStore((s) => s.chain)
  const components   = useSpectraStore((s) => s.components)
  const systemParams = useSpectraStore((s) => s.systemParams)
  const clearChain   = useSpectraStore((s) => s.clearChain)
  const addComponent = useSpectraStore((s) => s.addComponent)
  const addToChain   = useSpectraStore((s) => s.addToChain)
  const setSystemParams = useSpectraStore((s) => s.setSystemParams)

  const [open, setOpen]         = useState(false)
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading]   = useState(false)
  const [saveName, setSaveName] = useState('')
  const [status, setStatus]     = useState<{ ok: boolean; msg: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [loadConfirm, setLoadConfirm]     = useState<string | null>(null)

  function flash(ok: boolean, msg: string) {
    setStatus({ ok, msg })
    setTimeout(() => setStatus(null), 3500)
  }

  async function fetchList() {
    setLoading(true)
    try {
      setProjects(await listProjects())
    } catch {
      flash(false, 'Cannot reach backend')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchList()
  }, [open])

  async function handleSave() {
    const name = saveName.trim()
    if (!name || chain.length === 0) return
    const data: ChainExport = {
      _spectra: '1',
      exportedAt: new Date().toISOString(),
      chain,
      components,
      systemParams,
    }
    try {
      await saveProject(name, data)
      setSaveName('')
      flash(true, `Saved "${name}"`)
      fetchList()
    } catch (e: unknown) {
      flash(false, e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleLoad(name: string) {
    if (chain.length > 0 && loadConfirm !== name) {
      setLoadConfirm(name)
      setTimeout(() => setLoadConfirm(null), 4000)
      return
    }
    try {
      const data = await loadProject(name)
      clearChain()
      for (const comp of Object.values(data.components)) addComponent(comp)
      for (const id of data.chain) if (data.components[id]) addToChain(id)
      if (data.systemParams) setSystemParams(data.systemParams)
      setLoadConfirm(null)
      flash(true, `Loaded "${name}"`)
    } catch (e: unknown) {
      flash(false, e instanceof Error ? e.message : 'Load failed')
    }
  }

  async function handleDelete(name: string) {
    if (deleteConfirm !== name) {
      setDeleteConfirm(name)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    try {
      await deleteProject(name)
      setDeleteConfirm(null)
      flash(true, `Deleted "${name}"`)
      fetchList()
    } catch {
      flash(false, 'Delete failed')
    }
  }

  const canSave = saveName.trim().length > 0 && chain.length > 0

  return (
    <div className="border-t border-gray-800">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>☁</span>
          <span>Projects</span>
          {projects.length > 0 && (
            <span className="text-[9px] bg-gray-800 border border-gray-700 text-gray-500 rounded px-1 font-mono">
              {projects.length}
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Status flash */}
          {status && (
            <div className={`text-[10px] rounded px-2 py-1.5 flex items-center gap-1 ${
              status.ok
                ? 'bg-emerald-900/30 text-emerald-400'
                : 'bg-red-900/30 text-red-400'
            }`}>
              <span>{status.ok ? '✓' : '⚠'}</span>
              <span>{status.msg}</span>
            </div>
          )}

          {/* Save form */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={chain.length === 0 ? 'Add stages first…' : 'Project name…'}
              disabled={chain.length === 0}
              className="flex-1 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 outline-none disabled:opacity-40 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-2.5 py-1.5 text-[11px] bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-medium transition-colors"
            >
              Save
            </button>
          </div>

          {/* Load confirm banner */}
          {loadConfirm && (
            <div className="flex items-center justify-between bg-violet-900/30 border border-violet-700/50 rounded px-2 py-1.5 text-[10px]">
              <span className="text-violet-300">Replace current chain?</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleLoad(loadConfirm)}
                  className="text-white bg-violet-700 hover:bg-violet-600 rounded px-1.5 py-0.5 transition-colors"
                >
                  Load
                </button>
                <button onClick={() => setLoadConfirm(null)} className="text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Project list */}
          {loading ? (
            <p className="text-[10px] text-gray-600 text-center py-2">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-[10px] text-gray-700 text-center py-2">
              No saved projects — build a chain and save it above.
            </p>
          ) : (
            <div className="space-y-1.5">
              {projects.map((p) => (
                <div
                  key={p.name}
                  className="rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 px-2.5 py-2 flex items-center gap-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-200 font-medium truncate">{p.name}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">{relativeTime(p.saved_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleLoad(p.name)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-violet-700/50 hover:bg-violet-600 text-violet-200 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(p.name)}
                      title={deleteConfirm === p.name ? 'Click again to confirm' : 'Delete'}
                      className={`text-[9px] px-1 py-0.5 rounded transition-colors ${
                        deleteConfirm === p.name
                          ? 'text-red-400 animate-pulse'
                          : 'text-gray-700 hover:text-red-400 hover:bg-gray-800'
                      }`}
                    >
                      {deleteConfirm === p.name ? '✕!' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[9px] text-gray-700 text-center">
            Saved to Spectra server · stays after browser storage clears
          </p>
        </div>
      )}
    </div>
  )
}
