import { useSpectraStore } from '../../store/useSpectraStore'

export function SystemParamsForm() {
  const systemParams = useSpectraStore((s) => s.systemParams)
  const setSystemParams = useSpectraStore((s) => s.setSystemParams)

  const bwMhz = (systemParams.bandwidth_hz / 1e6).toString()

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Frequency (GHz)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
          value={systemParams.frequency_ghz ?? 2.4}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v > 0) setSystemParams({ frequency_ghz: v })
          }}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Bandwidth (MHz)</label>
        <input
          type="number"
          step="any"
          min="0"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
          value={bwMhz}
          onChange={(e) => {
            const mhz = parseFloat(e.target.value)
            if (!isNaN(mhz) && mhz > 0) setSystemParams({ bandwidth_hz: mhz * 1e6 })
          }}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Temperature (K)</label>
        <input
          type="number"
          step="any"
          min="0"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
          value={systemParams.temperature_k}
          onChange={(e) => {
            const k = parseFloat(e.target.value)
            if (!isNaN(k) && k > 0) setSystemParams({ temperature_k: k })
          }}
        />
      </div>
    </div>
  )
}
