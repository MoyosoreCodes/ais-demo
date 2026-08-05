// PDF (jsPDF + autotable) and Excel (xlsx) export helpers. Every PDF carries the
// fictional-data footer required by the demo constraints.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { fmtDate, fmtDateTime, nowIso } from './format';
import type { Client, Farm, Sample } from './types';

const FOOTER = 'FICTIONAL DEMONSTRATION DATA — AIS prototype, not an official record';
const PRIMARY: [number, number, number] = [15, 107, 79]; // #0F6B4F

type Cell = string | number;

function drawChrome(doc: jsPDF, title: string, subtitle?: string): void {
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text('Agriculture Information System — Republic of Seychelles', 14, 13);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(15);
  doc.text(title, 14, 32);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 14, 39);
  }
}

function stampFooter(doc: jsPDF): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(FOOTER, 14, h - 8);
  doc.text(`Generated ${fmtDateTime(nowIso())}`, w - 14, h - 8, { align: 'right' });
}

export interface TableExport {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Cell[][];
  filename: string;
}

export function exportTablePdf({ title, subtitle, columns, rows, filename }: TableExport): void {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => r.map((c) => String(c))),
    startY: 46,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    margin: { top: 46 },
    didDrawPage: () => {
      drawChrome(doc, title, subtitle);
      stampFooter(doc);
    },
  });
  doc.save(filename);
}

export function exportTableExcel({
  sheet,
  columns,
  rows,
  filename,
}: {
  sheet: string;
  columns: string[];
  rows: Cell[][];
  filename: string;
}): void {
  const aoa: Cell[][] = [columns, ...rows, [], [FOOTER]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

// Templated laboratory report PDF (req vi.7).
export function labReportPdf(sample: Sample, client: Client, farm: Farm): void {
  const doc = new jsPDF();
  drawChrome(
    doc,
    'Laboratory Analysis Report',
    `${sample.type.toUpperCase()} sample · ${sample.id}`,
  );
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const meta = [
    ['Sample ID', sample.id],
    ['Type', sample.type],
    ['Client', `${client.firstName} ${client.lastName} (${client.id})`],
    ['Farm', `${farm.name} (${farm.id})`],
    ['District', farm.district],
    ['Requested', fmtDate(sample.requestedAt)],
    ['Completed', sample.completedAt ? fmtDate(sample.completedAt) : '—'],
  ];
  autoTable(doc, {
    body: meta,
    startY: 46,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
  });
  autoTable(doc, {
    head: [['Parameter', 'Result', 'Unit', 'Reference']],
    body: sample.results.map((r) => [r.name, r.value, r.unit, r.reference]),
    startY: 92,
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    styles: { fontSize: 10 },
    didDrawPage: () => stampFooter(doc),
  });
  if (sample.resultSummary) {
    const y = 92 + 12 + sample.results.length * 10 + 8;
    doc.setFontSize(10);
    doc.text(`Summary: ${sample.resultSummary}`, 14, y);
  }
  doc.save(`${sample.id}-lab-report.pdf`);
}
