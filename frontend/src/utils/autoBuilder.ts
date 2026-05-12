/**
 * Auto-Builder engine — greedy top-N chain search
 *
 * Strategy (no deep recursion, no memoised singleton):
 *  1. Flatten catalog to a plain array each call
 *  2. Try every single component as a seed
 *  3. For each seed greedily extend by picking the pool item
 *     that most improves the composite score — up to maxStages
 *  4. Collect all intermediate chains, deduplicate, rank by score
 *  5. Return top-5
 *
 * All Friis math is inline — no imports, no module-level state.
 */

import type { RFComponent } from '../types'
import { COMPONENT_CATALOG } from '../data/componentCatalog'

export interface DesignTargets {
  max_nf_db:    number
  min_gain_db:  number
  min_iip3_dbm: number
}

export interface CandidateChain {
  components:  RFComponent[]
  nf_db:       number
  gain_db:     number
  iip3_dbm:    number
  meetsNf:     boolean
  meetsGain:   boolean
  meetsIip3:   boolean
  meetsAll:    boolean
  score:       number
}

// ── Friis (inline, no imports) ────────────────────────────────────────────────

function db2lin(db: number)  { return Math.pow(10, db / 10) }
function dbm2mw(dbm: number) { return Math.pow(10, dbm / 10) }
function mw2dbm(mw: number)  { return 10 * Math.log10(mw < 1e-30 ? 1e-30 : mw) }

function cascade(stages: RFComponent[]) {
  if (stages.length === 0) return { nf_db: 0, gain_db: 0, iip3_dbm: 100 }
  let fCasc    = db2lin(stages[0].nf_db > 0 ? stages[0].nf_db : 0)
  let gainLin  = db2lin(stages[0].gain_db)
  let cumGain  = stages[0].gain_db
  let invIip3  = stages[0].iip3_dbm != null ? 1 / dbm2mw(stages[0].iip3_dbm) : 0
  let gForIip3 = gainLin
  for (let i = 1; i < stages.length; i++) {
    const s = stages[i]
    fCasc    += (db2lin(s.nf_db > 0 ? s.nf_db : 0) - 1) / gainLin
    gainLin  *= db2lin(s.gain_db)
    cumGain  += s.gain_db
    if (s.iip3_dbm != null) invIip3 += gForIip3 / dbm2mw(s.iip3_dbm)
    gForIip3 *= db2lin(s.gain_db)
  }
  return {
    nf_db:    10 * Math.log10(fCasc < 1 ? 1 : fCasc),
    gain_db:  cumGain,
    iip3_dbm: invIip3 > 0 ? mw2dbm(1 / invIip3) : 100,
  }
}

// ── composite score 0–100 ─────────────────────────────────────────────────────

function scoreChain(
  nf_db: number, gain_db: number, iip3_dbm: number,
  t: DesignTargets,
): number {
  const nfM   = Math.min(1, Math.max(-1, (t.max_nf_db   - nf_db)   / 5))
  const gainM = Math.min(1, Math.max(-1, (gain_db - t.min_gain_db)  / 20))
  const iip3M = Math.min(1, Math.max(-1, (iip3_dbm - t.min_iip3_dbm) / 30))
  return Math.round(((0.5 * nfM + 0.3 * gainM + 0.2 * iip3M) + 1) * 50)
}

// ── build result object ───────────────────────────────────────────────────────

function makeCandidate(components: RFComponent[], t: DesignTargets): CandidateChain {
  const { nf_db, gain_db, iip3_dbm } = cascade(components)
  return {
    components,
    nf_db:    +nf_db.toFixed(2),
    gain_db:  +gain_db.toFixed(2),
    iip3_dbm: +iip3_dbm.toFixed(2),
    meetsNf:   nf_db   <= t.max_nf_db,
    meetsGain: gain_db >= t.min_gain_db,
    meetsIip3: iip3_dbm >= t.min_iip3_dbm,
    meetsAll:  nf_db <= t.max_nf_db && gain_db >= t.min_gain_db && iip3_dbm >= t.min_iip3_dbm,
    score:     scoreChain(nf_db, gain_db, iip3_dbm, t),
  }
}

// ── main export ───────────────────────────────────────────────────────────────

const MAX_STAGES  = 4
const TOP_RESULTS = 5

export function autoDesign(targets: DesignTargets): CandidateChain[] {
  // Build flat pool fresh each call — no module-level cache
  const pool: RFComponent[] = COMPONENT_CATALOG.flatMap((sec, si) =>
    sec.components.map((c, ci) => ({
      ...c,
      id:     `ab_${si}_${ci}`,
      source: 'catalog' as const,
    }))
  )

  if (pool.length === 0) return []

  const results: CandidateChain[] = []

  // For each pool item as seed, greedily extend the chain
  for (const seed of pool) {
    let chain: RFComponent[] = [seed]

    // Record single-stage candidate
    results.push(makeCandidate(chain, targets))

    for (let stage = 1; stage < MAX_STAGES; stage++) {
      // Find the pool item that most improves the score when appended
      let bestScore = -Infinity
      let bestItem: RFComponent | null = null

      for (const candidate of pool) {
        // Avoid exact-same component consecutively
        if (candidate.id === chain[chain.length - 1].id) continue
        const extended = [...chain, candidate]
        const { nf_db, gain_db, iip3_dbm } = cascade(extended)
        const s = scoreChain(nf_db, gain_db, iip3_dbm, targets)
        if (s > bestScore) { bestScore = s; bestItem = candidate }
      }

      if (!bestItem) break
      chain = [...chain, bestItem]
      results.push(makeCandidate(chain, targets))
    }
  }

  // Deduplicate by component name sequence
  const seen = new Set<string>()
  const unique = results.filter((c) => {
    const key = c.components.map((s) => s.name).join('→')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort: meetsAll first, then by score descending
  return unique
    .sort((a, b) => {
      if (a.meetsAll !== b.meetsAll) return a.meetsAll ? -1 : 1
      return b.score - a.score
    })
    .slice(0, TOP_RESULTS)
}
