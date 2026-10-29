// Living world data (WP23a, WP23b): denizen lines, chains, cadence and era caps, placements, sprite sheets, loops and environment tables.
// Why: every number and player-facing string of the living world lives here, so renderers and the simulation stay free of copy and balance.
// Pure data: no Phaser. The only derived values are seenKeyOf, WORLD_KNOWN_IDS and WORLD_SWEEP. Line text is verbatim from STORY_BIBLE §5.2.
import type { TechId } from './types';
import { DEPTH, GROUND_Y } from './world';
import { PALETTE } from './palette';

export type DenizenId = 'inspector' | 'dog' | 'crow' | 'girl' | 'payphone' | 'sensor7';
export type SpeakerId = Exclude<DenizenId, 'sensor7'>;   // sensor7 is wordless
export type GroundId = 'inspector' | 'dog' | 'crow' | 'payphone' | 'sensor7' | 'lamp' | 'clock' | 'stakeChain' | 'hole' | 'scraps'
  | 'girl' | 'puddles' | 'sprout' | 'lantern';
export type FramingKey = 'e1' | 's8' | 's8w' | 's9' | 's10' | 's11' | 's15' | 'portrait' | 'baseL' | 'baseR';
export type ChainId = 'crossedLines' | 'postCap' | 'synchronization' | 'oneObserver';
export type WorldRow = 'back' | 'front';

// What starts a line. Chains and beats are queued by the director; the rest come from the simulation.
export type LineTrigger =
  | { kind: 'logReply'; logId: string }
  | { kind: 'buy'; techId: TechId; minLevel?: number; level?: number }
  | { kind: 'ms'; techId: TechId }
  | { kind: 'eraEntry'; era: number }
  | { kind: 'idle'; owned?: readonly TechId[]; afterLog?: string; afterLine?: string; minPlayS?: number; minEraS?: number; localHour?: readonly [number, number] }
  | { kind: 'rapid' }
  | { kind: 'tier'; techId?: TechId; tier?: number; firstTop?: true }
  | { kind: 'offline'; minS: number }
  | { kind: 'demoNear'; lifetimeEe: number }
  | { kind: 'postCap'; step: number }
  | { kind: 'opener'; fromCycle: number; toCycle?: number }
  | { kind: 'postgame'; minS: number }
  | { kind: 'chain'; chainId: ChainId; step: number };
export type WorldOffer = LineTrigger | { kind: 'beat'; beat: string };

export interface WorldLine { id: string; speaker: SpeakerId; eras: readonly number[]; trigger: LineTrigger; tones: readonly string[];
  text: string; core?: true; you?: true; demo?: true; once?: true; cyc?: true; post?: true; replaces?: string; perEra?: true; scripted?: true }
export interface WorldSaveState { seen: string[]; seenEver: string[]; eraMoments: [number, number, number, number, number]; youEras: number; relics?: number }
export interface WorldPlacement { x: number; row: WorldRow; route?: readonly [number, number]; xs?: readonly number[]; dy?: number; inner?: true }
export interface LoopFrame { frame: string; dx: number; flip?: boolean }

// Era V shadows go out once the horizon field reaches level 9. INS-12 plays at the same level, so the line and the art change together.
// Defined above WORLD_LINES (its trigger reads it); worldEras.ts imports it, so this file must never import worldEras.ts.
export const WORLD_SHADOWS = { offEra: 5, offRule: { techId: 'horizonField', minLevel: 9 } } as const;

