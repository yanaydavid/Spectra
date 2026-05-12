/**
 * My Library — custom component manager
 *
 * Shows all user-created components (source = 'manual' or 'datasheet',
 * without a chain-instance '__' in their ID).
 * Each row supports inline edit and delete.
 * A "+ New Component" form at the bottom creates new library entries.
 */

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, RFComponent } from '../../types'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', PA: '🔊', VGA: '↕', Limiter: '⌇',
  BPF: '≋', LPF: '⊏', HPF: '⊐', BSF: '⊓', Diplexer: '⑂',
  Attenuator: '▼', Splitter: '⑃', Coupler: '⊕', Circulator: '↻', Isolator: '⇒', Termination: '⏚',
  PhaseShifter: 'φ', Hybrid90: '90°', Hybrid180: '180°', Balun: '∞',
  Mixer: '×', UpConverter: '↑×', Multiplier: '×n', Divider: '÷n',
  VCO: '〜', VCXO: '◇', PLL: '⊗', CrystalOsc: '⬡',
  Switch: '⎋', TRSwitch: '⇌',
  ADC: '⤒', DAC: '⤓',
  Antenna: '📶', Generic: '□',
}

const COMPONENT_TYPES: ComponentType[] = [
  'LNA','Amplifier','PA','VGA','Limiter',
  'BPF','LPF','HPF','BSF','Diplexer',
  'Attenuator','Splitter','Coupler','Circulator','Isolator','Termination',
  'PhaseShifter','Hybrid90','Hybrid180','Balun',
  'Mixer','UpConverter','Multiplier','Divider',
  'VCO','VCXO','PLL','CrystalOsc',
  'Switch','TRSwitch',
  'ADC','DAC',
  'Antenna','Generic',
]

type FormData = {
  name: string
  type: ComponentType
  gain_db: string
  nf_db: string
  iip3_dbm: string
  p1db_dbm: string
}

const EMPTY_FORM: FormData = {
  name: '', type: 'LNA', gain_db: '', nf_db: '', iip3_dbm: '', p1db_dbm: '',
}

function componentToForm(c: RFComponent): FormData {
  return {
    name: c.name,
    type: c.type,
    gain_db: String(c.gain_db),
    nf_db: String(c.nf_db),
    iip3_dbm: String(c.iip3_dbm ?? ''),
    p1db_dbm: String(c.p1db_dbm ?? ''),
  }
}

function parseForm(f: FormData): Partial<RFComponent> | string {
  if (!f.name.trim()) return 'Name is required'
  const gain = parseFloat(f.gain_db)
  const nf   = parseFloat(f.nf_db)
  const iip3 = parseFloat(f.iip3_dbm)
  const p1db = parseFloat(f.p1db_dbm)
  if (isNaN(gain)) return 'Gain must be a number'
  if (isNaN(nf))   return 'NF must be a number'
  return {
    name: f.name.trim(),
    type: f.type,
    gain_db: gain,
    nf_db: nf,
    iip3_dbm: isNaN(iip3) ? 0 : iip3,
    p1db_dbm: isNaN(p1db) ? 0 : p1db,
    source: 'manual' as const,
  }
}

