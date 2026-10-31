import Phaser from 'phaser';
import type { GameSession } from '../../simulation';
import type { SessionEvents } from '../../simulation/events';
import { isSplice } from '../../simulation/progression/status';
import { TECHNOLOGIES } from '../../data/technologies';
import { FIND_WORLD_TEXT, REACH_TEXT } from '../../data/findWorld';
import type { Signal } from '../../utils/signal';
import type { GameFeedback } from '../context';
import type { WorldUi } from '../scenes/WorldScene';
import type { PhotoModeController } from '../photoModeController';
import type { CycleTransition } from './CycleTransition';
import type { FloatingText } from './FloatingText';
import type { PokeTarget, PokeTargetId, SpliceDebugRow, WorldDebugApi } from './LivingWorldDirector';
import { FindMarker } from './FindMarker';
import type { FindDebugStats, FindMarkerStats } from './FindMarker';
import { PokeLayer } from './PokeLayer';
import type { PokeLayerStats } from './PokeLayer';
import { FX_OBJECTS, ReachFx } from './ReachFx';
import type { ReachFxStats } from './ReachFx';
import type { Vec2 } from '../../data/machineComponents';

// WP28 the machine's reach (C12): the lazy chunk that holds the Find marker, the poke layer and (WP28b) the reach FX. WorldScene builds it after its FaultMarker
// block (import(), the same torn-down guard); bootstrap warms the chunk. Only the director port it reads is typed here (the C11 subset,
// type-only imports), so the chunk pulls no director code. The Find marker is built first, so its zone is inserted before the poke
// zones (Phaser's input picks the earliest zone of equal rank), and a Find pick-up stays on top of a poke target. The reach FX is built
// after the poke layer and updated last.

/** The director API the reach reads (C11): the framing and the crow's perch for Finds, the poke API for the poke layer. */
export type WorldReachDirectorPort = Pick<WorldDebugApi, 'framingKey' | 'crowPerchPos' | 'pokeTargets' | 'poke' | 'setPointer' | 'spliceTip' | 'spliceStats' | 'pokeStats' | 'pokeReset' | 'findProducer' | 'setFindAt'>;

export interface WorldReachDeps {
  session: GameSession;
  floatingText: FloatingText;
  /** Read per use: the living world director is a lazy chunk and may not exist yet (null until then). */
  director: () => WorldReachDirectorPort | null;
  ui: Pick<WorldUi, 'techTree' | 'modals' | 'eraCards' | 'worldView'>;
  photo: () => PhotoModeController | null;
  cycle: () => CycleTransition | null;
  /** The G key command (ctx.commands.collectFind). */
  collectCommand: Signal<void>;
  reducedMotion: () => boolean;
  /** #ui-root: the Splice tooltip slab lives here (the poke layer). */
  tooltipRoot: HTMLElement;
  feedback: Pick<GameFeedback, 'purchaseDenied' | 'worldSound' | 'partEvolved'>;
  /** WP28b [R1]: PylonLine's lit cable points of feed (0 or 1) into out, world px (B-T4 wires it; none = no pylon dots or arcs). */
  pylonPoints?: (feed: number, out: Vec2[]) => number;
  /** WP28b [R1]: DustField.setFrequencyMs (B-T4 wires it). */
  setDustFrequency?: (ms: number | null) => void;
}

/** One poke target in client px (C14): the director's game-px box mapped through the camera and the canvas. */
export interface PokeTargetDebug { id: PokeTargetId; kind: PokeTarget['kind']; enabled: boolean; x: number; y: number; w: number; h: number }

/** The poke readings (C14): the hovered target, and the director's last answers and unavailable windows. */
export interface PokeDebugStats {
  hover: string | null;
  last: Readonly<Record<string, { reaction: string; level: 1 | 2 | 3; atMs: number; delayMs: number }>>;
  unavailable: readonly string[];
}

/** The reach's counters (C14): its top-level objects, the mean frame cost, and the FX parts (WP28b fills them). */
export interface ReachDebugStats { objects: number; meanMs: number; parts: Readonly<Record<string, number>> }

/** The debug probe (C14): built here, forwarded by the hook (one null-safe line each). */
export interface ReachDebugProbe {
  findStats(): FindDebugStats;
  forceFind(): boolean;
  setFinds(on: boolean): void;
  spliceStats(): SpliceDebugRow[];
  pokeTargets(): PokeTargetDebug[];
  poke(id: PokeTargetId): string | null;
  pokeStats(): PokeDebugStats;
  pokeReset(): void;
  reachStats(): ReachDebugStats;
}

/** Top-level display objects of the reach: the Find container, the poke zones container and the poke brackets, then the reach FX's six. */
const REACH_OBJECTS = 3 + FX_OBJECTS;

/** The machine's reach in one World scene: the Find marker, the poke layer, the Splice wake line and the reach FX (WP28b). */
export class WorldReach {
  private readonly scene: Phaser.Scene;
  private readonly session: GameSession;
  private readonly director: () => WorldReachDirectorPort | null;
  private readonly ui: WorldReachDeps['ui'];
  private readonly find: FindMarker;
  private readonly pokes: PokeLayer;
  private readonly fx: ReachFx;
  private readonly unsubscribePurchase: () => void;

