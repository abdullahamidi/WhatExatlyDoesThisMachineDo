export const TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor',
  'motorTuning','pistonArray','improvedPistons','generatorBlueprint'] as const;
export type TechId = typeof TECH_IDS[number];
export type TechKind = 'starting' | 'unlock' | 'repeatable' | 'milestone';
export type Branch = 'origin' | 'mechanical' | 'automation' | 'convergence';
export type Effect =                       // repeatable effects apply per level
  | { type: 'clickAdd'; amount: number }   // additive ME/click
  | { type: 'clickMult'; factor: number }  // multiplicative manual
  | { type: 'autoAdd'; amount: number }    // additive ME/s
  | { type: 'autoPct'; percent: number }   // additive % pool -> (1 + sum%/100)
  | { type: 'none' };
export type Requirement =
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetimeMe'; amount: number };
export interface TechDefinition {
  id: TechId; name: string; kind: TechKind; branch: Branch;
  baseCost: number; growth: number | null; maxLevel: number | null; // growth/maxLevel only for repeatable
  effects: Effect[]; requires: Requirement[];
  description: string; flavor?: string;
  tree: { col: number; row: number };      // layout hint for WP3 tech UI
}
export interface GameState {
  me: number; lifetimeMe: number; totalClicks: number;
  techLevels: Record<TechId, number>;      // 0 = not owned; unlock/milestone owned = 1
  lastSimTime: number;                     // epoch ms of last simulated point
  createdAt: number;
}
export interface SettingsState { muted: boolean }
export interface ProductionRates { perClick: number; perSecond: number }
export type TechStatus = 'locked' | 'available' | 'purchased';
export interface RequirementView { req: Requirement; met: boolean; label: string }
export interface TechView {
  id: TechId; def: TechDefinition; status: TechStatus; level: number;
  nextCost: number | null; affordable: boolean; requirements: RequirementView[];
  currentEffectText: string; nextEffectText: string | null;
}
export type PurchaseFailure = 'locked' | 'maxed' | 'owned' | 'insufficient' | 'notPurchasable';
export type PurchaseResult =
  | { ok: true; state: GameState; cost: number; newLevel: number }
  | { ok: false; reason: PurchaseFailure };
export interface OfflineReport { elapsedSeconds: number; cappedSeconds: number; gained: number }
export interface SaveEnvelope { version: number; savedAt: number; state: GameState; settings: SettingsState }
export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'recovered';
export interface LoadResult { state: GameState; settings: SettingsState; status: LoadStatus; error?: string }
