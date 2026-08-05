// ID generators. Extract the trailing numeric run of existing IDs and increment.
interface HasId {
  id: string;
}

const maxSeq = (items: HasId[], re: RegExp): number =>
  items.reduce((max, it) => {
    const m = it.id.match(re);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

const pad = (n: number, w: number): string => String(n).padStart(w, '0');

export const nextClientId = (items: HasId[]): string =>
  `CLT-${pad(maxSeq(items, /^CLT-(\d+)$/) + 1, 4)}`;

export const nextFarmId = (items: HasId[]): string =>
  `FRM-2026-${pad(maxSeq(items, /^FRM-2026-(\d+)$/) + 1, 5)}`;

export const nextLoanId = (items: HasId[]): string =>
  `LN-2026-${pad(maxSeq(items, /^LN-2026-(\d+)$/) + 1, 3)}`;

export const nextSampleId = (items: HasId[]): string =>
  `SMP-2026-${pad(maxSeq(items, /^SMP-2026-(\d+)$/) + 1, 3)}`;

export const nextCaseId = (items: HasId[]): string =>
  `SV-2026-${pad(maxSeq(items, /^SV-2026-(\d+)$/) + 1, 3)}`;

export const nextVisitId = (items: HasId[]): string =>
  `LV-2026-${pad(maxSeq(items, /^LV-2026-(\d+)$/) + 1, 3)}`;

export const nextInspectionId = (items: HasId[]): string =>
  `INS-2026-${pad(maxSeq(items, /^INS-2026-(\d+)$/) + 1, 3)}`;

export const nextVendorId = (items: HasId[]): string =>
  `VD-2026-${pad(maxSeq(items, /^VD-2026-(\d+)$/) + 1, 3)}`;

export const nextDocId = (items: HasId[]): string =>
  `DOC-2026-${pad(maxSeq(items, /^DOC-2026-(\d+)$/) + 1, 3)}`;

// Session-unique suffix that does not rely on Date.now / Math.random being deterministic.
let counter = 0;
export const uid = (prefix: string): string =>
  `${prefix}-${(++counter).toString(36)}${(performance.now() | 0).toString(36)}`;
