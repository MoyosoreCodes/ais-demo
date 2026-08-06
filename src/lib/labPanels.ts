/**
 * Laboratory analysis panels (vi.2–vi.5).
 *
 * One panel per sample type defines the parameters an analyst enters, the unit,
 * the method and the reference range. Result entry on S06 is rendered from this
 * metadata, and `flagResult` applies the same range logic the seed generator
 * used, so a hand-entered result and a seeded one are assessed identically.
 */

import type { LabResult, SampleType } from './types'

export interface PanelParameter {
  parameter: string
  unit: string
  method: string
  referenceRange: string
  /** Free-text parameters (e.g. a pathogen screen) are not range-checked. */
  kind: 'number' | 'text'
  /** Offered as options for text parameters. */
  options?: string[]
  step?: number
}

export const LAB_PANELS: Record<SampleType, PanelParameter[]> = {
  soil: [
    { parameter: 'pH (H₂O)', unit: '', method: 'SM-4500-H', referenceRange: '5.5 – 7.0', kind: 'number', step: 0.1 },
    { parameter: 'Organic matter', unit: '%', method: 'Walkley-Black', referenceRange: '> 3.0', kind: 'number', step: 0.1 },
    { parameter: 'Nitrogen (total)', unit: '%', method: 'Kjeldahl', referenceRange: '0.15 – 0.30', kind: 'number', step: 0.01 },
    { parameter: 'Phosphorus (available)', unit: 'mg/kg', method: 'Olsen', referenceRange: '15 – 40', kind: 'number', step: 0.1 },
    { parameter: 'Potassium (exchangeable)', unit: 'mg/kg', method: 'NH₄OAc', referenceRange: '120 – 300', kind: 'number', step: 1 },
    { parameter: 'Electrical conductivity', unit: 'dS/m', method: 'SM-2510-B', referenceRange: '< 1.0', kind: 'number', step: 0.01 },
  ],
  water: [
    { parameter: 'pH', unit: '', method: 'SM-4500-H', referenceRange: '6.5 – 8.5', kind: 'number', step: 0.1 },
    { parameter: 'Turbidity', unit: 'NTU', method: 'SM-2130-B', referenceRange: '< 5', kind: 'number', step: 0.1 },
    { parameter: 'Nitrate (NO₃-N)', unit: 'mg/L', method: 'SM-4500-NO₃', referenceRange: '< 10', kind: 'number', step: 0.1 },
    { parameter: 'E. coli', unit: 'CFU/100 mL', method: 'SM-9223-B', referenceRange: '0', kind: 'number', step: 1 },
    { parameter: 'Total dissolved solids', unit: 'mg/L', method: 'SM-2540-C', referenceRange: '< 600', kind: 'number', step: 1 },
  ],
  plant: [
    { parameter: 'Leaf nitrogen', unit: '%', method: 'Kjeldahl', referenceRange: '2.5 – 3.5', kind: 'number', step: 0.01 },
    { parameter: 'Leaf phosphorus', unit: '%', method: 'ICP-OES', referenceRange: '0.15 – 0.30', kind: 'number', step: 0.01 },
    { parameter: 'Leaf potassium', unit: '%', method: 'ICP-OES', referenceRange: '2.0 – 4.0', kind: 'number', step: 0.01 },
    {
      parameter: 'Pathogen screen', unit: '', method: 'Culture + microscopy', referenceRange: 'Not detected',
      kind: 'text', options: ['Not detected', 'Fusarium spp. detected', 'Newcastle disease virus detected', 'Colletotrichum spp. detected'],
    },
  ],
  compost: [
    { parameter: 'pH', unit: '', method: 'SM-4500-H', referenceRange: '6.5 – 8.0', kind: 'number', step: 0.1 },
    { parameter: 'Moisture', unit: '%', method: 'Gravimetric', referenceRange: '40 – 60', kind: 'number', step: 1 },
    { parameter: 'C:N ratio', unit: '', method: 'Dry combustion', referenceRange: '15 – 25', kind: 'number', step: 0.1 },
    { parameter: 'Maturity (Solvita)', unit: 'index', method: 'Solvita', referenceRange: '≥ 6', kind: 'number', step: 1 },
  ],
}

/**
 * Assess a result against its reference range.
 *
 * Handles "a – b", "< a", "> a", "≥ a", "≤ a" and the literal "0". Text
 * parameters are normal when they match the reference exactly. Mirrors
 * `flagResult` in scripts/generate-seed.mjs.
 */
export function flagResult(result: Omit<LabResult, 'flag'>): LabResult {
  const raw = result.referenceRange.trim()

  if (typeof result.value !== 'number') {
    return { ...result, flag: String(result.value).trim() === raw ? 'normal' : 'high' }
  }

  const v = result.value
  const range = raw.replace(/[≥≤]/g, (m) => (m === '≥' ? '>=' : '<='))

  let lo: number | null = null
  let hi: number | null = null

  if (range.includes('–')) {
    const [a, b] = range.split('–').map((s) => parseFloat(s))
    lo = a
    hi = b
  } else if (range.startsWith('>=')) lo = parseFloat(range.slice(2))
  else if (range.startsWith('<=')) hi = parseFloat(range.slice(2))
  else if (range.startsWith('<')) hi = parseFloat(range.slice(1))
  else if (range.startsWith('>')) lo = parseFloat(range.slice(1))
  else if (range === '0') hi = 0

  if (lo !== null && !Number.isNaN(lo) && v < lo) return { ...result, flag: 'low' }
  if (hi !== null && !Number.isNaN(hi) && v > hi) return { ...result, flag: 'high' }
  return { ...result, flag: 'normal' }
}

export const SAMPLE_TYPE_LABELS: Record<SampleType, string> = {
  soil: 'Soil',
  water: 'Water',
  plant: 'Plant',
  compost: 'Compost',
}

export const SAMPLE_PURPOSES = [
  'Routine fertility monitoring',
  'Pre-planting assessment',
  'Irrigation water quality check',
  'Suspected nutrient deficiency',
  'Compost maturity verification',
  'Disease investigation support',
  'Soil fertility assessment ahead of new construction',
] as const

/** The lifecycle an officer and the laboratory move a sample through (vi.2–vi.4). */
export const SAMPLE_LIFECYCLE = [
  { status: 'requested', label: 'Requested', actor: 'Applicant or officer' },
  { status: 'collected', label: 'Collected', actor: 'Field officer' },
  { status: 'registered', label: 'Registered', actor: 'Laboratory' },
  { status: 'testing', label: 'Testing', actor: 'Laboratory' },
  { status: 'completed', label: 'Completed', actor: 'Laboratory' },
] as const
