import { useState } from 'react'
import {
  synthesisL,
  synthesisPi,
  synthesisT,
  qMin,
  type MatchingResult,
  type NetworkType,
} from '../../utils/matchingNetwork'
import { CircuitSvg } from './CircuitSvg'

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: MatchingResult }) {
  if (!result.valid) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-xs text-red-400">
        ⚠ {result.error}
      </div>
    )
  }

  const typeLabel: Record<NetworkType, string> = { L: 'L-network', pi: 'π-network', T: 'T-network' }
  const topoLabel = result.topology === 'lowpass' ? 'Low-pass' : 'High-pass'

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">
          {typeLabel[result.networkType]} — {topoLabel}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">Q = {result.Q}</span>
      </div>

      {/* Schematic */}
      <div className="bg-gray-950 rounded p-2 overflow-x-auto">
        <CircuitSvg networkType={result.networkType} elements={result.elements} />
      </div>

      {/* Component values */}
      <div className="flex flex-wrap gap-2">
        {result.elements.map((el) => (
          <div
            key={el.label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
              el.type === 'L'
                ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400'
                : 'bg-blue-900/20 border-blue-800 text-blue-400'
            }`}
          >
            <span className="font-semibold">{el.label}</span>
            <span className="text-gray-400">{el.position}</span>
            <span className="font-mono font-bold">{el.value} {el.unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

type Tab = 'L' | 'pi' | 'T'

export function MatchingNetworkPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('L')
  const [Rs, setRs] = useState(50)
  const [Rl, setRl] = useState(200)
  const [freq, setFreq] = useState(2.4)
  const [Q, setQ] = useState(3)

  const qm = qMin(Rs, Rl)

  const lResults = synthesisL(Rs, Rl, freq)
  const piResult = synthesisPi(Rs, Rl, freq, Q)
  const tResult  = synthesisT(Rs, Rl, freq, Q)

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>⚙ Matching Network</span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Rs (Ω)', value: Rs, set: setRs, step: 5 },
              { label: 'Rl (Ω)', value: Rl, set: setRl, step: 5 },
              { label: 'Freq (GHz)', value: freq, set: setFreq, step: 0.1 },
            ].map(({ label, value, set, step }) => (
              <div key={label}>
                <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  step={step}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
                />
              </div>
            ))}
          </div>

          {/* Q_min hint */}
          <p className="text-[10px] text-gray-600">
            Q<sub>min</sub> = {qm} — π and T networks require Q &gt; {qm}
          </p>

          {/* Network type tabs */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
            {(['L', 'pi', 'T'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1 transition-colors ${
                  tab === t ? 'bg-violet-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'pi' ? 'π-Network' : `${t}-Network`}
              </button>
            ))}
          </div>

          {/* Q selector for π / T */}
          {(tab === 'pi' || tab === 'T') && (
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">
                Desired Q (min {qm})
              </label>
              <input
                type="number"
                step={0.5}
                min={qm + 0.1}
                value={Q}
                onChange={(e) => setQ(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
              />
            </div>
          )}

          {/* Results */}
          <div className="space-y-3">
            {tab === 'L' && lResults.map((r, i) => <ResultCard key={i} result={r} />)}
            {tab === 'pi' && <ResultCard result={piResult} />}
            {tab === 'T'  && <ResultCard result={tResult} />}
          </div>
        </div>
      )}
    </div>
  )
}
