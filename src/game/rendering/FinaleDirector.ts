import type Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import { motionPolicy } from '../../simulation/settings';
import type { EndingPhase } from '../../data/types';
import { FINALE_BOOST, FINALE_CLOCK, FINALE_PLATE, FINALE_REVEAL } from '../../data/finale';
import type { FinaleBeat } from '../../data/finale';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { beatsBetween, finaleEndS, finaleFrame } from '../math/finale';
import type { CameraPose, FinaleFrame, FinaleShot } from '../math/finale';
import { buildFinaleOverlay } from '../../ui/finaleView';
import type { FinaleOverlayHandle } from '../../ui/finale';
import type { NewCycleHook } from '../newCycle';
import type { ParallaxBackground } from './ParallaxBackground';
import type { RestoredGround } from './RestoredGround';
import type { Eclipse } from './Eclipse';
import type { ApertureBeam } from './ApertureBeam';
import type { DustField } from './DustField';
import type { SteamFx } from './SteamFx';
import type { FinaleFx } from './FinaleFx';
import type { CameraController } from './CameraController';
import type { MachineView } from '../entities/MachineView';
import type { Terrain } from './Terrain';

// Finale director (WP13 T11). Owns the film clock and, each frame, pushes one FinaleFrame (math/finale.ts) to every
// finale renderer, the camera override and the overlay. It owns no economy state: it reads the session and calls
// only finishEndingSequence() (sequence -> choice). KEEP and new-cycle are wired in bootstrap.

/** Rolling window of update() costs for the perf probe (same window as MachineView). */
const COST_SAMPLE_COUNT = 120;
const PLATE_ID = MACHINE_COMPONENTS.namePlate.id;

export interface FinaleDirectorDeps {
  session: GameSession;
  newCycle: NewCycleHook;
  overlay: FinaleOverlayHandle;
  background: ParallaxBackground;
  restoredGround: RestoredGround;
  terrain: Terrain;
  eclipse: Eclipse;
  beam: ApertureBeam;
  dust: DustField;
  fx: FinaleFx;
  steamFx: SteamFx;
  machine: MachineView;
  camera: CameraController;
  /** Beat sink (ctx.feedback.finaleBeat). 'flock' is not routed here: FinaleFx emits it once per spawn. */
  emitBeat(beat: FinaleBeat): void;
}

export interface FinaleState {
  phase: EndingPhase;
  t: number;
  shot: FinaleShot | null;
  reduced: boolean;
  restored: boolean;
  meanMs: number;
}

