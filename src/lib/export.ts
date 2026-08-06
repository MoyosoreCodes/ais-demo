/**
 * Report export (v.6, vi.7, and later xii.6).
 *
 * jsPDF and SheetJS are pulled in dynamically so ~600 kB of export machinery
 * never blocks first paint — it loads the moment an officer actually clicks
 * Export.
 *
 * Every generated document carries the FICTIONAL DEMONSTRATION DATA notice, so
 * a PDF that leaves the room cannot be mistaken for a real departmental record.
 */

import { format } from 'date-fns'

const BRAND: [number, number, number] = [15, 107, 79]
const INK: [number, number, number] = [35, 40, 39]
const MUTED: [number, number, number] = [104, 113, 111]
const WARN: [number, number, number] = [199, 119, 0]

const FICTIONAL_NOTICE =
  'FICTIONAL DEMONSTRATION DATA — prototype build. No real person, National Identification Number or telephone number appears in this document.'

export interface ReportColumn<T> {
  header: string
  /** Cell value; returned numbers are right-aligned in the PDF. */
  value: (row: T) => string | number
  width?: number
  align?: 'left' | 'right' | 'center'
}

export interface ReportMeta {
  label: string
  value: string
}

export interface ReportOptions<T> {
  /** Used for the on-screen title, the PDF heading and the file name. */
  title: string
  subtitle?: string
  columns: ReportColumn<T>[]
  rows: T[]
  /** Filter summary etc., printed under the heading. */
  meta?: ReportMeta[]
  /** Printed under the table — totals, counts, caveats. */
  notes?: string[]
  orientation?: 'portrait' | 'landscape'
  fileStem?: string
}

/**
 * jsPDF's built-in fonts are WinAnsi-encoded, which has no subscripts and no
 * `≥`/`≤`. Left alone, `pH (H₂O)` prints as `pH (H ,O)` and `NH₄OAc` as
 * `NH „OAc` — wrong, and wrong in a document that goes to an applicant. Map the
 * characters the domain actually uses to plain equivalents, then drop anything
 * still outside Latin-1 rather than emit a misleading glyph.
 */
const PDF_CHAR_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '≥': '>=', '≤': '<=', '≈': '~', '≠': '!=',
  '★': '*', '✓': 'Y', '✕': 'N', '·': '·',
  '‘': "'", '’': "'", '“': '"', '”': '"',
}

/**
 * Beyond Latin-1, WinAnsi still carries a handful of typographic characters
 * that jsPDF maps correctly — the dashes, bullet and ellipsis this app uses.
 * Keep those; drop anything else that would print as the wrong glyph.
 */
const WINANSI_EXTRAS = '–—•…€™'

const pdfText = (value: string | number): string =>
  String(value)
    .replace(/[₀-₉⁰¹²³⁴≥≤≈≠★✓✕‘’“”]/g, (m) => PDF_CHAR_MAP[m] ?? m)
    .replace(new RegExp(`[^\\u0020-\\u00FF${WINANSI_EXTRAS}]`, 'gu'), '')

const stamp = () => format(new Date(), 'yyyy-MM-dd_HHmm')

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

/* ------------------------------------------------------------------ *
 * Shared PDF chrome
 * ------------------------------------------------------------------ */

type Doc = import('jspdf').jsPDF

/** Departmental letterhead: crest mark, titles and the prototype badge. */
function drawHeader(doc: Doc, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 3, 'F')

  // Neutral crest placeholder — a shield, matching the app header.
  doc.setFillColor(...BRAND)
  doc.roundedRect(14, 12, 12, 14, 2, 2, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(20, 18, 2.6, 'F')

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(pdfText('Agriculture Information System'), 31, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(pdfText('Republic of Seychelles · Department of Agriculture'), 31, 23)

  doc.setFillColor(254, 246, 231)
  doc.setDrawColor(...WARN)
  doc.setLineWidth(0.3)
  const badge = 'PROTOTYPE — DEMONSTRATION BUILD'
  doc.setFontSize(7)
  const badgeWidth = doc.getTextWidth(badge) + 6
  doc.roundedRect(pageWidth - 14 - badgeWidth, 12, badgeWidth, 6.5, 1.5, 1.5, 'FD')
  doc.setTextColor(...WARN)
  doc.setFont('helvetica', 'bold')
  doc.text(pdfText(badge), pageWidth - 14 - badgeWidth + 3, 16.4)

  doc.setDrawColor(220, 224, 224)
  doc.setLineWidth(0.4)
  doc.line(14, 30, pageWidth - 14, 30)

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(pdfText(title), 14, 40)

  let y = 40
  if (subtitle) {
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    doc.text(pdfText(subtitle), 14, y)
  }
  return y + 6
}

/** Page numbers plus the fictional-data notice on every page. */
function drawFooters(doc: Doc): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 224, 224)
    doc.setLineWidth(0.4)
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...WARN)
    // 66 mm is reserved on the right for the page/generated line below.
    const lines = doc.splitTextToSize(pdfText(FICTIONAL_NOTICE), pageWidth - 28 - 66)
    doc.text(lines, 14, pageHeight - 11)

    doc.setTextColor(...MUTED)
    doc.text(
      pdfText(`Page ${i} of ${total}  ·  Generated ${format(new Date(), 'd MMM yyyy HH:mm')}`),
      pageWidth - 14,
      pageHeight - 11,
      { align: 'right' },
    )
  }
}

