export const TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor',
  'motorTuning','pistonArray','improvedPistons','generatorBlueprint'] as const;
export type TechId = typeof TECH_IDS[number];
export const RESOURCE_IDS = ['me', 'ee', 'pr', 'rs', 'xf'] as const;
export type ResourceId = typeof RESOURCE_IDS[number];
export type ResourceMap = Record<ResourceId, number>;
export interface ResourceDefinition {
  id: ResourceId; name: string; short: string; era: number;
  source: ResourceId | null;               // resource that feeds this one via `convert`
  convExp: number;                         // exponent applied to the source per-second rate
}
export type TechKind = 'starting' | 'unlock' | 'repeatable' | 'milestone';
export type Branch = 'origin' | 'mechanical' | 'automation' | 'convergence';
export type Effect =                                      // repeatable effects apply per level
  | { type: 'clickAdd'; amount: number }                  // additive ME/click
  | { type: 'clickMult'; factor: number }                 // multiplicative manual ME
  | { type: 'autoAdd'; amount: number; res?: ResourceId } // additive /s, res defaults to 'me'
  | { type: 'autoPct'; percent: number; res?: ResourceId } // additive % pool, res defaults to 'me'
  | { type: 'rateMult'; factor: number; res: ResourceId | 'all' } // multiplicative per-second
  | { type: 'convert'; amount: number; res: ResourceId }  // source = RESOURCES[res].source
  | { type: 'clickEcho'; seconds: number; res: ResourceId } // per click = seconds*lvl * perSecond[res]
  | { type: 'none' };
export type Requirement =
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetime'; res: ResourceId; amount: number };
export interface TechDefinition {
  id: TechId; name: string; kind: TechKind; branch: Branch;
  era: number; costRes: ResourceId;        // era: 1..5; costRes: resource spent by purchase
  baseCost: number; growth: number | null; maxLevel: number | null; // growth/maxLevel only for repeatable
  effects: Effect[]; requires: Requirement[];
  description: string; flavor?: string;
  tree: { col: number; row: number };      // layout hint for WP3 tech UI
}
export interface GameState {
  res: ResourceMap; lifetime: ResourceMap; totalClicks: number;
  techLevels: Record<TechId, number>;      // 0 = not owned; unlock/milestone owned = 1
  lastSimTime: number;                     // epoch ms of last simulated point
  createdAt: number;
}
export interface SettingsState { muted: boolean }
export interface ProductionRates { perClick: ResourceMap; perSecond: ResourceMap }
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
export interface OfflineReport { elapsedSeconds: number; cappedSeconds: number; gained: ResourceMap }
export interface SaveEnvelope { version: number; savedAt: number; state: GameState; settings: SettingsState }
export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'recovered';
export interface LoadResult { state: GameState; settings: SettingsState; status: LoadStatus; error?: string }