  constructor(scene: Phaser.Scene, deps: WorldReachDeps) {
    this.scene = scene;
    this.session = deps.session;
    this.director = deps.director;
    this.ui = deps.ui;
    this.find = new FindMarker(scene, {
      session: deps.session,
      director: deps.director,
      floatingText: deps.floatingText,
      ui: deps.ui,
      photo: deps.photo,
      cycle: deps.cycle,
      reducedMotion: deps.reducedMotion,
      collectCommand: deps.collectCommand,
    });
    this.pokes = new PokeLayer(scene, {
      session: deps.session,
      director: deps.director,
      ui: deps.ui,
      photo: deps.photo,
      cycle: deps.cycle,
      feedback: deps.feedback,
      tooltipRoot: deps.tooltipRoot,
    });
    // WP28b: built after the poke layer, so its objects sit above the poke zones and brackets in the display list.
    this.fx = new ReachFx(scene, {
      session: deps.session,
      feedback: deps.feedback,
      director: deps.director,
      photo: () => deps.photo()?.isActive() === true,
      reducedMotion: deps.reducedMotion,
      pylonPoints: deps.pylonPoints,
      setDustFrequency: deps.setDustFrequency,
    });
    this.unsubscribePurchase = deps.session.on('purchase', (e) => this.onPurchase(e));
  }

  /** Per frame, right after the fault marker: the Find marker, then the poke layer, then the reach FX (last). */
  update(deltaMs: number): void {
    this.find.update(deltaMs);
    this.pokes.update();
    this.fx.update(deltaMs);
  }

  /** Unsubscribes and destroys the reach's display objects (the containers of the marker and the layer, the brackets, the FX). */
  destroy(): void {
    this.unsubscribePurchase();
    this.pokes.destroy();
    this.find.destroy();
    this.fx.destroy();
  }

  /** Marker, layer and FX stats; meanMs is the sum of their update times (debug probe windows). */
  stats(): { find: FindMarkerStats; pokes: PokeLayerStats; fx: ReachFxStats; objects: number; meanMs: number } {
    const find = this.find.stats();
    const pokes = this.pokes.stats();
    const fx = this.fx.stats();
    return { find, pokes, fx, objects: REACH_OBJECTS, meanMs: find.meanMs + pokes.meanMs + fx.meanMs };
  }

  /**
   * The debug probe (C14). toClient maps a world point to client px (the hook's conversion). Reads only, except the switches the smokes
   * use (forceFind, setFinds, poke, pokeReset), which go through the session or the director as the game does.
   */
  debugProbe(toClient: (gx: number, gy: number) => { x: number; y: number }): ReachDebugProbe {
    return {
      findStats: () => this.find.debugStats(toClient),
      forceFind: () => this.find.forceFind(),
      setFinds: (on) => this.find.setEnabled(on),
      spliceStats: () => this.spliceRows(),
      pokeTargets: () => this.targetsClient(toClient),
      poke: (id) => this.debugPoke(id),
      pokeStats: () => this.debugPokeStats(),
      pokeReset: () => this.director()?.pokeReset(),
      reachStats: () => {
        const s = this.stats();
        return { objects: s.objects, meanMs: s.meanMs, parts: s.fx.parts };
      },
    };
  }

  /** A Splice wake (a purchase of an isSplice tech, from the tree or a dead object): one polite line, `Spliced: {name}. {effect}.`. */
  private onPurchase(e: SessionEvents['purchase']): void {
    const def = TECHNOLOGIES[e.id];
    if (!isSplice(def)) return;
    const effect = this.session.getTechView(e.id).currentEffectText;
    this.ui.worldView.announce(FIND_WORLD_TEXT.a11yPrefix, REACH_TEXT.wakeAnnounce.replace('{name}', def.name).replace('{effect}', effect));
  }

  /** The director's Splice rows (C11, debug). Empty without a director. */
  private spliceRows(): SpliceDebugRow[] {
    const d = this.director();
    if (d === null) return [];
    const rows: SpliceDebugRow[] = [];
    const n = d.spliceStats(rows);
    return rows.slice(0, n);
  }

  /** The director's poke targets, each box mapped to client px: game px, then the camera's inverse to world px, then the hook's map. */
  private targetsClient(toClient: (gx: number, gy: number) => { x: number; y: number }): PokeTargetDebug[] {
    const d = this.director();
    if (d === null) return [];
    const out: PokeTarget[] = [];
    const n = d.pokeTargets(out);
    const cam = this.scene.cameras.main;
    const res: PokeTargetDebug[] = [];
    for (let i = 0; i < n; i += 1) {
      const t = out[i];
      if (t === undefined) continue;
      const a = cam.getWorldPoint(t.x, t.y);
      const b = cam.getWorldPoint(t.x + t.w, t.y + t.h);
      const p = toClient(a.x, a.y);
      const q = toClient(b.x, b.y);
      res.push({ id: t.id, kind: t.kind, enabled: t.enabled, x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y });
    }
    return res;
  }

  /** The reaction id of a debug poke (director.poke, no ack and no sound: a probe). Null when the director ignores or is absent. */
  private debugPoke(id: PokeTargetId): string | null {
    const d = this.director();
    if (d === null) return null;
    return d.poke(id, this.scene.time.now)?.reaction ?? null;
  }

  /** The hovered target from the layer, merged with the director's last answers and unavailable windows. */
  private debugPokeStats(): PokeDebugStats {
    const dir = this.director()?.pokeStats();
    return { hover: this.pokes.stats().hover, last: dir?.last ?? {}, unavailable: dir?.unavailable ?? [] };
  }
}
