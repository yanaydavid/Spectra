import { useState } from 'react'
import React from 'react'

interface Props {
  /** Receiver sensitivity from cascade (dBm) — already includes NF */
  sensitivityDbm: number | null
  /** Center frequency from system params (GHz) */
  freqGhz?: number
}

interface LinkParams {
  p_tx_dbm: number       // Transmit power
  g_tx_dbi: number       // TX antenna gain
  g_rx_dbi: number       // RX antenna gain
  freq_ghz: number       // Frequency
  distance_km: number    // Link distance
  snr_req_db: number     // Required SNR for demodulation
}

function fspl(freq_ghz: number, distance_km: number): number {
  // Free Space Path Loss: 92.45 + 20·log10(f_GHz) + 20·log10(d_km)
  return 92.45 + 20 * Math.log10(freq_ghz) + 20 * Math.log10(distance_km)
}

function calcBudget(p: LinkParams, sensitivityDbm: number | null) {
  const eirp = p.p_tx_dbm + p.g_tx_dbi
  const pathLoss = fspl(p.freq_ghz, p.distance_km)
  const rxPower = eirp - pathLoss + p.g_rx_dbi
  const reqSensitivity = sensitivityDbm !== null ? sensitivityDbm + p.snr_req_db : null
  const margin = reqSensitivity !== null ? rxPower - reqSensitivity : null
  return { eirp, pathLoss, rxPower, reqSensitivity, margin }
}

function NumField({
  label,
  unit,
  value,
  onChange,
  step = 1,
}: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] text-gray-500 w-20 shrink-0">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
      />
      <span className="text-[10px] text-gray-600 w-8 shrink-0">{unit}</span>
    </div>
  )
}

function ResultRow({ label, value, unit, colorClass = 'text-gray-200' }: { label: string; value: number; unit: string; colorClass?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs font-mono ${colorClass}`}>
        {value.toFixed(1)} <span className="text-gray-600">{unit}</span>
      </span>
    </div>
  )
}

const DEFAULT_PARAMS: LinkParams = {
  p_tx_dbm: 23,
  g_tx_dbi: 0,
  g_rx_dbi: 0,
  freq_ghz: 2.4,
  distance_km: 1,
  snr_req_db: 10,
}

export function LinkBudgetPanel({ sensitivityDbm, freqGhz }: Props) {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState<LinkParams>({
    ...DEFAULT_PARAMS,
    freq_ghz: freqGhz ?? DEFAULT_PARAMS.freq_ghz,
  })

  // Keep freq_ghz in sync when system params change (only if user hasn't overridden)
  const prevFreqRef = React.useRef(freqGhz)
  React.useEffect(() => {
    if (freqGhz !== undefined && freqGhz !== prevFreqRef.current) {
      setP((prev) => ({ ...prev, freq_ghz: freqGhz }))
      prevFreqRef.current = freqGhz
    }
  }, [freqGhz])

  const set = (key: keyof LinkParams) => (v: number) => setP((prev) => ({ ...prev, [key]: v }))

  const result = calcBudget(p, sensitivityDbm)
  const marginColor =
    result.margin === null
      ? 'text-gray-500'
      : result.margin >= 10
      ? 'text-emerald-400'
      : result.margin >= 0
      ? 'text-amber-400'
      : 'text-red-400'

  return (
    <div className="border-t border-gray-800 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>Link Budget</span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Inputs */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Transmitter</p>
            <NumField label="TX Power"    unit="dBm" value={p.p_tx_dbm}     onChange={set('p_tx_dbm')} step={0.5} />
            <NumField label="TX Antenna"  unit="dBi" value={p.g_tx_dbi}     onChange={set('g_tx_dbi')} step={0.5} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Channel</p>
            <NumField label="Frequency"   unit="GHz" value={p.freq_ghz}     onChange={set('freq_ghz')}     step={0.1} />
            <NumField label="Distance"    unit="km"  value={p.distance_km}  onChange={set('distance_km')}  step={0.1} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Receiver</p>
            <NumField label="RX Antenna"  unit="dBi" value={p.g_rx_dbi}     onChange={set('g_rx_dbi')} step={0.5} />
            <NumField label="Req. SNR"    unit="dB"  value={p.snr_req_db}   onChange={set('snr_req_db')} />
          </div>

          {/* Results */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 space-y-0.5">
            <ResultRow label="EIRP"             value={result.eirp}      unit="dBm" colorClass="text-gray-300" />
            <ResultRow label="Path Loss (FSPL)" value={result.pathLoss}  unit="dB"  colorClass="text-gray-400" />
            <ResultRow label="Received Power"   value={result.rxPower}   unit="dBm" colorClass="text-blue-400" />
            {result.reqSensitivity !== null && (
              <ResultRow label="Required Sens."  value={result.reqSensitivity} unit="dBm" colorClass="text-amber-400" />
            )}
            {sensitivityDbm === null && (
              <p className="text-[10px] text-gray-600 pt-1">Add a chain to compute receiver sensitivity</p>
            )}

            {result.margin !== null && (
              <>
                <div className="border-t border-gray-800 mt-2 pt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Link Margin</span>
                  <span className={`text-lg font-mono font-bold ${marginColor}`}>
                    {result.margin >= 0 ? '+' : ''}{result.margin.toFixed(1)}
                    <span className="text-xs font-normal text-gray-500 ml-1">dB</span>
                  </span>
                </div>
                <p className={`text-[10px] text-center pt-1 ${marginColor}`}>
                  {result.margin >= 10
                    ? '✓ Link is healthy'
                    : result.margin >= 0
                    ? '⚠ Link is marginal'
                    : '✗ Link budget is closed — insufficient margin'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
