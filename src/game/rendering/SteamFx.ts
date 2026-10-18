import Phaser from 'phaser';
import { MILESTONE_BURSTS, STEAM_EMITTERS, STEAM_FX } from '../../data/steamFx';
import type { EmitterMode, SteamEmitter } from '../../data/steamFx';
import { MACHINE_MOTION } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { PIXEL_SCALE } from '../../data/world';
import type { GameSession } from '../../simulation';
import type { MachineView } from '../entities/MachineView';
import { driverValue } from '../math/animation';
import { machineLocalToWorld } from '../math/machineLayout';
import { burstDelaySeconds, burstPoints, emitterActive, emitterRate, puffState, stepEmitter } from '../math/steamFx';

/** Per-emitter run state. Cleared on session reset and while the emitter's gate is unmet. */
interface EmitterState {
  acc: number;                   // rate emitters: fractional puffs carried between frames
  nextBurstAt: number | null;    // burst emitters: clock time of the next burst, null while the driver is below its floor
  burstIndex: number;            // burst emitters: index fed to burstDelaySeconds
  counter: number;               // rate emitters: round-robin index over the spawn points
  burstPoint: number;            // round-robin burst emitters: index of the point the next periodic burst fires from
}

/** An emitter paired with its run state, in STEAM_EMITTERS order. */
interface Lane {
  emitter: SteamEmitter;
  state: EmitterState;
}

/** A pooled puff image that is alive, with its age and spawn point in world px. */
interface LivePuff {
  image: Phaser.GameObjects.Image;
  ageMs: number;
  base: Vec2;
}

/** A puff queued to spawn once the clock reaches `at` (seconds). `point` is machine-local art px. */
interface ScheduledPuff {
  at: number;
  point: Vec2;
  assetId: SteamEmitter['assetId'];
}

/** Hammer puffs per frame are capped so a long stall cannot flood the pool. */
const MAX_STRIKE_PUFFS = 3;

/** Machine part each rate emitter belongs to: its puffs wait while that part is still assembling. */
const RATE_EMITTER_PART: Readonly<Record<string, MachineComponentId>> = {
  chimney: 'chimney',
  manifold: 'steamManifold',
};

function freshState(): EmitterState {
  return { acc: 0, nextBurstAt: null, burstIndex: 0, counter: 0, burstPoint: 0 };
}

/** Local spawn point `index` round-robin over `points`, or undefined when there are none. */
function pointAt(points: readonly Vec2[], index: number): Vec2 | undefined {
  if (points.length === 0) return undefined;
  return points[index % points.length];
}

// World-space steam and smoke puffs for the era III machine (boiler chimney, relief valves, steam hammer
// strikes, manifold leaks) and the era IV calliope whistles. Emitter rates and gates come from data (STEAM_EMITTERS); the pure maths
// lives in math/steamFx. Puffs come from a bounded pool of images that are hidden while free.
export class SteamFx {
  private readonly scene: Phaser.Scene;
  private readonly session: GameSession;
  private readonly getMachine: () => MachineView | null;
  private readonly lanes: Lane[] = STEAM_EMITTERS.map((emitter) => ({ emitter, state: freshState() }));
  private readonly free: Phaser.GameObjects.Image[] = [];
  private live: LivePuff[] = [];
  private scheduled: ScheduledPuff[] = [];
  private created = 0;
  private clock = 0;          // seconds of simulated frame time since construction
  private lastStrikes = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(scene: Phaser.Scene, session: GameSession, getMachine: () => MachineView | null) {
    this.scene = scene;
    this.session = session;
    this.getMachine = getMachine;
    this.unsubscribers = [
      session.on('unlock', ({ id }) => this.onUnlock(id)),
      session.on('milestone', ({ id }) => this.onMilestone(id)),
      session.on('reset', () => this.onReset()),
    ];
  }

