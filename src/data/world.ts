import type { AssetId } from '../assets/assetIds';
import type { TechId } from './types';
import { PALETTE } from './palette';
export const VIEW = { width: 1280, height: 720 } as const;
export const WORLD = { width: 2560, height: 1440 } as const;
export const GROUND_Y = 1120;                                   // world y of the ground/horizon line
export const PIXEL_SCALE = 2;                                   // art px -> world px
export const MACHINE_ANCHOR = { x: 1280, y: GROUND_Y } as const;
export const CAMERA = { focus: { x: 1280, y: GROUND_Y - 160 }, defaultZoom: 1, maxZoom: 2,
  wheelZoomFactor: 1.1, wheelStepCooldownMs: 80, dragThresholdPx: 4, refocusMs: 450,
  fitMarginPx: 72, autoFrame: true } as const;   // minZoom is derived: minZoomToFit(VIEW, WORLD) === 0.5; fitMarginPx: world px kept clear around the machine when auto-framing
export const DEPTH = { background: -100, ground: 0, machine: 100, dust: 200, floatingText: 300 } as const;
export const PARALLAX_BOTTOM_MARGIN = 200;                      // world px the non-sky layer textures extend below the ground line (hidden behind the ground)
export const PARALLAX_FADE_MS = 1500;                           // ms for a parallax layer to fade in or out when its visibility changes
export interface ParallaxLayerDef { id: string; assetId: AssetId; scrollFactor: number;
  bottomY: number;      // world y where the texture BOTTOM appears when the camera is centred on CAMERA.focus
  depth: number; alpha: number;
  underfill: number | null;   // colour of a rectangle filled below the texture so panning shows no gap
  tint?: number;              // tint: haze colour multiplied into the layer (audit S3 #14)
  visibleWhen?: { techId: TechId; minLevel: number } }   // layer shown only when this tech level is reached (default: always)
export const PARALLAX_LAYERS: readonly ParallaxLayerDef[] = [
  { id: 'sky',       assetId: 'bg.sky',       scrollFactor: 0,    bottomY: VIEW.height,                       depth: DEPTH.background,      alpha: 1,    underfill: null },
  { id: 'mountains', assetId: 'bg.mountains', scrollFactor: 0.15, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 10, alpha: 0.45, underfill: PALETTE.industrialGray },
  { id: 'skyline',   assetId: 'bg.skyline',   scrollFactor: 0.3,  bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 20, alpha: 0.4,  underfill: PALETTE.grayDark },
  { id: 'pylons',    assetId: 'bg.pylons',    scrollFactor: 0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 30, alpha: 0.45, underfill: null, tint: 0xb8a98f },
  { id: 'pylonsLit', assetId: 'bg.pylonsLit', scrollFactor: 0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 31, alpha: 0.7, underfill: null, visibleWhen: { techId: 'powerLines', minLevel: 1 } },
];
/** Art px of the pylon wires inside bg.pylonsLit (origin top-left): attachment points under the insulator strings, plus sag and line style. */
export const PYLON_LINE = {
  anchorsArt: [{ x: 159.5, y: 59 }, { x: 223.5, y: 59 }, { x: 148.5, y: 90 }, { x: 234.5, y: 90 }],
  sagFraction: 0.06, thicknessPx: 2, depthOffset: 1,
} as const;
export const GROUND_LAYER = { assetId: 'terrain.ground', depth: DEPTH.ground } as const;   // scrollFactor 1, spans GROUND_Y..WORLD.height
export const GROUND_SHADE: { color: number; alpha: number; bandStarts: readonly number[];
  haze: { color: number; alpha: number; height: number } } =
  { color: PALETTE.ink, alpha: 0.07, bandStarts: [64, 128, 192],
    haze: { color: PALETTE.skyHaze, alpha: 0.3, height: 18 } };   // world px below GROUND_Y; haze under the horizon strip, bands are hard steps
export const HORIZON_STRIP = { height: 6, color: PALETTE.rustDark, alpha: 0.6 } as const;  // thin darker strip at GROUND_Y
export const DUST: { maxParticles: number; frequencyMs: number; lifespanMs: [number, number]; speedX: [number, number];
  speedY: [number, number]; alpha: [number, number]; scale: [number, number]; depth: number; spawnTopY: number; spawnBottomY: number } =
  { maxParticles: 60, frequencyMs: 250, lifespanMs: [6000, 11000], speedX: [10, 30], speedY: [-4, 4],
    alpha: [0, 0.35] /* [end, start] fade */, scale: [1, 2.5], depth: DEPTH.dust,
    spawnTopY: GROUND_Y - 520, spawnBottomY: GROUND_Y - 20 };
export const CRANK_FEEDBACK = { degreesPerClick: 90, tweenMs: 160, shakePx: 1 /* art px */, shakeMs: 60,
  floatRisePx: 40, floatMs: 1100, floatPoolSize: 24, hitRadius: 36 /* art px, crank click area */ } as const;
export const FLOATING_TEXT = { fontSizePx: 24, strokePx: 4, jitterX: 14, spawnOffsetY: -56, color: '#ffd27a' } as const;   // world px
export const CRANK_PULSE = { color: 0xffd27a, radiusArtPx: 20, strokeArtPx: 2, alphaPeak: 0.6, periodMs: 1200 } as const;   // first-click ring on the crank (art px)
