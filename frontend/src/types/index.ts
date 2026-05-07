export type ComponentType =
  | 'LNA'
  | 'Amplifier'
  | 'Attenuator'
  | 'Mixer'
  | 'Filter'
  | 'Generic'

export interface RFComponent {
  id: string
  name: string
  type: ComponentType
  gain_db: number
  nf_db: number
  iip3_dbm: number
  p1db_dbm: number
  source: 'datasheet' | 'manual'
}

export interface SystemParams {
  bandwidth_hz: number
  temperature_k: number
}

export interface PerStageResult {
  stage_index: number
  component_id: string
  component_name: string
  cumulative_gain_db: number
  cumulative_nf_db: number
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