function drawMeta(doc: Doc, meta: ReportMeta[], startY: number): number {
  if (!meta.length) return startY
  const pageWidth = doc.internal.pageSize.getWidth()
  const colWidth = (pageWidth - 28) / 3
  let y = startY

  doc.setFontSize(8)
  meta.forEach((m, i) => {
    const col = i % 3
    if (col === 0 && i > 0) y += 9
    const x = 14 + col * colWidth
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(pdfText(m.label.toUpperCase()), x, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(pdfText(m.value), colWidth - 4)[0] ?? pdfText(m.value), x, y + 4)
  })
  return y + 12
}

/* ------------------------------------------------------------------ *
 * Generic table exports
 * ------------------------------------------------------------------ */

export async function exportTablePdf<T>(options: ReportOptions<T>): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({
    orientation: options.orientation ?? 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let y = drawHeader(doc, options.title, options.subtitle)
  y = drawMeta(doc, options.meta ?? [], y)

  autoTable(doc, {
    startY: y,
    head: [options.columns.map((c) => pdfText(c.header))],
    body: options.rows.map((row) => options.columns.map((c) => pdfText(c.value(row)))),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 224, 224], textColor: INK },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [247, 248, 248] },
    // autotable 5 splits a tall row across a page break by default, which left
    // an orphaned name fragment at the top of page 2. Keep rows whole.
    rowPageBreak: 'avoid',
    columnStyles: Object.fromEntries(
      options.columns.map((c, i) => [
        i,
        { halign: c.align ?? 'left', ...(c.width ? { cellWidth: c.width } : {}) },
      ]),
    ),
    margin: { left: 14, right: 14, bottom: 22 },
  })

  const finalY = (doc as Doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  if (options.notes?.length) {
    let ny = finalY + 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    for (const note of options.notes) {
      const lines = doc.splitTextToSize(pdfText(note), doc.internal.pageSize.getWidth() - 28)
      doc.text(lines, 14, ny)
      ny += lines.length * 4 + 2
    }
  }

  drawFooters(doc)
  doc.save(`${options.fileStem ?? slug(options.title)}_${stamp()}.pdf`)
}

export async function exportTableExcel<T>(options: ReportOptions<T>): Promise<void> {
  const XLSX = await import('xlsx')

  const header = options.columns.map((c) => c.header)
  const body = options.rows.map((row) => options.columns.map((c) => c.value(row)))

  // A short preamble keeps the provenance and the fictional-data warning with
  // the data when the sheet is opened outside the application.
  const preamble: (string | number)[][] = [
    ['Agriculture Information System — Republic of Seychelles'],
    [options.title],
    ...(options.subtitle ? [[options.subtitle]] : []),
    ['Generated', format(new Date(), 'd MMM yyyy HH:mm')],
    ...(options.meta ?? []).map((m) => [m.label, m.value]),
    [FICTIONAL_NOTICE],
    [],
  ]

  const sheet = XLSX.utils.aoa_to_sheet([...preamble, header, ...body])
  sheet['!cols'] = options.columns.map((c) => ({
    wch: Math.max(
      c.header.length + 2,
      ...options.rows.slice(0, 200).map((r) => String(c.value(r)).length + 2),
      12,
    ),
  }))

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, options.title.slice(0, 28) || 'Report')
  if (options.notes?.length) {
    const notes = XLSX.utils.aoa_to_sheet(options.notes.map((n) => [n]))
    notes['!cols'] = [{ wch: 110 }]
    XLSX.utils.book_append_sheet(book, notes, 'Notes')
  }

  XLSX.writeFile(book, `${options.fileStem ?? slug(options.title)}_${stamp()}.xlsx`)
}

/* ------------------------------------------------------------------ *
 * Templated laboratory report (vi.7)
 * ------------------------------------------------------------------ */

