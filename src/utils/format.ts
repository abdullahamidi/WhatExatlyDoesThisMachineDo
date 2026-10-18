import type { NumberNotation } from '../data/types';

export type { NumberNotation };

export const NUMBER_SUFFIXES: ReadonlyArray<{ value: number; suffix: string }> = [
  { value: 1e3, suffix: 'K' },
  { value: 1e6, suffix: 'M' },
  { value: 1e9, suffix: 'B' },
  { value: 1e12, suffix: 'T' },
  { value: 1e15, suffix: 'Qa' },
  { value: 1e18, suffix: 'Qi' },
  { value: 1e21, suffix: 'Sx' },
  { value: 1e24, suffix: 'Sp' },
  { value: 1e27, suffix: 'Oc' },
  { value: 1e30, suffix: 'No' },
  { value: 1e33, suffix: 'Dc' },
];

export type RoundMode = 'floor' | 'ceil' | 'round';

/** Module-level default notation (the player's setting). Read at call time by every formatter. */
let defaultNotation: NumberNotation = 'suffix';

export function setDefaultNotation(n: NumberNotation): void {
  defaultNotation = n;
}

export function getDefaultNotation(): NumberNotation {
  return defaultNotation;
}

const EPSILON = 1e-9;
const EXPONENT_CEILING = '1.00e36';
/** Suffix notation switches to exponent form at and above this value. */
const EXPONENT_FROM = 1e36;

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

/** Splits a finite positive number into mantissa and decimal exponent (exact at powers of ten). */
function splitExponential(a: number): { mantissa: number; exponent: number } {
  const [mantissaText = '0', exponentText = '0'] = a.toExponential(9).split('e');
  return { mantissa: Number(mantissaText), exponent: Number(exponentText) };
}

function formatScientific(a: number, mode: RoundMode): string {
  const { mantissa, exponent } = splitExponential(a);
  const rounded = roundTo(mantissa, 2, mode);
  if (rounded < 10) return `${rounded.toFixed(2)}e${exponent}`;
  return `1.00e${exponent + 1}`;
}

function formatEngineering(a: number, mode: RoundMode): string {
  const { mantissa, exponent } = splitExponential(a);
  const power = Math.floor(exponent / 3) * 3;
  const scaled = mantissa * 10 ** (exponent - power);
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  const rounded = roundTo(scaled, decimals, mode);
  if (rounded < 1000) return `${trimZeros(rounded.toFixed(decimals))}e${power}`;
  return `1e${power + 3}`;
}

/** Formats a magnitude that is at least 1000 (or rounded up to 1000) in the chosen notation. */
function formatThousandsAndUp(a: number, mode: RoundMode, notation: NumberNotation): string {
  if (notation === 'scientific') return formatScientific(a, mode);
  if (notation === 'engineering') return formatEngineering(a, mode);
  if (a >= EXPONENT_FROM) return formatScientific(a, mode);
  return formatLarge(a, mode);
}

function formatMagnitude(a: number, mode: RoundMode, notation: NumberNotation): string {
  if (a < 1000) {
    const rounded = roundTo(a, 1, mode);
    if (rounded < 1000) return trimZeros(rounded.toFixed(1));
    return formatThousandsAndUp(1000, mode, notation);
  }
  return formatThousandsAndUp(a, mode, notation);
}

/** Explicit `notation` wins; otherwise the default notation set by setDefaultNotation. */
export function formatNumber(n: number, mode: RoundMode = 'floor', notation?: NumberNotation): string {
  if (!Number.isFinite(n)) return '0';
  const body = formatMagnitude(Math.abs(n), mode, notation ?? defaultNotation);
  return n < 0 && body !== '0' ? `-${body}` : body;
}

/** Formats a price. Prices round up so a displayed price is never lower than the charged price. */
export function formatCost(n: number, notation?: NumberNotation): string {
  return formatNumber(n, 'ceil', notation);
}

export function formatRate(n: number, notation?: NumberNotation): string {
  return `${formatNumber(n, 'floor', notation)}/s`;
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