// The 63 lines: the 31 WP23a lines in bible order, then the 32 WP23b lines appended in bible order. Text is copied verbatim from
// STORY_BIBLE §5.2 (the sweep and the tests check it against the bible rows).
export const WORLD_LINES: readonly WorldLine[] = [
  { id: 'INS-01', speaker: 'inspector', eras: [1], trigger: { kind: 'logReply', logId: 'observer-count' }, tones: ['myst', 'funny'], text: "Unchanged. I'm not on the count either.", core: true },
  { id: 'INS-02', speaker: 'inspector', eras: [1], trigger: { kind: 'logReply', logId: 'chamber-seal' }, tones: ['funny'], text: "Signed it myself. Still not logged." },
  { id: 'INS-03', speaker: 'inspector', eras: [1, 2], trigger: { kind: 'logReply', logId: 'idle-cycle' }, tones: ['myst'], text: "No beginning. I checked page one. It's page two." },
  { id: 'INS-04', speaker: 'inspector', eras: [1], trigger: { kind: 'ms', techId: 'generatorBlueprint' }, tones: ['funny'], text: "R, blank, S. Seven letters. Rusting. Fits.", core: true },
  { id: 'INS-05', speaker: 'inspector', eras: [2], trigger: { kind: 'chain', chainId: 'crossedLines', step: 3 }, tones: ['funny'], text: "Operator. Not on my list.", core: true },
  { id: 'INS-06', speaker: 'inspector', eras: [2], trigger: { kind: 'idle', owned: ['powerLines'] }, tones: ['funny'], text: "Item four: the lamp. On. Item five: why." },
  { id: 'INS-07', speaker: 'inspector', eras: [2], trigger: { kind: 'ms', techId: 'substationBlueprint' }, tones: ['myst'], text: "Rusting doesn't fit anymore.", core: true },
  { id: 'INS-13', speaker: 'inspector', eras: [1, 2, 3, 4], trigger: { kind: 'tier', firstTop: true }, tones: ['funny', 'myst'], text: "Something just passed an inspection I didn't do." },
  { id: 'DOG-01', speaker: 'dog', eras: [1], trigger: { kind: 'idle', owned: ['wornMotor'] }, tones: ['funny'], text: "Good boy. Good— good boy. Stay." },
  { id: 'DOG-02', speaker: 'dog', eras: [1, 3], trigger: { kind: 'idle' }, tones: ['funny', 'creepy'], text: "Who's a good— who's a good— who's a good boy.", perEra: true },
  { id: 'DOG-03', speaker: 'dog', eras: [1, 2, 3], trigger: { kind: 'rapid' }, tones: ['funny'], text: "Easy. Easy. Somebody's in a hurry." },
  { id: 'DOG-04', speaker: 'dog', eras: [1, 2], trigger: { kind: 'tier', techId: 'improvedPistons', tier: 3 }, tones: ['funny'], text: "Loud. Too loud. Good— good boy." },
  { id: 'DOG-05', speaker: 'dog', eras: [2], trigger: { kind: 'idle', owned: ['powerLines'] }, tones: ['funny'], text: "Don't chew the cable. Don't chew— good boy." },
  { id: 'DOG-06', speaker: 'dog', eras: [2], trigger: { kind: 'logReply', logId: 'load-beneath' }, tones: ['creepy', 'funny'], text: "Leave it. Leave it. Leave it.", core: true },
  { id: 'DOG-07', speaker: 'dog', eras: [1, 2, 3, 4, 5], trigger: { kind: 'offline', minS: 3600 }, tones: ['tender', 'creepy'], text: "He waited the whole time. Good boy." },
  { id: 'DOG-12', speaker: 'dog', eras: [2], trigger: { kind: 'postCap', step: 4 }, tones: ['tender'], text: "Stay. Wait for it. Good boy.", core: true, demo: true, once: true },
  { id: 'CRW-01', speaker: 'crow', eras: [1], trigger: { kind: 'logReply', logId: 'unlabeled-part' }, tones: ['funny'], text: "Ignored. Ignored. Ignored." },
  { id: 'CRW-02', speaker: 'crow', eras: [1], trigger: { kind: 'idle', afterLog: 'observer-count' }, tones: ['myst'], text: "Zero-zero-four-one. Zero-zero-four-one." },
  { id: 'CRW-03', speaker: 'crow', eras: [1], trigger: { kind: 'buy', techId: 'pistonArray' }, tones: ['funny', 'myst'], text: "None. None. None." },
  { id: 'CRW-04', speaker: 'crow', eras: [2], trigger: { kind: 'chain', chainId: 'crossedLines', step: 2 }, tones: ['myst'], text: "Operator. Operator.", core: true },
  { id: 'GRL-01', speaker: 'girl', eras: [1], trigger: { kind: 'idle', minPlayS: 360 }, tones: ['myst', 'creepy'], text: "Is someone there? Your light is on.", core: true, you: true },
  { id: 'GRL-02', speaker: 'girl', eras: [2], trigger: { kind: 'idle', afterLine: 'GRL-01', minPlayS: 300, localHour: [0, 4] }, tones: ['creepy', 'tender'], text: "It's late where you are. Go to bed.", you: true, once: true },
  { id: 'GRL-03', speaker: 'girl', eras: [2], trigger: { kind: 'idle', owned: ['powerLines'] }, tones: ['myst'], text: "The lights came on. Nobody came home." },
  { id: 'GRL-04', speaker: 'girl', eras: [2], trigger: { kind: 'idle' }, tones: ['funny', 'creepy'], text: "Somebody's turning it. Is it somebody you know?", you: true },
  { id: 'GRL-05', speaker: 'girl', eras: [2], trigger: { kind: 'demoNear', lifetimeEe: 3000000 }, tones: ['myst'], text: "It gets bigger. Then it gets strange.", core: true },
  { id: 'GRL-06', speaker: 'girl', eras: [2], trigger: { kind: 'postCap', step: 3 }, tones: ['myst'], text: "The rest of it is further up. I saw it too.", core: true, demo: true, once: true },
  { id: 'PAY-01', speaker: 'payphone', eras: [2], trigger: { kind: 'chain', chainId: 'crossedLines', step: 1 }, tones: ['myst'], text: "Hello? Operator? Is this the operator?", core: true },
  { id: 'PAY-02', speaker: 'payphone', eras: [2], trigger: { kind: 'buy', techId: 'powerLines' }, tones: ['funny'], text: "Please hold. This call is important to us.", core: true },
  { id: 'PAY-03', speaker: 'payphone', eras: [2], trigger: { kind: 'idle', owned: ['powerLines'] }, tones: ['funny', 'creepy'], text: "All operators are busy. Or gone." },
  { id: 'PAY-04', speaker: 'payphone', eras: [2], trigger: { kind: 'idle', afterLog: 'copper-memory' }, tones: ['myst'], text: "Connecting… connecting… please continue to hold." },
  { id: 'PAY-05', speaker: 'payphone', eras: [2], trigger: { kind: 'postCap', step: 1 }, tones: ['funny', 'creepy'], text: "We're sorry. This call cannot be completed.", core: true, demo: true, once: true },
  // WP23b (eras III-V, postgame, cycle 2+). Columns follow the bible table; the texts equal the bible rows.
  { id: 'INS-08', speaker: 'inspector', eras: [3], trigger: { kind: 'idle', owned: ['reliefValves'] }, tones: ['funny'], text: "Forecast said rain. I brought an umbrella." },
  { id: 'INS-09', speaker: 'inspector', eras: [3], trigger: { kind: 'ms', techId: 'pressureVesselBlueprint' }, tones: ['creepy'], text: "I've stopped guessing the word. It's guessing me.", core: true },
  { id: 'INS-10', speaker: 'inspector', eras: [4], trigger: { kind: 'chain', chainId: 'oneObserver', step: 1 }, tones: ['creepy'], text: "One observer. I checked. It isn't me.", core: true },
  { id: 'INS-11', speaker: 'inspector', eras: [4], trigger: { kind: 'ms', techId: 'harmonicConvergence' }, tones: ['myst'], text: "Target: blank. I know the feeling.", core: true },
  { id: 'INS-12', speaker: 'inspector', eras: [5], trigger: { kind: 'buy', techId: WORLD_SHADOWS.offRule.techId, minLevel: WORLD_SHADOWS.offRule.minLevel }, tones: ['omen', 'funny'], text: "My shadow's gone. I've filed a report." },
  { id: 'INS-14', speaker: 'inspector', eras: [1], trigger: { kind: 'idle' }, tones: ['funny', 'creepy'], text: "Same rounds. Page one. You look familiar.", cyc: true, once: true, replaces: 'INS-01' },
  { id: 'INS-PG', speaker: 'inspector', eras: [5], trigger: { kind: 'postgame', minS: 0 }, tones: ['tender'], text: "Good boy.", post: true, scripted: true },
  { id: 'DOG-08', speaker: 'dog', eras: [3], trigger: { kind: 'idle', owned: ['reliefValves'] }, tones: ['funny', 'creepy'], text: "Don't shake on the carpet. What carpet." },
  { id: 'DOG-09', speaker: 'dog', eras: [4], trigger: { kind: 'chain', chainId: 'synchronization', step: 1 }, tones: ['creepy'], text: "Good boy. Good boy.", core: true },
  { id: 'DOG-10', speaker: 'dog', eras: [4], trigger: { kind: 'idle' }, tones: ['creepy'], text: "Sit. Stay. Stay. Stay." },
  { id: 'DOG-11', speaker: 'dog', eras: [5], trigger: { kind: 'idle' }, tones: ['omen'], text: "Heel. Heel. Good— heel." },
  { id: 'DOG-13', speaker: 'dog', eras: [1, 2], trigger: { kind: 'idle' }, tones: ['tender', 'creepy'], text: "Good boy. You kept the ball. Good boy.", cyc: true, once: true, replaces: 'DOG-01' },
  { id: 'CRW-05', speaker: 'crow', eras: [3], trigger: { kind: 'idle' }, tones: ['myst'], text: "{cycleWords}. {cycleWords}." },
  { id: 'CRW-06', speaker: 'crow', eras: [4], trigger: { kind: 'chain', chainId: 'synchronization', step: 1 }, tones: ['creepy'], text: "Good boy. Good boy.", core: true },
  { id: 'CRW-07', speaker: 'crow', eras: [4], trigger: { kind: 'buy', techId: 'echoCrank' }, tones: ['creepy'], text: "Answers. Answers. Answers." },
  { id: 'CRW-08', speaker: 'crow', eras: [5], trigger: { kind: 'ms', techId: 'finalAlignment' }, tones: ['creepy'], text: "Thank you for holding. Thank you for holding.", core: true, you: true },
  { id: 'CRW-09', speaker: 'crow', eras: [3], trigger: { kind: 'idle' }, tones: ['creepy'], text: "{cycleWords}. Again.", cyc: true, replaces: 'CRW-05' },
  { id: 'GRL-07', speaker: 'girl', eras: [3], trigger: { kind: 'logReply', logId: 'steam-rain' }, tones: ['myst', 'funny'], text: "It's not an error. It's Tuesday.", core: true },
  { id: 'GRL-08', speaker: 'girl', eras: [3], trigger: { kind: 'idle' }, tones: ['creepy'], text: "Smell that? Don't tell it." },
  { id: 'GRL-09', speaker: 'girl', eras: [4], trigger: { kind: 'chain', chainId: 'oneObserver', step: 2 }, tones: ['creepy'], text: "It isn't counting us.", core: true },
  { id: 'GRL-10', speaker: 'girl', eras: [4], trigger: { kind: 'idle' }, tones: ['creepy'], text: "I'm not walking. You keep looking away.", core: true, you: true },
  { id: 'GRL-11', speaker: 'girl', eras: [5], trigger: { kind: 'idle', owned: ['skyAperture'] }, tones: ['omen'], text: "Don't look up. It looks back." },
  { id: 'GRL-12', speaker: 'girl', eras: [1], trigger: { kind: 'idle' }, tones: ['creepy', 'tender'], text: "Cycle {cycle}. You came back. So did we.", cyc: true, once: true, replaces: 'GRL-01' },
  { id: 'PAY-06', speaker: 'payphone', eras: [3], trigger: { kind: 'eraEntry', era: 3 }, tones: ['funny'], text: "Someone moved me. I was mid-call.", core: true },
  { id: 'PAY-07', speaker: 'payphone', eras: [3], trigger: { kind: 'idle', minEraS: 900 }, tones: ['funny', 'creepy'], text: "You've been holding a long time. Please hold.", core: true, you: true },
  { id: 'PAY-08', speaker: 'payphone', eras: [4], trigger: { kind: 'logReply', logId: 'signal-below' }, tones: ['creepy'], text: "Hello? I'm calling from downstairs.", core: true },
  { id: 'PAY-09', speaker: 'payphone', eras: [4], trigger: { kind: 'chain', chainId: 'synchronization', step: 2 }, tones: ['creepy'], text: "All lines are now in phase. Please hold.", core: true },
  { id: 'PAY-10', speaker: 'payphone', eras: [4], trigger: { kind: 'idle', afterLine: 'INS-10' }, tones: ['omen'], text: "This call may be monitored. It always was." },
  { id: 'PAY-11', speaker: 'payphone', eras: [5], trigger: { kind: 'logReply', logId: 'operator-located' }, tones: ['omen'], text: "Operator located. Please hold for connection.", core: true },
  { id: 'PAY-12', speaker: 'payphone', eras: [5], trigger: { kind: 'postgame', minS: 600 }, tones: ['tender'], text: "Thank you for holding.", core: true, post: true },
  { id: 'PAY-13', speaker: 'payphone', eras: [1, 2], trigger: { kind: 'opener', fromCycle: 2, toCycle: 2 }, tones: ['creepy'], text: "You have one saved message. It is from you.", core: true, cyc: true, once: true },
  { id: 'PAY-14', speaker: 'payphone', eras: [1, 2], trigger: { kind: 'opener', fromCycle: 3 }, tones: ['creepy'], text: "You have {savedWords} saved messages. All from you.", core: true, cyc: true },
];

