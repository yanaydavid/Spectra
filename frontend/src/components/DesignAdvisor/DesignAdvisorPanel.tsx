/**
 * Design Advisor Panel
 *
 * Analyses the current chain and surfaces actionable RF design insights:
 *  - Noise Figure contribution waterfall (per-stage %)
 *  - IIP3 bottleneck bar
 *  - Stage-ordering recommendations with one-click apply
 *  - Gain warnings
 */

import { useState, useMemo } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { analyzeChain, type AdvisorInsight, type NfContribution } from '../../utils/designAdvisor'

// ── severity config ───────────────────────────────────────────────────────────

const SEV_ICON: Record<string, string> = {
  info:     '💡',
  warn:     '⚠️',
  critical: '🔴',
}
const SEV_BG: Record<string, string> = {
  info:     'bg-sky-900/30 border-sky-800',
  warn:     'bg-amber-900/30 border-amber-800',
  critical: 'bg-red-900/30 border-red-800',
}
const SEV_TEXT: Record<string, string> = {
  info:     'text-sky-300',
  warn:     'text-amber-300',
  critical: 'text-red-300',
}

// ── NF waterfall bar ──────────────────────────────────────────────────────────

const STAGE_COLORS = [
  '#a78bfa', '#34d399', '#60a5fa', '#fb923c',
  '#f472b6', '#facc15', '#4ade80', '#38bdf8',
]

function NfWaterfall({ contribs }: { contribs: NfContribution[] }) {
  if (contribs.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-gray-600 uppercase tracking-wider">NF contribution per stage</p>
      {contribs.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500 w-24 truncate shrink-0">{c.componentName}</span>
          <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(c.pct, 2)}%`,
                background: STAGE_COLORS[i % STAGE_COLORS.length],
              }}
            />
          </div>
          <span
            className="text-[9px] font-mono w-9 text-right shrink-0"
            style={{ color: STAGE_COLORS[i % STAGE_COLORS.length] }}
          >
            {c.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── IIP3 contribution bar ─────────────────────────────────────────────────────

function Iip3Bar({ contribs }: { contribs: { stageIndex: number; componentName: string; pct: number }[] }) {
  if (contribs.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-gray-600 uppercase tracking-wider">IIP3 degradation per stage</p>
      {contribs.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500 w-24 truncate shrink-0">{c.componentName}</span>
          <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(c.pct, 2)}%`,
                background: STAGE_COLORS[i % STAGE_COLORS.length],
              }}
            />
          </div>
          <span
            className="text-[9px] font-mono w-9 text-right shrink-0"
            style={{ color: STAGE_COLORS[i % STAGE_COLORS.length] }}
          >
            {c.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── insight card ──────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onApply,
}: {
  insight: AdvisorInsight
  onApply?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-lg border px-3 py-2 ${SEV_BG[insight.severity]}`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{SEV_ICON[insight.severity]}</span>
          <span className={`text-[11px] font-semibold ${SEV_TEXT[insight.severity]}`}>
            {insight.title}
          </span>
        </div>
        <span className="text-[10px] text-gray-700">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-gray-400 leading-relaxed">{insight.detail}</p>
          {insight.type === 'reorder_beneficial' && onApply && (
            <button
              onClick={(e) => { e.stopPropagation(); onApply() }}
              className="text-[10px] px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors font-semibold"
            >
              ✦ Apply optimal order (−{insight.nfImprovement?.toFixed(1)} dB NF)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function DesignAdvisorPanel() {
  const [open, setOpen] = useState(false)

  const chain      = useSpectraStore((s) => s.chain)
  const components = useSpectraStore((s) => s.components)
  const cascadeResult = useSpectraStore((s) => s.cascadeResult)
  const reorderChain  = useSpectraStore((s) => s.reorderChain)
  const clearChain    = useSpectraStore((s) => s.clearChain)
  const addToChain    = useSpectraStore((s) => s.addToChain)

  const result = useMemo(() => {
    if (!cascadeResult || chain.length === 0) return null
    return analyzeChain(chain, components, cascadeResult.per_stage)
  }, [chain, components, cascadeResult])

  const criticalCount = result?.insights.filter((i) => i.severity === 'critical').length ?? 0
  const warnCount     = result?.insights.filter((i) => i.severity === 'warn').length ?? 0

  function applyOptimalOrder(suggestedOrder: string[]) {
    // suggestedOrder is sorted component IDs — map back to current chain entry IDs
    // The chain entries are unique instance IDs like "compId__timestamp_random"
    // We need to reorder the chain array to match the suggested component order
    const currentChain = [...chain]

    // Build a map from base component id to chain entry ids
    const entrysByBase: Record<string, string[]> = {}
    for (const entryId of currentChain) {
      // entryId is either a plain id (from library) or "baseId__ts_rand"
      const base = entryId.split('__')[0]
      if (!entrysByBase[base]) entrysByBase[base] = []
      entrysByBase[base].push(entryId)
    }

    const newOrder: string[] = []
    const used = new Set<string>()

    for (const suggestedId of suggestedOrder) {
      // find the chain entry for this component
      const base = suggestedId.split('__')[0]
      const candidates = currentChain.filter(
        (id) => (id === suggestedId || id.startsWith(base + '__')) && !used.has(id)
      )
      if (candidates.length > 0) {
        newOrder.push(candidates[0])
        used.add(candidates[0])
      }
    }

    // Append any remaining (shouldn't happen but safety)
    for (const id of currentChain) {
      if (!used.has(id)) newOrder.push(id)
    }

    // Apply by reordering: swap chain to match newOrder
    // Easiest: clear and re-add in new order using the store's addToChain
    // But addToChain clones — instead we do a series of reorderChain ops
    // Simplest safe approach: replace chain via clearChain + rebuild isn't ideal
    // Use selection sort via reorderChain
    const working = [...chain]
    for (let i = 0; i < newOrder.length; i++) {
      const targetId = newOrder[i]
      const currentIdx = working.indexOf(targetId)
      if (currentIdx !== i) {
        reorderChain(currentIdx, i)
        working.splice(i, 0, working.splice(currentIdx, 1)[0])
      }
    }
  }

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🧠 Design Advisor</span>
          {(criticalCount > 0 || warnCount > 0) && (
            <span className="flex gap-1">
              {criticalCount > 0 && (
                <span className="text-[9px] bg-red-900/50 text-red-300 border border-red-800 rounded px-1 font-mono">
                  {criticalCount} critical
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-800 rounded px-1 font-mono">
                  {warnCount} warn
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {chain.length === 0 || !result ? (
            <p className="text-xs text-gray-600 text-center py-2">
              Add components to the chain to see design recommendations
            </p>
          ) : (
            <>
              {/* NF Waterfall */}
              <NfWaterfall contribs={result.nfContributions} />

              {/* IIP3 contributions */}
              {result.iip3Contributions.length > 1 && (
                <Iip3Bar contribs={result.iip3Contributions} />
              )}

              {/* Insights */}
              {result.insights.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">Recommendations</p>
                  {result.insights.map((insight, i) => (
                    <InsightCard
                      key={i}
                      insight={insight}
                      onApply={
                        insight.suggestedOrder
                          ? () => applyOptimalOrder(insight.suggestedOrder!)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}

              <p className="text-[9px] text-gray-700 leading-relaxed">
                NF contribution uses Friis decomposition. IIP3 bottleneck shows gain-referred input intercept degradation per stage.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