export interface LabReportInput {
  sampleId: string
  sampleType: string
  purpose: string
  clientName: string
  clientId: string
  nin: string
  farmName: string
  farmId: string
  parcelRef: string
  district: string
  coordinates: string
  requestedOn: string
  collectedOn?: string
  registeredOn?: string
  testingStartedOn?: string
  completedOn?: string
  analystName: string
  results: {
    parameter: string
    value: string
    unit: string
    method: string
    referenceRange: string
    flag: string
  }[]
  interpretation?: string
  recommendation?: string
}

/**
 * The report an applicant receives — laid out like a departmental laboratory
 * certificate rather than a generic table dump.
 */
export async function exportLabReportPdf(input: LabReportInput): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = drawHeader(
    doc,
    'Laboratory Analysis Report',
    `${input.sampleType.charAt(0).toUpperCase()}${input.sampleType.slice(1)} sample · ${input.sampleId}`,
  )

  y = drawMeta(
    doc,
    [
      { label: 'Sample reference', value: input.sampleId },
      { label: 'Sample type', value: input.sampleType },
      { label: 'Date completed', value: input.completedOn ?? '—' },
      { label: 'Applicant', value: `${input.clientName} (${input.clientId})` },
      { label: 'Holding', value: `${input.farmName} (${input.farmId})` },
      { label: 'District', value: input.district },
    ],
    y,
  )

  /* --- purpose --- */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(pdfText('Purpose of analysis'), 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  const purpose = doc.splitTextToSize(pdfText(input.purpose), pageWidth - 28)
  doc.text(purpose, 14, y + 5)
  y += 5 + purpose.length * 4 + 5

  /* --- chain of custody --- */
  autoTable(doc, {
    startY: y,
    head: [['Requested', 'Collected', 'Registered', 'Testing started', 'Completed']],
    body: [[
      input.requestedOn,
      input.collectedOn ?? '—',
      input.registeredOn ?? '—',
      input.testingStartedOn ?? '—',
      input.completedOn ?? '—',
    ].map(pdfText)],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [220, 224, 224], textColor: INK },
    headStyles: { fillColor: [237, 239, 239], textColor: MUTED, fontStyle: 'bold', fontSize: 7 },
    margin: { left: 14, right: 14, bottom: 22 },
  })

  y = ((doc as Doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8

  /* --- results --- */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(pdfText('Results'), 14, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Result', 'Unit', 'Reference range', 'Method', 'Assessment']],
    body: input.results.map((r) => [r.parameter, r.value, r.unit, r.referenceRange, r.method, r.flag].map(pdfText)),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 224, 224], textColor: INK },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center' } },
    // Out-of-range rows are tinted so the exception is findable at a glance.
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const flag = input.results[data.row.index]?.flag
      if (flag && flag !== 'normal') {
        data.cell.styles.fillColor = [254, 246, 231]
        if (data.column.index === 5) data.cell.styles.textColor = WARN
      }
    },
    margin: { left: 14, right: 14, bottom: 22 },
  })

  y = ((doc as Doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8

  /* --- interpretation and recommendation --- */
  const block = (heading: string, text: string, atY: number): number => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(pdfText(heading), 14, atY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(pdfText(text), pageWidth - 28)
    doc.text(lines, 14, atY + 5)
    return atY + 5 + lines.length * 4 + 6
  }

  if (input.interpretation) y = block('Interpretation', input.interpretation, y)
  if (input.recommendation) y = block('Recommendation', input.recommendation, y)

  /* --- signature block --- */
  y += 4
  doc.setDrawColor(180, 190, 190)
  doc.setLineWidth(0.3)
  doc.line(14, y, 80, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(pdfText(`${input.analystName} · Laboratory Staff`), 14, y + 4)
  doc.text(pdfText('Analyst signature'), 14, y + 8)

  doc.line(pageWidth - 80, y, pageWidth - 14, y)
  doc.text(pdfText('Date of issue'), pageWidth - 80, y + 8)
  doc.text(pdfText(input.completedOn ?? '—'), pageWidth - 80, y + 4)

  drawFooters(doc)
  doc.save(`lab-report_${input.sampleId}_${stamp()}.pdf`)
}

/* ------------------------------------------------------------------ *
 * CSV (xii.6)
 * ------------------------------------------------------------------ */

const csvCell = (value: string | number): string => {
  const text = String(value)
  // Quote when the value could otherwise break the row, and double any quotes.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function exportTableCsv<T>(options: ReportOptions<T>): void {
  const lines = [
    options.columns.map((c) => csvCell(c.header)).join(','),
    ...options.rows.map((row) => options.columns.map((c) => csvCell(c.value(row))).join(',')),
  ]
  // A UTF-8 BOM so Excel opens accented Seychellois names correctly.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${options.fileStem ?? slug(options.title)}_${stamp()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