// A perEra line keeps its plain id in its first listed era, so WP23a saves stay valid; its later eras are seen as `id@era`
// (bible §7.8: DOG-02 once in era I and once in era III, so era III's seen key is `DOG-02@3`).
export function seenKeyOf(line: WorldLine, era: number): string {
  return line.perEra === true && era !== line.eras[0] ? line.id + '@' + era : line.id;
}

// Chains are one moment for cadence; members play in step order (bible §6.1).
// A trigger step counts spoken members only; the wordless readout flip is step 1 of ONE OBSERVER in the bible.
export const WORLD_CHAINS: Record<ChainId, readonly string[]> = {
  crossedLines: ['PAY-01', 'CRW-04', 'INS-05'],
  synchronization: ['DOG-09', 'CRW-06', 'PAY-09'],
  oneObserver: ['INS-10', 'GRL-09'],
  postCap: ['PAY-05', 'INS-07', 'GRL-06', 'DOG-12'],
};
// Members that start on the same frame (bible §6.1 SYNCHRONIZATION). The pair is chain step 1 of synchronization.
export const WORLD_UNISON: readonly (readonly [string, string])[] = [['DOG-09', 'CRW-06']];
// What starts each chain (bible §6.1): a purchase or a SYS LOG reply. postCap starts from the demo cap (§8), so it is not listed.
export const WORLD_CHAIN_STARTS: Record<Exclude<ChainId, 'postCap'>, { kind: 'buy'; techId: TechId } | { kind: 'logReply'; logId: string }> = {
  crossedLines: { kind: 'buy', techId: 'generator' },
  synchronization: { kind: 'logReply', logId: 'sync-success' },
  oneObserver: { kind: 'logReply', logId: 'observer-one' },
};
// Wordless beats (bible §5.5): pseudo-ids that are not lines.
export const WORLD_BEATS: readonly string[] = ['beat.tapeFreeze', 'beat.failedSync', 'beat.sensorTurn'];
// Every id a save may carry for the living world (normalize filter): line ids except scripted lines (never scheduled, so never
// seen), the per-era keys of perEra lines, and the beats.
export const WORLD_KNOWN_IDS: ReadonlySet<string> = new Set<string>([
  ...WORLD_LINES.filter((l) => l.scripted !== true).map((l) => l.id),
  ...WORLD_LINES.filter((l) => l.perEra === true).flatMap((l) => l.eras.map((e) => seenKeyOf(l, e))),
  ...WORLD_BEATS,
]);
// Layer ceiling: eras I-V (WP23b). The demo keeps its own cap (EDITIONS.demo.maxEra).
export const LIVING_WORLD = { maxEra: 5 } as const;
// Relic count cap (WP28 FIELD NOTES): equals RELIC_NOTES.length (src/data/finds.ts); pinned by a GameSession test.
export const RELICS_MAX = 15;
export const DEFAULT_WORLD_SAVE: WorldSaveState = { seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0, relics: 0 };

