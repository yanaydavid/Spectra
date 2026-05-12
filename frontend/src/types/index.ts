export type ComponentType =
  // Amplifiers
  | 'LNA' | 'Amplifier' | 'PA' | 'VGA' | 'Limiter'
  // Filters
  | 'BPF' | 'LPF' | 'HPF' | 'BSF' | 'Diplexer'
  // Attenuators & passive
  | 'Attenuator' | 'Splitter' | 'Coupler' | 'Circulator' | 'Isolator' | 'Termination'
  // Phase
  | 'PhaseShifter' | 'Hybrid90' | 'Hybrid180' | 'Balun'
  // Frequency conversion
  | 'Mixer' | 'UpConverter' | 'Multiplier' | 'Divider'
  // Oscillators & clocking
  | 'VCO' | 'VCXO' | 'PLL' | 'CrystalOsc'
  // Switches
  | 'Switch' | 'TRSwitch'
  // Digital
  | 'ADC' | 'DAC'
  // Antenna
  | 'Antenna'
  // Generic
  | 'Generic'

export interface RFComponent {
  id: string
  name: string
  type: ComponentType
  gain_db: number
  nf_db: number
  iip3_dbm?: number | null
  p1db_dbm?: number | null
  source?: 'datasheet' | 'manual'
  rotation?: 0 | 90 | 180 | 270   // visual rotation of node on canvas
}

export interface SystemParams {
  bandwidth_hz: number
  temperature_k: number
  frequency_ghz: number
}

export interface PerStageResult {
  stage_index: number
  component_id: string
  component_name: string
  cumulative_gain_db: number
  cumulative_nf_db: number
  cumulative_iip3_dbm?: number | null
}

export interface PresetSnapshot {
  cascaded_nf_db: number
  total_gain_db: number
  cascaded_iip3_dbm: number | null
  sensitivity_dbm: number
}

export interface Preset {
  name: string
  chain: string[]
  components: Record<string, RFComponent>
  systemParams?: SystemParams
  snapshot?: PresetSnapshot   // cascade metrics at save time
  savedAt: number
}

export interface CascadeResult {
  total_gain_db: number
  cascaded_nf_db: number
  cascaded_iip3_dbm: number
  sensitivity_dbm: number
  per_stage: PerStageResult[]
}

export interface ExtractedParams {
  name: string
  gain_db: number | null
  nf_db: number | null
  iip3_dbm: number | null
  p1db_dbm: number | null
  extraction_notes: string | null
}

export interface ChainCalculationRequest {
  stages: RFComponent[]
  system_params: SystemParams
}
