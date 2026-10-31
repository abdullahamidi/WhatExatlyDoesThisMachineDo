import Phaser from 'phaser';
import type { FramingKey } from '../../data/livingWorld';
import { WORLD_ENV, WORLD_PLACEMENTS } from '../../data/livingWorld';
import type { EraNumber } from '../../data/eras';
import type { Vec2 } from '../../data/machineComponents';
import { STEAM_EMITTERS, STEAM_FX } from '../../data/steamFx';
import { TECHNOLOGIES } from '../../data/technologies';
import type { ProductionRates, TechId } from '../../data/types';
import { DEPTH, GROUND_Y, PARALLAX_LAYERS, PIXEL_SCALE, PYLON_LINE } from '../../data/world';
import { REACH_FX } from '../../data/worldReach';
import { REACH_LEVEL, SPLICE_REACH } from '../../data/worldShared';
import type { GameSession } from '../../simulation';
import { currentEra, eraResource } from '../../simulation/progression/era';
import { isSplice } from '../../simulation/progression/status';
import type { GameFeedback } from '../context';
import type { SpliceDebugRow, WorldDebugApi } from './LivingWorldDirector';
import { TimingWindow } from '../math/findMarker';
import { reachLevel } from '../math/reachLevel';
import { boundsToWorld, visibleMachineBounds } from '../math/machineBounds';
import { machineLocalToWorld } from '../math/machineLayout';
import {
  FLASH_GAP_MS, PULSE_GAP_MS, arcRatePerS, debrisBobPx, debrisMoves, debrisRiseArt, driftRatePerS, dustFrequencyMs, fxEnabled,
  groundWaveX, pylonDotCount, pylonDotPositions, spawnDue, throttleOk,
} from '../math/worldReach';

// WP28b (D6): the machine's reach effects, drawn in the WorldReach chunk. The rules (schedules, rates, gates, depth of the dots) are in
// math/worldReach.ts and every number is in data/worldReach.ts. Six top-level objects, all made here: the ground Graphics (crank pulses
// and the waves), the base dust, the pylon dots, the arcs, the debris, and one container for the drift puffs (a pool of five images).
// Nothing is created after the constructor. The Graphics redraw at the Splice pulses' cadence (15 Hz) and only while something on them
// changes; the puffs move every frame (five images). Everything is off unless no ending runs; photo mode freezes the FX (the last frame
// stays). Pooled state only: an update allocates nothing.

/** Top-level display objects of the reach FX (the six above). WorldReach counts them in its objects. */
export const FX_OBJECTS = 6;
/** A frame step is clamped to this (ms): a hidden tab or a stall moves the effects no further. A robustness clamp, not tuning. */
const MAX_STEP_MS = 100;
/** Window of update() wall times kept for stats().meanMs (the Find marker's and the poke layer's probe window). */
const TIMING_SAMPLES = 120;
/** Graphics redraw cadence: the Splice pulse layer's (SPLICE_REACH.redrawHz, a copy of SPLICE_FX.redrawHz). A redraw clears and draws the layer, so it is capped. */
const REDRAW_MS = 1000 / SPLICE_REACH.redrawHz;
/** A base-dust hop goes up and back inside one roll gap (maxHopsPerS), so a speck hops at most maxHopsPerS a second. */
const HOP_MS = 1000 / (2 * REACH_FX.baseDust.maxHopsPerS);
const HOP_CHECK_MS = 1000 / REACH_FX.baseDust.maxHopsPerS;
/** Crank pulse slots: PULSE_GAP_MS apart and lifeMs long, so two can be alive at once. */
const PULSE_SLOTS = 2;
/** Wave slots: a wave lives until both fronts pass the view, and waves start at least minGapMs apart, so three can overlap. */
const WAVE_SLOTS = 3;
/** Arc slots: an arc lives lifeMs (90 ms) and the rate is at most arc.rate.max a second, so a few suffice. */
const ARC_SLOTS = 4;
/** Site buffer for the arc picks: the four fixed sites (lamp head, booth hood, two pylon ends) and one foot per woken Splice (16 at most). */
const SITE_CAP = 24;
/** Debris slots: the most specks a run holds (debris.specks[1]). */
const DEBRIS_SLOTS = REACH_FX.debris.specks[1];
/** A debris speck is 2 x 2 art px: a body, with its top row the violet rim (REACH_FX.debris.rim). A sprite size, not tuning. */
const SPECK_ART_PX = 2;
/** The dust frequency is sent only when it moved by at least this (ms). */
const DUST_STEP_MS = 1;
/** Pylon dots sit on the cable's own layer, one step above the lit pylons (the depth rule in data/worldReach.ts). */
const PYLON_DEPTH = (PARALLAX_LAYERS.find((layer) => layer.id === 'pylonsLit')?.depth ?? DEPTH.background)
  + PYLON_LINE.depthOffset + REACH_FX.pylonPulse.depthOffset;