// Cadence and timing (bible §7.1). Milliseconds unless the name says otherwise.
export const WORLD_VOICE_CONFIG = {
  firstMomentAfterMs: 90000, sessionWarmupMs: 60000, minGapMs: 120000, logReplyGapMs: 45000, nonCoreGapMs: 360000,
  perDenizenGapMs: 300000, toastQuietMs: 30000, afterIndexCloseMs: 2500, logReplyAfterClearMs: 1000,
  idleInputMs: 45000, idleInputCoreMs: 20000, hourCap: 8, hourCapCycle2: 4, hourWindowMs: 3600000,
  reactiveTtlMs: 90000, logReplyTtlMs: 40000, coreLogReplyTtlMs: 150000,
  bubbleBaseMs: 2600, bubblePerCharMs: 55, bubbleMinMs: 3500, bubbleMaxMs: 6500, bubbleFadeMs: 150,
  turnHoldBeforeMs: 300, turnHoldAfterMs: 600, glanceHoldMs: 1500, glanceNoBubbleNearMs: 10000,
  chainStepAfterMs: 1200, chainMaxBubbles: 2, seenFraction: 0.6, sysLogDeferMaxMs: 6500,
  offlineAfterWelcomeMs: 8000, offlineMinS: 3600, rapidClicksPerS: 6, rapidWindowMs: 3000, dialToneMaxMs: 2000,
  crossedLinesPrelude: { dialToneMs: 1200, ringMs: 1000 }, ringGapMs: 300000, postCapFirstMs: 20000, postCapGapMs: 120000,
  tapeFreezeMs: 1200, placeWaitMs: 10000, placeBlockLimit: 2, ladderRecheckMs: 250, viewInsetPx: 16, rippleOutsideGapMs: 4000,
  earFlickGapMs: 10000, tickClampMs: 250,
  eraEntryAfterCardMs: 3000, openerAfterPurchaseMs: 60000, unisonHoldMs: 4800, unisonCapMs: 12000,
} as const;

// Moments per era (bible §7.2): core is reserved, nonCore is capped. postCap is the demo arc; postgame is the held day.
export const WORLD_ERA_CAPS: Record<1 | 2 | 3 | 4 | 5 | 'postCap' | 'postgame', { core: number; nonCore: number }> = {
  1: { core: 3, nonCore: 3 }, 2: { core: 5, nonCore: 2 }, 3: { core: 4, nonCore: 2 }, 4: { core: 5, nonCore: 1 },
  5: { core: 2, nonCore: 2 }, postCap: { core: 4, nonCore: 0 }, postgame: { core: 1, nonCore: 0 },
};
// Glance gaps per era (bible §7.6): a random denizen turns to camera, wordless. Era V has none (the stare, §5.5).
export const WORLD_GLANCE: Record<1 | 2 | 3 | 4, { minMs: number; maxMs: number }> = {
  1: { minMs: 360000, maxMs: 540000 }, 2: { minMs: 300000, maxMs: 480000 }, 3: { minMs: 240000, maxMs: 420000 },
  4: { minMs: 180000, maxMs: 300000 },
};
export const WORLD_GLANCE_SEED = 23101;

