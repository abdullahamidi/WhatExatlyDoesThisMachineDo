// Test-only hook. Installed only when debugEnabled(search, DEV) and not in a packaged desktop host.
import Phaser from 'phaser';
import type { GameSession } from '../simulation';
import type { TechTree } from '../ui/techTree';
import type { ModalStack } from '../ui/modalStack';
import type { SystemMenu } from '../ui/systemMenu';
import type { SaveController } from '../persistence/saveController';
import type { GameAudio } from '../audio/gameAudio';
import type { PrestigeState, TechId } from '../data/types';
import type { GameAudioStats } from '../audio/gameAudio';
import type { CyclePreview } from '../simulation/prestige';
import type { MachineComponentId } from '../data/machineComponents';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { MACHINE_ANCHOR } from '../data/world';
import { SHOWCASE_SCENE_KEY } from '../data/showcase';
import { machineLocalToWorld, resolveAttachment } from './math/machineLayout';
import { isRestoredKey, restoredComponentIds } from './math/restoredTextures';
import { worldToClient } from './math/camera';
import type { WorldScene } from './scenes/WorldScene';
import { ShowcaseScene } from './scenes/ShowcaseScene';
import type { ShowcaseState } from './scenes/ShowcaseScene';
import type { FinaleState } from './rendering/FinaleDirector';
import type { FinaleFrame } from './math/finale';
import type { CycleTransitionState } from './rendering/CycleTransition';
import type { WorldDebugApi, WorldDebugState } from './rendering/LivingWorldDirector';
import type { FaultDebugStats } from './rendering/FaultMarker';
import { OutputTicker } from './rendering/OutputTicker';
import type { NewCycleController } from './newCycle';
import type { DemoEndDebugState } from '../ui/demoEndModel';

/** Live objects the hook reads from. Read-only views only; no mutation helpers. */
export interface DebugExtras {
  modals: ModalStack;
  systemMenu: SystemMenu;
  saveController: SaveController;
  audio: GameAudio;
  newCycle: NewCycleController;
  /** WP21: demo end state; null in the full build or before the demo module loads. */
  demo?: () => DemoEndDebugState | null;
}

/** Cycle state for smokes: controller busy flag + preview, and the transition clock (inactive without a scene). */
export interface CycleDebugState {
  busy: boolean;
  preview: CyclePreview;
  transition: CycleTransitionState;
}

declare global {
  interface Window {
    __wedtmd?: {
      session: GameSession;
      crankClientPoint(): { x: number; y: number };
      componentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number; frame: number } | null;
      techTreeOpen(): boolean;
      crankPrompt(): boolean;
      saveNow(): boolean;
      systemMenuOpen(): boolean;
      modalCount(): number;
      audioUnlocked(): boolean;
      cameraState(): { zoom: number; centerX: number; centerY: number; relX: number; relY: number };
      machineStats(): { meanMs: number; maxMs: number; components: number };
      finaleState(): (FinaleState & { frame: FinaleFrame }) | null;
      skipFinale(): void;
      finaleSeek(t: number): void;
      displayObjects(): number;
      uiStats(): { meanMs: number; maxMs: number };
      perfMarks(): { bootStartMs: number; firstFrameMs: number } | null;
      audioStats(): GameAudioStats | null;
      prestige(): PrestigeState;
      cycleState(): CycleDebugState;
      // WP23a: living world debug API (C7). Null, false, [] or no-op when the World scene or its director is missing
      worldState(): WorldDebugState | null;
      worldSay(id: string): boolean;
      worldQuiet(on: boolean): void;
      worldAdvance(ms: number): void;
      worldLogShown(logId: string): void;
      worldClock(hour: number | null): void;
      livingWorld(): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[];
      worldStats(): { objects: number; meanMs: number; parts: { cast: number; props: number; atmos: number; clocks: number; runners: number } };
      worldBubble(): { visible: boolean; rect: { x: number; y: number; w: number; h: number } | null; text: string; side: string } | null;
      // WP18: parts visibility probe, photo mode and the final-machine teaser (ShowcaseScene)
      partsVisible(): { visible: number; total: number; hidden: MachineComponentId[] } | null;
      photoMode(on: boolean, opts?: { hint?: boolean }): boolean;
      photoState(): { active: boolean; hint: boolean } | null;
      showcasePlay(opts?: { reduced?: boolean }): void;
      showcaseSeek(t: number): void;
      showcaseState(): ShowcaseState | null;
      showcaseStop(): void;
      // WP21: demo end state (phase, cap, card and teaser flags); null outside the demo build
      demoState(): DemoEndDebugState | null;
      // WP18b restored accent probes (World machine)
      restoredTextures(): { swapped: MachineComponentId[]; total: number } | null;
      textureKey(id: MachineComponentId): string | null;
      // WP16b-3: store-shot plate cap (World name plate + HUD plaque, rendering only)
      setPlateCap(maxTech: TechId | null): TechId | null;
      plateCap(): TechId | null;
      // WP22: part tier probes (World machine)
      partTiers(): Partial<Record<TechId, number>> | null;
      tierBeatsActive(): number;
      // WP24: cast runners, day clock, transitions, settle and presented props (debug only)
      worldBehaviour(): { id: string; activity: string; step: number; x: number; sinceMs: number; walking: boolean; look: string; k: number }[];
      worldBehaviourLog(): { id: string; activity: string; atMs: number; durMs: number; walked: boolean; reaction: boolean; look: string }[];
      worldBehaviourNext(actor: 'inspector' | 'dog' | 'crow' | 'girl' | 'conductor', activity: string): boolean;
      worldDay(): {
        min: number; target: number; tint: number; wind: number; weather: string; held: boolean;
        micro: { hitch: boolean; clockTwitch: boolean; lampDip: boolean; boothDip: boolean };
      } | null;
      worldDayHold(min: number | null): void;
      worldTransitions(): { id: string; startedAtMs: number | null; durMs: number; k: number }[];
      worldSettle(on: boolean): void;
      worldProps(): { id: string; frame: string; alpha: number; x: number; y: number }[];
      // WP25: machine output popups (OutputTicker). outputStats is null without a World scene or ticker.
      outputStats(): { shown: number; visible: number; y: number | null; rising: boolean; last: string | null; meanMs: number } | null;
      setOutputTicks(on: boolean): void;
      // WP27: machine faults (FaultMarker, C11). faultStats is null without a World scene or marker; client points are null
      // while the marker is hidden (anchorClient: null without an anchor). Smokes click `client`.
      faultStats(): FaultDebugStats | null;
      forceFault(): boolean;
      setFaults(on: boolean): void;
      windupStats(): { stored: number; cap: number; refill: number } | null;
      // WP27 smoke probe: the text of each line of the last gain block (FloatingText.lastBlockLines); null without a World scene.
      gainLines(): string[] | null;
    };
  }
}

