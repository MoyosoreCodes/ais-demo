/**
 * Configurable farm-registration intake (iii.3 ★).
 *
 * The S03 form is rendered from this metadata rather than hard-coded markup,
 * and an administrator toggles the optional fields on S11. Turning a field off
 * removes it from the form and from the summary — no redeployment.
 */

export type IntakeFieldKind = 'text' | 'number' | 'select' | 'multiselect' | 'textarea'

export interface IntakeFieldConfig {
  id: string
  label: string
  kind: IntakeFieldKind
  /** Core fields cannot be switched off — they carry the Appendix A6 rows. */
  core: boolean
  enabled: boolean
  required: boolean
  help?: string
  unit?: string
  options?: string[]
  /** Requirement rows this field evidences, for the `?refs=1` badges. */
  refs?: string[]
}

export const DEFAULT_INTAKE_FIELDS: IntakeFieldConfig[] = [
  { id: 'name', label: 'Holding name', kind: 'text', core: true, enabled: true, required: true, help: 'The name the farmer uses for the holding.' },
  { id: 'parcelRef', label: 'Parcel reference', kind: 'text', core: true, enabled: true, required: true, help: 'Format PR/DD/NNNN. Used by the duplicate check.', refs: ['iii.7'] },
  { id: 'sizeHa', label: 'Farm size', kind: 'number', core: true, enabled: true, required: true, unit: 'ha', refs: ['iii.3'] },
  { id: 'tenure', label: 'Tenure', kind: 'select', core: true, enabled: true, required: true, options: ['owned', 'leased-state', 'leased-private', 'family'], refs: ['iii.3'] },
  { id: 'crops', label: 'Crop activity', kind: 'multiselect', core: true, enabled: true, required: false, options: ['banana', 'cassava', 'sweet potato', 'chilli', 'lettuce', 'papaya', 'breadfruit'], refs: ['iii.3'] },
  { id: 'livestock', label: 'Livestock activity', kind: 'multiselect', core: true, enabled: true, required: false, options: ['broiler', 'layer', 'pig', 'goat'], refs: ['iii.3'] },
  { id: 'waterSource', label: 'Water source', kind: 'select', core: false, enabled: true, required: false, options: ['rainwater', 'borehole', 'river', 'mains', 'none'] },
  { id: 'irrigation', label: 'Irrigation method', kind: 'select', core: false, enabled: false, required: false, options: ['none', 'drip', 'sprinkler', 'furrow', 'manual'], help: 'Optional — switched off by default.' },
  { id: 'organic', label: 'Organic certification', kind: 'select', core: false, enabled: false, required: false, options: ['none', 'in conversion', 'certified'], help: 'Optional — switched off by default.' },
  { id: 'notes', label: 'Officer notes', kind: 'textarea', core: false, enabled: true, required: false },
]