  /** Advances emitters, scheduled puffs and live puffs by one frame. */
  update(deltaMs: number): void {
    const rawSeconds = Number.isFinite(deltaMs) ? deltaMs / 1000 : 0;
    const dt = Math.min(MACHINE_MOTION.maxFrameSeconds, Math.max(0, rawSeconds));
    this.clock += dt;
    const machine = this.getMachine();
    for (const lane of this.lanes) this.stepLane(lane, dt, machine);
    this.spawnDue();
    this.ageLive(dt);
  }

  /** Unsubscribes, destroys every pooled image and clears all queues; safe to call twice. */
  destroy(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    for (const puff of this.live) this.destroyImage(puff.image);
    for (const image of this.free) this.destroyImage(image);
    this.live = [];
    this.free.length = 0;
    this.scheduled = [];
    this.created = 0;
  }

  private destroyImage(image: Phaser.GameObjects.Image): void {
    if (image.scene) image.destroy(); // Phaser clears scene on destroy
  }

  // Runs one emitter for this frame. An inactive emitter (gate unmet, or its until tech reached) resets its run state and stays quiet.
  private stepLane(lane: Lane, dt: number, machine: MachineView | null): void {
    const { emitter, state } = lane;
    if (!emitterActive(emitter, this.session.state.techLevels)) {
      state.acc = 0;
      state.nextBurstAt = null;
      return;
    }
    const rates = this.session.rates.perSecond;
    const v = driverValue(emitter.driver, 0, rates.me, rates.ee, rates.pr, rates.rs);
    const mode = emitter.mode;
    switch (mode.kind) {
      case 'rate': {
        // A part still flying in has no steam yet: its lane stays quiet until it lands.
        const part = RATE_EMITTER_PART[emitter.id];
        const assembling = part !== undefined && machine?.isAssembling(part) === true;
        if (v >= emitter.threshold && !assembling) {
          const step = stepEmitter(state.acc, emitterRate(mode, v), dt);
          state.acc = step.acc;
          for (let i = 0; i < step.spawn; i += 1) {
            const point = pointAt(emitter.at, state.counter);
            state.counter += 1;
            if (point !== undefined) this.spawn(emitter.assetId, point);
          }
        } else {
          state.acc = 0;
        }
        return;
      }
      case 'burst':
        if (v >= emitter.threshold && v > mode.minDriver) {
          if (state.nextBurstAt === null) state.nextBurstAt = this.clock + this.nextBurstGap(state, mode);
          if (this.clock >= state.nextBurstAt) {
            // Round robin: every puff of this periodic burst comes from one point; the point advances per burst.
            const roundRobin = mode.roundRobin === true;
            const single = roundRobin ? state.burstPoint : null;
            if (roundRobin) state.burstPoint += 1;
            this.scheduleBurst(emitter, mode.count, mode.spacingMs, this.clock, single);
            state.nextBurstAt = this.clock + this.nextBurstGap(state, mode);
          }
        } else {
          state.nextBurstAt = null;
        }
        return;
      case 'strike':
        if (machine === null) return;
        this.spawnStrikes(emitter, machine.getHammerStrikes());
        return;
    }
  }

  /** Next burst delay for this emitter; advances burstIndex so every burst gets its own spacing. */
  private nextBurstGap(state: EmitterState, mode: Extract<EmitterMode, { kind: 'burst' }>): number {
    const gap = burstDelaySeconds(state.burstIndex, mode.everyMinS, mode.everyMaxS);
    state.burstIndex += 1;
    return gap;
  }

  // One puff per hammer strike since the last frame (capped). A count that went down means a session reset.
  private spawnStrikes(emitter: SteamEmitter, strikes: number): void {
    if (strikes < this.lastStrikes) {
      this.lastStrikes = strikes;
      return;
    }
    const count = Math.min(strikes - this.lastStrikes, MAX_STRIKE_PUFFS);
    const point = pointAt(emitter.at, 0);
    if (point !== undefined) {
      for (let i = 0; i < count; i += 1) this.spawn(emitter.assetId, point);
    }
    this.lastStrikes = strikes;
  }

