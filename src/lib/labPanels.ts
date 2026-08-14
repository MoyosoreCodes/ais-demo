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
      kind: 'text', options: ['Not detected', 'Fusarium spp. detected', 'Colletotrichum spp. detected'],
    },
  ],
  compost: [
    { parameter: 'pH', unit: '', method: 'SM-4500-H', referenceRange: '6.5 – 8.0', kind: 'number', step: 0.1 },
    { parameter: 'Moisture', unit: '%', method: 'Gravimetric', referenceRange: '40 – 60', kind: 'number', step: 1 },
    { parameter: 'C:N ratio', unit: '', method: 'Dry combustion', referenceRange: '15 – 25', kind: 'number', step: 0.1 },
    { parameter: 'Maturity (Solvita)', unit: 'index', method: 'Solvita', referenceRange: '≥ 6', kind: 'number', step: 1 },
  ],
  /*
   * Veterinary diagnostic panel. A suspected Newcastle-disease case is confirmed
   * from bird tissue and swabs, not from an agronomic plant panel, so this is a
   * distinct sample type with the parameters a poultry diagnosis actually needs.
   * The HI titre separates an active infection from a vaccinal response — the
   * flock in LSV-2026-0018 is recorded as vaccinated, which is the whole
   * clinical question the analyst has to answer.
   */
  avian_tissue: [
    {
      parameter: 'Newcastle disease virus (RT-PCR)', unit: '', method: 'RT-PCR', referenceRange: 'Not detected',
      kind: 'text', options: ['Not detected', 'Detected'],
    },
    {
      parameter: 'Haemagglutination inhibition titre', unit: '', method: 'HI test', referenceRange: '< log2 4',
      kind: 'text', options: ['log2 2', 'log2 4', 'log2 8', 'log2 16'],
    },
    {
      parameter: 'Avian influenza virus type A', unit: '', method: 'RT-PCR', referenceRange: 'Not detected',
      kind: 'text', options: ['Not detected', 'Detected'],
    },
    {
      parameter: 'Post-mortem findings', unit: '', method: 'Gross pathology', referenceRange: '—',
      kind: 'text',
      options: ['No significant findings', 'Consistent with velogenic ND', 'Consistent with respiratory infection'],
    },
  ],
}

/** Matches a "log2 N" serological titre in either a value or a reference range. */
const LOG2_TITRE = /log2\s*(-?\d+(?:\.\d+)?)/i

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
    // Serological titres read as "log2 8" against a "< log2 4" reference, so they
    // are compared numerically — a titre below the threshold is a normal result,
    // not merely one that fails to match the reference text.
    const refTitre = LOG2_TITRE.exec(raw)
    const valueTitre = LOG2_TITRE.exec(String(result.value))
    if (refTitre && valueTitre) {
      return flagResult({
        ...result,
        value: Number(valueTitre[1]),
        referenceRange: raw.replace(LOG2_TITRE, refTitre[1]),
      })
    }
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
  avian_tissue: 'Avian tissue / swab',
}

/**
 * Example wording for the interpretation and recommendation fields. The
 * agronomic panels share one example; the veterinary panel carries its own,
 * because soil advice is meaningless on a poultry diagnosis.
 */
export interface PanelExample {
  interpretation: string
  recommendation: string
}

const AGRONOMIC_EXAMPLE: PanelExample = {
  interpretation:
    'Moderately acidic soil with good organic matter. Available phosphorus is below the target range.',
  recommendation: 'Apply agricultural lime at 1.5 t/ha. Re-test in 9 months.',
}

const PANEL_EXAMPLES: Partial<Record<SampleType, PanelExample>> = {
  avian_tissue: {
    interpretation:
      'Newcastle disease virus detected in tracheal and cloacal swabs. The titre is consistent with active infection rather than a vaccinal response.',
    recommendation:
      'Quarantine the affected house and suspend bird movement. Notify Veterinary Services.',
  },
}

export const panelExample = (type: SampleType): PanelExample =>
  PANEL_EXAMPLES[type] ?? AGRONOMIC_EXAMPLE

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
