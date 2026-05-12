/**
 * Presets Panel
 *
 * Save, load and delete named RF chain designs.
 * Each preset card shows key cascade metrics at save time.
 * Saving with an existing name asks for overwrite confirmation.
 * Loading when chain is non-empty asks for confirmation.
 */

import { useState } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { Preset } from '../../types'

function relativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="flex items-center gap-0.5 text-[9px]">
      <span className="text-gray-600">{label}</span>
      <span className={color}>{value}</span>
    </span>
  )
}

// ── Single preset card ────────────────────────────────────────────────────────
function PresetCard({
  preset,
  onLoad,
  onDelete,
  onOverwrite,
}: {
  preset: Preset
  onLoad: () => void
  onDelete: () => void
  onOverwrite: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const snap = preset.snapshot

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    onDelete()
  }

  return (
    <div className="rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 transition-colors">
      <div className="px-2.5 py-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-200 font-medium truncate">{preset.name}</p>
            <p className="text-[9px] text-gray-600 mt-0.5">
              {preset.chain.length} stage{preset.chain.length !== 1 ? 's' : ''} · {relativeTime(preset.savedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onLoad}
              title="Load this preset"
              className="text-[9px] px-1.5 py-0.5 rounded bg-violet-700/50 hover:bg-violet-600 text-violet-200 transition-colors"
            >
              Load
            </button>
            <button
              onClick={onOverwrite}
              title="Overwrite with current chain"
              className="text-[9px] px-1 py-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              ↺
            </button>
            <button
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm' : 'Delete'}
              className={`text-[9px] px-1 py-0.5 rounded transition-colors ${
                confirmDelete ? 'text-red-400 animate-pulse' : 'text-gray-700 hover:text-red-400 hover:bg-gray-800'
              }`}
            >
              {confirmDelete ? '✕!' : '✕'}
            </button>
          </div>
        </div>

        {/* Metrics row */}
        {snap && (
          <div className="flex gap-2.5 mt-1.5 flex-wrap">
            <MetricPill label="NF" value={`${snap.cascaded_nf_db.toFixed(1)} dB`} color="text-amber-400" />
            <MetricPill label="G" value={`${snap.total_gain_db.toFixed(1)} dB`} color="text-green-400" />
            {snap.cascaded_iip3_dbm != null && (
              <MetricPill label="IIP3" value={`${snap.cascaded_iip3_dbm.toFixed(1)} dBm`} color="text-blue-400" />
            )}
            <MetricPill label="MDS" value={`${snap.sensitivity_dbm.toFixed(1)} dBm`} color="text-violet-400" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function PresetsPanel() {
  const presets      = useSpectraStore((s) => s.presets)
  const savePreset   = useSpectraStore((s) => s.savePreset)
  const loadPreset   = useSpectraStore((s) => s.loadPreset)
  const deletePreset = useSpectraStore((s) => s.deletePreset)
  const chain        = useSpectraStore((s) => s.chain)

  const [open, setOpen]         = useState(false)
  const [inputName, setInputName] = useState('')
  const [overwriteTarget, setOverwriteTarget] = useState<string | null>(null)
  const [loadConfirm, setLoadConfirm]         = useState<string | null>(null)

  const presetList = Object.values(presets).sort((a, b) => b.savedAt - a.savedAt)

  function handleSave() {
    const name = inputName.trim()
    if (!name || chain.length === 0) return

    if (presets[name] && overwriteTarget !== name) {
      setOverwriteTarget(name)   // ask for confirm
      return
    }
    savePreset(name)
    setInputName('')
    setOverwriteTarget(null)
  }

  function handleLoad(name: string) {
    if (chain.length > 0 && loadConfirm !== name) {
      setLoadConfirm(name)
      setTimeout(() => setLoadConfirm(null), 4000)
      return
    }
    loadPreset(name)
    setLoadConfirm(null)
  }

  function handleOverwrite(name: string) {
    savePreset(name)
  }

  const canSave = inputName.trim().length > 0 && chain.length > 0

  return (
    <div className="border-t border-gray-800">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>⊟</span>
          <span>Presets</span>
          {presetList.length > 0 && (
            <span className="text-[9px] bg-gray-800 border border-gray-700 text-gray-500 rounded px-1 font-mono">
              {presetList.length}
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Save form */}
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={inputName}
                onChange={(e) => { setInputName(e.target.value); setOverwriteTarget(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={chain.length === 0 ? 'Add stages first…' : 'Preset name…'}
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

            {/* Overwrite confirmation */}
            {overwriteTarget && (
              <div className="flex items-center justify-between bg-amber-900/30 border border-amber-700/50 rounded px-2 py-1.5 text-[10px]">
                <span className="text-amber-300">Overwrite "{overwriteTarget}"?</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { savePreset(overwriteTarget); setInputName(''); setOverwriteTarget(null) }}
                    className="text-white bg-amber-700 hover:bg-amber-600 rounded px-1.5 py-0.5 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setOverwriteTarget(null)}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Load confirmation */}
            {loadConfirm && (
              <div className="flex items-center justify-between bg-violet-900/30 border border-violet-700/50 rounded px-2 py-1.5 text-[10px]">
                <span className="text-violet-300">Replace current chain?</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { loadPreset(loadConfirm); setLoadConfirm(null) }}
                    className="text-white bg-violet-700 hover:bg-violet-600 rounded px-1.5 py-0.5 transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => setLoadConfirm(null)}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preset cards */}
          {presetList.length === 0 ? (
            <p className="text-[10px] text-gray-700 text-center py-2">
              No saved presets — build a chain and save it above.
            </p>
          ) : (
            <div className="space-y-1.5">
              {presetList.map((p) => (
                <PresetCard
                  key={p.name}
                  preset={p}
                  onLoad={() => handleLoad(p.name)}
                  onDelete={() => deletePreset(p.name)}
                  onOverwrite={() => handleOverwrite(p.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
