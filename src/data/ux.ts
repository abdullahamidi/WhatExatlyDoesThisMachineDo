import type { TechId } from './types';
import type { AssetId } from '../assets/assetIds';
import type { MachineComponentId } from './machineComponents';
import type { EraNumber } from './eras';

// WP20 first-impression UX tuning. Pure data: every number the onboarding, guidance, era-card, toast,
// camera-nudge, fly-in and click-juice code reads lives here. Keys and values are a contract for those files.

// First-run crank prompt and its blinking cursor, drawn over the crank hub until the first click.
export const ONBOARDING = {
  crankPrompt: '> TURN THE CRANK [CLICK / SPACE]', cursor: '_', blinkMs: 530,
  promptOffset: { x: 0, y: -150 },   // world px from the crank hub to the text bottom-centre (sky above the era I frame at zoom 1)
  fontPx: 20, strokePx: 4, color: '#ffd27a', strokeColor: '#14110f',
  techHint: '> SCHEMATIC AVAILABLE — OPEN TECH INDEX [T]',
} as const;
// Next-goal guidance: the ordered milestone chain the HUD points at, ending at the final tech.
export const NEXT_GOAL = {
  sequence: ['generatorBlueprint', 'generator', 'substationBlueprint', 'boiler', 'pressureVesselBlueprint',
    'resonatorSpire', 'harmonicConvergence', 'nullChamber', 'finalAlignment', 'primaryFunction'] as readonly TechId[],
  refreshMs: 250, prefix: 'NEXT: ', needs: 'NEEDS ', ready: 'READY — OPEN TECH INDEX [T]', lifetime: 'LIFETIME', etaPrefix: '~', sep: ' · ',
} as const;
// Tech Index badge: the count cap, the overflow text past it, and the label and aria suffix.
export const AFFORDABLE_BADGE = { max: 99, overflow: '99+', label: 'TECH INDEX', ariaSuffix: 'affordable' } as const;
// Era-unlock card: time on screen, fade in and out, and the signal prefix.
export const ERA_CARD = { showMs: 2400, fadeInMs: 250, fadeOutMs: 350, signalPrefix: 'NEW SIGNAL: ' } as const;
// Assembly queue fly-in: stagger between cards, capped so a full queue lands within about a second.
export const ASSEMBLY_QUEUE = { staggerMs: 120, maxStaggerSteps: 8 } as const;
// Camera nudge toward a new target: inner dead zone and pan fraction, capped in world px.
export const CAMERA_NUDGE = { innerFraction: 0.5, fraction: 0.35, maxWorldPx: 160 } as const;
// Toast burst: the joining window in ms and the arrow glyph used by the burst line.
export const TOAST_BURST = { windowMs: 1500, arrow: '→' } as const;
// Click-juice sparks thrown off the crank on each click; maxAlive caps the live pool.
export const CRANK_SPARKS = { texture: 'fx.dust' as AssetId, count: 4, speed: { min: 60, max: 150 }, angle: { min: 200, max: 340 },
  lifespanMs: 260, scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 }, gravityY: 320, tint: 0xffd27a, maxAlive: 32 } as const;
// HUD counter bump on gain: peak scale and time to settle back.
export const HUD_BUMP = { scale: 1.08, durationMs: 120 } as const;
// WP25 machine output popups (OutputTicker): one line of the frontier gain every periodMs from the first click on, full alpha for holdMs, then a linear fade to 0 at fadeMs. World px unless noted. offset is per era, from the anchor's resolved position (wornMotor / generator: centre; boiler / spireTower / nullChamber: base); the Art Director tunes these numbers (AD1 F1; round 2 F3: era III sits right of the HUD panel at UI 150, between it and the piston rack).
export const OUTPUT_TICK = { periodMs: 3000, fadeMs: 2400, holdMs: 1000, riseWorldPx: 36, alpha: 0.9, fontScale: 1, poolSize: 3,
  anchor: { 1: 'wornMotor', 2: 'generator', 3: 'boiler', 4: 'spireTower', 5: 'nullChamber' } satisfies Record<EraNumber, MachineComponentId>,
  offset: { 1: { x: 0, y: -32 }, 2: { x: 0, y: -90 }, 3: { x: 190, y: -216 }, 4: { x: 190, y: -160 }, 5: { x: 240, y: -116 } } satisfies Record<EraNumber, { x: number; y: number }> } as const;
// WP28 TECH INDEX: the SPLICES tab (label, row states, the affordable count suffix) and the BUY MAX control.
export const SPLICE_TAB = { label: 'SPLICES', dark: 'DARK', inReach: 'IN REACH', spliced: 'SPLICED', fullGame: 'FULL GAME', affordableSuffix: 'affordable' } as const;
export const BUY_MAX = { label: 'BUY MAX' } as const;
// WP28 NEXT BUY: the HUD line under the goal, `prefix` + tech name + `sep` + `etaPrefix` + the rounded ETA (formatDuration).
export const NEXT_BUY = { prefix: 'NEXT BUY: ', sep: ' · ', etaPrefix: '~' } as const;
// The machine's words (plain, US spelling, no '!' and no '...'). Placeholders: {n}, {res}, {have}, {need}, {name}.
export const SPLICE_TEXT = {
  title: 'SPLICE · ',
  click: 'CLICK TO SPLICE',
  need: 'NEED {n} MORE {res}',
  locked: 'LINE NOT IN REACH · {have} / {need} LIFETIME {res}',
  needsTech: 'LINE NOT IN REACH · {name} FIRST',
  fullGame: 'FULL GAME',
  spliced: 'SPLICED',
} as const;
