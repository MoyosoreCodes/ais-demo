import { format, parseISO } from 'date-fns';

export const nowIso = (): string => new Date().toISOString();

export const scr = (n: number): string => `SCR ${n.toLocaleString('en-US')}`;

export const fmtDate = (iso: string): string => {
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
};

export const fmtDateTime = (iso: string): string => {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
};

export const titleCase = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name: string): string =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
