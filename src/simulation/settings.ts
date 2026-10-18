import { DEFAULT_SETTINGS_VALUES, NOTATIONS, REDUCED_MOTION, UI_SCALES, VOLUME_RANGE } from '../data/settings';
import type { NumberNotation, SettingsState, UiScale } from '../data/types';

export interface MotionPolicy {
  shake: boolean;
  cameraTween: boolean;
  flashes: boolean;
  maxDegPerSec: number | null;
  assemblyDrop: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function pickVolume(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const clamped = Math.min(VOLUME_RANGE.max, Math.max(VOLUME_RANGE.min, v));
  return Math.round(clamped);
}

function pickNotation(v: unknown, fallback: NumberNotation): NumberNotation {
  return (NOTATIONS as readonly unknown[]).includes(v) ? (v as NumberNotation) : fallback;
}

function pickUiScale(v: unknown, fallback: UiScale): UiScale {
  return (UI_SCALES as readonly unknown[]).includes(v) ? (v as UiScale) : fallback;
}

// Lenient settings reader: never throws, never returns `base` itself.
// Each field: wrong type or invalid value -> base value (defaults when no base). Unknown keys are dropped.
export function normalizeSettings(raw: unknown, base?: SettingsState): SettingsState {
  const fallback: SettingsState = base ?? DEFAULT_SETTINGS_VALUES;
  const src: Record<string, unknown> = isRecord(raw) ? raw : {};
  return {
    muted: pickBoolean(src['muted'], fallback.muted),
    masterVolume: pickVolume(src['masterVolume'], fallback.masterVolume),
    sfxVolume: pickVolume(src['sfxVolume'], fallback.sfxVolume),
    ambientVolume: pickVolume(src['ambientVolume'], fallback.ambientVolume),
    notation: pickNotation(src['notation'], fallback.notation),
    reducedMotion: pickBoolean(src['reducedMotion'], fallback.reducedMotion),
    screenShake: pickBoolean(src['screenShake'], fallback.screenShake),
    statusMarkers: pickBoolean(src['statusMarkers'], fallback.statusMarkers),
    uiScale: pickUiScale(src['uiScale'], fallback.uiScale),
  };
}

// What the renderer may animate. Reduced motion switches every shake, tween and drop off.
export function motionPolicy(s: SettingsState): MotionPolicy {
  if (s.reducedMotion) {
    return {
      shake: false,
      cameraTween: false,
      flashes: false,
      maxDegPerSec: REDUCED_MOTION.maxDegPerSec,
      assemblyDrop: false,
    };
  }
  return {
    shake: s.screenShake,
    cameraTween: true,
    flashes: true,
    maxDegPerSec: null,
    assemblyDrop: true,
  };
}
