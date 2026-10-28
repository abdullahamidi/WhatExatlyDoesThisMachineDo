import type { AchievementId } from './achievements';
import type { PerkId } from './prestige';
import type { WorldSaveState } from './livingWorld';
export const TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor',
  'motorTuning','pistonArray','improvedPistons','generatorBlueprint',
  'generator','copperWinding','motorRetrofit','dynamoCrank','capacitorBank','sparkGap','transformer','powerLines','substationBlueprint',
  'boiler','firebox','inductionHeater','steamHammer','superheater','condenser','turbine','reliefValves','pressureVesselBlueprint',
  'resonatorSpire','harmonicCoil','pressureResonator','crankServo','echoCrank','phaseLock','standingWave','crystalLattice','harmonicConvergence',
  'nullChamber','containmentRing','resonantSiphon','graviticAnchor','inversionCrank','lensArray','horizonField','skyAperture','finalAlignment','primaryFunction',
  'bellowsDrive','gridExciter','mainsBackfeed','steamLance',
  'faultLamp','dischargeLever','leakWhistle','dampingFork','overrunClutch'] as const;
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
  | { type: 'offlineHours'; hours: number } // adds hours * level to the offline cap
  | { type: 'autoClick'; perSecond: number } // perSecond * level automatic crank clicks per second
  | { type: 'crankEcho'; seconds: number }                 // every click (manual and servo) also yields seconds x perSecondPre of EVERY energy, ME included
  | { type: 'windup'; seconds: number; refill: number }    // wind-up capacity (s of output) and refill (s per s)
  | { type: 'faultUnlock'; seconds: number }               // faults on; base payout seconds
  | { type: 'faultSeconds'; seconds: number }              // + payout seconds
  | { type: 'faultRate'; factor: number }                  // spawn interval x factor^level
  | { type: 'faultWindow'; seconds: number }               // + seconds a fault stays
  | { type: 'overdrive'; seconds: number; factor: number } // on a clear: perSecond x factor for `seconds` (refresh, never stack)
  | { type: 'ending' } // marker: starts the finale (WP12); no rate, click or offline effect
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
/** Finale progress (WP13): none -> sequence (cinematic) -> choice (KEEP / NEW CYCLE) -> postgame. */
export type EndingPhase = 'none' | 'sequence' | 'choice' | 'postgame';
export interface EndingState { phase: EndingPhase; engagedAt: number | null }   // engagedAt = lastSimTime at the ending purchase
export interface GameState {
  res: ResourceMap; lifetime: ResourceMap; totalClicks: number;
  techLevels: Record<TechId, number>;      // 0 = not owned; unlock/milestone owned = 1
  lastSimTime: number;                     // epoch ms of last simulated point
  createdAt: number;
  ending: EndingState;                     // WP13; additive save field (v2), default { phase: 'none', engagedAt: null }
}
export type NumberNotation = 'suffix' | 'scientific' | 'engineering';
export type UiScale = 100 | 125 | 150;
export type WorldVoices = 'on' | 'rare' | 'off';
export interface SettingsState {
  muted: boolean;
  masterVolume: number; sfxVolume: number; ambientVolume: number;   // int 0..100, default 100
  musicVolume: number;                  // int 0..100, default 70 (WP15); missing in old saves -> 70
  notation: NumberNotation;             // default 'suffix'
  reducedMotion: boolean;               // default false
  screenShake: boolean;                 // default true; ignored (off) while reducedMotion
  statusMarkers: boolean;               // default false
  uiScale: UiScale;                     // default 100
  confirmNewCycle: boolean;             // default true (WP14): BEGIN A NEW CYCLE asks for confirmation first
  worldVoices: WorldVoices;             // default on (WP23a): ON / RARE / OFF for the living-world speech bubbles
}
export interface StatsState {
  activeSeconds: number; offlineSeconds: number; longestOfflineSeconds: number;
  clicks: number; purchases: number;
  lifetime: ResourceMap; maxPerSecond: ResourceMap;
  cycles: number;                       // 1
  bestCycleSeconds: number | null;      // null
  startedAt: number;                    // epoch ms
}
export interface AchievementsState { unlocked: Partial<Record<AchievementId, number>> }   // id -> epoch ms
/** New-cycle prestige (WP14): cycle counter, lifetime Echoes earned, owned Memory perks in PERK_IDS order. */
export interface PrestigeState { cycle: number /* int >= 1 */; echoesEarned: number /* int >= 0, lifetime total */; perks: PerkId[] }
export interface ProductionRates { perClick: ResourceMap; perSecond: ResourceMap }
export type TechStatus = 'locked' | 'available' | 'purchased';
export interface RequirementView { req: Requirement; met: boolean; label: string }
export interface TechView {
  id: TechId; def: TechDefinition; status: TechStatus; level: number;
  nextCost: number | null; affordable: boolean; requirements: RequirementView[];
  currentEffectText: string; nextEffectText: string | null;
  demoLocked: boolean;                     // true when the edition era cap forbids this tech (WP21 demo)
}
export type PurchaseFailure = 'locked' | 'maxed' | 'owned' | 'insufficient' | 'notPurchasable' | 'demo';
export type PurchaseResult =
  | { ok: true; state: GameState; cost: number; newLevel: number }
  | { ok: false; reason: PurchaseFailure };
export interface OfflineReport { elapsedSeconds: number; cappedSeconds: number; gained: ResourceMap }
export interface SaveEnvelope { version: number; savedAt: number; state: GameState; settings: SettingsState; stats: StatsState; achievements: AchievementsState; prestige: PrestigeState; world: WorldSaveState }
export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'recovered';
export interface LoadResult { state: GameState; settings: SettingsState; stats: StatsState; achievements: AchievementsState; prestige: PrestigeState; world: WorldSaveState; status: LoadStatus; error?: string }
