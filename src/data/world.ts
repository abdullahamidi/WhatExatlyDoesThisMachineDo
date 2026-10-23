import type { AssetId } from '../assets/assetIds';
import type { TechId } from './types';
import type { MachineComponentId, Vec2 } from './machineComponents';
import { PALETTE, PALETTE_CSS } from './palette';
import type { FinaleTrackId } from './finale';
export const VIEW = { width: 1280, height: 720 } as const;
export const WORLD = { width: 3840, height: 2160 } as const;
export const GROUND_Y = 1680;                                   // world y of the ground/horizon line
export const PIXEL_SCALE = 2;                                   // art px -> world px
export const MACHINE_ANCHOR = { x: 1920, y: GROUND_Y } as const;
export const CAMERA = { focus: { x: 1920, y: GROUND_Y - 160 }, defaultZoom: 1, maxZoom: 2, minZoom: 0.5,
  wheelZoomFactor: 1.1, wheelStepCooldownMs: 80, dragThresholdPx: 4, refocusMs: 450,
  fitMarginPx: 72, autoFrame: true, hudTopInsetPx: 240,
  fullViewGroundBandPx: 160, fullViewTopMinPx: 24 } as const;   // minZoom explicit (below 0.5 one art px is smaller than a screen px); fitMarginPx: world px kept clear around the machine when auto-framing; hudTopInsetPx: screen px under the HUD panel, the machine top is kept below it when auto-framing; fullView*: framing at the min zoom (ART_ERA5 in-game review F2): ground line kept fullViewGroundBandPx above the screen bottom (pre-WP11 eras III-IV framing), machine top >= fullViewTopMinPx, base + fitMarginPx above the bottom edge
/** World x the tiled background patterns are phased to: the pre-WP11 machine anchor, so eras I-IV backgrounds stay pixel-identical. */
export const PATTERN_ORIGIN_X = 1280;
export const DEPTH = { background: -100, ground: 0, machine: 100, dust: 200, floatingText: 300 } as const;
export const PARALLAX_BOTTOM_MARGIN = 200;                      // world px the non-sky layer textures extend below the ground line (hidden behind the ground)
export const PARALLAX_FADE_MS = 1500;                           // ms for a parallax layer to fade in or out when its visibility changes
export interface ParallaxLayerDef { id: string; assetId: AssetId; scrollFactor: number;
  bottomY: number;      // world y where the texture BOTTOM appears when the camera is centred on CAMERA.focus
  depth: number; alpha: number;
  underfill: number | null;   // colour of a rectangle filled below the texture so panning shows no gap
  tint?: number;              // tint: haze colour multiplied into the layer (audit S3 #14)
  visibleWhen?: { techId: TechId; minLevel: number };   // layer shown only when this tech level is reached (default: always)
  finale?: { track: FinaleTrackId; dir: 'in' | 'out' };   // WP13 finale: alpha multiplier from the track value (in = v, out = 1 - v); combines with visibleWhen / alphaStages
  alphaStages?: readonly { techId: TechId; minLevel: number; alpha: number }[] }   // target alpha = stageAlpha() (max alpha over met stages, 0 if none); fades PARALLAX_FADE_MS; never combined with visibleWhen