// Era V rows (s15 and the portrait framing). Lantern 965 is the girl's x minus 11 (AD3b, WORLD_ENDING.homeX.lantern); it lies on the
// girl's drop line in the front row, dy 40 = her five era V steps (WORLD_GIRL.stepDyWorldPx x steps, AD3d H3).
const S15_ROWS: Partial<Record<GroundId, WorldPlacement>> = {
  sensor7: { x: 712, row: 'back' }, inspector: { x: 784, row: 'back', route: [760, 808] },
  payphone: { x: 3050, row: 'back' }, lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' },
  dog: { x: 2856, row: 'front', inner: true }, clock: { x: 2890, row: 'back', inner: true },
  stakeChain: { x: 2840, row: 'front', inner: true }, hole: { x: 2886, row: 'front', inner: true },
  puddles: { x: 960, row: 'back', inner: true }, sprout: { x: 996, row: 'back', inner: true },
  lantern: { x: 965, row: 'front', dy: 40, inner: true }, scraps: { x: 690, row: 'back', xs: [690, 830, 960] },
};
// Feet x per framing key (world px). Positions are fixed by DENIZEN_ART §3; a denizen that does not fit is off-stage.
export const WORLD_PLACEMENTS: Record<FramingKey, Partial<Record<GroundId, WorldPlacement>>> = {
  e1: {
    sensor7: { x: 1384, row: 'back' }, inspector: { x: 1472, row: 'back', route: [1448, 1496] },
    dog: { x: 2364, row: 'front' }, clock: { x: 2516, row: 'back' }, payphone: { x: 2420, row: 'back' },
    lamp: { x: 2476, row: 'back' }, crow: { x: 2476, row: 'back' }, stakeChain: { x: 2348, row: 'front' },
    hole: { x: 2394, row: 'front' }, scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
  },
  // WP27 F6.1: Sensor 7 and the clock stand at the generator pose; the Inspector moves to 1536 (no route). Without a sensor7 entry
  // placeOne returned null, so the era II entry showed no Sensor 7.
  s8: {
    sensor7: { x: 1470, row: 'back' }, inspector: { x: 1536, row: 'back' }, clock: { x: 2680, row: 'back' },
    dog: { x: 2604, row: 'front' }, payphone: { x: 2604, row: 'back' },
    lamp: { x: 2656, row: 'back' }, crow: { x: 2656, row: 'back' }, stakeChain: { x: 2588, row: 'front' },
    hole: { x: 2634, row: 'front' }, scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
  },
  // WP27 F6.1: the framing when a capacitorBank or sparkGap stands before the transformer (cx 2104 / 2112). The sensor and the
  // Inspector keep the wing rule at both poses. No clock: the right wing (2672-2728) holds payphone, lamp and crow (documented
  // exemption; the pose lasts 28-137 s). No girl: no 24 px slot at this pose (fallback b, ART_AUDIT WP27 (a)).
  s8w: {
    sensor7: { x: 1500, row: 'back' }, inspector: { x: 1552, row: 'back' },
    dog: { x: 2694, row: 'front' }, payphone: { x: 2678, row: 'back' }, lamp: { x: 2720, row: 'back' }, crow: { x: 2720, row: 'back' },
    stakeChain: { x: 2676, row: 'front' }, hole: { x: 2716, row: 'front' }, scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
  },
  s9: {
    sensor7: { x: 1384, row: 'back' }, inspector: { x: 1472, row: 'back', route: [1448, 1496] },
    dog: { x: 2856, row: 'front' }, clock: { x: 2900, row: 'back' }, payphone: { x: 2944, row: 'back' },
    lamp: { x: 2996, row: 'back' }, crow: { x: 2996, row: 'back' }, stakeChain: { x: 2840, row: 'front' },
    hole: { x: 2886, row: 'front' }, scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
  },
  // Late framings (WP23b R6). Inner entries sit in the inner gap (WORLD_LAYOUT.innerClearPx) and skip the wing rule.
  // WP27 F6.5 (era III, same rule): Sensor 7 at 1234 with the Inspector at 1276 (the one spot, WORLD_SPOTS.s10).
  s10: {
    sensor7: { x: 1234, row: 'back' }, inspector: { x: 1276, row: 'back' }, dog: { x: 2858, row: 'front' }, payphone: { x: 2858, row: 'back' },
    stakeChain: { x: 2842, row: 'front' }, hole: { x: 2888, row: 'front' },   // hole fails the wing rule here: off-stage
  },
  // WP27 F6.5: Sensor 7 at 750, the Inspector at 816 with the route 792-840 (the spots of WORLD_SPOTS.s11; the crouch clears the tripod by 6 px).
  s11: {
    sensor7: { x: 750, row: 'back' }, inspector: { x: 816, row: 'back', route: [792, 840] },
    dog: { x: 2856, row: 'front' }, clock: { x: 2890, row: 'back' }, payphone: { x: 3050, row: 'back' },
    lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' }, stakeChain: { x: 2840, row: 'front' },
    hole: { x: 2886, row: 'front' }, scraps: { x: 690, row: 'back', xs: [690, 830, 960] },
    puddles: { x: 960, row: 'back' }, sprout: { x: 996, row: 'back' },
  },
  s15: S15_ROWS,
  // Portrait is the s15 rows with the inspector standing without a route.
  portrait: { ...S15_ROWS, inspector: { x: 784, row: 'back' } },
  baseL: {
    sensor7: { x: 712, row: 'back' }, inspector: { x: 784, row: 'back' },
    puddles: { x: 960, row: 'back', inner: true }, sprout: { x: 996, row: 'back', inner: true }, lantern: { x: 965, row: 'front', dy: 40, inner: true },
  },
  baseR: {
    dog: { x: 2856, row: 'front', inner: true }, clock: { x: 2890, row: 'back', inner: true }, payphone: { x: 3050, row: 'back' },
    lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' }, stakeChain: { x: 2840, row: 'front', inner: true },
    hole: { x: 2886, row: 'front', inner: true },
  },
};
// The girl (DENIZEN_ART §2.4, §3): ground rows only. Cycle 3+ puts her on the ground at e1, s8 and s9 (ground); era V stands her
// in the front band (era5; worldPlacement adds the step offset). Framings without a row place no girl.
// WP26 Q4 moved the cycle 3+ ground girl from 1538 (on the 1530 scrap) to 1552, the largest x the wing rule allows (machine left
// 1576 less wingClearPx 24). Her boots (8 px left of x) clear the scrap's right edge 1538 by 6 px.
// WP27 F6.1 moved the s8 girl from 1552 to 1508, the far-plane mini's slot at the generator pose: she stands between Sensor 7
// (1470) and the Inspector (1536). AD2 F7 moved her to 1504: tripod 4 px, Inspector rest 8 px, crouch 2 art px clear.
// e1 and s9 keep 1552. s8w has no girl (no 24 px slot there).
export const WORLD_GIRL_PLACEMENTS: Partial<Record<FramingKey, { ground?: WorldPlacement; era5?: WorldPlacement }>> = {
  e1: { ground: { x: 1552, row: 'back' } }, s8: { ground: { x: 1504, row: 'back' } }, s9: { ground: { x: 1552, row: 'back' } },
  s11: { ground: { x: 880, row: 'back' }, era5: { x: 976, row: 'front' } },
  s15: { era5: { x: 976, row: 'front', inner: true } }, portrait: { era5: { x: 976, row: 'front', inner: true } },
};
// Layout rules for the cast and the bubbles (DENIZEN_ART §3, §4.2). World px unless the name says game px. Layout, not balance:
// they sit with the placements so worldPlacement.ts and worldBubbleController.ts read one copy of each number.
const FRAMING_POSES: readonly { key: FramingKey; zoom: number; centerX: number }[] = [
  { key: 'e1', zoom: 1, centerX: 1920 }, { key: 's8', zoom: 1, centerX: 2064 }, { key: 's8w', zoom: 1, centerX: 2112 },
  { key: 's9', zoom: 0.75, centerX: 2192 }, { key: 's10', zoom: 0.75, centerX: 2055 }, { key: 's11', zoom: 0.5, centerX: 1922 },
  { key: 's15', zoom: 0.5, centerX: 1920 }, { key: 'portrait', zoom: 0.5, centerX: 1920 }, { key: 'baseL', zoom: 1, centerX: 1320 },
  { key: 'baseR', zoom: 1, centerX: 2520 },
];
export const WORLD_LAYOUT = {
  // Crank hub: the bubble layout reserves a circle around it, and the gain text block sits above it.
  crankHub: { x: 1920, y: 1568 },
  crankClearPx: 24,                 // on top of the crank hit circle (CRANK_FEEDBACK.hitRadius art px at PIXEL_SCALE)
  gainBox: { w: 200, h: 120 },      // gain text block; its bottom-centre sits at the crank + FLOATING_TEXT.spawnOffset
  // Usable wing: starts this far outside the view edge and ends this far short of the machine edge.
  wingClearPx: 24,
  // Inner gap: the 64 px anchor box plus wingClearPx (DENIZEN_ART §3). An inner entry stays this far inside the machine edges.
  innerClearPx: 88,
  // Reference poses of the framing keys: zoom and centre x of the default fitView pose of each stage family.
  framingPoses: FRAMING_POSES,
  // Head reserve: a bubble must not cover another denizen's head. padWorldPx is the pad per side of a head (world px; the inspector
  // is wider). aboveGamePx and heightGamePx place and size the reserved box above the head (game px).
  headReserve: { padWorldPx: { inspector: 36, other: 12 }, aboveGamePx: 4, heightGamePx: 24 },
} as const;
// Prop rows: feet y and depth (DENIZEN_ART §1.4).
export const WORLD_ROWS: Record<WorldRow, { y: number; depth: number }> = {
  back: { y: GROUND_Y, depth: DEPTH.ground + 5 },
  front: { y: GROUND_Y + 32, depth: DEPTH.machine + 3 },
};
// Depth offsets added to the row depth, per layer kind. A walker visiting a row that is not its home row (postgame Inspector in the front row) draws behind the residents but above every shadow.
export const WORLD_DEPTH_OFFSETS = { shadow: -0.01, visitor: -0.005, scraps: -0.2, hole: -0.1, stakeChain: 0, lamp: 0, booth: 0, clock: 0, glow: 0.05, marks: 0.05, receiver: 0.1, cast: 0, crow: 0.2, sensor: 0, motes: 0.3 } as const;
// Far planes. A strip sits at x = tileOriginX + 2 * artX, y = tileTopY + 2 * artY (art px, origin top-left).
export const WORLD_FAR_PLANES = {
  window: { sf: 0.3, depth: DEPTH.background + 21.5, tileOriginX: 768, tileTopY: 428 },
  pylon: { sf: 0.55, depth: DEPTH.background + 32, tileOriginX: 576, tileTopY: 846 },
  girlWindow: { artX: 306, artY: 106 },
  // AD2c (Q6, era II entry): three on the tall tower right of centre (AD2) and three in the upper floors of the big central
  // tower, so the generator pose (s8) shows all six: real skyline cut-outs above the machine top in s8 and s9, clear of the
  // HUD at every UI scale and of the pylon plane. Halos (padArtPx 3) touch but never overlap.
  windows: [
    { artX: 306, artY: 120, w: 4, h: 6 }, { artX: 306, artY: 132, w: 4, h: 6 }, { artX: 318, artY: 146, w: 4, h: 6 },
    { artX: 143, artY: 71, w: 2, h: 4 }, { artX: 131, artY: 99, w: 4, h: 4 }, { artX: 134, artY: 109, w: 1, h: 3 },
  ],
  // footArtXE1 (AD4 F6): the e1 foot (cycle 2+ era I trace), game x 72 at e1: between the first era I scrap (1330, game 50) and Sensor 7
  // (1384, tripod 88-120); s8 / s9 keep footArtX (85 / 171).
  girlMini: { footArtX: 146, footArtY: 157, footArtXE1: 100 },
  // Near pylon foot (era III girl, miniNear): tile instance k = -1, left of the machine edge at the s11 pose (game x 145).
  girlMiniNear: { tileOriginX: 64, footArtX: 146, footArtY: 157 },
  // Screen-x probes (fraction of the view width) that pick a tile instance: skyline and pylon at the e1 pose, near pylon at s11.
  probe: { window: 0.3, pylon: 0.2, pylonNear: 0.12 },
} as const;
// Shadow ellipse widths (height 3), baked once from the one world.shadow entry: people, dog, booth.
export const WORLD_SHADOW_WIDTHS = [14, 18, 26] as const;
// Hidden speaker prefixes for the bubble's live region.
export const WORLD_A11Y_PREFIX: Record<SpeakerId, string> = { inspector: 'Inspector:', dog: 'Dog:', crow: 'Crow:', girl: 'Girl:', payphone: 'Payphone:' };
// Speech bubble geometry in CSS px (before the #ui-root zoom). widthByScale: max width per UI scale percent.
export const WORLD_BUBBLE = {
  tailH: 8, gap: 6, inset: 8, tailMargin: 10, sideOffset: 14, cssMaxWidth: 200, widthByScale: { 100: 200, 125: 250, 150: 300 },
} as const;
// Hard silence reasons (bible §7.4). No bubble starts while one is set; a visible bubble is cut.
export const WORLD_SILENCE = ['quiet', 'layer-hidden', 'asleep', 'tab-hidden', 'photo', 'finale', 'cycle', 'teaser', 'demo-card', 'tech-index', 'modal', 'era-card', 'onboarding'] as const;
export type WorldSilence = (typeof WORLD_SILENCE)[number];