export class FinaleDirector {
  private readonly scene: Phaser.Scene;
  private readonly deps: FinaleDirectorDeps;
  private readonly unsubscribes: Array<() => void> = [];
  private t = 0;
  private reduced = false;
  private start: CameraPose;
  private neutralApplied = false;
  private overriding = false;
  private frame: FinaleFrame | null = null;
  /** High-water mark of the film clock: beats at or before it have fired this run (seeking back never refires). */
  private firedUpTo = 0;
  private readonly costs: number[] = [];
  private costCursor = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, deps: FinaleDirectorDeps) {
    this.scene = scene;
    this.deps = deps;
    this.reduced = this.readReduced();
    this.start = this.cameraPose();
    this.unsubscribes.push(
      deps.session.on('ending', ({ phase }) => {
        if (phase === 'sequence') this.begin();
      }),
      deps.session.on('reset', () => this.reset()),
    );
    // Boot (D1): 'sequence' is normalised to 'choice' on load, so a boot never plays the film. 'choice' and
    // 'postgame' show the end state at once.
    const phase = this.phase();
    if (phase === 'sequence') this.begin();
    if (phase === 'choice' || phase === 'postgame') this.t = this.endS();
    this.present(0);
  }

  /** Per frame, after the other renderers: advances the clock, fires beats, pushes the frame. */
  update(deltaMs: number): void {
    if (this.destroyed) return;
    const started = performance.now();
    const dtMs = Number.isFinite(deltaMs) ? Math.min(Math.max(deltaMs, 0), FINALE_CLOCK.maxFrameMs) : 0;
    if (this.phase() === 'sequence') this.moveTo(this.t + dtMs / 1000);
    this.present(dtMs);
    this.recordCost(performance.now() - started);
  }

  /** Esc during the sequence: jump to the end of the film, fire plate + chord only, open the choice. */
  skip(): void {
    if (this.destroyed || this.phase() !== 'sequence') return;
    const prev = this.t;
    this.t = Math.max(prev, this.endS());
    for (const beat of beatsBetween(Math.max(prev, this.firedUpTo), this.t)) {
      if (beat === 'plate' || beat === 'chord') this.fireBeat(beat);
    }
    this.firedUpTo = Math.max(this.firedUpTo, this.t);
    this.deps.session.finishEndingSequence();
  }

  /** Debug / smoke: moves the film clock to t (fires the beats it crosses) and renders at once. */
  seek(t: number): void {
    if (this.destroyed) return;
    this.moveTo(Number.isFinite(t) ? Math.max(0, t) : 0);
    this.present(0);
  }

  getState(): FinaleState {
    const frame = this.frame;
    return {
      phase: this.phase(),
      t: this.t,
      shot: frame?.shot ?? null,
      reduced: this.reduced,
      restored: frame?.restored ?? false,
      meanMs: this.meanMs(),
    };
  }

  /** The last frame pushed to the renderers, or null before the first update. */
  getFrame(): FinaleFrame | null {
    return this.frame;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const off of this.unsubscribes) off();
    this.unsubscribes.length = 0;
    if (this.overriding) {
      this.overriding = false;
      this.deps.camera.setOverride(null);
    }
    this.deps.overlay.render(null);
  }

  private phase(): EndingPhase {
    return this.deps.session.state.ending.phase;
  }

  /** Film time the buttons are up, in the reduced-motion mode this run uses (matches typewriter). */
  private endS(): number {
    return finaleEndS(FINALE_REVEAL, this.reduced);
  }

  private readReduced(): boolean {
    return !motionPolicy(this.deps.session.settings).flashes;
  }

  private cameraPose(): CameraPose {
    const cam = this.scene.cameras.main;
    return { centerX: cam.midPoint.x, centerY: cam.midPoint.y, zoom: cam.zoom };
  }

  /** The sequence starts at t 0 from the camera's current pose; reduced motion is read once for the run. */
  private begin(): void {
    if (this.destroyed) return;
    this.t = 0;
    this.firedUpTo = 0;
    this.reduced = this.readReduced();
    this.start = this.cameraPose();
    this.neutralApplied = false;
  }

  /** Reset: back to t 0 and the neutral (wasteland) frame at once. */
  private reset(): void {
    if (this.destroyed) return;
    this.t = 0;
    this.firedUpTo = 0;
    this.neutralApplied = false;
    this.present(0);
  }

  /** Moves the clock; during the sequence fires the beats crossed past the high-water mark and finishes at endS. */
  private moveTo(next: number): void {
    const prev = this.t;
    this.t = next;
    if (this.phase() !== 'sequence') return;
    for (const beat of beatsBetween(Math.max(prev, this.firedUpTo), next)) this.fireBeat(beat);
    this.firedUpTo = Math.max(this.firedUpTo, next);
    if (next >= this.endS()) this.deps.session.finishEndingSequence(); // after the last line types and the buttons appear
  }

  private fireBeat(beat: FinaleBeat): void {
    const d = this.deps;
    if (beat === 'calliope') d.steamFx.fireBurst(FINALE_BOOST.calliope.emitter, FINALE_BOOST.calliope.count);
    else if (beat === 'plate' && !this.reduced) d.fx.plateDust(d.machine.getComponentWorldPosition(PLATE_ID), FINALE_PLATE.puffs);
    if (beat !== 'flock') d.emitBeat(beat);
  }

  /** Pushes the frame of the current phase. 'none' pushes the neutral frame once (it is today's world). */
  private present(dtMs: number): void {
    const d = this.deps;
    const phase = this.phase();
    if (phase === 'none') {
      if (!this.neutralApplied) {
        this.neutralApplied = true;
        this.apply(finaleFrame({ phase, t: this.t, reduced: this.reduced, start: this.start }), dtMs);
      }
      d.overlay.render(null);
      return;
    }
    this.neutralApplied = false;
    this.apply(finaleFrame({ phase, t: this.t, reduced: this.reduced, start: this.start }), dtMs);
    d.overlay.render(buildFinaleOverlay(phase, this.t, this.reduced, d.newCycle.blockedReason()));
  }

  private apply(frame: FinaleFrame, dtMs: number): void {
    const d = this.deps;
    d.background.applyFinale(frame.tracks);
    d.restoredGround.applyFinale(frame);
    d.terrain.setRestored(frame.restored);
    d.eclipse.applyFinale(frame.eclipse);
    d.beam.applyFinale(frame.beam);
    d.dust.applyFinale(frame.dust);
    d.fx.applyFinale(frame, dtMs);
    d.machine.applyFinale({ boost: frame.boost, restored: frame.restored });
    if (frame.camera !== null) {
      d.camera.setOverride(frame.camera);
      this.overriding = true;
    } else if (this.overriding) {
      this.overriding = false;
      d.camera.setOverride(null);
    }
    this.frame = frame;
  }

  private recordCost(ms: number): void {
    if (this.costs.length < COST_SAMPLE_COUNT) {
      this.costs.push(ms);
      return;
    }
    this.costs[this.costCursor] = ms;
    this.costCursor = (this.costCursor + 1) % COST_SAMPLE_COUNT;
  }

  private meanMs(): number {
    if (this.costs.length === 0) return 0;
    let sum = 0;
    for (const c of this.costs) sum += c;
    return sum / this.costs.length;
  }
}
