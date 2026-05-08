/**
 * Dynamic Range Panel
 *
 * SFDR  = (2/3) · (IIP3 - Noise Floor)        [dB]
 * IDR   = IIP3 - Noise Floor                   [dB]  (Instantaneous / Linear DR)
 * BDR   = P1dB_in - Noise Floor                [dB]  (Blocking DR — using P1dB ≈ IIP3 - 9.6 dB)
 *
 * All quantities are input-referred.
 * Noise floor = sensitivity_dbm (kTB + NF, already computed by backend).
 */

interface Props {
  iip3_dbm: number
  sensitivity_dbm: number
}

function Row({ label, value, unit, color, tooltip }: {
  label: string
  value: number
  unit: string
  color: string
  tooltip: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60 group relative">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[9px] text-gray-700 cursor-help" title={tooltip}>(?)</span>
      </div>
      <span className={`text-sm font-mono font-bold ${color}`}>
        {value.toFixed(1)}
        <span className="text-[10px] text-gray-600 font-normal ml-1">{unit}</span>
      </span>
    </div>
  )
}

// Visual range bar
function RangeBar({ label, low, high, color }: {
  label: string; low: number; high: number; color: string
}) {
  const span = high - low
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>{label}</span>
        <span className="font-mono">{span.toFixed(1)} dB</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full opacity-80" style={{ width: '100%', background: color }} />
      </div>
      <div className="flex justify-between text-[9px] text-gray-700 font-mono">
        <span>{low.toFixed(1)} dBm</span>
        <span>{high.toFixed(1)} dBm</span>
      </div>
    </div>
  )
}

export function DynamicRangePanel({ iip3_dbm, sensitivity_dbm }: Props) {
  const noiseFloor  = sensitivity_dbm                       // kTB + NF (input-referred)
  const sfdr        = (2 / 3) * (iip3_dbm - noiseFloor)    // SFDR in dB
  const idr         = iip3_dbm - noiseFloor                 // Instantaneous DR
  const p1db_in     = iip3_dbm - 9.6                        // Approximate: P1dB ≈ IIP3 − 9.6 dB
  const bdr         = p1db_in - noiseFloor                  // Blocking DR

  // Input level at which IM3 = noise floor (= sensitivity + SFDR)
  const sfdr_top    = noiseFloor + sfdr

  return (
    <div className="border-t border-gray-800 pt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Dynamic Range
      </p>

      {/* Metric rows */}
      <div className="bg-gray-900 rounded-lg px-3 py-1 border border-gray-800">
        <Row
          label="SFDR"
          value={sfdr}
          unit="dB"
          color="text-rose-400"
          tooltip="Spurious-Free Dynamic Range = (2/3)·(IIP3 − Noise Floor)"
        />
        <Row
          label="Instantaneous DR"
          value={idr}
          unit="dB"
          color="text-orange-400"
          tooltip="IIP3 − Noise Floor (linear dynamic range)"
        />
        <Row
          label="Blocking DR"
          value={bdr}
          unit="dB"
          color="text-yellow-400"
          tooltip="P1dB(in) − Noise Floor, where P1dB ≈ IIP3 − 9.6 dB"
        />
        <Row
          label="Noise Floor"
          value={noiseFloor}
          unit="dBm"
          color="text-gray-400"
          tooltip="Input-referred noise floor = kTB + Cascaded NF (= Sensitivity)"
        />
        <Row
          label="IIP3 (input)"
          value={iip3_dbm}
          unit="dBm"
          color="text-blue-400"
          tooltip="Input-referred third-order intercept point"
        />
      </div>

      {/* Visual range bars */}
      <div className="space-y-3">
        <RangeBar label="SFDR window"        low={noiseFloor} high={sfdr_top}  color="#fb7185" />
        <RangeBar label="Instantaneous DR"   low={noiseFloor} high={iip3_dbm}  color="#fb923c" />
        <RangeBar label="Blocking DR"        low={noiseFloor} high={p1db_in}   color="#facc15" />
      </div>

      <p className="text-[9px] text-gray-700 leading-relaxed">
        SFDR = highest signal level at which no IM3 product rises above the noise floor.
        A higher SFDR means the receiver can handle stronger interferers.
      </p>
    </div>
  )
}