// Sprite sheets (DENIZEN_ART §5.1). Frame names follow the sheet's column order.
export type WorldSheetId = 'inspector' | 'dog' | 'crow' | 'girl' | 'payphone' | 'receiver' | 'sensor7' | 'girlWindow' | 'girlMini'
  | 'lamp' | 'lampGlow' | 'clock' | 'stakeChain' | 'hole' | 'scraps' | 'mote' | 'windowLit'
  | 'puddle' | 'sprout' | 'lantern' | 'redBall' | 'clipboardPages' | 'page' | 'virga';
export const WORLD_FRAMES: Record<WorldSheetId, readonly string[]> = {
  inspector: ['idleA', 'idleB', 'walk0', 'walk1', 'walk2', 'walk3', 'write0', 'write1', 'glance', 'front', 'talk', 'shield', 'pat0', 'pat1', 'wave', 'watch', 'umbrellaOpen', 'frontUmbrella', 'talkUmbrella', 'lookUp', 'crouch', 'umbrellaHalf'],
  dog: ['sit0', 'sit1', 'sniff0', 'sniff1', 'walk0', 'walk1', 'walk2', 'walk3', 'dig0', 'dig1', 'shake0', 'shake1', 'head', 'talk', 'flat', 'lie', 'sleep', 'chase0', 'chase1', 'wag', 'scratch0', 'scratch1', 'lookUp'],
  crow: ['frozen', 'perch0', 'perch1', 'head', 'talk', 'peck0', 'peck1', 'fly0', 'fly1', 'fly2', 'frozenTip', 'ruffle', 'perchTurn', 'perchHead', 'perchTalk'],
  girl: ['stand0', 'stand1', 'palm', 'talk', 'shield', 'run0', 'run1', 'run2', 'run3', 'lanternDrop', 'lanternUp', 'tilt'],
  payphone: ['dark', 'lit', 'ring0', 'ring1', 'fog', 'restored'],
  receiver: ['hang', 'swing0', 'swing1', 'swing2', 'level', 'onHook'],
  sensor7: ['tripod', 'headL', 'headC', 'headR', 'headUp', 'fog', 'glyphDash', 'glyphOne'],
  girlWindow: ['flickerA', 'flickerB', 'dark', 'restored'],
  girlMini: ['warm', 'cold', 'palm'],
  lamp: ['dead', 'lit', 'warm', 'restored'],
  lampGlow: ['cold', 'warm'],
  clock: ['ruin', 'restored'],
  stakeChain: ['chained', 'fallen'],
  hole: ['stage1', 'stage2', 'stage3', 'stage4'],
  scraps: ['scrap0', 'scrap1', 'scrap2'],
  mote: ['ash', 'moth'],
  windowLit: ['lit', 'breathe'],
  // Puddles: index (size - 1) * 3 + look (grey, ring, black), then whole (the restored sky). WORLD_PUDDLE in worldEras.ts.
  puddle: ['size1Grey', 'size1Ring', 'size1Black', 'size2Grey', 'size2Ring', 'size2Black', 'size3Grey', 'size3Ring', 'size3Black', 'whole'],
  sprout: ['stage1', 'stage2', 'stage3', 'stage4', 'bloom'],
  lantern: ['lit', 'fallen'],
  redBall: ['ball'],
  clipboardPages: ['thin', 'medium', 'thick'],
  page: ['flat', 'tilt'],
  virga: ['fall', 'frozen'],
};
// Manifest id per sheet (asset registry keys).
export const WORLD_SHEET_KEYS: Record<WorldSheetId, string> = {
  inspector: 'world.inspector', dog: 'world.dog', crow: 'world.crow', girl: 'world.girl', payphone: 'world.payphone',
  receiver: 'world.receiver', sensor7: 'world.sensor7', girlWindow: 'world.girlWindow', girlMini: 'world.girlMini',
  lamp: 'world.lamp', lampGlow: 'world.lampGlow', clock: 'world.clock', stakeChain: 'world.stakeChain', hole: 'world.hole',
  scraps: 'world.scraps', mote: 'world.mote', windowLit: 'bg.windowLit',
  puddle: 'world.puddle', sprout: 'world.sprout', lantern: 'world.lantern', redBall: 'world.redBall',
  clipboardPages: 'world.clipboardPages', page: 'world.page', virga: 'bg.virga',
};
// Sheet row per era: eras I-V are rows 0-4; whole (restored) is row 5.
export const WORLD_ERA_ROW = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, whole: 5 } as const;
export const WORLD_ERA_ROW_SHEETS: readonly WorldSheetId[] = ['inspector', 'dog', 'crow', 'girl', 'payphone', 'receiver', 'sensor7'];

