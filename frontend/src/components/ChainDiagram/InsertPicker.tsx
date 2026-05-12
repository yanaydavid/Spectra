/**
 * InsertPicker
 *
 * Small floating panel that appears when the user clicks a "+" edge button.
 * Lists all library components and lets the user pick one to insert at
 * a specific chain index.  Also offers a "New blank" quick-create.
 */

import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, RFComponent } from '../../types'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', Attenuator: '▼', Mixer: '×', Filter: '≋', Generic: '□',
}
const COMPONENT_TYPES: ComponentType[] = ['LNA', 'Amplifier', 'Attenuator', 'Mixer', 'Filter', 'Generic']

interface Props {
  insertAtIndex: number          // insert BEFORE this index (shift everything right)
  screenX: number
  screenY: number
  onClose: () => void
}

export function InsertPicker({ insertAtIndex, screenX, screenY, onClose }: Props) {
  const components  = useSpectraStore((s) => s.components)
  const addComponent = useSpectraStore((s) => s.addComponent)
  const addToChain  = useSpectraStore((s) => s.addToChain)

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Library items only (no chain instances)
  const library = Object.values(components).filter((c) => !c.id.includes('__'))
  const filtered = library.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.type.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape or click outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onMouse(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouse)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onMouse) }
  }, [onClose])

  function insertExisting(comp: RFComponent) {
    addToChain(comp.id, insertAtIndex)
    onClose()
  }

  function insertBlank(type: ComponentType) {
    const id = uuidv4()
    const blank: RFComponent = {
      id, name: `New ${type}`, type,
      gain_db: type === 'Attenuator' ? -3 : type === 'Filter' ? -2 : 15,
      nf_db: type === 'LNA' ? 2 : 3,
      iip3_dbm: null, p1db_dbm: null, source: 'manual',
    }
    addComponent(blank)
    addToChain(id, insertAtIndex)
    onClose()
  }

  // Keep panel inside viewport
  const W = 220, H = 320
  const left = Math.min(screenX, window.innerWidth  - W - 16)
  const top  = Math.min(screenY, window.innerHeight - H - 16)

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left, top, zIndex: 9999, width: W }}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Insert Component</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xs">✕</button>
      </div>

      {/* Search */}
      <div className="px-2.5 pt-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search library…"
          className="w-full bg-gray-800 border border-gray-700 focus:border-violet-500 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 outline-none"
        />
      </div>

      {/* Quick blank buttons */}
      {query === '' && (
        <div className="px-2.5 pt-2">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Quick add</p>
          <div className="grid grid-cols-3 gap-1">
            {COMPONENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => insertBlank(t)}
                className="flex flex-col items-center py-1.5 rounded border border-gray-800 hover:border-violet-600 hover:bg-violet-900/20 transition-colors"
              >
                <span className="text-sm mb-0.5">{TYPE_ICON[t]}</span>
                <span className="text-[8px] text-gray-500">{t}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Library list */}
      <div className="px-2.5 pt-2 pb-2.5 max-h-40 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-[10px] text-gray-700 text-center py-2">No matches</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((comp) => (
              <button
                key={comp.id}
                onClick={() => insertExisting(comp)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800 transition-colors text-left"
              >
                <span className="text-sm opacity-70">{TYPE_ICON[comp.type] ?? '□'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{comp.name}</p>
                  <p className="text-[9px] text-gray-600">{comp.type} · G {comp.gain_db} dB</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