export const PARALLAX_LAYERS: readonly ParallaxLayerDef[] = [
  { id: 'sky',       assetId: 'bg.sky',       scrollFactor: 0,    bottomY: VIEW.height,                       depth: DEPTH.background,      alpha: 1,    underfill: null },
  { id: 'mountains', assetId: 'bg.mountains', scrollFactor: 0.15, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 10, alpha: 0.45, underfill: PALETTE.industrialGray, finale: { track: 'mountains', dir: 'out' } },
  { id: 'skyline',   assetId: 'bg.skyline',   scrollFactor: 0.3,  bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 20, alpha: 0.4,  underfill: PALETTE.grayDark, finale: { track: 'skyline', dir: 'out' } },
  { id: 'pylons',    assetId: 'bg.pylons',    scrollFactor: 0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 30, alpha: 0.45, underfill: null, tint: 0xb8a98f },
  { id: 'pylonsLit', assetId: 'bg.pylonsLit', scrollFactor: 0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 31, alpha: 0.7, underfill: null, visibleWhen: { techId: 'powerLines', minLevel: 1 } },
  { id: 'skyViolet', assetId: 'bg.skyViolet', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 1, alpha: 1, underfill: null,
    alphaStages: [{ techId: 'nullChamber', minLevel: 1, alpha: 0.25 }, { techId: 'lensArray', minLevel: 1, alpha: 0.5 }, { techId: 'horizonField', minLevel: 5, alpha: 0.75 }, { techId: 'skyAperture', minLevel: 1, alpha: 1 }],
    finale: { track: 'sky', dir: 'out' } },
  { id: 'horizonGlow', assetId: 'bg.horizonGlow', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 3, alpha: 1, underfill: null,
    alphaStages: [{ techId: 'horizonField', minLevel: 1, alpha: 0.35 }, { techId: 'horizonField', minLevel: 10, alpha: 0.55 }, { techId: 'horizonField', minLevel: 20, alpha: 0.75 }],
    finale: { track: 'glow', dir: 'out' } },
  // WP13 restored world: twins of sky / mountains / skyline (same scrollFactor, bottomY and art size), faded in by the finale track.
  { id: 'skyRestored', assetId: 'bg.skyRestored', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 4, alpha: 1, underfill: null,
    finale: { track: 'sky', dir: 'in' } },
  { id: 'mountainsRestored', assetId: 'bg.mountainsRestored', scrollFactor: 0.15, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 11, alpha: 0.45, underfill: PALETTE.green0,
    finale: { track: 'mountains', dir: 'in' } },
  { id: 'skylineRestored', assetId: 'bg.skylineRestored', scrollFactor: 0.3, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 21, alpha: 0.4, underfill: PALETTE.green1 /* far fields, = ground rows of bg.skylineRestored */,
    finale: { track: 'skyline', dir: 'in' } },
];
/** Era V eclipse sprite in the sky (sky px, origin centre): frame 0 = the baked sun, hidden; stages step the frame up as techs arrive; diamond = the one-off flash frame. */
export const ECLIPSE = { assetId: 'bg.eclipse', skyPx: { x: 372, y: 290 }, depth: DEPTH.background + 2,
  stages: [{ techId: 'nullChamber', minLevel: 1, frame: 1 }, { techId: 'lensArray', minLevel: 1, frame: 2 }, { techId: 'horizonField', minLevel: 5, frame: 3 }, { techId: 'skyAperture', minLevel: 1, frame: 5 }],
  diamond: { techId: 'skyAperture', frame: 4, ms: 1200 } } as const;
/** Era V aperture beam: a world-space light shaft from the aperture part up to the sky (tile 32 world px wide). `component` is the MachineComponentId 'aperture' as a plain literal. */
export const APERTURE_BEAM = { assetId: 'fx.beam', component: 'aperture', minLatchFrame: 3, artX: 64, footArtY: -588, fps: 8, alpha: 0.85, depth: DEPTH.machine + 1 } as const;
/** Art px of the pylon wires inside bg.pylonsLit (origin top-left): attachment points under the insulator strings, plus sag and line style. */
export const PYLON_LINE = {
  anchorsArt: [{ x: 159.5, y: 59 }, { x: 223.5, y: 59 }, { x: 148.5, y: 90 }, { x: 234.5, y: 90 }],
  sagFraction: 0.06, thicknessPx: 2, depthOffset: 1,
} as const;
/** A world-space cable feed from a machine part to the pylon line (CR-A). side 'left' = only anchors left of the part; 'any' = right of it (the mast). */
export interface PylonFeed { id: string; component: MachineComponentId; point: string; side: 'any' | 'left'; gate?: { techId: TechId; minLevel: number };
  leadTo?: Vec2 }   // leadTo: machine-local art px; a 1 px cable runs from point up to leadTo and the catenary starts there