  // Queues the puffs of one burst, puff i at startAt + i * spacingMs. single null: puff i at point i % n;
  // single k: every puff at point k (round robin, one whistle per burst).
  private scheduleBurst(emitter: SteamEmitter, count: number, spacingMs: number, startAt: number, single: number | null = null): void {
    const pts = burstPoints(emitter.at, count, single);
    pts.forEach((point, i) => {
      this.scheduled.push({ at: startAt + (i * spacingMs) / 1000, point, assetId: emitter.assetId });
    });
  }

  // A tech bought with a burst emitter fires one burst, after the valve has landed. A round-robin emitter
  // fires every whistle once (count per point), so the purchase reads as one whistle per point.
  private onUnlock(id: string): void {
    const startAt = this.clock + STEAM_FX.purchaseBurstDelayMs / 1000;
    for (const lane of this.lanes) {
      const { emitter } = lane;
      const mode = emitter.mode;
      if (emitter.gate.techId !== id || mode.kind !== 'burst') continue;
      if (!emitterActive(emitter, this.session.state.techLevels)) continue;
      const count = mode.roundRobin === true ? mode.count * emitter.at.length : mode.count;
      this.scheduleBurst(emitter, count, mode.spacingMs, startAt);
    }
  }

  // Milestone whistles: a short burst from each named emitter, starting now (MILESTONE_BURSTS order).
  private onMilestone(id: string): void {
    for (const m of MILESTONE_BURSTS) {
      if (m.techId !== id) continue;
      const lane = this.lanes.find((l) => l.emitter.id === m.emitter);
      if (lane === undefined) continue;
      const mode = lane.emitter.mode;
      if (mode.kind !== 'burst') continue;
      this.scheduleBurst(lane.emitter, m.count, mode.spacingMs, this.clock, null);
    }
  }

  // Hides and pools every puff, drops queued puffs and zeroes all run state.
  private onReset(): void {
    for (const puff of this.live) this.release(puff.image);
    this.live = [];
    this.scheduled = [];
    for (const lane of this.lanes) lane.state = freshState();
    this.lastStrikes = 0;
  }

  // Spawns queued puffs whose time has come.
  private spawnDue(): void {
    const due = this.scheduled.filter((s) => s.at <= this.clock);
    if (due.length === 0) return;
    this.scheduled = this.scheduled.filter((s) => s.at > this.clock);
    for (const s of due) this.spawn(s.assetId, s.point);
  }

  /** Takes a pooled image (creating one up to poolSize) and starts a puff at a machine-local point. Drops silently when full. */
  private spawn(assetId: SteamEmitter['assetId'], localPoint: Vec2): void {
    let image = this.free.pop();
    if (image === undefined) {
      if (this.created >= STEAM_FX.poolSize) return;
      image = this.scene.add.image(0, 0, 'fx.steamPuff', 0).setDepth(STEAM_FX.depth).setVisible(false);
      this.created += 1;
    }
    image.setTexture(assetId, 0).setVisible(true);
    this.live.push({ image, ageMs: 0, base: machineLocalToWorld(localPoint) });
  }

  private release(image: Phaser.GameObjects.Image): void {
    image.setVisible(false);
    this.free.push(image);
  }

  // Moves every live puff along its curve; expired puffs go back to the pool.
  private ageLive(dt: number): void {
    const still: LivePuff[] = [];
    for (const puff of this.live) {
      puff.ageMs += dt * 1000;
      const st = puffState(puff.ageMs, STEAM_FX);
      if (st.done) {
        this.release(puff.image);
        continue;
      }
      const image = puff.image;
      const x = puff.base.x + st.dx * PIXEL_SCALE;
      const y = puff.base.y + st.dy * PIXEL_SCALE;
      image
        .setFrame(st.frame)
        .setPosition(Math.round(x / PIXEL_SCALE) * PIXEL_SCALE, Math.round(y / PIXEL_SCALE) * PIXEL_SCALE)
        .setScale(PIXEL_SCALE * st.scale)
        .setAlpha(st.alpha);
      still.push(puff);
    }
    this.live = still;
  }
}
