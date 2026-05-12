/**
 * Chain JSON export / import
 *
 * Export: serialises chain + components + systemParams to a .json file download.
 * Import: reads a .json file, validates the schema, returns the parsed data.
 */

import type { RFComponent, SystemParams } from '../types'

export interface ChainExport {
  _spectra: '1'          // format marker
  exportedAt: string
  chain: string[]
  components: Record<string, RFComponent>
  systemParams: SystemParams
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportChainJson(
  chain: string[],
  components: Record<string, RFComponent>,
  systemParams: SystemParams,
  filename = 'rf-chain.json',
) {
  const data: ChainExport = {
    _spectra: '1',
    exportedAt: new Date().toISOString(),
    chain,
    components,
    systemParams,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import ────────────────────────────────────────────────────────────────────

export class ImportError extends Error {}

export function parseChainJson(text: string): ChainExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('Invalid JSON file.')
  }

  if (typeof data !== 'object' || data === null) throw new ImportError('File is not a JSON object.')
  const obj = data as Record<string, unknown>

  if (obj._spectra !== '1') throw new ImportError('Not a Spectra chain file (missing _spectra marker).')
  if (!Array.isArray(obj.chain))          throw new ImportError('Invalid file: missing chain array.')
  if (typeof obj.components !== 'object') throw new ImportError('Invalid file: missing components.')
  if (typeof obj.systemParams !== 'object') throw new ImportError('Invalid file: missing systemParams.')

  // Basic component validation
  const components = obj.components as Record<string, unknown>
  for (const [id, c] of Object.entries(components)) {
    if (typeof c !== 'object' || c === null) throw new ImportError(`Invalid component: ${id}`)
    const comp = c as Record<string, unknown>
    if (typeof comp.name !== 'string') throw new ImportError(`Component ${id} missing name.`)
    if (typeof comp.gain_db !== 'number') throw new ImportError(`Component ${id} missing gain_db.`)
    if (typeof comp.nf_db !== 'number') throw new ImportError(`Component ${id} missing nf_db.`)
  }

  return data as ChainExport
}

export function importChainFromFile(): Promise<ChainExport> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type  = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { reject(new ImportError('No file selected.')); return }
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const result = parseChainJson(e.target?.result as string)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new ImportError('Could not read file.'))
      reader.readAsText(file)
    }
    input.oncancel = () => reject(new ImportError('Cancelled.'))
    input.click()
  })
}