export const PYLON_FEEDS: readonly PylonFeed[] = [
  { id: 'mast', component: 'cableMast', point: 'top', side: 'any' },
  { id: 'turbine', component: 'turbine', point: 'export', side: 'left', gate: { techId: 'turbine', minLevel: 1 }, leadTo: { x: -374, y: -94 } },
];
export const GROUND_LAYER = { assetId: 'terrain.ground', depth: DEPTH.ground } as const;   // scrollFactor 1, spans GROUND_Y..WORLD.height
export const GROUND_SHADE: { color: number; alpha: number; bandStarts: readonly number[];
  haze: { color: number; alpha: number; height: number } } =
  { color: PALETTE.ink, alpha: 0.07, bandStarts: [64, 128, 192],
    haze: { color: PALETTE.skyHaze, alpha: 0.3, height: 18 } };   // world px below GROUND_Y; haze under the horizon strip, bands are hard steps
export const HORIZON_STRIP = { height: 6, color: PALETTE.rustDark, alpha: 0.6 } as const;  // thin darker strip at GROUND_Y
export const DUST: { maxParticles: number; frequencyMs: number; lifespanMs: [number, number]; speedX: [number, number];
  speedY: [number, number]; alpha: [number, number]; scale: [number, number]; depth: number; spawnTopY: number; spawnBottomY: number;
  spawnHalfWidth: number } =
  { maxParticles: 90 /* 60 x 1.5 with the 1.5x wider spawn band (WP11 review): same density */, frequencyMs: 250, lifespanMs: [6000, 11000], speedX: [10, 30], speedY: [-4, 4],
    alpha: [0, 0.35] /* [end, start] fade */, scale: [1, 2.5], depth: DEPTH.dust,
    spawnTopY: GROUND_Y - 520, spawnBottomY: GROUND_Y - 20,
    spawnHalfWidth: WORLD.width / 2 /* dust spawns across the whole world: MACHINE_ANCHOR.x +- spawnHalfWidth */ };
/** Rising dust once the spire stands (Era IV): mote speedY [-18, -6] world px/s, spawn top GROUND_Y - 900. */
export const DUST_RISING: { techId: TechId; minLevel: number; speedY: [number, number]; spawnTopY: number } =
  { techId: 'resonatorSpire', minLevel: 1, speedY: [-18, -6], spawnTopY: GROUND_Y - 900 };
export const CRANK_FEEDBACK = { degreesPerClick: 90, tweenMs: 160, shakePx: 1 /* art px */, shakeMs: 60,
  floatRisePx: 40, floatMs: 1100, hitRadius: 36 /* art px, crank click area */ } as const;
export const FLOATING_TEXT = { fontSizePx: 24, minScreenPx: 16, strokePx: 4, jitterX: 6, spawnOffset: { x: 116, y: -128 },
  spawnOffsetSpire: { x: 316, y: -138 }, spireComponent: 'spireTower', maxLines: 5,
  lineGapPx: 2, coalesceMs: 300, blockMaxMs: 900, blockPoolSize: 6, charWidthEm: 0.62, color: '#ffd27a',
  colors: { me: '#ffd27a', ee: PALETTE_CSS.cyanLight, pr: PALETTE_CSS.steam, rs: PALETTE_CSS.verdigrisLight, xf: PALETTE_CSS.violetPale } } as const;   // world px (WP17 crank gain block: minScreenPx is the font floor in screen px; spawnOffset is the block bottom-centre from the crank)
/** Poll path of the HUD rebuild (WorldScene): at most one rebuild per HUD_REFRESH_MS. Session events rebuild at once. */
export const HUD_REFRESH_MS = 100;
export const CRANK_PULSE = { color: 0xffd27a, radiusArtPx: 20, strokeArtPx: 2, alphaPeak: 0.6, periodMs: 1200 } as const;   // first-click ring on the crank (art px)