/** The deps the reach FX reads. WorldReach supplies them; the ports are read per use (a lazy director may come later). */
export interface ReachFxDeps {
  session: GameSession;
  feedback: Pick<GameFeedback, 'partEvolved'>;
  director: () => Pick<WorldDebugApi, 'framingKey' | 'spliceStats'> | null;
  photo: () => boolean;
  reducedMotion: () => boolean;
  /** WP28b [R1]: the polyline of the lit cable of feed (0 or 1) into out, world px; returns its point count (0 while unlit). */
  pylonPoints?: (feed: number, out: Vec2[]) => number;
  /** WP28b [R1]: DustField.setFrequencyMs. null restores the field's own frequency. */
  setDustFrequency?: (ms: number | null) => void;
}

/** The FX counters and mean update cost (the debug probe's reachStats; WorldReach adds meanMs to its own). */
export interface ReachFxStats { objects: number; meanMs: number; parts: Record<string, number> }

/** A redraw schedule: dirty when the layer has something to show or to clear; lastMs is the FX clock of its last redraw. */
interface Cadence { dirty: boolean; lastMs: number }

/** One steam puff of the drift pool: its image and its motion (world px; base is the spawn point, speed per second). */
interface Puff {
  readonly image: Phaser.GameObjects.Image;
  live: boolean;
  ageMs: number;
  lifeMs: number;
  base: Vec2;
  speedPx: number;
  risePx: number;
  frame: number;
}

/** One debris speck: its x (world px), the art px it rises to, its rise time and its bob phase. */
interface Speck { live: boolean; startMs: number; x: number; targetArt: number; riseMs: number; phase: number }

/** One arc: its site (world px), its length in art px and its zig-zag sign. */
interface Arc { live: boolean; startMs: number; x: number; y: number; lenArt: number; sign: number }

// The first free slot of a list of start times (NaN marks a free slot), or -1.
function freeSlot(starts: readonly number[]): number {
  for (let i = 0; i < starts.length; i++) if (Number.isNaN(starts[i] ?? Number.NaN)) return i;
  return -1;
}

