/**
 * Design Advisor — chain analysis engine
 *
 * Produces actionable insights from the cascade result:
 *  - NF contribution % per stage (Friis decomposition)
 *  - IIP3 bottleneck identification
 *  - Gain deficit / excess warnings
 *  - Optimal ordering suggestion (greedy: highest G/NF ratio first)
 */

import type { RFComponent } from '../types'
import type { PerStageResult } from '../types'

export interface NfContribution {
  stageIndex: number
  componentName: string
  /** Friis noise contribution in linear (F - 1) / G_prev */
  linear: number
  /** Percentage of total cascaded F */
  pct: number
}

export interface IssueLevel { level: 'ok' | 'warn' | 'critical'; msg: string }

export interface AdvisorInsight {
  type: 'nf_dominator' | 'iip3_bottleneck' | 'gain_deficit' | 'gain_excess'
       | 'reorder_beneficial' | 'already_optimal' | 'single_stage'
  severity: 'info' | 'warn' | 'critical'
  title: string
  detail: string
  /** If set, the reordered chain IDs that would improve NF */
  suggestedOrder?: string[]
  /** improvement delta if reorder applied */
  nfImprovement?: number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function dbToLin(db: number) { return Math.pow(10, db / 10) }
function linToDb(lin: number) { return 10 * Math.log10(Math.max(lin, 1e-15)) }
function dbmToMw(dbm: number) { return Math.pow(10, dbm / 10) }
function mwToDbm(mw: number)  { return 10 * Math.log10(Math.max(mw, 1e-15)) }

/** Friis cascaded NF (linear F) for a given stage order */
function cascadeNf(stages: RFComponent[]): number {
  if (stages.length === 0) return 1
  let f    = dbToLin(Math.max(stages[0].nf_db, 0))
  let gLin = dbToLin(stages[0].gain_db)
  for (let i = 1; i < stages.length; i++) {
    f    += (dbToLin(Math.max(stages[i].nf_db, 0)) - 1) / gLin
    gLin *= dbToLin(stages[i].gain_db)
  }
  return f
}

/** Per-stage Friis NF contributions (linear) */
function nfContributions(stages: RFComponent[]): NfContribution[] {
  if (stages.length === 0) return []
  const contribs: number[] = []
  let gLin = 1

  for (let i = 0; i < stages.length; i++) {
    const fi = dbToLin(Math.max(stages[i].nf_db, 0))
    contribs.push(i === 0 ? fi : (fi - 1) / gLin)
    gLin *= dbToLin(stages[i].gain_db)
  }

  const total = contribs.reduce((a, b) => a + b, 0)
  return stages.map((s, i) => ({
    stageIndex: i,
    componentName: s.name,
    linear: contribs[i],
    pct: total > 0 ? (contribs[i] / total) * 100 : 0,
  }))
}

/** Cascaded IIP3 (input-referred mW) */
function cascadeIip3(stages: RFComponent[]): number {
  if (stages.length === 0) return Infinity
  let invIip3     = stages[0].iip3_dbm != null ? 1 / dbmToMw(stages[0].iip3_dbm) : 0
  let gainForIip3 = dbToLin(stages[0].gain_db)
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].iip3_dbm != null) {
      invIip3 += gainForIip3 / dbmToMw(stages[i].iip3_dbm!)
    }
    gainForIip3 *= dbToLin(stages[i].gain_db)
  }
  return invIip3 > 0 ? 1 / invIip3 : Infinity
}

/** Greedy sort: descending gain/NF ratio (best gain + best NF first) */
function greedyOptimalOrder(stages: RFComponent[]): RFComponent[] {
  return [...stages].sort((a, b) => {
    // Primary: gain descending (high gain first reduces NF of subsequent stages)
    // Secondary: NF ascending (low NF stage first)
    const scoreA = a.gain_db - a.nf_db
    const scoreB = b.gain_db - b.nf_db
    return scoreB - scoreA
  })
}

// ── main export ───────────────────────────────────────────────────────────────

export interface AdvisorResult {
  nfContributions: NfContribution[]
  insights: AdvisorInsight[]
  /** IIP3 contribution (linear gain-referred) % per stage */
  iip3Contributions: { stageIndex: number; componentName: string; pct: number }[]
}

