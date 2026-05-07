interface Props {
  label: string
  value: number | null
  unit?: string
  positiveIsGood?: boolean
}

export function ParameterBadge({ label, value, unit = 'dB', positiveIsGood = true }: Props) {
  if (value === null) return null
  const isPositive = value >= 0
  const colorClass =
    positiveIsGood
      ? isPositive ? 'text-emerald-400' : 'text-red-400'
      : isPositive ? 'text-amber-400' : 'text-emerald-400'

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono font-medium ${colorClass}`}>
        {value.toFixed(1)}{unit}
      </span>
    </span>
  )
}
