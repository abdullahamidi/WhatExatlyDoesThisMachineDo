import type { TechId } from './types';
import type { AssetId } from '../assets/assetIds';

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
