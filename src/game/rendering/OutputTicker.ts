import Phaser from 'phaser';
import { DEPTH, FLOATING_TEXT } from '../../data/world';
import { OUTPUT_TICK } from '../../data/ux';
import { PALETTE_CSS } from '../../data/palette';
import type { MachineComponentId } from '../../data/machineComponents';
import type { GameSession } from '../../simulation';
import { currentEra } from '../../simulation/progression/era';
import type { MachineView } from '../entities/MachineView';
import { gainFontPx } from '../math/gainBlock';
import { outputTickAlpha, outputTickLine, stepOutputTick } from '../math/outputTick';

// WP25 machine output popups (C5). Under passive-first progression the machine carries the economy, so its output is the
// number the player reads: one line of the frontier gain every OUTPUT_TICK.periodMs, rising and fading over the part
// that makes it. The texts are pooled: created once in the constructor and animated by hand in update() (no tweens, no
// allocation on the frame path).

/** The ticker reads these lazily on every update (the WorldScene port pattern): nothing is captured at construction. */
export interface OutputTickerPorts {
  session: Pick<GameSession, 'state' | 'rates'>;
  machine: () => MachineView | null;
  photoActive: () => boolean;
  finaleOrPostgame: () => boolean;
  reducedMotion: () => boolean;
}

/** Counters and timing for the debug hook and the smokes. `y` is the world y of the newest visible popup. */
export interface OutputTickerStats {
  shown: number;
  visible: number;
  y: number | null;
  rising: boolean;
  last: string | null;
  meanMs: number;
}

/** One preallocated popup: its text, its start point, its age and whether it is on screen. `seq` orders the starts. */
interface PopupSlot {
  text: Phaser.GameObjects.Text;
  startX: number;
  startY: number;
  ageMs: number;
  active: boolean;
  seq: number;
}

/** Window of update() wall times kept for stats().meanMs. A debug probe window, not tuning. */
const TIMING_SAMPLES = 300;

/** Scene -> its ticker, so the debug hook and the WorldScene reach the one ticker of a scene. */
const registry = new WeakMap<Phaser.Scene, OutputTicker>();

/**
 * Machine output popups for one World scene. Hidden (and the period restarted) in photo mode, finale or postgame, before the
 * first click, and while disabled; reduced motion keeps the fade and drops the rise. Never interactive.
 */
export class OutputTicker {
  private readonly scene: Phaser.Scene;
  private readonly ports: OutputTickerPorts;
  private readonly container: Phaser.GameObjects.Container;
  private readonly pool: PopupSlot[] = [];
  /** Ring buffer of the last update() durations (ms); `timingCursor` is the next slot to write. */
  private readonly timings = new Float64Array(TIMING_SAMPLES);
  private timingCount = 0;
  private timingCursor = 0;
  private enabled = true;
  /** Period accumulator (ms): reset whenever the popups are gated off, so the first popup comes one period after the gate opens. */
  private accMs = 0;
  private shown = 0;
  private lastText: string | null = null;

  static of(scene: Phaser.Scene): OutputTicker | undefined {
    return registry.get(scene);
  }