export function installDebugHook(session: GameSession, game: Phaser.Game, techTree: TechTree, extras: DebugExtras): void {
  const crankClientPoint = (): { x: number; y: number } => {
    const world = machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS.handCrank));
    const cam = game.scene.getScene('World').cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    return worldToClient(
      world,
      { x: cam.worldView.x, y: cam.worldView.y },
      cam.zoom,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
    );
  };
  const componentState = (id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number; frame: number } | null => {
    const scene = game.scene.getScene<WorldScene>('World');
    return scene.getMachine()?.getComponentState(id) ?? null;
  };
  const techTreeOpen = (): boolean => techTree.isOpen();
  /** WP20: the world-space crank prompt text exists, is visible and active. */
  const crankPrompt = (): boolean => {
    const obj = game.scene.getScene('World').children.getByName('crank-prompt');
    return obj instanceof Phaser.GameObjects.Text && obj.visible && obj.active;
  };
  const saveNow = (): boolean => extras.saveController.saveNow();
  const systemMenuOpen = (): boolean => extras.systemMenu.isOpen();
  const modalCount = (): number => extras.modals.size();
  const audioUnlocked = (): boolean => extras.audio.unlocked;
  /** Camera centre is also reported relative to the machine anchor (rel = centre - MACHINE_ANCHOR). */
  const cameraState = (): { zoom: number; centerX: number; centerY: number; relX: number; relY: number } => {
    const cam = game.scene.getScene('World').cameras.main;
    const centerX = cam.midPoint.x;
    const centerY = cam.midPoint.y;
    return { zoom: cam.zoom, centerX, centerY, relX: centerX - MACHINE_ANCHOR.x, relY: centerY - MACHINE_ANCHOR.y };
  };
  /** Machine update timing (last 120 frames) for the perf probe; zeros while the machine is missing. */
  const machineStats = (): { meanMs: number; maxMs: number; components: number } => {
    const scene = game.scene.getScene<WorldScene>('World');
    return scene.getMachine()?.getUpdateStats() ?? { meanMs: 0, maxMs: 0, components: 0 };
  };
  /** Finale director state plus the last pushed frame; null before the world scene exists. */
  const finaleState = (): (FinaleState & { frame: FinaleFrame }) | null => {
    const director = game.scene.getScene<WorldScene>('World').getFinale();
    const frame = director?.getFrame() ?? null;
    if (director === null || frame === null) return null;
    return { ...director.getState(), frame };
  };
  const skipFinale = (): void => {
    game.scene.getScene<WorldScene>('World').getFinale()?.skip();
  };
  const finaleSeek = (t: number): void => {
    game.scene.getScene<WorldScene>('World').getFinale()?.seek(t);
  };
  /** Memory / prestige state (WP14): cycle, Echoes earned, owned perks. */
  const prestige = (): PrestigeState => session.prestige;
  /** New-cycle state (WP14): busy flag, what beginning now would give, and the transition clock. */
  const cycleState = (): CycleDebugState => ({
    busy: extras.newCycle.isBusy(),
    preview: extras.newCycle.preview(),
    transition: game.scene.getScene<WorldScene>('World').getCycleTransition()?.getState() ?? { active: false, tMs: 0, alpha: 0 },
  });
  /** WP23a living world (C7): the director's debug API; null without a World scene or once the director is torn down. */
  const worldDirector = (): WorldDebugApi | null => game.scene.getScene<WorldScene>('World')?.getWorldDirector()?.debug() ?? null;
  /** Scheduler, era, framing and silence state; null when the director is missing. */
  const worldState = (): WorldDebugState | null => worldDirector()?.worldState() ?? null;
  /** Forces a line (bypasses gaps and caps, not hard silence); false when refused or missing. */
  const worldSay = (id: string): boolean => worldDirector()?.worldSay(id) ?? false;
  /** Quiet on: no bubbles, no blips, no glances (figures stay). */
  const worldQuiet = (on: boolean): void => {
    worldDirector()?.worldQuiet(on);
  };
  /** Advances the scheduler clock and the play-time offset together (debug only). */
  const worldAdvance = (ms: number): void => {
    worldDirector()?.worldAdvance(ms);
  };
  /** Feeds the director's SYS LOG port: the log shows now and clears after its duration. */
  const worldLogShown = (logId: string): void => {
    worldDirector()?.worldLogShown(logId);
  };
  /** Local-hour override for the GRL-02 line; null restores the real clock. */
  const worldClock = (hour: number | null): void => {
    worldDirector()?.worldClock(hour);
  };
  /** Each living-world figure and prop: id, current frame, world x and feet y, alpha, visibility and speaking flag; [] when missing. */
  const livingWorld = (): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[] =>
    worldDirector()?.livingWorld() ?? [];
  /** Object count, mean director frame time (ms) and the mean update time of each part (ms, WP24 r2); zeros when missing. */
  const worldStats = (): { objects: number; meanMs: number; parts: { cast: number; props: number; atmos: number; clocks: number; runners: number } } =>
    worldDirector()?.worldStats() ?? { objects: 0, meanMs: 0, parts: { cast: 0, props: 0, atmos: 0, clocks: 0, runners: 0 } };
  /** The speech bubble as shown now (visibility, rect, text, side); null when missing. */
  const worldBubble = (): { visible: boolean; rect: { x: number; y: number; w: number; h: number } | null; text: string; side: string } | null =>
    worldDirector()?.worldBubble() ?? null;
  /** Display list size of the world scene (perf probe). */
  const displayObjects = (): number => game.scene.getScene('World').children.list.length;
  /** Session update + HUD + tech tree time per frame (WP15), last 120 frames; zeros while the world scene is missing. */
  const uiStats = (): { meanMs: number; maxMs: number } =>
    game.scene.getScene<WorldScene>('World')?.getUiStats() ?? { meanMs: 0, maxMs: 0 };
  /** Performance marks (WP15): boot (first line of main.ts) and the first world-scene update; null when neither exists. */
  const perfMarks = (): { bootStartMs: number; firstFrameMs: number } | null => {
    const boot = performance.getEntriesByName('wedtmd:boot')[0];
    const firstFrame = performance.getEntriesByName('wedtmd:first-frame')[0];
    if (boot === undefined && firstFrame === undefined) return null;
    return { bootStartMs: boot?.startTime ?? 0, firstFrameMs: firstFrame?.startTime ?? 0 };
  };
  /** Music and mix readout (WP15): theme, slot gains, duck, live and music voices, master peak. Zeros before the first gesture. */
  const audioStats = (): GameAudioStats | null => extras.audio.stats();
  /** Visibility probe (WP18): hidden parts and counts, as the machine shows them now; null before the world scene exists. */
  const partsVisible = (): { visible: number; total: number; hidden: MachineComponentId[] } | null =>
    game.scene.getScene<WorldScene>('World')?.getMachine()?.partsVisibility() ?? null;
  /** Photo mode (WP18): forced entry from any phase, or exit. Returns whether photo mode is active afterwards; false without a controller. */
  const photoMode = (on: boolean, opts?: { hint?: boolean }): boolean => {
    const photo = game.scene.getScene<WorldScene>('World')?.getPhoto() ?? null;
    if (photo === null) return false;
    if (on) photo.enter({ force: true, hint: opts?.hint });
    else photo.exit();
    return photo.isActive();
  };
  /** Photo mode state (WP18): active flag and hint visibility; null without a controller. */
  const photoState = (): { active: boolean; hint: boolean } | null =>
    game.scene.getScene<WorldScene>('World')?.getPhoto()?.state() ?? null;
  /** The teaser scene once ShowcaseScene.ensure registered it; null before that. */
  const showcaseScene = (): ShowcaseScene | null => {
    const scene = game.scene.keys[SHOWCASE_SCENE_KEY];
    return scene instanceof ShowcaseScene ? scene : null;
  };
  /** Starts the final-machine teaser (WP18) with the live settings; reduced: portrait from t 0, no ramps. */
  const showcasePlay = (opts?: { reduced?: boolean }): void => {
    ShowcaseScene.play(game, { settings: session.settings, reduced: opts?.reduced, sleepWorld: true });
  };
  /** Jumps the running teaser clock to t (WP18 smoke); no-op when the teaser is not running. */
  const showcaseSeek = (t: number): void => {
    showcaseScene()?.seek(t);
  };
  /** Teaser state (WP18); null when the scene is missing or not playing. */
  const showcaseState = (): ShowcaseState | null => {
    const state = showcaseScene()?.getState() ?? null;
    return state?.active === true ? state : null;
  };
  /** Stops the teaser and wakes the World when play put it to sleep (WP18). */
  const showcaseStop = (): void => {
    ShowcaseScene.stop(game);
  };
  /** Restored texture probe (WP18b): ids of the parts of restoredComponentIds() whose sprite shows a `#restored` texture, and how many parts have a variant; null without a World machine. */
  const restoredTextures = (): { swapped: MachineComponentId[]; total: number } | null => {
    const machine = game.scene.getScene<WorldScene>('World')?.getMachine() ?? null;
    if (machine === null) return null;
    const ids = restoredComponentIds();
    const swapped = ids.filter((id) => {
      const key = machine.getComponentSprite(id)?.texture.key;
      return key !== undefined && isRestoredKey(key);
    });
    return { swapped, total: ids.length };
  };
  /** Texture key of one machine part's sprite (WP18b); null without a World machine or sprite. */
  const textureKey = (id: MachineComponentId): string | null =>
    game.scene.getScene<WorldScene>('World')?.getMachine()?.getComponentSprite(id)?.texture.key ?? null;
  /** Store-shot plate cap (WP16b-3): WorldScene.setPlateCap; returns the cap in force, null without a World scene. Rendering only. */
  const setPlateCap = (maxTech: TechId | null): TechId | null =>
    game.scene.getScene<WorldScene>('World')?.setPlateCap(maxTech) ?? null;
  /** The store-shot plate cap in force (WP16b-3); null when none or without a World scene. */
  const plateCap = (): TechId | null => game.scene.getScene<WorldScene>('World')?.getPlateCap() ?? null;
  /** Displayed part tier per track with a visible host (WP22); null without a World machine. */
  const partTiers = (): Partial<Record<TechId, number>> | null =>
    game.scene.getScene<WorldScene>('World')?.getMachine()?.partTiers() ?? null;
  /** Tier-up beats in flight (WP22, D7 unit); 0 without a World machine. */
  const tierBeatsActive = (): number => game.scene.getScene<WorldScene>('World')?.getMachine()?.tierBeatsActive() ?? 0;
  /** WP24 cast: each runner's activity, clock, x, walk, look and pick index (the director's list); [] when missing. */
  const worldBehaviour = (): { id: string; activity: string; step: number; x: number; sinceMs: number; walking: boolean; look: string; k: number }[] =>
    worldDirector()?.worldBehaviour() ?? [];
  /** WP24 cast: the ring of finished activities, oldest first (debug only); [] when missing. */
  const worldBehaviourLog = (): { id: string; activity: string; atMs: number; durMs: number; walked: boolean; reaction: boolean; look: string }[] =>
    worldDirector()?.worldBehaviourLog() ?? [];
  /** WP24 debug pin (D19): the actor ends its activity and starts `activity` (the conductor at the next downbeat); false when refused or missing. */
  const worldBehaviourNext = (actor: 'inspector' | 'dog' | 'crow' | 'girl' | 'conductor', activity: string): boolean =>
    worldDirector()?.worldBehaviourNext(actor, activity) ?? false;
  /** WP24 day clock: minute, target, tint, wind, weather and the hold flag; null while the layer is hidden or missing. */
  const worldDay = (): {
    min: number; target: number; tint: number; wind: number; weather: string; held: boolean;
    micro: { hitch: boolean; clockTwitch: boolean; lampDip: boolean; boothDip: boolean };
  } | null => worldDirector()?.worldDay() ?? null;
  /** WP24 day clock (AD audit): holds the day at `min`; null releases the hold. No-op when missing. */
  const worldDayHold = (min: number | null): void => {
    worldDirector()?.worldDayHold(min);
  };
  /** WP24 transition queue: queued and running transitions; [] when settled or missing. */
  const worldTransitions = (): { id: string; startedAtMs: number | null; durMs: number; k: number }[] => worldDirector()?.worldTransitions() ?? [];
  /** WP24 settle (debug, sticky): every target lands and the fades snap; no-op when missing. */
  const worldSettle = (on: boolean): void => {
    worldDirector()?.worldSettle(on);
  };
  /** WP24 presented props: id, frame, alpha, world x and feet y of each prop row; [] when missing. */
  const worldProps = (): { id: string; frame: string; alpha: number; x: number; y: number }[] => worldDirector()?.worldProps() ?? [];
  /** WP25: output popup counters and timing; null without a World scene or ticker. */
  const outputStats = (): { shown: number; visible: number; y: number | null; rising: boolean; last: string | null; meanMs: number } | null => OutputTicker.of(game.scene.getScene('World'))?.stats() ?? null;
  /** WP25: turns the machine output popups on or off (off also hides the visible ones). */
  const setOutputTicks = (on: boolean): void => { OutputTicker.of(game.scene.getScene('World'))?.setEnabled(on); };
  /** A world point in client px: the same conversion as crankClientPoint (WP27 fault probes). */
  const worldPointClient = (world: { x: number; y: number }): { x: number; y: number } => {
    const cam = game.scene.getScene('World').cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    return worldToClient(
      world,
      { x: cam.worldView.x, y: cam.worldView.y },
      cam.zoom,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
    );
  };
  /** WP27 machine faults: the clock and the marker's stats (FaultDebugStats, built in the lazy marker chunk). Null without a World scene or marker. */
  const faultStats = (): FaultDebugStats | null =>
    game.scene.getScene<WorldScene>('World')?.getFaultMarker()?.debugStats(worldPointClient) ?? null;
  /** WP27: forces the next eligible clock step to spawn a fault (session.debugForceFault); false when refused. */
  const forceFault = (): boolean => session.debugForceFault();
  /** WP27: the marker gate (off hides a live marker and freezes the clock); no-op without a marker. */
  const setFaults = (on: boolean): void => { game.scene.getScene<WorldScene>('World')?.getFaultMarker()?.setEnabled(on); };
  /** WP27 wind-up: stored seconds, cap and refill (seconds per second). */
  const windupStats = (): { stored: number; cap: number; refill: number } | null => session.windup;
  /** WP27 smoke probe: the text of each line of the last gain block (crank or fault popup); null without a World scene. */
  const gainLines = (): string[] | null => {
    const lines = game.scene.getScene<WorldScene>('World')?.getFloatingText()?.lastBlockLines() ?? null;
    return lines === null ? null : lines.map((line) => line.text);
  };
  window.__wedtmd = {
    session,
    crankClientPoint,
    componentState,
    techTreeOpen,
    crankPrompt,
    saveNow,
    systemMenuOpen,
    modalCount,
    audioUnlocked,
    cameraState,
    machineStats,
    finaleState,
    skipFinale,
    finaleSeek,
    displayObjects,
    uiStats,
    perfMarks,
    audioStats,
    prestige,
    cycleState,
    worldState,
    worldSay,
    worldQuiet,
    worldAdvance,
    worldLogShown,
    worldClock,
    livingWorld,
    worldStats,
    worldBubble,
    partsVisible,
    photoMode,
    photoState,
    showcasePlay,
    showcaseSeek,
    showcaseState,
    showcaseStop,
    demoState: () => extras.demo?.() ?? null,
    restoredTextures,
    textureKey,
    setPlateCap,
    plateCap,
    partTiers,
    tierBeatsActive,
    worldBehaviour,
    worldBehaviourLog,
    worldBehaviourNext,
    worldDay,
    worldDayHold,
    worldTransitions,
    worldSettle,
    worldProps,
    outputStats,
    setOutputTicks,
    faultStats,
    forceFault,
    setFaults,
    windupStats,
    gainLines,
  };
}
