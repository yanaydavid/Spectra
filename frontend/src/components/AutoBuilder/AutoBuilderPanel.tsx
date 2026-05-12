/**
 * Auto-Builder Panel
 *
 * User sets design targets → engine searches the catalog → shows top-5 chains.
 * One click loads a suggested chain into the main canvas.
 */

import { useState } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { autoDesign, type CandidateChain, type DesignTargets } from '../../utils/autoBuilder'

// ── helpers ───────────────────────────────────────────────────────────────────

function MetBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
      ok
        ? 'text-emerald-300 border-emerald-800 bg-emerald-900/30'
        : 'text-red-400 border-red-900 bg-red-900/20'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-mono w-6 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

// ── result card ───────────────────────────────────────────────────────────────

function ResultCard({
  candidate,
  rank,
  onLoad,
}: {
  candidate: CandidateChain
  rank: number
  onLoad: () => void
}) {
  const [expanded, setExpanded] = useState(rank === 0)

  return (
    <div
      className={`rounded-lg border transition-colors ${
        candidate.meetsAll
          ? 'border-emerald-800 bg-emerald-950/30'
          : 'border-gray-800 bg-gray-900/40'
      }`}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`text-[10px] font-bold w-4 shrink-0 ${
          rank === 0 ? 'text-amber-400' : 'text-gray-600'
        }`}>
          #{rank + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-300 truncate">
            {candidate.components.map((c) => c.name).join(' → ')}
          </p>
          <ScoreBar score={candidate.score} />
        </div>
        <span className="text-[10px] text-gray-700 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-800/60 pt-2">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'NF',   value: candidate.nf_db.toFixed(1),   unit: 'dB',  color: 'text-amber-400' },
              { label: 'Gain', value: candidate.gain_db.toFixed(1),  unit: 'dB',  color: 'text-emerald-400' },
              { label: 'IIP3', value: candidate.iip3_dbm.toFixed(1), unit: 'dBm', color: 'text-blue-400' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-gray-900 rounded px-2 py-1 border border-gray-800">
                <p className="text-[9px] text-gray-600">{label}</p>
                <p className={`text-xs font-mono font-semibold ${color}`}>
                  {value}
                  <span className="text-[9px] text-gray-600 ml-0.5">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Target badges */}
          <div className="flex flex-wrap gap-1">
            <MetBadge ok={candidate.meetsNf}   label="NF"   />
            <MetBadge ok={candidate.meetsGain}  label="Gain" />
            <MetBadge ok={candidate.meetsIip3}  label="IIP3" />
          </div>

          {/* Component list */}
          <div className="space-y-0.5">
            {candidate.components.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px]">
                <span className="text-gray-700 w-3 shrink-0">{i + 1}.</span>
                <span className="text-gray-400 flex-1 truncate">{c.name}</span>
                <span className="text-gray-600 font-mono">{c.gain_db}dB</span>
                <span className="text-gray-600 font-mono">NF{c.nf_db}</span>
              </div>
            ))}
          </div>

          {/* Load button */}
          <button
            onClick={(e) => { e.stopPropagation(); onLoad() }}
            className="w-full text-[10px] py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors font-semibold"
          >
            ↗ Load this design
          </button>
        </div>
      )}
    </div>
  )
}

// ── number input ──────────────────────────────────────────────────────────────

function TargetInput({
  label, value, unit, onChange, step = 1,
}: {
  label: string; value: number; unit: string
  onChange: (v: number) => void; step?: number
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-1">
        {label} <span className="text-gray-700">({unit})</span>
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
      />
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function AutoBuilderPanel() {
  const [open, setOpen] = useState(false)

  const addToChain    = useSpectraStore((s) => s.addToChain)
  const addComponent  = useSpectraStore((s) => s.addComponent)
  const clearChain    = useSpectraStore((s) => s.clearChain)

  const [targets, setTargets] = useState<DesignTargets>({
    max_nf_db:    3,
    min_gain_db:  20,
    min_iip3_dbm: 0,
  })
  const [results, setResults] = useState<CandidateChain[] | null>(null)

  const set = (k: keyof DesignTargets) => (v: number) =>
    setTargets((t) => ({ ...t, [k]: v }))

  const run = () => {
    try {
      const res = autoDesign(targets)
      setResults(res)
    } catch (e) {
      console.error('AutoBuilder error:', e)
      setResults([])
    }
  }

  function loadDesign(candidate: CandidateChain) {
    // Clear current chain then add each component
    clearChain()
    for (const comp of candidate.components) {
      // Register with a fresh ID so it doesn't conflict
      const freshId = `autobuilt_${comp.name.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const registered = { ...comp, id: freshId, source: 'catalog' as const }
      addComponent(registered)
      addToChain(freshId)
    }
  }

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>⚡ Auto-Builder</span>
          {results !== null && (
            <span className={`text-[9px] rounded px-1 border font-mono ${
              results.some((r) => r.meetsAll)
                ? 'text-emerald-300 border-emerald-800 bg-emerald-900/30'
                : 'text-amber-300 border-amber-800 bg-amber-900/30'
            }`}>
              {results.filter((r) => r.meetsAll).length}/{results.length} meet targets
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Target inputs */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Design targets</p>
            <div className="grid grid-cols-3 gap-2">
              <TargetInput label="Max NF"   value={targets.max_nf_db}    unit="dB"  onChange={set('max_nf_db')}    step={0.5} />
              <TargetInput label="Min Gain" value={targets.min_gain_db}  unit="dB"  onChange={set('min_gain_db')}  step={1}   />
              <TargetInput label="Min IIP3" value={targets.min_iip3_dbm} unit="dBm" onChange={set('min_iip3_dbm')} step={1}   />
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={run}
            className="w-full py-2 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded transition-colors"
          >
            ⚡ Find optimal designs
          </button>

          {/* Results */}
          {results !== null && (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                Top results — click to expand, load to apply
              </p>
              {results.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-2">
                  No viable chains found. Try relaxing the targets.
                </p>
              ) : (
                results.map((r, i) => (
                  <ResultCard
                    key={i}
                    candidate={r}
                    rank={i}
                    onLoad={() => loadDesign(r)}
                  />
                ))
              )}
            </div>
          )}

          <p className="text-[9px] text-gray-700 leading-relaxed">
            Searches up to 4-stage chains from the built-in catalog using beam search.
            Score reflects how well all three targets are met simultaneously.
          </p>
        </div>
      )}
    </div>
  )
}