  constructor(scene: Phaser.Scene, ports: OutputTickerPorts) {
    this.scene = scene;
    this.ports = ports;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.floatingText - 1);
    for (let i = 0; i < OUTPUT_TICK.poolSize; i += 1) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: FLOATING_TEXT.fontSizePx + 'px',
          color: FLOATING_TEXT.colors.me,
          fontStyle: 'bold',
          stroke: PALETTE_CSS.ink,
          strokeThickness: FLOATING_TEXT.strokePx,
        })
        .setOrigin(0.5, 1)
        .setVisible(false);
      this.container.add(text);
      this.pool.push({ text, startX: 0, startY: 0, ageMs: 0, active: false, seq: 0 });
    }
    registry.set(scene, this);
  }

  /** Per frame: advances the popups and starts one when the period is due. The call itself is timed for the probe. */
  update(dtMs: number): void {
    const t0 = performance.now();
    // A bad frame delta (NaN, negative) counts as no time, so ages and the period never go backwards.
    this.step(Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0);
    this.recordTiming(performance.now() - t0);
  }

  /** Turns the popups on or off. Off hides every visible popup at once; both directions restart the period. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.accMs = 0;
    if (!on) this.hideAll();
  }

  stats(): OutputTickerStats {
    let visible = 0;
    let newest: PopupSlot | null = null;
    for (const slot of this.pool) {
      if (!slot.active) continue;
      visible += 1;
      if (newest === null || slot.seq > newest.seq) newest = slot;
    }
    let sum = 0;
    for (let i = 0; i < this.timingCount; i += 1) sum += this.timings[i] ?? 0;
    return {
      shown: this.shown,
      visible,
      y: newest === null ? null : newest.text.y,
      rising: !this.ports.reducedMotion(),
      last: this.lastText,
      meanMs: this.timingCount === 0 ? 0 : sum / this.timingCount,
    };
  }

  /** Removes the ticker from the registry and destroys its texts and container; objects the scene teardown already destroyed are skipped. */
  destroy(): void {
    if (registry.get(this.scene) === this) registry.delete(this.scene);
    for (const slot of this.pool) {
      // Guard: Phaser clears `scene` once an object is destroyed.
      if (slot.text.scene) slot.text.destroy();
      slot.active = false;
    }
    this.pool.length = 0;
    if (this.container.scene) this.container.destroy();
  }

  private step(dtMs: number): void {
    if (this.gated()) {
      this.accMs = 0;
      this.hideAll();
      return;
    }
    const rising = !this.ports.reducedMotion();
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.ageMs += dtMs;
      const p = Math.min(1, slot.ageMs / OUTPUT_TICK.fadeMs);
      if (p >= 1) {
        this.hide(slot);
        continue;
      }
      // The rise decelerates (quadratic ease-out) over fadeMs; the alpha holds for holdMs, then fades linearly to 0 at fadeMs.
      const lift = rising ? OUTPUT_TICK.riseWorldPx * (1 - (1 - p) * (1 - p)) : 0;
      slot.text.setPosition(slot.startX, slot.startY - lift).setAlpha(OUTPUT_TICK.alpha * outputTickAlpha(slot.ageMs, OUTPUT_TICK.holdMs, OUTPUT_TICK.fadeMs));
    }
    const timer = stepOutputTick(this.accMs, dtMs, OUTPUT_TICK.periodMs);
    this.accMs = timer.accMs;
    if (timer.due) this.startPopup();
  }

  /** True while the popups must stay hidden: disabled, photo mode, finale or postgame, or no click yet. */
  private gated(): boolean {
    return !this.enabled || this.ports.photoActive() || this.ports.finaleOrPostgame() || this.ports.session.state.totalClicks <= 0;
  }

  /** Starts one popup: the frontier line over the part that makes it. A null line or a null machine starts nothing. */
  private startPopup(): void {
    const session = this.ports.session;
    const era = currentEra(session.state.techLevels);
    const line = outputTickLine(session.rates.perSecond, era, OUTPUT_TICK.periodMs / 1000);
    if (line === null) return;
    const machine = this.ports.machine();
    if (machine === null) return;
    // The era's anchor part; the crank stands in while that part is not on the machine yet.
    const anchor: MachineComponentId = OUTPUT_TICK.anchor[era];
    const id: MachineComponentId = machine.getComponentState(anchor).visible ? anchor : 'handCrank';
    const at = machine.getComponentWorldPosition(id);
    const slot = this.takeSlot();
    if (slot === null) return;
    const fontPx = Math.max(1, Math.round(gainFontPx(this.scene.cameras.main.zoom, FLOATING_TEXT.fontSizePx, FLOATING_TEXT.minScreenPx) * OUTPUT_TICK.fontScale));
    // The stroke scales with the popup's own size, as the crank gain block does.
    const scale = fontPx / FLOATING_TEXT.fontSizePx;
    const off = OUTPUT_TICK.offset[era];
    slot.startX = at.x + off.x;
    slot.startY = at.y + off.y;
    slot.ageMs = 0;
    slot.active = true;
    this.shown += 1;
    slot.seq = this.shown;
    this.lastText = line.text;
    slot.text
      .setText(line.text)
      .setFontSize(fontPx)
      .setColor(FLOATING_TEXT.colors[line.res])
      .setStroke(PALETTE_CSS.ink, FLOATING_TEXT.strokePx * scale)
      .setPosition(slot.startX, slot.startY)
      .setAlpha(OUTPUT_TICK.alpha)
      .setVisible(true);
  }

  /** The first hidden slot; when every slot is on screen, the oldest (smallest seq) is reused. */
  private takeSlot(): PopupSlot | null {
    let oldest: PopupSlot | null = null;
    for (const slot of this.pool) {
      if (!slot.active) return slot;
      if (oldest === null || slot.seq < oldest.seq) oldest = slot;
    }
    return oldest;
  }

  private hide(slot: PopupSlot): void {
    slot.active = false;
    slot.text.setVisible(false);
  }

  private hideAll(): void {
    for (const slot of this.pool) if (slot.active) this.hide(slot);
  }

  /** Keeps the last TIMING_SAMPLES update() durations; the oldest is overwritten once the buffer is full. */
  private recordTiming(ms: number): void {
    this.timings[this.timingCursor] = ms;
    this.timingCursor = (this.timingCursor + 1) % TIMING_SAMPLES;
    if (this.timingCount < TIMING_SAMPLES) this.timingCount += 1;
  }
}