export function analyzeChain(
  chain: string[],
  components: Record<string, RFComponent>,
  perStage: PerStageResult[],
): AdvisorResult {
  const stages = chain.map((id) => components[id]).filter(Boolean)
  if (stages.length === 0) {
    return { nfContributions: [], insights: [], iip3Contributions: [] }
  }

  const insights: AdvisorInsight[] = []
  const nfContribs = nfContributions(stages)

  // ── NF dominator ──────────────────────────────────────────────────────────
  const topNf = [...nfContribs].sort((a, b) => b.pct - a.pct)[0]
  if (topNf.pct > 60) {
    insights.push({
      type: 'nf_dominator',
      severity: topNf.pct > 80 ? 'critical' : 'warn',
      title: `${topNf.componentName} dominates NF`,
      detail: `Stage ${topNf.stageIndex + 1} contributes ${topNf.pct.toFixed(0)}% of the cascaded noise figure. Improving its NF or moving a high-gain stage before it would have the biggest impact.`,
    })
  }

  // ── gain deficit / excess ─────────────────────────────────────────────────
  const totalGain = perStage[perStage.length - 1]?.cumulative_gain_db ?? 0
  if (totalGain < 0) {
    insights.push({
      type: 'gain_deficit',
      severity: 'critical',
      title: 'Net chain loss',
      detail: `Total gain is ${totalGain.toFixed(1)} dB — the chain is lossy overall. Consider adding a gain stage or reducing attenuation.`,
    })
  } else if (totalGain > 50) {
    insights.push({
      type: 'gain_excess',
      severity: 'warn',
      title: 'Very high gain',
      detail: `Total gain is ${totalGain.toFixed(1)} dB. Excessive gain early in the chain can compress the receiver and worsen IIP3. Consider adding attenuation or splitting into sub-chains.`,
    })
  }

  // ── IIP3 bottleneck ───────────────────────────────────────────────────────
  const stagesWithIip3 = stages.filter((s) => s.iip3_dbm != null)
  if (stagesWithIip3.length > 1) {
    // Find which stage contributes most to 1/IIP3_cascade
    const invContribs: number[] = []
    let gainForIip3 = 1
    for (const s of stages) {
      if (s.iip3_dbm != null) {
        invContribs.push(gainForIip3 / dbmToMw(s.iip3_dbm))
      } else {
        invContribs.push(0)
      }
      gainForIip3 *= dbToLin(s.gain_db)
    }
    const totalInv = invContribs.reduce((a, b) => a + b, 0)
    const iip3Pcts = stages.map((s, i) => ({
      stageIndex: i,
      componentName: s.name,
      pct: totalInv > 0 ? (invContribs[i] / totalInv) * 100 : 0,
    }))

    const topIip3 = [...iip3Pcts].sort((a, b) => b.pct - a.pct)[0]
    if (topIip3.pct > 50) {
      insights.push({
        type: 'iip3_bottleneck',
        severity: topIip3.pct > 80 ? 'critical' : 'warn',
        title: `${topIip3.componentName} limits linearity`,
        detail: `Stage ${topIip3.stageIndex + 1} accounts for ${topIip3.pct.toFixed(0)}% of the cascaded IIP3 degradation. Improving its IIP3 or reducing the gain feeding into it would have the most impact on dynamic range.`,
      })
    }

    // Return iip3Pcts for chart
    const iip3Contributions = iip3Pcts
    const currentNfLin = cascadeNf(stages)
    const optimal = greedyOptimalOrder(stages)
    const optimalNfLin = cascadeNf(optimal)
    const nfImprovement = linToDb(currentNfLin) - linToDb(optimalNfLin)

    if (stages.length > 1 && nfImprovement > 0.3) {
      const suggestedOrder = optimal.map((s) => s.id)
      insights.push({
        type: 'reorder_beneficial',
        severity: nfImprovement > 1 ? 'warn' : 'info',
        title: `Reordering could save ${nfImprovement.toFixed(1)} dB NF`,
        detail: `The optimal ordering (by gain−NF score) would achieve a cascaded NF ${nfImprovement.toFixed(2)} dB lower. Click "Apply optimal order" to reorder the chain automatically.`,
        suggestedOrder,
        nfImprovement,
      })
    } else if (stages.length > 1) {
      insights.push({
        type: 'already_optimal',
        severity: 'info',
        title: 'Order is near-optimal',
        detail: `Current stage ordering is within ${Math.abs(nfImprovement).toFixed(2)} dB of the optimal NF arrangement.`,
      })
    }

    return { nfContributions: nfContribs, insights, iip3Contributions }
  }

  if (stages.length === 1) {
    insights.push({
      type: 'single_stage',
      severity: 'info',
      title: 'Single-stage chain',
      detail: 'Add more components to see cascade analysis and ordering recommendations.',
    })
  } else {
    // Multi-stage but no IIP3 data
    const currentNfLin = cascadeNf(stages)
    const optimal = greedyOptimalOrder(stages)
    const optimalNfLin = cascadeNf(optimal)
    const nfImprovement = linToDb(currentNfLin) - linToDb(optimalNfLin)

    if (nfImprovement > 0.3) {
      insights.push({
        type: 'reorder_beneficial',
        severity: nfImprovement > 1 ? 'warn' : 'info',
        title: `Reordering could save ${nfImprovement.toFixed(1)} dB NF`,
        detail: `Optimal ordering would reduce cascaded NF by ${nfImprovement.toFixed(2)} dB.`,
        suggestedOrder: optimal.map((s) => s.id),
        nfImprovement,
      })
    }
  }

  return { nfContributions: nfContribs, insights, iip3Contributions: [] }
}