// a + (b - a) x t.
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// A unit draw in [0, 1) from a spawn counter and a salt (a 32-bit integer hash): the same counter and salt give the same pick, so an arc
// site or a puff's drift is repeatable. Used for the picks the plan names "by hash"; the Poisson spawns keep their own uniform draw.
function hash01(counter: number, salt: number): number {
  let h = Math.imul((counter | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt | 0) + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// Destroys a display object unless Phaser already did (a scene teardown unsets the object's scene).
function destroyUnlessGone(o: Phaser.GameObjects.GameObject): void {
  if (o.scene) o.destroy();
}

/**
 * The machine's reach FX of one World scene. update() steps the FX clock, the spawns and the motion, and redraws the layers that
 * changed (at the cadence). The gates and the rules are read on every frame; the session's objects are read again only when they change.
 */
export class ReachFx {
  private readonly scene: Phaser.Scene;
  private readonly deps: ReachFxDeps;
  private readonly groundLayer: Phaser.GameObjects.Graphics;
  private readonly baseLayer: Phaser.GameObjects.Graphics;
  private readonly pylonLayer: Phaser.GameObjects.Graphics;
  private readonly arcLayer: Phaser.GameObjects.Graphics;
  private readonly debrisLayer: Phaser.GameObjects.Graphics;
  private readonly drift: Phaser.GameObjects.Container;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly timings = new TimingWindow(TIMING_SAMPLES);
  /** The FX clock (ms): steps by the clamped delta, holds while photo mode freezes the FX. */
  private nowMs = 0;
  /** True while the FX is off (an ending runs): everything is hidden and nothing spawns. */
  private off = false;
  /** The reduced-motion setting as of the last frame (a change clears every live effect). */
  private reduced = false;
  /** Clicks and big buys are queued by the session events and taken on the next frame. */
  private pendingClick = false;
  private pendingWave = false;
  // The caches: the tech levels (the era and the machine edges) and the rates (the energy level) are read again only when they change.
  private levelsRef: Readonly<Record<TechId, number>> | null = null;
  private ratesRef: Readonly<ProductionRates> | null = null;
  private era: EraNumber = 1;
  /** The machine's base edges in world px. */
  private left = 0;
  private right = 0;
  /** The era's energy level L (0..1), its per-second rate, and the EE and PR rates (arcs and drift). */
  private level = 0;
  private energyRate = 0;
  private rateEe = 0;
  private ratePr = 0;
  // Ground: pulse and wave slots (their start times on the FX clock; NaN is free) and the start of the last of each kind.
  private readonly pulseAt: number[] = Array.from({ length: PULSE_SLOTS }, () => Number.NaN);
  private readonly waveAt: number[] = Array.from({ length: WAVE_SLOTS }, () => Number.NaN);
  private lastPulseMs = Number.NEGATIVE_INFINITY;
  private lastWaveMs = Number.NEGATIVE_INFINITY;
  private readonly groundCad: Cadence = { dirty: true, lastMs: Number.NEGATIVE_INFINITY };
  // Base dust: per speck its hop start (NaN while resting), its hop height in art px, its next roll, and its x on the base line.
  private readonly hopStart: number[] = Array.from({ length: REACH_FX.baseDust.specks }, () => Number.NaN);
  private readonly hopArt: number[] = Array.from({ length: REACH_FX.baseDust.specks }, () => 0);
  private readonly nextRoll: number[] = Array.from({ length: REACH_FX.baseDust.specks }, () => Number.NEGATIVE_INFINITY);
  private readonly baseX: number[] = Array.from({ length: REACH_FX.baseDust.specks }, () => 0);
  private moteCursor = 0;
  private readonly baseCad: Cadence = { dirty: true, lastMs: Number.NEGATIVE_INFINITY };
  private hoppingNow = 0;
  // Dust law: the frequency last sent (NaN unknown), whether null was sent, and the last check.
  private dustMs = Number.NaN;
  private dustNulled = false;
  private dustCheckMs = Number.NEGATIVE_INFINITY;
  // Pylons: one point buffer per feed (its length is the feed's point count), one dot buffer per feed, and the dot count of the last redraw.
  private readonly cable: Vec2[][] = Array.from({ length: REACH_FX.pylonPulse.feeds }, (): Vec2[] => []);
  private readonly cableLen: number[] = Array.from({ length: REACH_FX.pylonPulse.feeds }, () => 0);
  private readonly dots: Vec2[][] = Array.from({ length: REACH_FX.pylonPulse.feeds }, (): Vec2[] => []);
  private readonly pylonCad: Cadence = { dirty: true, lastMs: Number.NEGATIVE_INFINITY };
  private dotsDrawn = 0;
  // Arcs: the site buffer (filled per spawn), the slots, and the start of the last arc.
  private readonly sites: Vec2[] = Array.from({ length: SITE_CAP }, (): Vec2 => ({ x: 0, y: 0 }));
  private readonly spliceRows: SpliceDebugRow[] = [];
  private readonly arcSlots: Arc[] = Array.from({ length: ARC_SLOTS }, (): Arc => ({ live: false, startMs: 0, x: 0, y: 0, lenArt: 0, sign: 1 }));
  private readonly arcCad: Cadence = { dirty: true, lastMs: Number.NEGATIVE_INFINITY };
  private lastArcMs = Number.NEGATIVE_INFINITY;
  // Drift: the pool (built in the constructor), the emitter points in world px, and the live count.
  private readonly puffs: Puff[] = [];
  private readonly sources: Vec2[] = [];
  private puffsAlive = 0;
  // Debris: the speck slots, the target count of this run (-1 until era V), the next spawn, and the live count.
  private readonly specks: Speck[] = Array.from({ length: DEBRIS_SLOTS }, (): Speck => ({ live: false, startMs: 0, x: 0, targetArt: 0, riseMs: 0, phase: 0 }));
  private readonly debrisCad: Cadence = { dirty: true, lastMs: Number.NEGATIVE_INFINITY };
  private debrisTarget = -1;
  private debrisNextMs = 0;
  private specksAlive = 0;
  // Counters for the probe: pulses, waves and arcs started since create.
  private pulsesStarted = 0;
  private wavesStarted = 0;
  private arcsStarted = 0;
  /** Puffs started since create: the counter the drift picks hash on. */
  private puffSpawns = 0;

  constructor(scene: Phaser.Scene, deps: ReachFxDeps) {
    this.scene = scene;
    this.deps = deps;
    this.groundLayer = scene.add.graphics().setDepth(DEPTH.ground + REACH_FX.groundPulse.depthOffset);
    this.baseLayer = scene.add.graphics().setDepth(DEPTH.machine + REACH_FX.baseDust.depthOffset);
    this.pylonLayer = scene.add.graphics().setDepth(PYLON_DEPTH);
    // Arcs and debris sit above the machine's props and under the dust (the arc and debris depthOffset in data/worldReach.ts).
    this.arcLayer = scene.add.graphics().setDepth(DEPTH.machine + REACH_FX.arc.depthOffset);
    this.debrisLayer = scene.add.graphics().setDepth(DEPTH.machine + REACH_FX.debris.depthOffset);
    this.drift = scene.add.container(0, 0).setDepth(DEPTH.ground + REACH_FX.drift.depthOffset);
    for (let i = 0; i < REACH_FX.drift.maxAlive; i++) {
      const image = scene.add.image(0, 0, 'fx.steamPuff', 0).setVisible(false);
      this.drift.add(image);
      this.puffs.push({ image, live: false, ageMs: 0, lifeMs: 0, base: { x: 0, y: 0 }, speedPx: 0, risePx: 0, frame: -1 });
    }
    // The drift spawn points: the chimney and the relief valves, in world px (machineLocalToWorld, the machine's own placement).
    for (const id of REACH_FX.drift.emitters) {
      const emitter = STEAM_EMITTERS.find((e) => e.id === id);
      for (const at of emitter?.at ?? []) this.sources.push(machineLocalToWorld(at));
    }
    const session = deps.session;
    this.unsubscribers.push(
      session.on('click', () => { this.pendingClick = true; }),
      session.on('unlock', () => { this.pendingWave = true; }),
      session.on('purchase', (e) => { if (isSplice(TECHNOLOGIES[e.id])) this.pendingWave = true; }),
      deps.feedback.partEvolved.on(() => { this.pendingWave = true; }),
      session.on('reset', () => this.clearLive()),
      session.on('cycle', () => this.clearLive()),
    );
  }

  /** Per frame: the FX step, timed for the probe. A bad delta (NaN, negative, a hidden tab) counts as no time. */
  update(deltaMs: number): void {
    const t0 = performance.now();
    this.step(deltaMs);
    this.timings.record(performance.now() - t0);
  }

  /** Unsubscribes and destroys the six objects (the container takes its images with it). */
  destroy(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
    destroyUnlessGone(this.groundLayer);
    destroyUnlessGone(this.baseLayer);
    destroyUnlessGone(this.pylonLayer);
    destroyUnlessGone(this.arcLayer);
    destroyUnlessGone(this.debrisLayer);
    destroyUnlessGone(this.drift);
  }

  /** The counters, the mean update cost and the parts (the probe's reachStats). debrisMoving is 0 under reduced motion. */
  stats(): ReachFxStats {
    return {
      objects: FX_OBJECTS,
      meanMs: this.timings.mean(),
      parts: {
        groundPulse: this.pulsesStarted,
        groundWave: this.wavesStarted,
        baseDust: this.hoppingNow,
        pylonPulse: this.dotsDrawn,
        arc: this.arcsStarted,
        drift: this.puffsAlive,
        debris: this.specksAlive,
        debrisMoving: this.reduced ? 0 : this.specksAlive,
      },
    };
  }

  // One frame. The ending hides everything for good; photo mode freezes it; otherwise the FX clock steps and every part runs.
  private step(deltaMs: number): void {
    if (this.deps.session.state.ending.phase !== 'none') {
      if (!this.off) this.hideAll();
      this.setDust(null);
      return;
    }
    if (this.off) {
      this.setVisibleAll(true);
      this.off = false;
    }
    if (this.deps.photo()) {
      this.pendingClick = false;
      this.pendingWave = false;
      this.setDust(null);
      return;
    }
    const reduced = this.deps.reducedMotion();
    if (reduced !== this.reduced) {
      this.reduced = reduced;
      this.clearLive();
    }
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, MAX_STEP_MS) : 0;
    this.nowMs += dt;
    this.refresh();
    this.readCable();
    this.updateDust();
    this.stepGround();
    this.stepBaseDust();
    this.stepPylons();
    this.stepArcs(dt);
    this.stepDrift(dt);
    this.stepDebris();
  }

  // Reads the session's objects again only when they changed: the era and the machine's edges (techLevels), the energy level (rates).
  private refresh(): void {
    const session = this.deps.session;
    const levels = session.state.techLevels;
    const rates = session.rates;
    const levelsChanged = levels !== this.levelsRef;
    if (levelsChanged) {
      this.levelsRef = levels;
      this.era = currentEra(levels);
      const edges = boundsToWorld(visibleMachineBounds(levels));
      this.left = edges.left;
      this.right = edges.right;
      const n = this.baseX.length;
      for (let i = 0; i < n; i++) this.baseX[i] = this.left + ((this.right - this.left) * (i + 0.5)) / n;
      this.baseCad.dirty = true;
    }
    if (!levelsChanged && rates === this.ratesRef) return;
    this.ratesRef = rates;
    const res = eraResource(this.era);
    this.energyRate = rates.perSecond[res];
    this.level = reachLevel(this.energyRate, REACH_LEVEL.lo[res], REACH_LEVEL.hi[res]);
    this.rateEe = rates.perSecond.ee;
    this.ratePr = rates.perSecond.pr;
  }

  // The lit cable's points for both feeds (none while reduced motion hides the pylon dots). Each buffer keeps exactly the points read.
  private readCable(): void {
    const read = this.deps.pylonPoints;
    const on = read !== undefined && fxEnabled('pylonPulse', this.reduced);
    for (let f = 0; f < this.cable.length; f++) {
      const pts = this.cable[f];
      if (pts === undefined) continue;
      const n = read !== undefined && on ? read(f, pts) : 0;
      if (pts.length > n) pts.length = n;
      this.cableLen[f] = Math.min(n, pts.length);
    }
  }

  // The dust law (dustLaw): at most updateHz sends, each only when the frequency moved; reduced motion gives the field its default.
  private updateDust(): void {
    if (this.reduced) {
      this.setDust(null);
      return;
    }
    if (!throttleOk(this.dustCheckMs, this.nowMs, 1000 / REACH_FX.dustLaw.updateHz)) return;
    this.dustCheckMs = this.nowMs;
    const ms = dustFrequencyMs(this.energyRate);
    if (Number.isNaN(this.dustMs) || Math.abs(ms - this.dustMs) >= DUST_STEP_MS) this.setDust(ms);
  }

  // Sends a frequency (or null, once, for the field's default) to the dust field, when the port is wired.
  private setDust(ms: number | null): void {
    if (ms === null) {
      if (this.dustNulled) return;
      this.dustNulled = true;
      this.dustMs = Number.NaN;
      this.deps.setDustFrequency?.(null);
      return;
    }
    this.dustNulled = false;
    this.dustMs = ms;
    this.deps.setDustFrequency?.(ms);
  }

  // Crank pulses (a manual click, throttled to PULSE_GAP_MS so the flash rate stays under maxFlashHz) and the big-buy waves, then the redraw.
  private stepGround(): void {
    const now = this.nowMs;
    const pulse = REACH_FX.groundPulse;
    const wave = REACH_FX.groundWave;
    if (this.pendingClick) {
      this.pendingClick = false;
      const slot = freeSlot(this.pulseAt);
      if (fxEnabled('groundPulse', this.reduced) && slot >= 0 && throttleOk(this.lastPulseMs, now, PULSE_GAP_MS)) {
        this.pulseAt[slot] = now;
        this.lastPulseMs = now;
        this.pulsesStarted++;
        this.groundCad.dirty = true;
      }
    }
    if (this.pendingWave) {
      this.pendingWave = false;
      const slot = freeSlot(this.waveAt);
      if (fxEnabled('groundWave', this.reduced) && slot >= 0 && throttleOk(this.lastWaveMs, now, wave.minGapMs)) {
        this.waveAt[slot] = now;
        this.lastWaveMs = now;
        this.wavesStarted++;
        this.startHops(wave.dustMotes);
        this.groundCad.dirty = true;
      }
    }
    const alive = this.expireGround(now, pulse.lifeMs);
    if (alive > 0) this.groundCad.dirty = true;
    if (this.groundCad.dirty && now - this.groundCad.lastMs >= REDRAW_MS) this.drawGround(now);
  }

  // Frees the pulses past their life and the waves whose fronts have both passed the view on their own side; returns the live count.
  private expireGround(now: number, lifeMs: number): number {
    let alive = 0;
    for (let i = 0; i < this.pulseAt.length; i++) {
      const start = this.pulseAt[i] ?? Number.NaN;
      if (Number.isNaN(start)) continue;
      if (now - start >= lifeMs) this.pulseAt[i] = Number.NaN;
      else alive++;
    }
    let view: Phaser.Geom.Rectangle | null = null;
    for (let i = 0; i < this.waveAt.length; i++) {
      const start = this.waveAt[i] ?? Number.NaN;
      if (Number.isNaN(start)) continue;
      view ??= this.scene.cameras.main.worldView;
      // The left front runs left and the right front runs right: a front that has passed the view on its own side never comes back.
      const age = now - start;
      if (groundWaveX(this.left, -1, age) > view.x || groundWaveX(this.right, 1, age) < view.right) alive++;
      else this.waveAt[i] = Number.NaN;
    }
    return alive;
  }

  // Draws the dashes of the live pulses (outward from both base edges, fading) and the raised fronts of the live waves, both in the
  // era's ground colour (F38: the sand of eras III-IV takes the gold).
  private drawGround(now: number): void {
    const g = this.groundLayer;
    g.clear();
    const ground = REACH_FX.colors.ground[this.era];
    const pulse = REACH_FX.groundPulse;
    const wave = REACH_FX.groundWave;
    const dash = pulse.dashArtPx * PIXEL_SCALE;
    const thick = pulse.thicknessArtPx * PIXEL_SCALE;
    let alive = 0;
    for (let i = 0; i < this.pulseAt.length; i++) {
      const start = this.pulseAt[i] ?? Number.NaN;
      if (Number.isNaN(start)) continue;
      alive++;
      const age = now - start;
      const travel = (pulse.speedPxPerS * age) / 1000;
      g.fillStyle(ground, mix(pulse.alphaFrom, pulse.alphaTo, Math.min(1, age / pulse.lifeMs)));
      g.fillRect(this.left - travel - dash, GROUND_Y + PIXEL_SCALE, dash, thick);
      g.fillRect(this.right + travel, GROUND_Y + PIXEL_SCALE, dash, thick);
    }
    const view = this.scene.cameras.main.worldView;
    const bump = wave.bumpArtPx * PIXEL_SCALE;
    g.fillStyle(ground, wave.alpha);
    for (let i = 0; i < this.waveAt.length; i++) {
      const start = this.waveAt[i] ?? Number.NaN;
      if (Number.isNaN(start)) continue;
      alive++;
      const age = now - start;
      const lx = groundWaveX(this.left, -1, age);
      const rx = groundWaveX(this.right, 1, age);
      if (lx > view.x) g.fillRect(lx - dash, GROUND_Y - bump, dash, bump);
      if (rx < view.right) g.fillRect(rx, GROUND_Y - bump, dash, bump);
    }
    this.groundCad.lastMs = now;
    this.groundCad.dirty = alive > 0;
  }

  // Base dust: each speck rolls at most maxHopsPerS a second; the roll hops it with the chance of the era level. Reduced motion hides it.
  private stepBaseDust(): void {
    const now = this.nowMs;
    const on = fxEnabled('baseDust', this.reduced);
    const base = REACH_FX.baseDust;
    const chance = base.chanceFrom + (base.chanceTo - base.chanceFrom) * this.level;
    let hopping = 0;
    let changed = false;
    for (let i = 0; i < this.hopStart.length; i++) {
      const start = this.hopStart[i] ?? Number.NaN;
      if (!Number.isNaN(start)) {
        if (now - start < HOP_MS) {
          hopping++;
          continue;
        }
        this.hopStart[i] = Number.NaN;
        changed = true;
      }
      if (on && throttleOk(this.nextRoll[i] ?? Number.NEGATIVE_INFINITY, now, HOP_CHECK_MS)) {
        this.nextRoll[i] = now;
        if (Math.random() < chance) {
          this.startHop(i, now);
          hopping++;
          changed = true;
        }
      }
    }
    this.hoppingNow = hopping;
    if (changed || hopping > 0) this.baseCad.dirty = true;
    if (this.baseCad.dirty && now - this.baseCad.lastMs >= REDRAW_MS) this.drawBase(now, on);
  }

  // Starts a hop of speck i: its height is a random whole art px in hopArtPx.
  private startHop(i: number, now: number): void {
    const hop = REACH_FX.baseDust.hopArtPx;
    this.hopStart[i] = now;
    this.hopArt[i] = hop[0] + Math.floor(Math.random() * (hop[1] - hop[0] + 1));
  }

  // The extra hops of a big buy: up to count specks that are resting, from a cursor so the same specks do not always go.
  private startHops(count: number): void {
    const n = this.hopStart.length;
    let started = 0;
    for (let k = 0; k < n && started < count; k++) {
      const i = (this.moteCursor + k) % n;
      if (!Number.isNaN(this.hopStart[i] ?? Number.NaN)) continue;
      this.startHop(i, this.nowMs);
      started++;
    }
    this.moteCursor = (this.moteCursor + count) % n;
  }

  // The base specks along the machine's base line; a hopping speck rises on a half sine by its art px.
  private drawBase(now: number, on: boolean): void {
    const g = this.baseLayer;
    g.clear();
    let hopping = 0;
    if (on) {
      const base = REACH_FX.baseDust;
      const size = base.sizeArtPx * PIXEL_SCALE;
      g.fillStyle(base.color, 1);
      for (let i = 0; i < this.baseX.length; i++) {
        const start = this.hopStart[i] ?? Number.NaN;
        let lift = 0;
        if (!Number.isNaN(start)) {
          hopping++;
          lift = Math.round(Math.sin((Math.PI * (now - start)) / HOP_MS) * (this.hopArt[i] ?? 0)) * PIXEL_SCALE;
        }
        g.fillRect((this.baseX[i] ?? this.left) - size / 2, GROUND_Y - size - lift, size, size);
      }
    }
    this.baseCad.lastMs = now;
    this.baseCad.dirty = hopping > 0;
  }

  // Pylon dots run along each lit cable: count from the era level, at pylonPulse.pxPerS. Shown only while a cable is lit.
  private stepPylons(): void {
    const now = this.nowMs;
    let lit = false;
    for (const n of this.cableLen) if (n >= 2) lit = true;
    if (lit || this.dotsDrawn > 0) this.pylonCad.dirty = true;
    if (this.pylonCad.dirty && now - this.pylonCad.lastMs >= REDRAW_MS) this.drawPylons(now, fxEnabled('pylonPulse', this.reduced));
  }

  private drawPylons(now: number, on: boolean): void {
    const g = this.pylonLayer;
    g.clear();
    let drawn = 0;
    if (on) {
      const p = REACH_FX.pylonPulse;
      const count = pylonDotCount(this.level);
      const size = p.dotArtPx * PIXEL_SCALE;
      g.fillStyle(REACH_FX.colors.pylonDot[this.era], 1);
      for (let f = 0; f < this.cable.length; f++) {
        const pts = this.cable[f];
        const out = this.dots[f];
        if (pts === undefined || out === undefined) continue;
        const k = pylonDotPositions(pts, count, now, out);
        for (let j = 0; j < k; j++) {
          const d = out[j];
          if (d !== undefined) g.fillRect(d.x - size / 2, d.y - size / 2, size, size);
        }
        drawn += k;
      }
    }
    this.dotsDrawn = drawn;
    this.pylonCad.lastMs = now;
    this.pylonCad.dirty = drawn > 0;
  }

  // Arcs (era II): a Poisson spawn at the EE rate, spaced FLASH_GAP_MS apart, at a site; each lives lifeMs.
  private stepArcs(dt: number): void {
    const now = this.nowMs;
    const arc = REACH_FX.arc;
    const on = fxEnabled('arc', this.reduced) && this.era === arc.era;
    let alive = 0;
    let expired = false;
    for (const a of this.arcSlots) {
      if (!a.live) continue;
      if (now - a.startMs >= arc.lifeMs) {
        a.live = false;
        expired = true;
      } else {
        alive++;
      }
    }
    if (on && spawnDue(dt, arcRatePerS(this.rateEe), Math.random()) && throttleOk(this.lastArcMs, now, FLASH_GAP_MS)) this.spawnArc(now);
    if (alive > 0 || expired) this.arcCad.dirty = true;
    if (this.arcCad.dirty && now - this.arcCad.lastMs >= REDRAW_MS) this.drawArcs(now);
  }

  // Picks a site (the sites of the framing, the lit cable's ends and the woken Splice feet) and starts an arc there, if a slot is free.
  private spawnArc(now: number): void {
    const n = this.collectSites();
    if (n === 0) return;
    let slot: Arc | undefined;
    for (const a of this.arcSlots) {
      if (!a.live) {
        slot = a;
        break;
      }
    }
    const k = this.arcsStarted;
    const site = this.sites[Math.min(n - 1, Math.floor(hash01(k, 1) * n))];
    if (slot === undefined || site === undefined) return;
    const len = REACH_FX.arc.lengthArtPx;
    slot.live = true;
    slot.startMs = now;
    slot.x = site.x;
    slot.y = site.y;
    slot.lenArt = len[0] + Math.floor(hash01(k, 2) * (len[1] - len[0] + 1));
    slot.sign = hash01(k, 3) < 0.5 ? -1 : 1;
    this.lastArcMs = now;
    this.arcsStarted++;
    this.arcCad.dirty = true;
  }

  // The arc sites into the buffer: the lamp head and the booth hood of the framing, the two ends of the first lit cable, then the feet of
  // the woken Splice objects. Returns the count (0 when there is nowhere to arc).
  private collectSites(): number {
    const d = this.deps.director();
    const framing: FramingKey | null = d?.framingKey() ?? null;
    let n = 0;
    if (framing !== null) {
      const placed = WORLD_PLACEMENTS[framing];
      const lamp = placed.lamp;
      if (lamp !== undefined) n = this.addSite(n, lamp.x, GROUND_Y - WORLD_ENV.lampHeadArtPx * PIXEL_SCALE);
      const phone = placed.payphone;
      if (phone !== undefined) n = this.addSite(n, phone.x + SPLICE_REACH.phoneDropEnd.dx, GROUND_Y + SPLICE_REACH.phoneDropEnd.dy);
    }
    for (let f = 0; f < this.cableLen.length; f++) {
      const len = this.cableLen[f] ?? 0;
      const pts = this.cable[f];
      if (len < 2 || pts === undefined) continue;
      const first = pts[0];
      const last = pts[len - 1];
      if (first !== undefined && last !== undefined) {
        n = this.addSite(n, first.x, first.y);
        n = this.addSite(n, last.x, last.y);
      }
      break;
    }
    if (d !== null) {
      const count = d.spliceStats(this.spliceRows);
      for (let i = 0; i < count; i++) {
        const row = this.spliceRows[i];
        if (row !== undefined && row.state === 'woken' && row.placed && row.visible) n = this.addSite(n, row.x, row.y);
      }
    }
    return n;
  }

  // Writes one site into the buffer (dropped past SITE_CAP); returns the new count.
  private addSite(n: number, x: number, y: number): number {
    const s = this.sites[n];
    if (s === undefined) return n;
    s.x = x;
    s.y = y;
    return n + 1;
  }

  // The arcs of this frame: the expired ones are already off; the live ones are zig-zags with a tip pixel at the end.
  private drawArcs(now: number): void {
    const g = this.arcLayer;
    g.clear();
    const arc = REACH_FX.arc;
    let alive = 0;
    for (const a of this.arcSlots) {
      if (!a.live) continue;
      alive++;
      const x0 = a.x - (a.lenArt * PIXEL_SCALE) / 2;
      g.lineStyle(PIXEL_SCALE, arc.core, 1).beginPath();
      for (let k = 0; k <= a.lenArt; k++) {
        const x = x0 + k * PIXEL_SCALE;
        const y = a.y + (k % 2 === 0 ? 0 : -a.sign * PIXEL_SCALE);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      const xe = x0 + a.lenArt * PIXEL_SCALE;
      const ye = a.y + (a.lenArt % 2 === 0 ? 0 : -a.sign * PIXEL_SCALE);
      g.fillStyle(arc.tip, 1).fillRect(xe - PIXEL_SCALE / 2, ye - PIXEL_SCALE / 2, PIXEL_SCALE, PIXEL_SCALE);
    }
    this.arcCad.lastMs = now;
    this.arcCad.dirty = alive > 0;
  }

  // Steam drift (era III): puffs from the chimney and the relief valves at the drift rate of PR/s, at most maxAlive; the images move each frame.
  private stepDrift(dt: number): void {
    const drift = REACH_FX.drift;
    const on = fxEnabled('drift', this.reduced) && this.era === drift.era;
    let alive = 0;
    for (const p of this.puffs) {
      if (!p.live) continue;
      p.ageMs += dt;
      if (p.ageMs >= p.lifeMs) {
        p.live = false;
        p.image.setVisible(false);
        continue;
      }
      alive++;
      this.placePuff(p);
    }
    if (on && this.sources.length > 0 && spawnDue(dt, driftRatePerS(this.ratePr), Math.random())) {
      for (const p of this.puffs) {
        if (p.live) continue;
        this.startPuff(p);
        alive++;
        break;
      }
    }
    this.puffsAlive = alive;
  }

  // Starts a puff at a random emitter point, with its life, drift speed and rise drawn from the drift law.
  private startPuff(p: Puff): void {
    const drift = REACH_FX.drift;
    const k = this.puffSpawns;
    const src = this.sources[Math.floor(hash01(k, 4) * this.sources.length)];
    if (src === undefined) return;
    this.puffSpawns++;
    p.live = true;
    p.ageMs = 0;
    p.lifeMs = mix(drift.lifeMs[0], drift.lifeMs[1], hash01(k, 5));
    p.speedPx = mix(drift.speedPxPerS[0], drift.speedPxPerS[1], hash01(k, 6));
    p.risePx = mix(drift.risePx[0], drift.risePx[1], hash01(k, 7));
    p.base.x = src.x;
    p.base.y = src.y;
    p.frame = -1;
    p.image.setVisible(true);
    this.placePuff(p);
  }

  // Moves a puff to its age: drift right, rise, grow and thin (the steam frames step with the life), on the art grid.
  private placePuff(p: Puff): void {
    const drift = REACH_FX.drift;
    const t = Math.min(1, p.ageMs / p.lifeMs);
    const x = p.base.x + (p.speedPx * p.ageMs) / 1000;
    const y = p.base.y - p.risePx * t;
    const frame = Math.min(STEAM_FX.frames - 1, Math.floor(t * STEAM_FX.frames));
    p.image
      .setPosition(Math.round(x / PIXEL_SCALE) * PIXEL_SCALE, Math.round(y / PIXEL_SCALE) * PIXEL_SCALE)
      .setScale(PIXEL_SCALE * mix(STEAM_FX.scaleFrom, STEAM_FX.scaleTo, t))
      .setAlpha(mix(drift.alphaFrom, drift.alphaTo, t));
    if (frame !== p.frame) {
      p.frame = frame;
      p.image.setFrame(frame);
    }
  }

  // Debris (era V): a run of specks (its target drawn once per run) spawns over time near the base, rises and hangs; reduced motion
  // places each at its final height with no motion.
  private stepDebris(): void {
    const now = this.nowMs;
    const debris = REACH_FX.debris;
    const on = fxEnabled('debris', this.reduced) && this.era === debris.era;
    const moving = debrisMoves(this.reduced);
    let alive = 0;
    for (const s of this.specks) if (s.live) alive++;
    if (on && this.debrisTarget < 0) {
      this.debrisTarget = debris.specks[0] + Math.floor(Math.random() * (debris.specks[1] - debris.specks[0] + 1));
    }
    if (on && alive < this.debrisTarget && now >= this.debrisNextMs) {
      let slot: Speck | undefined;
      for (const s of this.specks) {
        if (!s.live) {
          slot = s;
          break;
        }
      }
      if (slot !== undefined) {
        slot.live = true;
        slot.startMs = now;
        slot.x = mix(this.left, this.right, Math.random());
        slot.targetArt = mix(debris.riseArtPx[0], debris.riseArtPx[1], Math.random());
        slot.riseMs = mix(debris.riseMs[0], debris.riseMs[1], Math.random());
        slot.phase = Math.random();
        this.debrisNextMs = now + mix(debris.riseMs[0], debris.riseMs[1], Math.random());
        alive++;
        this.debrisCad.dirty = true;
      }
    }
    if (alive > 0 && moving) this.debrisCad.dirty = true;
    this.specksAlive = alive;
    if (this.debrisCad.dirty && now - this.debrisCad.lastMs >= REDRAW_MS) this.drawDebris(now, moving);
  }

  // The specks: a body and a violet rim row on top; a rising speck rises by its drawn law, a hanging one bobs.
  private drawDebris(now: number, moving: boolean): void {
    const g = this.debrisLayer;
    g.clear();
    const debris = REACH_FX.debris;
    const size = SPECK_ART_PX * PIXEL_SCALE;
    let alive = 0;
    for (const s of this.specks) {
      if (!s.live) continue;
      alive++;
      const age = now - s.startMs;
      const rise = debrisRiseArt(age, moving ? s.riseMs : 0, s.targetArt);
      const bob = moving && age >= s.riseMs ? debrisBobPx(now, s.phase) * PIXEL_SCALE : 0;
      const y = GROUND_Y - rise * PIXEL_SCALE + bob;
      g.fillStyle(debris.color, 1).fillRect(s.x - size / 2, y - size, size, size);
      g.fillStyle(debris.rim, 1).fillRect(s.x - size / 2, y - size, size, PIXEL_SCALE);
    }
    this.debrisCad.lastMs = now;
    this.debrisCad.dirty = moving && alive > 0;
  }

  // Ends everything live: the slots, the hops, the puffs, the debris run and the layers. Called on reset, cycle, a reduced-motion change and
  // the ending (the next run starts clean).
  private clearLive(): void {
    this.pendingClick = false;
    this.pendingWave = false;
    this.pulseAt.fill(Number.NaN);
    this.waveAt.fill(Number.NaN);
    this.hopStart.fill(Number.NaN);
    for (const a of this.arcSlots) a.live = false;
    for (const s of this.specks) s.live = false;
    for (const p of this.puffs) {
      p.live = false;
      p.image.setVisible(false);
    }
    this.debrisTarget = -1;
    this.debrisNextMs = this.nowMs;
    this.hoppingNow = 0;
    this.dotsDrawn = 0;
    this.puffsAlive = 0;
    this.specksAlive = 0;
    this.groundLayer.clear();
    this.baseLayer.clear();
    this.pylonLayer.clear();
    this.arcLayer.clear();
    this.debrisLayer.clear();
    this.groundCad.dirty = false;
    this.pylonCad.dirty = false;
    this.arcCad.dirty = false;
    this.debrisCad.dirty = false;
    // The resting base specks come back when the base dust is on again.
    this.baseCad.dirty = true;
  }

  // The ending: everything hidden and cleared; the FX stays off for the rest of the run.
  private hideAll(): void {
    this.clearLive();
    this.setVisibleAll(false);
    this.off = true;
  }

  private setVisibleAll(on: boolean): void {
    this.groundLayer.setVisible(on);
    this.baseLayer.setVisible(on);
    this.pylonLayer.setVisible(on);
    this.arcLayer.setVisible(on);
    this.debrisLayer.setVisible(on);
    this.drift.setVisible(on);
  }
}
