import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, ExtractedParams } from '../../types'

interface Props {
  extracted: ExtractedParams
  filename: string
  onDone: () => void
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

function guessType(name: string): ComponentType {
  const n = name.toLowerCase()

  // ── Explicit type strings ──────────────────────────────
  if (n.includes('lna'))                            return 'LNA'
  if (n.includes('vga') || n.includes('vca'))       return 'VGA'
  if (/\bpa\b/.test(n) || n.includes('power amp'))  return 'PA'
  if (n.includes('limiter') || n.includes('limit'))  return 'Limiter'
  if (n.includes('adc') || n.includes('a/d'))        return 'ADC'
  if (n.includes('dac') || n.includes('d/a'))        return 'DAC'
  if (n.includes('pll'))                             return 'PLL'
  if (n.includes('vco'))                             return 'VCO'
  if (n.includes('vcxo'))                            return 'VCXO'
  if (n.includes('mix'))                             return 'Mixer'
  if (n.includes('bpf') || n.includes('bandpass'))   return 'BPF'
  if (n.includes('lpf') || n.includes('low pass') || n.includes('lowpass')) return 'LPF'
  if (n.includes('hpf') || n.includes('high pass') || n.includes('highpass')) return 'HPF'
  if (n.includes('notch') || n.includes('bsf') || n.includes('band stop')) return 'BSF'
  if (n.includes('diplexer'))                        return 'Diplexer'
  if (n.includes('filter') || n.includes('filt'))    return 'BPF'
  if (n.includes('att') || n.includes('atten') || n.includes('pad')) return 'Attenuator'
  if (n.includes('splitter') || n.includes('divid') || n.includes('wilkinson')) return 'Splitter'
  if (n.includes('coupl'))                           return 'Coupler'
  if (n.includes('circul'))                          return 'Circulator'
  if (n.includes('isol'))                            return 'Isolator'
  if (n.includes('switch') || n.includes('spdt') || n.includes('sp3t') || n.includes('spnt')) return 'Switch'
  if (n.includes('t/r') || n.includes('tr switch'))  return 'TRSwitch'
  if (n.includes('balun'))                           return 'Balun'
  if (n.includes('phase') || n.includes('phas'))     return 'PhaseShifter'
  if (n.includes('amp') || n.includes('gain') || n.includes('driver')) return 'Amplifier'

  // ── Part-number prefix heuristics (manufacturer patterns) ─────────────────
  // Qorvo/TriQuint filters: QPQ, QPC, QPF, QPM
  if (/^qp[qcfm]/i.test(n))  return 'BPF'
  // Qorvo/TriQuint amplifiers: TQP, QPA, TGA, QPG
  if (/^(tqp|qpa|tga|qpg)/i.test(n)) return 'Amplifier'
  // Qorvo/TriQuint LNAs: QPL, TQL
  if (/^(qpl|tql)/i.test(n)) return 'LNA'
  // Mini-Circuits filters: SBP, SLP, SHP, SXBP, SXLP, SXHP, VBF, VLF, VHF
  if (/^s[blh]p|^sx[blh]p|^v[blh]f/i.test(n)) return 'BPF'
  // Mini-Circuits amplifiers: ERA, ZX60, ZX67, MAR, MAV, LEE, PHA, PSA, MGA, SNA
  if (/^(era|mar|mav|lee|psa|mga|sna)/i.test(n)) return 'Amplifier'
  if (/^zx6/i.test(n)) return 'Amplifier'
  // Analog Devices / ADI amplifiers: HMC4xx, HMC8xx, ADL5xxx
  if (/^hmc[2-9]\d{2}/i.test(n)) return 'Amplifier'
  if (/^adl5[0-5]/i.test(n)) return 'Amplifier'
  // ADI/Analog mixers: HMC1xx, ADL58xx, LTC5xxx
  if (/^hmc1\d{2}|^adl58|^ltc5/i.test(n)) return 'Mixer'
  // NXP / Ampleon power amps: BLM, BLP, BLF, BLC
  if (/^bl[mcpf]/i.test(n)) return 'PA'
  // Skyworks amplifiers: SKY, SE
  if (/^sky[0-9]|^se[0-9]/i.test(n)) return 'Amplifier'
  // Avago/Broadcom: MGA, MNA, ALM, ABA
  if (/^(mna|alm|aba)/i.test(n)) return 'Amplifier'
  // Generic "AG" prefix often = amplifier gain block
  if (/^ag\d/i.test(n)) return 'Amplifier'

  return 'Generic'
}

export function ExtractionReview({ extracted, filename, onDone }: Props) {
  const addComponent  = useSpectraStore((s) => s.addComponent)
  const addToChain    = useSpectraStore((s) => s.addToChain)
  const focusLibrary  = useSpectraStore((s) => s.focusLibrary)
  const chain         = useSpectraStore((s) => s.chain)
  const nodePositions = useSpectraStore((s) => s.nodePositions)

  const [name, setName] = useState(extracted.name || filename.replace(/\.pdf$/i, ''))
  const [type, setType] = useState<ComponentType>(guessType(extracted.name || filename))
  const [gain, setGain] = useState(extracted.gain_db?.toString() ?? '')
  const [nf,   setNf]   = useState(extracted.nf_db?.toString()  ?? '')
  const [iip3, setIip3] = useState(extracted.iip3_dbm?.toString() ?? '')
  const [p1db, setP1db] = useState(extracted.p1db_dbm?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  function buildComponent() {
    const gainN = parseFloat(gain)
    const nfN   = parseFloat(nf)
    if (!name.trim())  { setError('Name is required');         return null }
    if (isNaN(gainN))  { setError('Gain must be a number');    return null }
    if (isNaN(nfN))    { setError('NF must be a number');      return null }
    return {
      id:       uuidv4(),
      name:     name.trim(),
      type,
      gain_db:  gainN,
      nf_db:    nfN,
      iip3_dbm: iip3 !== '' ? parseFloat(iip3) : null,
      p1db_dbm: p1db !== '' ? parseFloat(p1db) : null,
      source:   'datasheet' as const,
    }
  }

  function handleAddToChain() {
    const comp = buildComponent()
    if (!comp) return
    addComponent(comp)
    // Position next to last node in chain
    const lastId  = chain[chain.length - 1]
    const lastPos = lastId ? (nodePositions[lastId] ?? { x: 0, y: 160 }) : { x: -260, y: 160 }
    addToChain(comp.id, undefined, { x: lastPos.x + 260, y: lastPos.y })
    onDone()
  }

  function handleSaveToLibrary() {
    const comp = buildComponent()
    if (!comp) return
    addComponent(comp)
    focusLibrary()   // auto-switch sidebar to My Library tab
    onDone()
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Review Extracted Parameters
      </p>

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
          ['Gain (dB)',  gain, setGain, true ],
          ['NF (dB)',    nf,   setNf,   true ],
          ['IIP3 (dBm)', iip3, setIip3, false],
          ['P1dB (dBm)', p1db, setP1db, false],
        ] as [string, string, (v: string) => void, boolean][]).map(([label, val, setter, required]) => (
          <div key={label}>
            <label className="block text-xs text-gray-500 mb-1">
              {label}
              {!required && <span className="text-gray-700 ml-1 text-[9px]">optional</span>}
            </label>
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
        <p className="text-xs text-gray-500 italic leading-relaxed">
          {extracted.extraction_notes}
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Primary: Add to Chain */}
      <button
        onClick={handleAddToChain}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
      >
        ⟶ Add to Chain
      </button>

      {/* Secondary: Save to Library only */}
      <div className="flex gap-2">
        <button
          onClick={handleSaveToLibrary}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 rounded transition-colors"
        >
          Save to Library
        </button>
        <button
          onClick={onDone}
          className="px-3 bg-gray-800 hover:bg-gray-700 text-gray-500 text-xs rounded transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-[10px] text-gray-700 text-center leading-tight">
        "Add to Chain" places it on the canvas instantly.<br/>
        "Save to Library" stores it under <span className="text-gray-500">Components → My Library</span>.
      </p>
    </div>
  )
}
