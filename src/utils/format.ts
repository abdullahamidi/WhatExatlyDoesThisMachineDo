export const NUMBER_SUFFIXES: ReadonlyArray<{ value: number; suffix: string }> =
  [{ value: 1e3, suffix: 'K' }, { value: 1e6, suffix: 'M' }, { value: 1e9, suffix: 'B' }, { value: 1e12, suffix: 'T' }];

export type RoundMode = 'floor' | 'ceil' | 'round';

const EPSILON = 1e-9;
const EXPONENT_CEILING = '1.00e15';

function roundTo(x: number, decimals: number, mode: RoundMode): number {
  const factor = 10 ** decimals;
  if (mode === 'floor') return Math.floor(x * factor + EPSILON) / factor;
  if (mode === 'ceil') return Math.ceil(x * factor - EPSILON) / factor;
  return Math.round(x * factor) / factor;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function formatLarge(v: number, mode: RoundMode): string {
  let idx = 0;
  NUMBER_SUFFIXES.forEach((entry, i) => {
    if (entry.value <= v) idx = i;
  });
  const entry = NUMBER_SUFFIXES[idx];
  if (!entry) return EXPONENT_CEILING;
  const scaled = v / entry.value;
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  const rounded = roundTo(scaled, decimals, mode);
  if (rounded < 1000) return trimZeros(rounded.toFixed(decimals)) + entry.suffix;
  const next = NUMBER_SUFFIXES[idx + 1];
  return next ? `1${next.suffix}` : EXPONENT_CEILING;
}

function formatMagnitude(a: number, mode: RoundMode): string {
  if (a >= 1e15) return a.toExponential(2).replace('+', '');
  if (a < 1000) {
    const rounded = roundTo(a, 1, mode);
    if (rounded < 1000) return trimZeros(rounded.toFixed(1));
    return formatLarge(1000, mode);
  }
  return formatLarge(a, mode);
}

export function formatNumber(n: number, mode: RoundMode = 'floor'): string {
  if (!Number.isFinite(n)) return '0';
  const body = formatMagnitude(Math.abs(n), mode);
  return n < 0 && body !== '0' ? `-${body}` : body;
}

/** Formats a price. Prices round up so a displayed price is never lower than the charged price. */
export function formatCost(n: number): string {
  return formatNumber(n, 'ceil');
}

export function formatRate(n: number): string {
  return `${formatNumber(n)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const s = Math.floor(seconds);
  if (s >= 3600) {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (s >= 60) {
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${s}s`;
}