// ── Compact inline param fields ───────────────────────────────────────────────
function ParamFields({
  form, onChange,
}: {
  form: FormData
  onChange: (f: FormData) => void
}) {
  const field = (key: keyof FormData, label: string) => (
    <div key={key}>
      <label className="block text-[9px] text-gray-600 mb-0.5 uppercase tracking-wider">{label}</label>
      <input
        type={key === 'name' || key === 'type' ? 'text' : 'number'}
        step="any"
        className="w-full bg-gray-950 border border-gray-700 focus:border-violet-500 rounded px-2 py-1 text-xs text-gray-100 outline-none"
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
        placeholder={label}
      />
    </div>
  )

  return (
    <div className="space-y-2 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-[9px] text-gray-600 mb-0.5 uppercase tracking-wider">Name</label>
          <input
            type="text"
            className="w-full bg-gray-950 border border-gray-700 focus:border-violet-500 rounded px-2 py-1 text-xs text-gray-100 outline-none"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Component name"
          />
        </div>
        <div>
          <label className="block text-[9px] text-gray-600 mb-0.5 uppercase tracking-wider">Type</label>
          <select
            className="w-full bg-gray-950 border border-gray-700 focus:border-violet-500 rounded px-2 py-1 text-xs text-gray-100 outline-none"
            value={form.type}
            onChange={(e) => onChange({ ...form, type: e.target.value as ComponentType })}
          >
            {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
          </select>
        </div>
        {field('gain_db', 'Gain (dB)')}
        {field('nf_db', 'NF (dB)')}
        {field('iip3_dbm', 'IIP3 (dBm)')}
        {field('p1db_dbm', 'P1dB (dBm)')}
      </div>
    </div>
  )
}

// ── Single library row with inline edit ───────────────────────────────────────
function LibraryRow({ comp }: { comp: RFComponent }) {
  const updateComponent = useSpectraStore((s) => s.updateComponent)
  const deleteComponent  = useSpectraStore((s) => s.deleteComponent)
  const addToChain       = useSpectraStore((s) => s.addToChain)

  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<FormData>(componentToForm(comp))
  const [error, setError]     = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState(false)

  function handleSave() {
    const result = parseForm(form)
    if (typeof result === 'string') { setError(result); return }
    updateComponent(comp.id, result)
    setEditing(false)
    setError(null)
  }

  function handleDelete() {
    if (!delConfirm) { setDelConfirm(true); setTimeout(() => setDelConfirm(false), 3000); return }
    deleteComponent(comp.id)
  }

  function handleCancel() {
    setForm(componentToForm(comp))
    setEditing(false)
    setError(null)
  }

  return (
    <li className={`rounded-lg border ${editing ? 'border-violet-700/60 bg-gray-900/60' : 'border-gray-800 hover:border-gray-700'} transition-colors`}>
      {/* Collapsed row */}
      {!editing && (
        <div className="flex items-center gap-2 px-2.5 py-2 group">
          <span className="text-sm shrink-0 opacity-70">{TYPE_ICON[comp.type] ?? '□'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-200 truncate font-medium">{comp.name}</p>
            <div className="flex gap-2 mt-0.5 text-[10px] text-gray-500">
              <span className="text-green-400">G {comp.gain_db} dB</span>
              <span className="text-amber-400">NF {comp.nf_db} dB</span>
              {comp.iip3_dbm != null && <span className="text-blue-400">IIP3 {comp.iip3_dbm} dBm</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => addToChain(comp.id)}
              title="Add to chain"
              className="text-[9px] px-1.5 py-0.5 rounded bg-violet-700/60 hover:bg-violet-600 text-violet-200 transition-colors"
            >
              + Chain
            </button>
            <button
              onClick={() => { setForm(componentToForm(comp)); setEditing(true) }}
              title="Edit"
              className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors px-1"
            >
              ✎
            </button>
            <button
              onClick={handleDelete}
              title={delConfirm ? 'Click again to confirm delete' : 'Delete'}
              className={`text-[10px] transition-colors px-1 ${delConfirm ? 'text-red-400 animate-pulse' : 'text-gray-600 hover:text-red-400'}`}
            >
              {delConfirm ? '✕!' : '✕'}
            </button>
          </div>
        </div>
      )}

      {/* Expanded edit form */}
      {editing && (
        <div className="px-2.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Edit Component</span>
            <button onClick={handleCancel} className="text-gray-600 hover:text-gray-300 text-[11px]">✕</button>
          </div>
          <ParamFields form={form} onChange={setForm} />
          {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleSave}
              className="flex-1 bg-violet-700 hover:bg-violet-600 text-white text-xs font-medium py-1.5 rounded transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

// ── New component form ────────────────────────────────────────────────────────
function NewComponentForm({ onClose }: { onClose: () => void }) {
  const addComponent = useSpectraStore((s) => s.addComponent)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = parseForm(form)
    if (typeof result === 'string') { setError(result); return }
    addComponent({ ...result, id: uuidv4() } as RFComponent)
    setForm(EMPTY_FORM)
    setError(null)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="mx-2 mb-2 p-2.5 rounded-lg border border-violet-700/50 bg-gray-900/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">New Component</span>
        <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-300 text-[11px]">✕</button>
      </div>
      <ParamFields form={form} onChange={setForm} />
      {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}
      <button
        type="submit"
        className="w-full mt-2.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-medium py-1.5 rounded transition-colors"
      >
        Save to Library
      </button>
    </form>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function MyLibrary() {
  const components    = useSpectraStore((s) => s.components)
  const clearLibrary  = useSpectraStore((s) => s.clearLibrary)
  const [showNew, setShowNew]           = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  // Library items are components without a chain-instance separator
  const libraryComponents = Object.values(components).filter(
    (c) => !c.id.includes('__')
  )

  function handleClearAll() {
    if (!clearConfirm) {
      setClearConfirm(true)
      setTimeout(() => setClearConfirm(false), 4000)
      return
    }
    clearLibrary()
    setClearConfirm(false)
  }

  return (
    <div>
      {/* List */}
      {libraryComponents.length === 0 && !showNew ? (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-gray-600 mb-3">
            No components yet.<br />Upload a datasheet or create one below.
          </p>
        </div>
      ) : (
        <ul className="px-2 space-y-1.5 pb-2">
          {libraryComponents.map((comp) => (
            <LibraryRow key={comp.id} comp={comp} />
          ))}
        </ul>
      )}

      {/* Bottom actions */}
      <div className="px-2 pb-2 space-y-1.5">
        {/* Add new */}
        {showNew ? (
          <NewComponentForm onClose={() => setShowNew(false)} />
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-700 hover:border-violet-600 text-xs text-gray-600 hover:text-violet-400 transition-colors"
          >
            <span>+</span>
            <span>New Component</span>
          </button>
        )}

        {/* Clear library */}
        {libraryComponents.length > 0 && (
          <button
            onClick={handleClearAll}
            className={`w-full py-1.5 rounded-lg border text-xs transition-colors ${
              clearConfirm
                ? 'border-red-600/60 bg-red-900/20 text-red-400 animate-pulse'
                : 'border-gray-800 text-gray-700 hover:border-red-700/50 hover:text-red-500'
            }`}
          >
            {clearConfirm ? '⚠ Click again to clear all components' : 'Clear Library'}
          </button>
        )}
      </div>
    </div>
  )
}
