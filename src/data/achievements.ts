import type { ResourceId, TechId } from './types';

// Achievement table (WP12, C3). Pure data: every name, description, icon and threshold lives here.
// Order of ACHIEVEMENT_IDS is the unlock/listing order. Cosmetic only: no economy effect.

export const ACHIEVEMENT_IDS = [
  'firstTurn', 'steadyHand', 'tireless', 'unrelenting', 'shiftWorker', 'wornMotor', 'fullStroke', 'blueprint',
  'tinkerer', 'engineer', 'fullIndex',
  'eraElectric', 'noGrid', 'kilowatt', 'eraThermal', 'ratingExceeded', 'rollingBoil', 'eraResonance',
  'convergence', 'harmonics', 'eraExotic', 'alignment', 'restoration', 'newCycle',
  'shortNap', 'longSilence', 'automation', 'servoChorus', 'sevenDigits', 'thirteenDigits', 'bigNumber',
  'echoes', 'keeper',
] as const;
export type AchievementId = typeof ACHIEVEMENT_IDS[number];

export type AchievementCondition =
  | { type: 'stat'; key: 'clicks' | 'purchases' | 'activeSeconds' | 'longestOfflineSeconds' | 'cycles'; atLeast: number }
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetime'; res: ResourceId | 'any'; atLeast: number }
  | { type: 'maxRate'; res: ResourceId; atLeast: number }
  | { type: 'techsOwned'; atLeast: number }
  | { type: 'prestige'; key: 'echoesEarned' | 'perksOwned'; atLeast: number };

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  icon: number;
  condition: AchievementCondition;
  secret?: boolean;
}

// Sprite sheets and frame layout for the badge UI (ART_ERA5 §9). Paths are relative to public/.
export const UI_ART = {
  badges: 'assets/ui/badges.png',
  badgesLocked: 'assets/ui/badges-locked.png',
  icons16: 'assets/ui/icons16.png',
  button: 'assets/ui/button.png',
  panel: 'assets/ui/panel.png',
  badgeFrame: 24,
  iconFrame: 16,
  icon: { lock: 3, check: 4 },
  nineSliceBorder: 8,
} as const;