export type WorldLoopId = 'receiver';
// The receiver swing loop (WorldProps): one entry per frame step (frame, dx in world px, flip).
// The cast plays the WP24 behaviour runners, so the older walk and idle loops were pruned in WP26.
export const WORLD_LOOPS: Record<WorldLoopId, readonly LoopFrame[]> = {
  receiver: [
    { frame: 'hang', dx: 0 }, { frame: 'swing0', dx: 0 }, { frame: 'swing1', dx: 0 }, { frame: 'swing2', dx: 0 }, { frame: 'swing1', dx: 0 }, { frame: 'swing0', dx: 0 },
  ],
};

// Playback per era (bible §3.0, DENIZEN_ART §1.6). fps2 after wornMotor, fps4 after pistonArray, fps8 from era II.
export const WORLD_PLAYBACK = {
  // Era from which playback is steady: fps8 and full cast alpha. Mirrors STEADY_ERA in worldPlayback.ts.
  steadyEra: 2,
  crankTech: 'wornMotor', pistonTech: 'pistonArray',
  fps: { fps2: 2, fps4: 4, fps8: 8 },
  alpha: { crank: 0.75, motor: 0.85, era2: 1 },
  shadowScale: { 1: 0.5, 2: 1 }, shadowAlpha: 0.28,
  seamEras: [1, 2], talkFps: 8,
  trackingRows: [18, 22], trackingShiftArtPx: 2,
  failedSyncOrder: ['dog', 'inspector', 'crow', 'payphone'], failedSyncGapMs: 250, failedSyncFailMs: 200,
} as const;
// Environment and prop tuning (bible §4.1, DENIZEN_ART §5). Art px unless the name says world px.
export const WORLD_ENV = {
  windowAlpha: 1,
  // Fade target of the lit-window group while only the generator is owned (era II entry): a dim group reads as the generator
  // arriving, and powerLines lights it fully. The fade time is windowGlow.fadeMs. AD2c (Q6): 0.5 -> 0.85; at 0.5 the six tiles
  // were muted on the grey towers at 1920x1080 (ladder .5 / .7 / .9).
  windowDimLevel: 0.85,
  windowGlow: { padArtPx: 3, alpha: 0.65, color: 0xd9822b, fadeMs: 1500 },
  windowFlickerMs: [1500, 4000], windowFlickerSeed: 7,
  mainsFlicker: { amp: 0.08, periodMs: 1700 },
  lampHeadArtPx: 49,
  // Lamp glow: a faint halo, not a solid plate (AD2 F4: the old 0.8 read as an orange plate). A lamp ripple or flicker adds
  // bumpAlpha for rippleMs.
  lampGlow: { alpha: 0.4, bumpAlpha: 0.2 },
  motes: { count: 5, orbitRadiusPx: 14, periodMs: 6000, fallArtPx: 24 },
  crowLiftArtPx: 58, crowStutterPx: 4,
  ring: { bursts: 2, burstMs: 400, gapMs: 200, jerkPx: 2 },
  receiverArt: { x: 13, y: -22 },
  // Receiver hung on the booth (script onHook frame): offset from the booth feet, art px (Z11).
  receiverOnHookArt: { x: 13, y: -34 },
  sensor7: { ledArt: { x: 2, y: -23 }, headRangeWorldPx: 200, ledColors: { red: 0xad6236, amber: 0xf0a848, green: PALETTE.green2 }, blinkMs: [2500, 6000], doubleBlinkMs: 150 },
  clock: { faceCenterArt: { x: 0, y: -36 }, hourLenArt: 3, minuteLenArt: 5, hour: 4, minute: 41, color: 0x14110f },
  // Pebbles at the booth foot: spotsWorldPx are world px from the booth origin, just outside its footprint; the first count are drawn.
  pebbles: { count: 2, hopPx: 2, spotsWorldPx: [-36, 36] },
  notice: { sheetTickMs: 250, earFlickMs: 150 },
  rippleMs: 400,
  trackingFrameMs: 125,
} as const;
// Dog hole: stage = motorRetrofit tier - tierOffset, kept in minStage..maxStage (bible §10). loadBeneathEe: digging starts at the DOG-06 log.
export const WORLD_HOLE = { loadBeneathEe: 100000, minStage: 1, maxStage: 4, tierOffset: 1 } as const;
// Tally marks on the booth pane (DENIZEN_ART §5): base 40 + cycle, groups of 5 in 2 columns, 5 rows (capacity 50).
export const WORLD_MARKS = { base: 40, groupSize: 5, groupCols: 2, rows: 5, strokeH: 4, strokePitch: 2, groupPitch: 9, rowGap: 1, slash: [[1, 3], [3, 2], [5, 1]], pane: { x: 6, y: 13, w: 16, h: 24 }, color: 0xa8957a, fogColor: 0xddc9a3 } as const;
// World ripple per tier-up, by era (bible §10). One plays per TECH INDEX release.
export const WORLD_RIPPLES: Record<1 | 2 | 3 | 4 | 5, readonly string[]> = {
  1: ['pebbles', 'receiverStep', 'crowTip'], 2: ['lampBright', 'dogBristle'], 3: ['gust'], 4: ['sway', 'puddleRing'], 5: ['shadowFlick', 'doubleExposure'],
};
// Tier-to-world mappings (bible §10): hole stage, lamp flicker techs, dog line tier.
export const WORLD_TIER_PROPS = { holeTech: 'motorRetrofit', lampFlickerTechs: ['copperWinding', 'transformer'], dogLine: { techId: 'improvedPistons', tier: 3 } } as const;

// Every line text, for the text sweep.
export const WORLD_SWEEP: readonly { where: string; text: string }[] = WORLD_LINES.map((l) => ({ where: 'WORLD_LINES.' + l.id, text: l.text }));
