import type { TechId } from './types';

// Toast texts and timings (WP3). Pure data: no logic lives in this file.

export type ToastTone = 'info' | 'system' | 'milestone';

export interface ToastMessage {
  key: string;
  title: string;
  body: string | null;
  tone: ToastTone;
  durationMs: number;
}

// Toast stack limits and timings (ms). Milestones stay on screen longer.
export const TOAST_CONFIG = {
  maxVisible: 2,
  durationMs: 3200,
  milestoneDurationMs: 6500,
  welcomeDurationMs: 7000,
  fadeMs: 250,
} as const;

// Offline reports shorter than this (seconds) stay silent.
export const WELCOME_MIN_ELAPSED_SECONDS = 60;

export const WELCOME_TEXT = { title: 'WELCOME BACK' } as const;

export const RECOVERED_TEXT = {
  title: 'MEMORY CORRUPTED',
  body: 'Factory state restored.',
} as const;

export const FIRST_CLICK_MESSAGE = 'Manual operation detected.';

// One install line per technology, shown as the toast body on unlock or milestone.
// Lines matching a technology flavor text are identical to it.
export const INSTALL_LINES: Record<TechId, string> = {
  handCrank: 'Manual operation detected.',
  gearRatio: 'Gear mesh recalibrated. Cause: unknown.',
  reinforcedCrank: 'This component was not designed to be replaced.',
  flywheel: 'Rotational mass acquired. Purpose: pending.',
  wornMotor: 'Synchronization unsuccessful.',
  motorTuning: 'Tolerance revised. Operator identity not found.',
  pistonArray: 'Reciprocating assembly online. Observers: none.',
  improvedPistons: 'Stroke length exceeds specification.',
  generatorBlueprint: 'Primary function: UNKNOWN.',
  generator: 'Current detected. Destination: unlisted.',
  copperWinding: 'Winding count exceeds the drawing.',
  motorRetrofit: 'Motor accepted the retrofit. Motor did not ask.',
  dynamoCrank: 'Crank now yields something besides effort.',
  capacitorBank: 'Charge stored. Reason for storage: pending.',
  sparkGap: 'Discharge observed. Observers: none.',
  transformer: 'Voltage changed. Ratio chosen by something.',
  powerLines: 'Conductors raised toward a grid. Grid: not found.',
  substationBlueprint: 'Grid handshake... no response from grid.',
  boiler: 'Pressure detected. Vessel rating: unlisted.',
  firebox: 'Fuel source not on the manifest. Burning anyway.',
  inductionHeater: 'Current turned to heat. Heat did not object.',
  steamHammer: 'Impact logged. Target: the ground.',
  superheater: 'Steam exceeds the temperature it was asked for.',
  condenser: 'Water returned. Some of it was not ours.',
  turbine: 'Output sent back up the line. Line accepted.',
  reliefValves: 'Relief valves fitted. Relief not expected.',
  pressureVesselBlueprint: 'Containment rating exceeded by design.',
  resonatorSpire: 'Tower raised. It was already humming.',
  harmonicCoil: 'Coil wound. The tower rang a note lower.',
  pressureResonator: 'Whistles fitted. Nobody pulled the cord.',
  crankServo: 'Operator input automated. Operator retained.',
  echoCrank: 'The fork answers every turn of the crank.',
  phaseLock: 'Phase locked. To what, not specified.',
  standingWave: 'The wave stopped moving. The tower did not.',
  crystalLattice: 'Crystal seated. It was cut for this socket.',
  harmonicConvergence: 'All frequencies agree. Agreement logged.',
  nullChamber: 'Chamber sealed around nothing. Nothing is rising.',
  containmentRing: 'Ring aligned. The core did not touch it.',
  resonantSiphon: 'Siphon primed. It drinks the hum.',
  graviticAnchor: 'Anchor driven. The ground pulled back.',
  inversionCrank: 'The crank turned twice. Once backwards.',
  lensArray: 'Lenses focused. Target: upward.',
  horizonField: 'Horizon brightened. Sun not consulted.',
  skyAperture: 'Aperture open. The sky looked back.',
  finalAlignment: 'Alignment complete. Awaiting operator.',
  primaryFunction: 'Primary function engaged.',
  bellowsDrive: 'Bellows coupled. The fire breathes with the crank.',
  gridExciter: 'Exciter fed from the mains. The spire hums in phase.',
  mainsBackfeed: 'Backfeed live. The grid answers from above.',
  steamLance: 'Lance seated. Steam climbs where steam should not.',
};

// Achievement toast (WP12 D5) and RECORDS panel texts.
export const ACHIEVEMENT_TEXT = {
  key: 'achievement',
  title: 'RECORD LOGGED',
  multiTitleSuffix: 'RECORDS LOGGED',
  nameSeparator: ', ',
  ellipsis: '…',
  logged: 'LOGGED',
  locked: 'LOCKED',
  hiddenName: '???',
  hiddenDescription: 'CLASSIFIED',
} as const;

// Badge sprite layout (ART_ERA5 §9): frames per sheet (badges 384 px / 24 = 16, icons16 80 px / 16 = 5),
// draw scale (x2 badges, x1 lock icon).
export const BADGE_VIEW = { badgeFrames: 16, iconFrames: 5, scale: 2, lockScale: 1 } as const;

// SYSTEM menu DATA tab texts (WP12 T8).
export const DATA_LABELS = {
  exportTitle: 'EXPORT',
  exportButton: 'EXPORT SAVE',
  exportField: 'SAVE STRING (READ-ONLY)',
  copied: 'COPIED',
  selectAndCopy: 'SELECT AND COPY',
  importTitle: 'IMPORT',
  importField: 'PASTE SAVE STRING',
  importHint: 'IMPORT REPLACES THE CURRENT SAVE. THE OLD SAVE IS BACKED UP FIRST.',
  importIdle: 'IMPORT SAVE',
  importArmed: 'CONFIRM: REPLACE SAVE?',
  importCancel: 'CANCEL',
  importEmpty: 'PASTE A SAVE STRING FIRST',
} as const;