export const ACHIEVEMENTS: Readonly<Record<AchievementId, AchievementDefinition>> = {
  firstTurn: {
    id: 'firstTurn', name: 'First Turn', description: 'Crank the handle once.', icon: 0,
    condition: { type: 'stat', key: 'clicks', atLeast: 1 },
  },
  steadyHand: {
    id: 'steadyHand', name: 'Steady Hand', description: 'Crank the handle 100 times.', icon: 1,
    condition: { type: 'stat', key: 'clicks', atLeast: 100 },
  },
  tireless: {
    id: 'tireless', name: 'Tireless', description: 'Crank the handle 1,000 times.', icon: 2,
    condition: { type: 'stat', key: 'clicks', atLeast: 1000 },
  },
  unrelenting: {
    id: 'unrelenting', name: 'Unrelenting', description: 'Crank the handle 10,000 times.', icon: 2,
    condition: { type: 'stat', key: 'clicks', atLeast: 10000 },
  },
  shiftWorker: {
    id: 'shiftWorker', name: 'Shift Worker', description: 'Keep the machine running for one hour.', icon: 1,
    condition: { type: 'stat', key: 'activeSeconds', atLeast: 3600 },
  },
  wornMotor: {
    id: 'wornMotor', name: 'It Moves By Itself', description: 'Find the worn motor.', icon: 3,
    condition: { type: 'tech', id: 'wornMotor', minLevel: 1 },
  },
  fullStroke: {
    id: 'fullStroke', name: 'Full Stroke', description: 'Install a piston array.', icon: 3,
    condition: { type: 'tech', id: 'pistonArray', minLevel: 1 },
  },
  blueprint: {
    id: 'blueprint', name: 'Blueprint', description: 'Draft the generator blueprint.', icon: 4,
    condition: { type: 'tech', id: 'generatorBlueprint', minLevel: 1 },
  },
  tinkerer: {
    id: 'tinkerer', name: 'Tinkerer', description: 'Make 25 purchases.', icon: 4,
    condition: { type: 'stat', key: 'purchases', atLeast: 25 },
  },
  engineer: {
    id: 'engineer', name: 'Engineer', description: 'Make 150 purchases.', icon: 4,
    condition: { type: 'stat', key: 'purchases', atLeast: 150 },
  },
  fullIndex: {
    id: 'fullIndex', name: 'Full Index', description: 'Own 30 technologies.', icon: 4,
    condition: { type: 'techsOwned', atLeast: 30 },
  },
  eraElectric: {
    id: 'eraElectric', name: 'Live Wire', description: 'Bring the generator online.', icon: 5,
    condition: { type: 'tech', id: 'generator', minLevel: 1 },
  },
  noGrid: {
    id: 'noGrid', name: 'No Grid Answered', description: 'Draft the substation blueprint.', icon: 5,
    condition: { type: 'tech', id: 'substationBlueprint', minLevel: 1 },
  },
  kilowatt: {
    id: 'kilowatt', name: 'Kilowatt', description: 'Reach 1,000 EE per second.', icon: 5,
    condition: { type: 'maxRate', res: 'ee', atLeast: 1000 },
  },
  eraThermal: {
    id: 'eraThermal', name: 'Under Pressure', description: 'Fire up the boiler.', icon: 6,
    condition: { type: 'tech', id: 'boiler', minLevel: 1 },
  },
  ratingExceeded: {
    id: 'ratingExceeded', name: 'Rating Exceeded', description: 'Draft the pressure vessel.', icon: 6,
    condition: { type: 'tech', id: 'pressureVesselBlueprint', minLevel: 1 },
  },
  rollingBoil: {
    id: 'rollingBoil', name: 'Rolling Boil', description: 'Reach 1,000 PR per second.', icon: 6,
    condition: { type: 'maxRate', res: 'pr', atLeast: 1000 },
  },
  eraResonance: {
    id: 'eraResonance', name: 'Resonant', description: 'Raise the resonator spire.', icon: 7,
    condition: { type: 'tech', id: 'resonatorSpire', minLevel: 1 },
  },
  convergence: {
    id: 'convergence', name: 'Convergence', description: 'Complete the harmonic convergence.', icon: 7,
    condition: { type: 'tech', id: 'harmonicConvergence', minLevel: 1 },
  },
  harmonics: {
    id: 'harmonics', name: 'Harmonics', description: 'Reach 1,000 RS per second.', icon: 7,
    condition: { type: 'maxRate', res: 'rs', atLeast: 1000 },
  },
  eraExotic: {
    id: 'eraExotic', name: 'Units Unknown', description: 'Something answered from the null chamber.', icon: 8, secret: true,
    condition: { type: 'tech', id: 'nullChamber', minLevel: 1 },
  },
  alignment: {
    id: 'alignment', name: 'Alignment', description: 'The last alignment, secured.', icon: 8, secret: true,
    condition: { type: 'tech', id: 'finalAlignment', minLevel: 1 },
  },
  restoration: {
    id: 'restoration', name: 'Primary Function', description: 'The machine remembers what it is for.', icon: 9, secret: true,
    condition: { type: 'tech', id: 'primaryFunction', minLevel: 1 },
  },
  newCycle: {
    id: 'newCycle', name: 'Cycle 0043', description: 'The count begins again.', icon: 10, secret: true,
    condition: { type: 'stat', key: 'cycles', atLeast: 2 },
  },
  shortNap: {
    id: 'shortNap', name: 'Short Nap', description: 'Stay offline for one hour.', icon: 12,
    condition: { type: 'stat', key: 'longestOfflineSeconds', atLeast: 3600 },
  },
  longSilence: {
    id: 'longSilence', name: 'Long Silence', description: 'Stay offline for eight hours.', icon: 12,
    condition: { type: 'stat', key: 'longestOfflineSeconds', atLeast: 28800 },
  },
  automation: {
    id: 'automation', name: 'Hands Free', description: 'Install the crank servo.', icon: 13,
    condition: { type: 'tech', id: 'crankServo', minLevel: 1 },
  },
  servoChorus: {
    id: 'servoChorus', name: 'Servo Chorus', description: 'Bring the crank servo to level 9 of 10.', icon: 13,
    condition: { type: 'tech', id: 'crankServo', minLevel: 9 },
  },
  sevenDigits: {
    id: 'sevenDigits', name: 'Seven Digits', description: 'Reach 1,000,000 lifetime ME.', icon: 14,
    condition: { type: 'lifetime', res: 'me', atLeast: 1e6 },
  },
  thirteenDigits: {
    id: 'thirteenDigits', name: 'Ten Digits', description: 'Reach 1,000,000,000 of any resource.', icon: 14,
    condition: { type: 'lifetime', res: 'any', atLeast: 1e9 },
  },
  bigNumber: {
    id: 'bigNumber', name: 'Gauge In The Red', description: 'Reach 5 billion of any resource.', icon: 14,
    condition: { type: 'lifetime', res: 'any', atLeast: 5e9 },
  },
  echoes: {
    id: 'echoes', name: 'Echo Chamber', description: 'Gather nine Echoes across finished cycles.', icon: 11, secret: true,
    condition: { type: 'prestige', key: 'echoesEarned', atLeast: 9 },
  },
  keeper: {
    id: 'keeper', name: 'Keeper', description: 'Own all five Memory perks.', icon: 15, secret: true,
    condition: { type: 'prestige', key: 'perksOwned', atLeast: 5 },
  },
};

export const ACHIEVEMENT_LIST: readonly AchievementDefinition[] = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id]);
