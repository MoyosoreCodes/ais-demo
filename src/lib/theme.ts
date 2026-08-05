// Reads the CSS brand tokens (src/index.css :root) for jsPDF / Leaflet.
const FALLBACK: Record<number, string> = {
  50: '#ecf7f2',
  100: '#cfe9df',
  200: '#9fd3bf',
  300: '#63b79a',
  400: '#2e9576',
  500: '#158060',
  600: '#0f6b4f',
  700: '#0c563f',
  800: '#0a4230',
  900: '#072f22',
};

export const cssVar = (name: string): string =>
  (typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '') || '';

export const brandHex = (shade = 600): string =>
  cssVar(`--color-primary-${shade}`) || FALLBACK[shade] || '#0f6b4f';

export const dangerHex = (): string => cssVar('--color-danger') || '#dc2626';

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full || '0f6b4f', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const brandRgb = (shade = 600): [number, number, number] => hexToRgb(brandHex(shade));
