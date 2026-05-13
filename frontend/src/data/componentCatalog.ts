import type { RFComponent } from '../types'

type CatalogEntry = Omit<RFComponent, 'id' | 'source'>

export interface CatalogSection {
  type: RFComponent['type']
  components: CatalogEntry[]
}

export const COMPONENT_CATALOG: CatalogSection[] = [
  {
    type: 'LNA',
    components: [
      { name: 'ZX60-P105LN+',  type: 'LNA', gain_db: 20.0, nf_db: 0.6,  iip3_dbm:  20, p1db_dbm:  8 },
      { name: 'PSA4-5043+',    type: 'LNA', gain_db: 19.7, nf_db: 0.54, iip3_dbm:  10, p1db_dbm:  1 },
      { name: 'SPF-5189Z',     type: 'LNA', gain_db: 19.0, nf_db: 0.5,  iip3_dbm:  12, p1db_dbm:  2 },
      { name: 'MGA-13516',     type: 'LNA', gain_db: 16.0, nf_db: 0.75, iip3_dbm:  22, p1db_dbm: 10 },
      { name: 'PGA-103+',      type: 'LNA', gain_db: 13.0, nf_db: 0.7,  iip3_dbm:  27, p1db_dbm: 16 },
    ],
  },
  {
    type: 'Amplifier',
    components: [
      { name: 'ZX60-3018G+',   type: 'Amplifier', gain_db: 13.0, nf_db: 2.7, iip3_dbm: 33, p1db_dbm: 22 },
      { name: 'ZX60-V63+',     type: 'Amplifier', gain_db: 14.0, nf_db: 4.0, iip3_dbm: 25, p1db_dbm: 14 },
      { name: 'ERA-5+',        type: 'Amplifier', gain_db: 19.5, nf_db: 3.5, iip3_dbm: 20, p1db_dbm: 10 },
      { name: 'ERA-2+',        type: 'Amplifier', gain_db: 14.0, nf_db: 4.0, iip3_dbm: 16, p1db_dbm:  5 },
      { name: 'GALI-52+',      type: 'Amplifier', gain_db: 11.5, nf_db: 4.5, iip3_dbm: 32, p1db_dbm: 21 },
    ],
  },
  {
    type: 'BPF',
    components: [
      { name: 'BPF 900 MHz',   type: 'BPF', gain_db: -2.0, nf_db: 2.0,  iip3_dbm: 50, p1db_dbm: 40 },
      { name: 'BPF 1.575 GHz', type: 'BPF', gain_db: -1.5, nf_db: 1.5,  iip3_dbm: 50, p1db_dbm: 40 },
      { name: 'BPF 2.4 GHz',   type: 'BPF', gain_db: -2.0, nf_db: 2.0,  iip3_dbm: 50, p1db_dbm: 40 },
      { name: 'SAW 433 MHz',   type: 'BPF', gain_db: -3.0, nf_db: 3.0,  iip3_dbm: 40, p1db_dbm: 30 },
      { name: 'SAW 915 MHz',   type: 'BPF', gain_db: -2.5, nf_db: 2.5,  iip3_dbm: 40, p1db_dbm: 30 },
    ],
  },
  {
    type: 'Attenuator',
    components: [
      { name: 'Pad 1 dB',  type: 'Attenuator', gain_db:  -1, nf_db:  1, iip3_dbm: 60, p1db_dbm: 50 },
      { name: 'Pad 3 dB',  type: 'Attenuator', gain_db:  -3, nf_db:  3, iip3_dbm: 60, p1db_dbm: 50 },
      { name: 'Pad 6 dB',  type: 'Attenuator', gain_db:  -6, nf_db:  6, iip3_dbm: 60, p1db_dbm: 50 },
      { name: 'Pad 10 dB', type: 'Attenuator', gain_db: -10, nf_db: 10, iip3_dbm: 60, p1db_dbm: 50 },
      { name: 'Pad 20 dB', type: 'Attenuator', gain_db: -20, nf_db: 20, iip3_dbm: 60, p1db_dbm: 50 },
    ],
  },
  {
    type: 'Mixer',
    components: [
      { name: 'ZX05-C42+',       type: 'Mixer', gain_db:  -7, nf_db:  7.5, iip3_dbm: 17, p1db_dbm:  7 },
      { name: 'ZX05-1L+',        type: 'Mixer', gain_db:  -7, nf_db:  7.5, iip3_dbm: 13, p1db_dbm:  3 },
      { name: 'Active Mixer typ', type: 'Mixer', gain_db:  10, nf_db: 12.0, iip3_dbm:  5, p1db_dbm: -5 },
      { name: 'RFMD RF2713',      type: 'Mixer', gain_db:   9, nf_db: 11.0, iip3_dbm:  8, p1db_dbm: -2 },
    ],
  },
]
