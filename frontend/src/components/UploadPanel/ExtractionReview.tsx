import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, ExtractedParams } from '../../types'

interface Props {
  extracted: ExtractedParams
  filename: string
  onDone: () => void
}

const COMPONENT_TYPES: ComponentType[] = ['LNA', 'Amplifier', 'Attenuator', 'Mixer', 'Filter', 'Generic']

function guessType(name: string): ComponentType {
  const n = name.toLowerCase()
  if (n.includes('lna')) return 'LNA'
  if (n.includes('amp')) return 'Amplifier'
  if (n.includes('att') || n.includes('pad')) return 'Attenuator'
  if (n.includes('mix')) return 'Mixer'
  if (n.includes('fil') || n.includes('bpf') || n.includes('lpf')) return 'Filter'
  return 'Generic'
}

export function ExtractionReview({ extracted, filename, onDone }: Props) {
  const addComponent = useSpectraStore((s) => s.addComponent)

  const [name, setName] = useState(extracted.name || filename.replace(/\.pdf$/i, ''))
  const [type, setType] = useState<ComponentType>(guessType(extracted.name || filename))
  const [gain, setGain] = useState(extracted.gain_db?.toString() ?? '')
  const [nf, setNf] = useState(extracted.nf_db?.toString() ?? '')
  const [iip3, setIip3] = useState(extracted.iip3_dbm?.toString() ?? '')
  const [p1db, setP1db] = useState(extracted.p1db_dbm?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const gainN = parseFloat(gain)
    const nfN = parseFloat(nf)
    const iip3N = parseFloat(iip3)
    const p1dbN = parseFloat(p1db)
    if (!name.trim()) return setError('Name is required')
    if (isNaN(gainN) || isNaN(nfN) || isNaN(iip3N) || isNaN(p1dbN))
      return setError('All parameters must be numbers')

    addComponent({
      id: uuidv4(),
      name: name.trim(),
      type,
      gain_db: gainN,
      nf_db: nfN,
      iip3_dbm: iip3N,
      p1db_dbm: p1dbN,
      source: 'datasheet',
    })
    onDone()
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Review Extracted Parameters</p>

      <input
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Component name"
      />

      <select
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
        value={type}
        onChange={(e) => setType(e.target.value as ComponentType)}
      >
        {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        {([
          ['Gain (dB)', gain, setGain],
          ['NF (dB)', nf, setNf],
          ['IIP3 (dBm)', iip3, setIip3],
          ['P1dB (dBm)', p1db, setP1db],
        ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
          <div key={label}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type="number"
              step="any"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
              value={val}
              onChange={(e) => setter(e.target.value)}
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {extracted.extraction_notes && (
        <p className="text-xs text-gray-500 italic">{extracted.extraction_notes}</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-1.5 rounded transition-colors"
        >
          Add to Library
        </button>
        <button
          onClick={onDone}
          className="px-3 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
