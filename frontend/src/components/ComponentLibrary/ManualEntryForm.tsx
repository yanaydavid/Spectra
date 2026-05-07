import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, RFComponent } from '../../types'

const COMPONENT_TYPES: ComponentType[] = ['LNA', 'Amplifier', 'Attenuator', 'Mixer', 'Filter', 'Generic']

const DEFAULTS = { name: '', type: 'Generic' as ComponentType, gain_db: '', nf_db: '', iip3_dbm: '', p1db_dbm: '' }

export function ManualEntryForm() {
  const addComponent = useSpectraStore((s) => s.addComponent)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const gain = parseFloat(form.gain_db)
    const nf = parseFloat(form.nf_db)
    const iip3 = parseFloat(form.iip3_dbm)
    const p1db = parseFloat(form.p1db_dbm)
    if (!form.name.trim()) return setError('Name is required')
    if (isNaN(gain) || isNaN(nf) || isNaN(iip3) || isNaN(p1db)) return setError('All parameters must be numbers')
    const component: RFComponent = {
      id: uuidv4(),
      name: form.name.trim(),
      type: form.type,
      gain_db: gain,
      nf_db: nf,
      iip3_dbm: iip3,
      p1db_dbm: p1db,
      source: 'manual',
    }
    addComponent(component)
    setForm(DEFAULTS)
    setError(null)
    setOpen(false)
  }

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span>+ Add manually</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-2">
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500"
            placeholder="Component name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ComponentType })}
          >
            {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            {([['gain_db', 'Gain (dB)'], ['nf_db', 'NF (dB)'], ['iip3_dbm', 'IIP3 (dBm)'], ['p1db_dbm', 'P1dB (dBm)']] as const).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-1.5 rounded transition-colors"
          >
            Add to Library
          </button>
        </form>
      )}
    </div>
  )
}
