import { useState } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'

export function PresetsPanel() {
  const presets = useSpectraStore((s) => s.presets)
  const savePreset = useSpectraStore((s) => s.savePreset)
  const loadPreset = useSpectraStore((s) => s.loadPreset)
  const deletePreset = useSpectraStore((s) => s.deletePreset)
  const chain = useSpectraStore((s) => s.chain)

  const [inputName, setInputName] = useState('')
  const [open, setOpen] = useState(false)

  const presetList = Object.values(presets).sort((a, b) => b.savedAt - a.savedAt)

  function handleSave() {
    const name = inputName.trim()
    if (!name || chain.length === 0) return
    savePreset(name)
    setInputName('')
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        <span>⊟</span>
        <span>Presets</span>
        <span className="text-gray-700">{presetList.length > 0 ? `(${presetList.length})` : ''}</span>
        <span className="text-gray-700">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Save current chain */}
          <div className="flex gap-1">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Preset name…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 placeholder-gray-600"
            />
            <button
              onClick={handleSave}
              disabled={!inputName.trim() || chain.length === 0}
              className="px-2 py-1 text-xs bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded text-white transition-colors"
            >
              Save
            </button>
          </div>

          {/* Preset list */}
          {presetList.length === 0 ? (
            <p className="text-[10px] text-gray-700 text-center py-1">No saved presets</p>
          ) : (
            <ul className="space-y-1">
              {presetList.map((p) => (
                <li key={p.name} className="flex items-center gap-1 group">
                  <button
                    onClick={() => loadPreset(p.name)}
                    className="flex-1 text-left text-xs text-gray-400 hover:text-gray-100 truncate transition-colors"
                  >
                    {p.name}
                    <span className="text-[9px] text-gray-700 ml-1">
                      ({p.chain.length} stages)
                    </span>
                  </button>
                  <button
                    onClick={() => deletePreset(p.name)}
                    className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 text-[10px] transition-all"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
