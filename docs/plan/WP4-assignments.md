# WP4 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP4.md` + `docs/GAME_SPEC.md` (§8, §10) + WP3 review carry-overs. Workers are `implementation-worker` agents (Haiku). No `src/simulation` change by anyone. `SAVE_VERSION` stays 1.

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** then **(2) exactly one assignment block**. Same-wave workers run in parallel. Between waves run the wave's own tests (`npx vitest run <files>`) plus `npx tsc --noEmit`.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** startup + save controller, **T2** notice rules + system logs (+ toast/log connectors), **T3** audio data + math, **T4** modal stack + reset model + `GameContext` contract | 4 |
| 2 | **T5** WebAudio synth, **T6** gameAudio controller, **T7** system menu DOM, **T8** tech tree + MachineView integration (modal stack, denied/landed signals) | 4 |
| 3 | **T9** HUD button + WorldScene gating, **T10** bootstrap + debug hook | 2 |
| 4 | EM Mode B (validate, glue), then Director smoke test | — |

Expected transient tsc errors (not a worker fault): after wave 1, `src/game/bootstrap.ts` fails typecheck because `GameContext` gained required fields (`feedback`, `modals`) and `GameCommands` gained `openSystemMenu`; after wave 2 it also fails on `createTechTree(root, session, commands)` (new signature). Only T10 fixes it. Any tsc error outside `bootstrap.ts`/`WorldScene.ts` (and files of the running wave) after a wave is a real bug.

## Deviations from `WP4.md` (deliberate)

1. **Shared modal / Esc stack** (carry-over). New pure `src/ui/modalStack.ts`. The tech tree and system menu NO LONGER own a window `keydown` Esc listener; ONE capture listener is bound once in bootstrap (`bindEscapeToStack`). Esc closes only the top-most entry. The two-step reset is its own stack layer: while the reset is armed the menu pushes `'system-reset'` above `'system-menu'`, so the first Esc only disarms and the second closes the menu. The close buttons close the whole dialog.
2. **Scene input gating generalised**: `WorldScene.ui` is `{ hud, techTree, modals }` and `input.enabled = !modals.isOpen()`. WorldScene no longer calls `techTree.isOpen()` for gating. `systemMenu` is not passed to WorldScene.
3. **Audio taps** (carry-over). `GameContext` gains `feedback: GameFeedback = { purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId> }`. The tech tree emits `purchaseDenied` on a failed buy. MachineView emits `partLanded` in the assembly `onComplete` (animated landings only, not instant settle on load or reset). Audio: heavy clunk on `partLanded` (not on `unlock`), deny buzz on `purchaseDenied`, light thunk on `'purchase'`. NO sound on `'unlock'`.
4. **`GameContext` also gains `modals: ModalStack`.** `createTechTree` becomes `createTechTree(root, ctx: GameContext)`. `SystemMenuDeps` carries `modals`.
5. **Offline / recovered toasts**: boot welcome-back and recovered toasts are shown by bootstrap from the `StartupResult` (the boot `'offline'` event fires before listeners exist). `connectOfflineNotices` covers only LATER `'offline'` events (tab-return via `update()`).
6. `SaveController` also saves on `'milestone'` (a milestone is a state change that would otherwise wait for the next autosave).
7. WP4.md T5 split: `synth.ts` (low-level voices, T5) and `gameAudio.ts` (events + loop, T6). Wave 1 holds T2's connectors (`connectOfflineNotices`, `connectSystemLog`) so wave 2 stays at 4 workers.
8. `ModalStack` has `size()` so the debug hook can report modal depth (smoke test).

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP4: persistence wiring (autosave, offline welcome-back, recovered save), SYSTEM menu (mute, save, two-step reset), procedural WebAudio sound, rare system-log toasts, a shared modal/Esc stack. WP1 (simulation), WP2 (world/HUD), WP3 (tech tree, toasts, machine growth) are finished; read neighbouring files before writing.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker. Never edit package.json, tsconfig.json, vite.config.ts, index.html, anything under src/simulation, src/data/types.ts, technologies.ts, balance.ts, world.ts, palette.ts, machineComponents.ts, src/persistence/{codec,saveManager,schema}.ts, src/utils.
- PURE files (no 'phaser', no `window`/`document`/`AudioContext`): src/data/**, src/persistence/**, src/audio/audioMath.ts, src/ui/*Rules.ts, src/ui/systemMenuModel.ts, src/ui/modalStack.ts. DOM/WebAudio files (src/ui/*.ts, src/audio/synth.ts, src/audio/gameAudio.ts) may use `document`/`window`/`AudioContext` but NEVER import Phaser. Only src/game/{entities,rendering,scenes} + debugHook/bootstrap import Phaser (`import Phaser from 'phaser';`).
- Phaser 3.90 typings do not declare create/preload/init on Scene: NEVER write `override` on them. `update(_time: number, delta: number)` DOES need `override`.
- All tuning numbers/texts live in src/data/. In TS under src/game, src/ui and src/audio NEVER write a `0x......` hex literal (use PALETTE / PALETTE_CSS). CSS files may use hex values with the comment `/* keep in sync with src/data/palette.ts */` (see src/ui/hud.css).
- Nothing in WP4 may throw into the game loop. Storage and audio failures degrade silently, with at most a `console.warn`. Text is written with `textContent`, never innerHTML.
- Rendering never mutates GameState. Allowed session mutations: `purchase` (tech tree), `setMuted`, `reset` (via SaveController only).
- No new dependencies, no npm install, no commits, no markdown/report files. No audio/image asset files.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension.
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM/Phaser), `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats. Avoid `-0`.
- Other workers edit OTHER files concurrently. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== EXISTING APIS (do not change) ===
// src/simulation (barrel '../simulation'): GameSession { state: ReadonlyGameState; rates: {perClick, perSecond}; settings: Readonly<SettingsState>; revision;
//   click(); purchase(id): PurchaseResult; update(nowMs?); applyOffline(nowMs?): OfflineReport; reset(nowMs?); setMuted(m); getAllTechViews(); getTechView(id); on(type, fn): () => void }
//   constructor GameSession({ state, settings?, now?: () => number }) — emits nothing, credits nothing. Also exports createInitialState(nowMs), DEFAULT_SETTINGS (src/simulation/state).
// events (SessionEvents): click{gained} purchase{id,level,cost} unlock{id} milestone{id} offline: OfflineReport reset{} settings: SettingsState (only when muted changes).
//   purchase emits 'purchase' then (level was 0) 'unlock'. update() delegates to applyOffline when the gap > 60 s (tab return) and emits 'offline'.
// src/data/types.ts: GameState {me, lifetimeMe, totalClicks, techLevels, lastSimTime, createdAt}, SettingsState {muted}, OfflineReport {elapsedSeconds, cappedSeconds, gained},
//   LoadResult {state, settings, status: 'new'|'loaded'|'migrated'|'recovered', error?}, PurchaseFailure 'locked'|'maxed'|'owned'|'insufficient'|'notPurchasable', TechId.
// src/data/balance.ts: OFFLINE_CAP_SECONDS (8h), AUTOSAVE_INTERVAL_MS (15000), SAVE_KEY 'wedtmd.save', SAVE_BACKUP_KEY 'wedtmd.save.corrupt', OFFLINE_REPORT_THRESHOLD_SECONDS 60.
// src/persistence/saveManager.ts: KeyValueStorage {getItem,setItem,removeItem}, MemoryStorage, browserStorage(),
//   class SaveManager(storage, key?) { load(nowMs): LoadResult (never throws; backs up corrupt raw text to SAVE_BACKUP_KEY); save(state, settings, nowMs): boolean; reset(): void }
// src/utils/format.ts: formatNumber(n, mode?), formatCost, formatRate, formatDuration(seconds) ("2h", "1h 5m", "45s"). src/utils/signal.ts: Signal<T>{emit, on(fn): () => void}, createSignal<T>().
// src/data/notifications.ts: ToastTone 'info'|'system'|'milestone', ToastMessage {key,title,body: string|null,tone,durationMs}, TOAST_CONFIG {maxVisible:3,durationMs:3200,milestoneDurationMs:6500,fadeMs:250}, FIRST_CLICK_MESSAGE, INSTALL_LINES.
// src/ui/notificationRules.ts: messageFor(NotificationEvent). src/ui/toasts.ts: Toasts {show(msg); clear(); destroy()}, createToasts(root, config?), connectNotifications(session, toasts): () => void.
// src/ui/techTree.ts: TechTree {open; close; isOpen; update; destroy}. Currently owns a window keydown Esc listener and a backdrop-click close.
// src/game/context.ts (current): GameCommands {refocus; openTechTree: Signal<void>}, GameContext {session; commands}.
// src/game/entities/MachineView.ts: update(deltaMs), getComponentState(id), shake(); assembly tween onComplete = settle + spawnPuff + shake.
// z-index: tech overlay 100, toasts 200. HUD CSS variables on `.hud-panel, .hud-buttons` (see src/ui/hud.css; copy the variable block for new overlays).

=== NEW CONTRACTS (spelled out so parallel workers integrate) ===
// ---- src/ui/modalStack.ts (T4) — PURE ----
export interface ModalStack {
  /** Adds a dialog on top (an existing id is moved to the top and its close fn replaced). Returns an idempotent remover. */
  push(id: string, close: () => void): () => void;
  /** Removes without calling close. No-op when absent. */
  remove(id: string): void;
  has(id: string): boolean;
  isOpen(): boolean;                 // size() > 0
  size(): number;
  topId(): string | null;
  /** Calls close() of the TOP entry only (try/catch -> console.error), then removes that entry if it is still on the stack. Returns false when empty. */
  closeTop(): boolean;
  /** Fires only when isOpen() flips. Returns unsubscribe. */
  onChange(fn: (open: boolean) => void): () => void;
}
export function createModalStack(): ModalStack;
export interface EscapeEventLike { key: string; preventDefault(): void; stopPropagation(): void }
export interface EscapeTarget {
  addEventListener(type: 'keydown', listener: (e: EscapeEventLike) => void, capture?: boolean): void;
  removeEventListener(type: 'keydown', listener: (e: EscapeEventLike) => void, capture?: boolean): void;
}
/** One capture-phase keydown listener: Escape while stack.isOpen() -> preventDefault + stopPropagation + closeTop(). Returns the disposer. */
export function bindEscapeToStack(stack: ModalStack, target: EscapeTarget): () => void;
// stack ids used in the game: 'tech-tree', 'system-menu', 'system-reset'.

// ---- src/game/context.ts (T4) ----
import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import type { ModalStack } from '../ui/modalStack';
export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void>; openSystemMenu: Signal<void> }
export interface GameFeedback { purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId> }
export interface GameContext { session: GameSession; commands: GameCommands; feedback: GameFeedback; modals: ModalStack }

// ---- src/persistence (T1) ----
// startup.ts
export interface StartupResult { session: GameSession; load: LoadResult; offline: OfflineReport; saved: boolean }
export function startSession(saveManager: SaveManager, nowMs: number, clock?: () => number): StartupResult;
//   load(nowMs) -> new GameSession({state, settings, now: clock ?? (() => Date.now())}) -> applyOffline(nowMs) -> saveManager.save(state, settings, nowMs) -> return
// saveController.ts
export interface Scheduler { setInterval(fn: () => void, ms: number): unknown; clearInterval(h: unknown): void }
export interface SaveController {
  saveNow(): boolean;          // saveManager.save(session.state, session.settings, now()); never throws
  resetProgress(): void;       // saveManager.reset(); session.reset(now()); saveNow()
  start(): void;               // interval AUTOSAVE_INTERVAL_MS (or intervalMs) + subscribe 'purchase','milestone','settings' -> saveNow (idempotent)
  dispose(): void;             // clears interval + unsubscribes
  readonly lastSaveOk: boolean | null;
}
export function createSaveController(o: { session: GameSession; saveManager: SaveManager; now?: () => number;
  scheduler?: Scheduler; intervalMs?: number }): SaveController;   // default scheduler = globalThis setInterval/clearInterval

// ---- src/data/notifications.ts + src/ui/notificationRules.ts (T2) ----
// data adds: TOAST_CONFIG.welcomeDurationMs = 7000 (keep existing keys), WELCOME_MIN_ELAPSED_SECONDS = 60, WELCOME_TEXT { title: 'WELCOME BACK' }, RECOVERED_TEXT { title: 'MEMORY CORRUPTED'; body: 'Factory state restored.' }
export function welcomeBackMessage(r: OfflineReport): ToastMessage | null;
//   null if !(r.gained > 0) or !(r.elapsedSeconds >= WELCOME_MIN_ELAPSED_SECONDS). key 'welcome-back', tone 'system', durationMs TOAST_CONFIG.welcomeDurationMs, title 'WELCOME BACK',
//   body `Unattended for ${formatDuration(elapsedSeconds)}. +${formatNumber(gained)} ME accumulated.` + ` Buffer capped at ${formatDuration(cappedSeconds)}.` only when elapsedSeconds > cappedSeconds
export function recoveredMessage(): ToastMessage;   // key 'save-recovered', tone 'system', title/body from RECOVERED_TEXT, durationMs TOAST_CONFIG.welcomeDurationMs
// ---- src/data/systemLogs.ts + src/ui/systemLogRules.ts (T2) ----
export type SystemLogTrigger = { kind: 'lifetimeMe'; atLeast: number } | { kind: 'playSeconds'; atLeast: number };   // playSeconds = (nowMs - createdAt)/1000
export interface SystemLogEntry { id: string; text: string; trigger: SystemLogTrigger }
export const SYSTEM_LOGS: readonly SystemLogEntry[];   // 8-10 entries, unique ids, cryptic spec-§10 tone, <= 60 chars, no duplicate of INSTALL_LINES / FIRST_CLICK_MESSAGE
export const SYSTEM_LOG_CONFIG = { minGapMs: 120000, checkIntervalMs: 5000, durationMs: 5000 } as const;
export interface SystemLogTracker { readonly shown: ReadonlySet<string>; readonly lastShownAt: number }
export function seedTracker(s: { lifetimeMe: number; createdAt: number }, nowMs: number): SystemLogTracker;   // already-met -> shown; lastShownAt = nowMs
export function nextSystemLog(t: SystemLogTracker, s: { lifetimeMe: number; createdAt: number }, nowMs: number,
  cfg?: { minGapMs: number }): { entry: SystemLogEntry; tracker: SystemLogTracker } | null;   // <= 1 per call, table order, null inside minGap
export function systemLogMessage(e: SystemLogEntry): ToastMessage;   // key `log:${id}`, tone 'system', title 'SYS LOG', body e.text, durationMs SYSTEM_LOG_CONFIG.durationMs
// ---- src/ui/toasts.ts (T2) addition ----
export function connectOfflineNotices(session: GameSession, toasts: Toasts): () => void;   // every 'offline' event -> welcomeBackMessage(report) -> toasts.show when non-null
// ---- src/ui/systemLog.ts (T2) ----
export function connectSystemLog(session: GameSession, toasts: Toasts, now?: () => number): () => void;   // seeds on start; window.setInterval checkIntervalMs; 'reset' reseeds; disposer clears both

// ---- src/data/audio.ts + src/audio/audioMath.ts (T3) ----
export const AUDIO: {
  masterGain: number; rampSeconds: number; updateIntervalMs: number; lookaheadSeconds: number;
  crank:    { hz: number; ticks: number; tickGapMs: number; decayMs: number; gain: number };
  purchase: { hz: number; decayMs: number; gain: number };                                    // light thunk on 'purchase'
  clunk:    { hz: number; decayMs: number; noiseGain: number; gain: number };                 // heavy, on partLanded
  deny:     { hz: number; ms: number; count: number; gapMs: number; gain: number };           // low buzz on purchaseDenied
  sting:    { notesHz: readonly number[]; noteMs: number; gain: number };                     // 3 notes on 'milestone'
  hum:      { minHz: number; maxHz: number; minGain: number; maxGain: number; refPerSecond: number; maxPerSecond: number };
  gearTick: { minPerSecond: number; maxPerSecond: number; gain: number; hz: number; decayMs: number };
  wind:     { gain: number; lowpassHz: number; gustPeriodS: number; gustDepth: number };
};  // declared `as const`
export function activityLevel(perSecond: number, ref: number, max: number): number;   // log(1+ps/ref)/log(1+max/ref) clamped [0,1]; <=0 / NaN -> 0
export function humFrequency(perSecond: number, cfg?: typeof AUDIO.hum): number;      // lerp(minHz,maxHz,level), always within range
export function humGain(perSecond: number, cfg?: typeof AUDIO.hum): number;           // 0 when ps <= 0 or NaN, else lerp(minGain,maxGain,level)
export function gearTickRate(perSecond: number, cfg?: typeof AUDIO.gearTick): number; // ticks/s: 0 when ps <= 0 or NaN, else in [minPerSecond,maxPerSecond], monotonic
export function masterTarget(muted: boolean, unlocked: boolean, base?: number): number; // 0 if muted or locked, else base (default AUDIO.masterGain)

// ---- src/audio/synth.ts (T5) — WebAudio voices, no event logic ----
export interface Synth {
  setMaster(target: number, rampSeconds: number): void;
  playCrank(): void;                  // AUDIO.crank ratchet: `ticks` short bursts, `tickGapMs` apart
  playPurchase(): void;               // AUDIO.purchase light thunk
  playClunk(): void;                  // AUDIO.clunk sine thump + noise burst (part landed)
  playDeny(): void;                   // AUDIO.deny low buzz, `count` pulses
  playSting(): void;                  // AUDIO.sting 3 notes
  setHum(hz: number, gain: number): void;                       // one persistent oscillator, ramped; gain 0 = silent
  scheduleGearTicks(ticksPerSecond: number): void;              // lookahead scheduling inside the synth (own nextTickTime, AUDIO.lookaheadSeconds); 0 clears/resets the schedule
  setWind(on: boolean): void;         // looped noise -> lowpass(AUDIO.wind.lowpassHz) -> gain; slow gust LFO on the gain
  suspend(): void;                    // context.suspend().catch(noop)
  resume(): void;                     // context.resume().catch(noop)
  close(): void;                      // stop nodes, context.close().catch(noop); further calls are no-ops
}
export function createSynth(context: AudioContext): Synth;    // never throws (wrap in try/catch, degrade to no-op)

// ---- src/audio/gameAudio.ts (T6) ----
import type { GameFeedback } from '../game/context';
export interface GameAudio { readonly unlocked: boolean; dispose(): void }
export function createGameAudio(session: GameSession, feedback: GameFeedback, target?: Window): GameAudio;   // never throws; default target = window

// ---- src/data/systemMenu.ts + src/ui/systemMenuModel.ts (T4) — PURE ----
export const SYSTEM_MENU_CONFIG = { resetArmMs: 5000, saveFeedbackMs: 1600 } as const;
export type ResetState = { stage: 'idle' } | { stage: 'armed'; armedAt: number };
export function reduceReset(s: ResetState, ev: { type: 'press' | 'cancel' | 'tick'; nowMs: number }, armMs?: number): { state: ResetState; execute: boolean };
//   idle+press -> armed(armedAt = nowMs), execute false; armed+press with nowMs - armedAt <  armMs -> idle, execute TRUE; armed+press expired (>= armMs) -> armed(armedAt = nowMs) (re-arm, execute FALSE);
//   armed+tick expired (>= armMs) -> idle; armed+tick not expired -> unchanged; cancel -> idle; idle+tick/cancel -> idle; execute is true ONLY for the confirming press
export function muteLabel(muted: boolean): string;          // 'AUDIO: ON' | 'AUDIO: OFF'
export function resetLabel(s: ResetState): string;          // 'RESET PROGRESS' | 'CONFIRM: ERASE ALL?'
export function saveFeedbackLabel(ok: boolean): string;     // 'STATE WRITTEN' | 'WRITE FAILED'

// ---- src/ui/systemMenu.ts (T7) ----
import type { ModalStack } from './modalStack';
export interface SystemMenuDeps { isMuted(): boolean; setMuted(m: boolean): void; saveNow(): boolean; resetProgress(): void; modals: ModalStack }
export interface SystemMenu { open(): void; close(): void; toggle(): void; isOpen(): boolean; destroy(): void }
export function createSystemMenu(root: HTMLElement, deps: SystemMenuDeps): SystemMenu;
//   ids: #system-menu (overlay), #sys-mute, #sys-save, #sys-reset, #sys-reset-cancel, #sys-close, #sys-feedback; stack ids 'system-menu' and 'system-reset'

// ---- src/ui/techTree.ts (T8) ----
export function createTechTree(root: HTMLElement, ctx: GameContext): TechTree;   // ctx supplies session, commands.openTechTree, modals, feedback.purchaseDenied

// ---- src/game/scenes/WorldScene.ts (T9) ----
//   constructor(ctx: GameContext, ui: { hud: Hud; techTree: TechTree; modals: ModalStack })

// ---- src/game/debugHook.ts (T10) ----
export interface DebugExtras { modals: ModalStack; systemMenu: SystemMenu; saveController: SaveController; audio: GameAudio }
export function installDebugHook(session: GameSession, game: Phaser.Game, techTree: TechTree, extras: DebugExtras): void;
//   window.__wedtmd keeps: session, crankClientPoint, componentState, techTreeOpen; adds: saveNow(): boolean, systemMenuOpen(): boolean, modalCount(): number, audioUnlocked(): boolean
```

---

# WAVE 1 (parallel: T1, T2, T3, T4 — disjoint files, all pure except T2 connectors)

## T1 — Startup + save controller (pure)

**wave**: 1. **files_owned**: `src/persistence/startup.ts`, `src/persistence/saveController.ts`, `src/persistence/startup.test.ts`, `src/persistence/saveController.test.ts`

**objective**: Boot a `GameSession` from storage with offline progress applied exactly once, and a controller that autosaves and resets.

**context**: read `src/persistence/saveManager.ts`, `codec.ts`, `persistence.test.ts` (patterns for building saves), `src/simulation/GameSession.ts`. Contracts above (`startSession`, `SaveController`). Imports: `GameSession` from `../simulation`; `AUTOSAVE_INTERVAL_MS` from `../data/balance`; types from `../data/types`. No `window`/`document` (default scheduler uses `globalThis.setInterval`/`globalThis.clearInterval`).
- `startSession`: `const load = saveManager.load(nowMs)`; session built with `load.state`, `load.settings`, `now: clock`; `offline = session.applyOffline(nowMs)`; `saved = saveManager.save(session.state, session.settings, nowMs)`.
- `createSaveController`: `now` defaults `Date.now`; `saveNow()` stores `lastSaveOk` and returns it, wrapped in try/catch (false on throw); `start()` is idempotent (no double interval or double subscriptions); `dispose()` is idempotent and `start()` after `dispose()` works again.

**constraints**: pure; no Phaser/DOM; no `any`; do not change `SaveManager`.

**acceptance** (tests, use `MemoryStorage` and a fake scheduler that records `fn`, `ms` and lets the test call `fn`):
- (a) empty storage -> `load.status === 'new'`, `offline.gained === 0`, `saved === true`, `SAVE_KEY` is set.
- (b) save a state with `wornMotor` owned and `lastSimTime` 2 h before `now` (`computeRates` from `../simulation/production/rates` gives perSecond; build the state by spreading `createInitialState(t0)` with `techLevels`) -> `offline.gained` is perSecond x 7200 (`toBeCloseTo(..., 6)`). A second `startSession` on the same storage 1 s later -> gained is perSecond x 1: no double award.
- (c) a save 10 h back with a motor -> `gained` capped (`cappedSeconds === OFFLINE_CAP_SECONDS`, `elapsedSeconds` is 36000).
- (d) `'{broken'` in storage -> `load.status === 'recovered'`, fresh state, `SAVE_BACKUP_KEY` holds `'{broken'`.
- (e) a save with `muted: true` -> `session.settings.muted === true` and the next save keeps it.
- Controller: `start()` registers one interval at `AUTOSAVE_INTERVAL_MS` and an interval tick writes a save; a `'purchase'` event (use `session.purchase` with a state that has enough ME), a `'milestone'` event and `setMuted(true)` each write a save; double `start()` registers one interval; `resetProgress()` leaves storage holding a fresh state (`me === 0`, only `handCrank` owned) with `muted` kept, and the session emits `'reset'`; `dispose()` clears the interval and later events do not save; a storage whose `setItem` throws -> `saveNow()` is false, `lastSaveOk` is false, nothing throws.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/persistence/startup.ts src/persistence/saveController.ts && echo FAIL || echo OK
```

## T2 — Notice rules, system logs and connectors

**wave**: 1. **files_owned**: `src/data/notifications.ts`, `src/data/systemLogs.ts`, `src/ui/notificationRules.ts`, `src/ui/systemLogRules.ts`, `src/ui/notificationRules.test.ts`, `src/ui/systemLogRules.test.ts`, `src/ui/toasts.ts`, `src/ui/systemLog.ts`

**objective**: Welcome-back and recovered messages, the rare system-log table with its pure scheduler, and the two DOM-side connectors.

**context**: contracts above. Keep every existing export and behaviour of `notifications.ts`, `notificationRules.ts` and `toasts.ts` (`connectNotifications`, `createToasts`, `clear`).
- `notifications.ts` only gains the new constants (no logic). `notificationRules.ts` gains `welcomeBackMessage` and `recoveredMessage` (import `formatDuration`, `formatNumber` from `../utils/format`).
- `systemLogs.ts`: 8-10 entries. Cryptic, §10 tone (see `docs/GAME_SPEC.md` §10), each <= 60 chars, thresholds positive, ordered by increasing trigger value within each kind; mix `playSeconds` (e.g. 120 to 2400) and `lifetimeMe` (small to large; read `src/data/technologies.ts` for the economy scale). No emojis. Tone example: `Log 0041: observer count unchanged.` Do not copy INSTALL_LINES.
- `nextSystemLog(t, s, nowMs, cfg = { minGapMs: SYSTEM_LOG_CONFIG.minGapMs })`: if `nowMs - t.lastShownAt < cfg.minGapMs` -> null; else the FIRST entry in table order not in `t.shown` whose trigger is met; returns the entry and a NEW tracker (`shown` with the id added, `lastShownAt = nowMs`); never mutate the input tracker. `seedTracker`: every entry whose trigger is already met goes into `shown`, `lastShownAt = nowMs`.
- `toasts.ts`: add `connectOfflineNotices` (import `welcomeBackMessage`). Existing code untouched.
- `systemLog.ts` (DOM-side; imports `type Toasts` from `./toasts`, `type GameSession` from `../simulation`): `let tracker = seedTracker(session.state, now())`; `window.setInterval(check, SYSTEM_LOG_CONFIG.checkIntervalMs)` where `check` calls `nextSystemLog(tracker, session.state, now())` and, if non-null, stores the tracker and calls `toasts.show(systemLogMessage(entry))`; `session.on('reset', () => { tracker = seedTracker(session.state, now()); })`; the returned disposer clears the interval and unsubscribes. `now` defaults to `Date.now`.

**constraints**: `notifications.ts`, `notificationRules.ts`, `systemLogs.ts`, `systemLogRules.ts` are pure. `systemLog.ts` and `toasts.ts` never import Phaser. `textContent` only.

**acceptance** (tests):
- `welcomeBackMessage`: gained 0, NaN or negative -> null; elapsed 59 -> null; elapsed 60 with gained 5 -> key `welcome-back`, tone `system`, title `WELCOME BACK`, `durationMs === TOAST_CONFIG.welcomeDurationMs`; body contains `formatDuration(elapsed)` and `formatNumber(gained)`; elapsed 7200 / capped 28800 -> no `capped` text; elapsed 36000 / capped 28800 -> body contains `capped at 8h`. Existing WP3 rule tests stay green.
- `recoveredMessage`: key `save-recovered`, tone `system`, non-empty title and body.
- `SYSTEM_LOGS`: 8-10 entries, unique ids, each text non-empty and <= 60 chars, positive thresholds, no text equal to any `INSTALL_LINES` value or `FIRST_CLICK_MESSAGE`.
- `seedTracker` puts already-met entries into `shown` and sets `lastShownAt`; `nextSystemLog` returns null inside the minGap, exactly one entry after the gap (table order), never the same entry twice in a loop of 50 calls spaced by `minGapMs`, and does not mutate its input; `systemLogMessage` key `log:<id>`, title `SYS LOG`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/notificationRules.test.ts src/ui/systemLogRules.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/notifications.ts src/data/systemLogs.ts src/ui/notificationRules.ts src/ui/systemLogRules.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser|innerHTML" src/ui/toasts.ts src/ui/systemLog.ts && echo FAIL || echo OK
```

## T3 — Audio data + parameter math (pure)

**wave**: 1. **files_owned**: `src/data/audio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`

**objective**: All sound tuning in data plus pure, clamped mapping functions from ME/s to hum and gear-tick parameters.

**context**: contract above. Suggested starting values (tune freely, keep the shape): `masterGain 0.3, rampSeconds 0.08, updateIntervalMs 200, lookaheadSeconds 0.15`; `crank {hz 180, ticks 3, tickGapMs 28, decayMs 45, gain 0.5}`; `purchase {hz 140, decayMs 120, gain 0.45}`; `clunk {hz 70, decayMs 260, noiseGain 0.5, gain 0.9}`; `deny {hz 90, ms 90, count 2, gapMs 70, gain 0.4}`; `sting {notesHz [220, 277, 330], noteMs 160, gain 0.35}`; `hum {minHz 48, maxHz 96, minGain 0.04, maxGain 0.16, refPerSecond 1, maxPerSecond 5000}`; `gearTick {minPerSecond 1.5, maxPerSecond 14, gain 0.12, hz 240, decayMs 30}`; `wind {gain 0.05, lowpassHz 420, gustPeriodS 9, gustDepth 0.6}`. Whole object `as const`, one-line comment per group. Math: `level = clamp01(log(1+ps/ref) / log(1+max/ref))`; non-finite / <= 0 / NaN -> 0; `Infinity` -> 1. `humFrequency` at 0 ME/s returns `minHz`. `gearTickRate` = `min + (max-min)*level` when `ps > 0`. Normalise `-0` to `0`.

**constraints**: pure; no DOM/WebAudio types; no `any`; each function has a one-line formula comment.

**acceptance** (tests): for inputs 0, -5, NaN, Infinity, 1e12, 0.001 and 1 all outputs are finite and in range; `activityLevel` monotonic over an increasing list; `humGain(0) === 0` and `gearTickRate(0) === 0`; `humFrequency(0)` equals `minHz`, `humFrequency(1e12)` equals `maxHz`; `gearTickRate(0.001) >= gearTick.minPerSecond`; `masterTarget(true, true) === 0`, `(false, false) === 0`, `(false, true) === AUDIO.masterGain`, custom `base` honoured; `AUDIO.sting.notesHz.length === 3`; every `AUDIO` numeric leaf is finite and `>= 0`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio/audioMath.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document|AudioContext)\b" src/data/audio.ts src/audio/audioMath.ts && echo FAIL || echo OK
```

## T4 — Modal stack, reset model, `GameContext` contract

**wave**: 1. **files_owned**: `src/ui/modalStack.ts`, `src/ui/modalStack.test.ts`, `src/data/systemMenu.ts`, `src/ui/systemMenuModel.ts`, `src/ui/systemMenuModel.test.ts`, `src/game/context.ts`

**objective**: The shared Esc/modal stack, the pure two-step reset reducer and labels, and the new `GameContext` shape.

**context**: contracts above (`ModalStack`, `createModalStack`, `bindEscapeToStack`, `GameContext` block, `reduceReset`, labels).
- `modalStack.ts`: an ordered array of `{ id, close }`. `push` of an existing id removes it first, then appends (moves to top, replaces `close`). `closeTop` takes the last entry, calls `close()` in try/catch (`console.error` on throw), then removes that id if it is still present. `onChange` listeners are called only when `isOpen()` flips; a throwing listener is caught. The remover returned by `push` removes by id only if the entry still has the same `close` function (a stale remover must not remove a re-pushed entry).
- `bindEscapeToStack`: listener `(e) => { if (e.key === 'Escape' && stack.isOpen()) { e.preventDefault(); e.stopPropagation(); stack.closeTop(); } }`, registered with `capture = true`; the disposer removes with the same arguments. With an empty stack it must not call `preventDefault`.
- `context.ts`: replace the file with the contract block (types only, `import type`). Grep `src` for any other construction of a `GameContext` / `GameCommands` object literal and report it (only `bootstrap.ts` is expected; do not edit it).
- `src/data/systemMenu.ts`: `SYSTEM_MENU_CONFIG` as contract plus the label strings used by the model (`MUTE_LABELS`, `RESET_LABELS`, `SAVE_LABELS`), so the model holds no literals.

**constraints**: pure; no DOM/Phaser; no `any`; `systemMenuModel.ts` imports only from `../data/systemMenu`.

**acceptance** (tests):
- Stack: empty `closeTop()` is false; push a, b -> `topId() === 'b'`, `size() === 2`; `closeTop()` calls only b's close and removes it; if close does not remove itself the entry is still removed; if close throws the stack stays consistent; re-push of `a` moves it to the top; `remove` of an unknown id is a no-op; the remover is idempotent and a stale remover does nothing; `onChange` fires once for 0 -> 1, nothing for 1 -> 2, once for 1 -> 0, and unsubscribe works.
- `bindEscapeToStack` with a fake target (stores the listener and its `capture` arg): Escape with an open stack -> top closed, `preventDefault` and `stopPropagation` called, capture is true; Escape with an empty stack -> nothing called; other keys ignored; disposer removes the same listener; two stacked dialogs need two Escape presses.
- `reduceReset`: arm (idle+press), confirm (armed+press at +1000 -> `execute` true and idle), expiry by tick (+5000 -> idle, `execute` false), cancel, double press after expiry (re-arms, `execute` false), `execute` never true on any other transition, custom `armMs` honoured; input state not mutated. Labels: exact strings `AUDIO: ON`, `AUDIO: OFF`, `RESET PROGRESS`, `CONFIRM: ERASE ALL?`, `STATE WRITTEN`, `WRITE FAILED`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/modalStack.test.ts src/ui/systemMenuModel.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/ui/modalStack.ts src/ui/systemMenuModel.ts src/data/systemMenu.ts && echo FAIL || echo OK
```

---

# WAVE 2 (parallel: T5, T6, T7, T8 — disjoint files; wave 1 done)

## T5 — WebAudio synth

**wave**: 2. **files_owned**: `src/audio/synth.ts`

**objective**: Low-level procedural voices behind the `Synth` interface. No event logic, no state reading.

**context**: contract `Synth` above; tuning from `AUDIO` (`../data/audio`). TS lib `dom` provides `AudioContext`, `GainNode`, etc.
- Graph: `master = context.createGain()` (starts at 0) -> `context.destination`. All voices connect to `master`.
- One-shots: create nodes, schedule with `context.currentTime`, `gain.gain.setValueAtTime` then `exponentialRampToValueAtTime(0.0001, t + decay)`, `osc.stop(t + decay + 0.05)`. Disconnect nodes in `osc.onended` so nothing leaks.
- `playCrank`: `ticks` short triangle/square bursts at `hz`, spaced `tickGapMs`. `playPurchase`: sine thunk at `hz` with a quick pitch drop. `playClunk`: sine at `hz` plus a white-noise burst (buffer of random samples, `noiseGain`), both decaying over `decayMs`. `playDeny`: `count` sawtooth pulses of `ms`, `gapMs` apart at `hz`. `playSting`: 3 sine/triangle notes `noteMs` apart.
- `setHum`: one persistent oscillator (sawtooth, through a lowpass at ~2x hz) with its own gain; `frequency.setTargetAtTime` / `gain.setTargetAtTime` (time constant 0.1 s). Start the oscillator lazily on the first call.
- `scheduleGearTicks(rate)`: if `rate <= 0` or non-finite set `nextTickTime = 0` and return. Else `const now = context.currentTime`; if `nextTickTime < now` set it to `now`; while `nextTickTime < now + AUDIO.lookaheadSeconds` schedule one short tick (`gearTick.hz`, `decayMs`, `gain`) at `nextTickTime` and add `1 / rate`. Cap the loop at 8 iterations per call.
- `setWind(on)`: build once: looped noise buffer source (2 s) -> lowpass `wind.lowpassHz` -> gain; a slow `OscillatorNode` LFO (`1 / gustPeriodS` Hz) through a gain of `wind.gain * gustDepth` into the wind gain's `gain` AudioParam, base `wind.gain`. On/off by ramping the wind gain (0 when off).
- `setMaster(target, ramp)`: `master.gain.cancelScheduledValues(now)`; `setValueAtTime(current)`; `linearRampToValueAtTime(target, now + ramp)`.
- `suspend/resume/close`: guarded, rejected promises caught. After `close()` every method returns immediately.
- Every public method body is wrapped in try/catch with `console.warn` at most once per method (keep a `warned` set), so a thrown WebAudio error never escapes.

**constraints**: no Phaser; no `any`; no asset files; no `0x` literals; no per-frame allocation outside the one-shot voices; tuning numbers come from `AUDIO` (structural constants such as noise buffer length or filter ratios may be named `const`s at the top of the file).

**acceptance**: typecheck clean; reasoning check: `createSynth(ctx)` makes no sound by itself; any method after `close()` is a no-op; `scheduleGearTicks(0)` schedules nothing; hum gain 0 is silent; the master starts at 0 so nothing is audible before `setMaster`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|\bany\b|0x[0-9a-fA-F]{6}" src/audio/synth.ts && echo FAIL || echo OK
```

## T6 — gameAudio controller

**wave**: 2. **files_owned**: `src/audio/gameAudio.ts`

**objective**: Gesture-unlocked audio that listens to the session and the feedback signals and drives the synth.

**context**: contracts `GameAudio`, `Synth` (import `createSynth`, `type Synth` from `./synth`), `GameFeedback` (type import from `../game/context`), `AUDIO` and the `audioMath` functions. NO Phaser.
- `createGameAudio(session, feedback, target = window)`: registers ONE `pointerdown` and ONE `keydown` listener on `target` (capture true) that call `unlock()` once and then remove both.
- `unlock()`: `const Ctor = target.AudioContext ?? (target as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext`; if missing or `new Ctor()` throws, mark failed and stay a permanent no-op (`unlocked` stays false). Else create the synth, `unlocked = true`, `synth.setMaster(masterTarget(session.settings.muted, true), AUDIO.rampSeconds)`, `synth.setWind(!muted)`, `synth.resume()`, start the update timer, subscribe the events.
- Event subscriptions (only after unlock; keep every unsubscribe): `session.on('click')` -> `playCrank`; `session.on('purchase')` -> `playPurchase`; `session.on('milestone')` -> `playSting`; `feedback.partLanded.on` -> `playClunk`; `feedback.purchaseDenied.on` -> `playDeny`; `session.on('settings')` -> `setMaster(masterTarget(settings.muted, true), AUDIO.rampSeconds)` and `setWind(!settings.muted)` (and `resume()` when unmuted and the document is visible). NO handler for `'unlock'`. While muted the one-shot handlers return early.
- Update loop: `window.setInterval` every `AUDIO.updateIntervalMs`: `ps = session.rates.perSecond`; muted -> `setHum(0, 0)` and `scheduleGearTicks(0)`; else `setHum(humFrequency(ps), humGain(ps))` and `scheduleGearTicks(gearTickRate(ps))`.
- Visibility: a `visibilitychange` listener on `target.document`: hidden -> `synth.suspend()`; visible and not muted -> `synth.resume()`. Removed on dispose.
- `dispose()`: removes every listener (pending unlock listeners, events, signals, visibility), clears the timer, `synth.close()`; idempotent. `unlocked` is a getter.
- Every handler body wrapped in try/catch with `console.warn` (never throw into session/signal emit).

**constraints**: no Phaser; no `any` (use the typed optional-property cast for `webkitAudioContext`); no asset files; no timers or listeners left after `dispose()`; never constructs an `AudioContext` before a gesture.

**acceptance**: typecheck clean; reasoning check: constructing it creates no `AudioContext`; the first `pointerdown` unlocks once and the listeners are gone; with no `AudioContext` constructor the game keeps working silently; muting sets the master target to 0 and stops hum/ticks; dispose leaves no listener.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|\bany\b|0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts && echo FAIL || echo OK
```

## T7 — System menu DOM

**wave**: 2. **files_owned**: `src/ui/systemMenu.ts`, `src/ui/systemMenu.css`

**objective**: Terminal-style SYSTEM modal: mute toggle, manual save, two-step reset, using the shared modal stack.

**context**: contract `SystemMenu`/`SystemMenuDeps` above. Imports: `./systemMenu.css`; `reduceReset`, `muteLabel`, `resetLabel`, `saveFeedbackLabel` and types from `./systemMenuModel`; `SYSTEM_MENU_CONFIG` from `../data/systemMenu`; `type ModalStack` from `./modalStack`. NO Phaser. Follow `src/ui/techTree.ts` for DOM patterns (a `createElement` helper, `role=dialog`, `aria-modal`, focus restore).
DOM (built once, appended to `root`):
```
#system-menu[role=dialog][aria-modal=true][aria-labelledby=sys-title]   (class is-open while open)
  #system-panel
    h2#sys-title "SYSTEM"
    button#sys-mute      (text = muteLabel(deps.isMuted()))
    button#sys-save      (text "SAVE STATE"; after click shows saveFeedbackLabel(ok) in #sys-feedback for SYSTEM_MENU_CONFIG.saveFeedbackMs)
    button#sys-reset     (text = resetLabel(state))
    button#sys-reset-cancel  (hidden unless armed; text "CANCEL")
    div#sys-feedback[aria-live=polite]
    button#sys-close "CLOSE [ESC]"
```
Behaviour:
- `open()`: if open return; remember `document.activeElement`; add `is-open`; `modals.push('system-menu', close)`; refresh the mute label; focus `#sys-close`. `close()`: if closed return; disarm the reset (see below), clear feedback and timers, remove `is-open`, `modals.remove('system-menu')`, restore focus. `toggle()`, `isOpen()`. NO window keydown listener (Esc is handled by the shared stack).
- Backdrop click (`event.target === overlay`) closes the menu.
- Mute: click -> `deps.setMuted(!deps.isMuted())` then refresh the label.
- Save: click -> `ok = deps.saveNow()`; feedback text `saveFeedbackLabel(ok)`; a timer (`window.setTimeout`, previous one cleared) clears it after `saveFeedbackMs`.
- Reset: keep `resetState` (initial `{ stage: 'idle' }`). Button click -> `r = reduceReset(resetState, { type: 'press', nowMs: Date.now() })`; apply `r.state`; `syncResetUi()`; if `r.execute` -> `deps.resetProgress()` then `close()` (which disarms). `syncResetUi()`: set the reset button text via `resetLabel`, show/hide `#sys-reset-cancel`, toggle class `is-armed`; when armed push `'system-reset'` on the stack with close fn `cancelReset` (so Esc disarms only) and start an expiry timer (`window.setTimeout(armMs)` that dispatches `{ type: 'tick' }`); when idle remove `'system-reset'` from the stack and clear the expiry timer. `cancelReset()` dispatches `cancel`. `#sys-reset-cancel` click -> `cancelReset()`.
- `destroy()`: close, remove all listeners and timers, remove the overlay; idempotent.

CSS: variables on `#system-menu` (same HUD palette block with the sync comment). `#system-menu`: `position:fixed; inset:0; z-index:150; display:none; pointer-events:auto; background:rgba(8,6,5,.78); align-items:center; justify-content:center;` `.is-open {display:flex}`. Panel: iron-2 background, 2px rust border, ink outer ring, scanline `::after` (pointer-events none), monospace uppercase, amber text, `width:min(420px,92vw)`, flex column, gap 10px. Buttons reuse the `.hud-btn` look (re-declare, do not depend on hud.css). `#sys-reset.is-armed`: rust-dark background, haze text, pulsing border keyframes (off under `prefers-reduced-motion`). `#sys-feedback`: reserved min-height (no layout jump). `[hidden]` must win over display rules.

**constraints**: no Phaser; `textContent` only; no `0x` literals; no `any`; no listeners/timers left after `destroy`; labels only from the model; calls nothing but the four deps.

**acceptance**: typecheck clean; reasoning check against the smoke test: reset once -> button reads `CONFIRM: ERASE ALL?`; a second press within 5 s calls `resetProgress` once and closes; a single press then a 6 s wait returns to `RESET PROGRESS` and does nothing; Esc while armed only disarms (menu stays open, stack still holds `'system-menu'`); the second Esc closes the menu; closing while armed disarms; the mute label matches `deps.isMuted()` on open and after toggle.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|innerHTML|\bany\b|0x[0-9a-fA-F]{6}|addEventListener\('keydown'" src/ui/systemMenu.ts && echo FAIL || echo OK
```

## T8 — Tech tree + MachineView integration (modal stack, denied and landed signals)

**wave**: 2. **files_owned**: `src/ui/techTree.ts`, `src/game/entities/MachineView.ts`

**objective**: The tech tree uses the shared modal stack and emits `purchaseDenied`; MachineView emits `partLanded` on assembly completion.

**context**: read both files first; contracts `GameContext`, `GameFeedback`, `ModalStack` above.
`techTree.ts`:
- Signature `createTechTree(root: HTMLElement, ctx: GameContext): TechTree`; destructure `const { session, commands, modals, feedback } = ctx;` (replaces the old `session`/`commands` parameters; `import type { GameContext }` from `../game/context`, drop the unused `GameCommands` import).
- `open()`: replace `window.addEventListener('keydown', onKeyDown)` with `modals.push('tech-tree', close)`. `close()`: replace the removeEventListener with `modals.remove('tech-tree')`. Delete `onKeyDown` entirely. Keep the backdrop click close, the focus logic, `dirty` handling and everything else as is.
- `onBuy` failure branch: after `flashDenied()` add `feedback.purchaseDenied.emit(result.reason)`. A successful purchase emits nothing new.
- `destroy()` keeps calling `close()` first, so the stack entry is removed.
`MachineView.ts`:
- In `startAssembly`'s `onComplete`, after `this.shake()` add `this.ctx.feedback.partLanded.emit(id)`. Instant settles (build, load, reset, `sync`) never emit. Nothing else changes.

**constraints**: nothing else changes; no Phaser in techTree.ts; the modal stack is the ONLY Esc path (no `keydown` listener in techTree.ts); `session.revision` stays unused in techTree.ts; no `0x` literals.

**acceptance**: typecheck clean for these two files (bootstrap.ts is expected to fail until T10); `grep keydown src/ui/techTree.ts` has no matches; a failed buy emits exactly one `purchaseDenied` with the failure reason; `partLanded` fires once per animated landing and never on load.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "keydown|from ['\"]phaser|\brevision\b|innerHTML" src/ui/techTree.ts && echo FAIL || echo OK
grep -n "partLanded" src/game/entities/MachineView.ts
```

---

# WAVE 3 (parallel: T9, T10 — disjoint files; waves 1 and 2 done)

## T9 — HUD button + WorldScene gating

**wave**: 3. **files_owned**: `src/ui/hud.ts`, `src/ui/hud.css`, `src/game/scenes/WorldScene.ts`

**objective**: A SYSTEM button in the HUD and canvas input disabled while ANY modal is open.

**context**:
- `hud.ts`: add `const systemButton = createElement('button', { id: 'hud-system', className: 'hud-btn', text: 'SYSTEM' })`, `type = 'button'`, `title = 'Open the system menu'`; append it to `#hud-buttons` after REFOCUS; `onSystem = () => commands.openSystemMenu.emit()`; add and remove its click listener like the others (remove in `destroy`). Existing ids and behaviour unchanged. `hud.css`: only if the three buttons need a tweak; otherwise leave untouched.
- `WorldScene.ts`: `import type { ModalStack } from '../../ui/modalStack';` change the `ui` field and constructor parameter type to `{ hud: Hud; techTree: TechTree; modals: ModalStack }`. In `update`, replace `this.input.enabled = !this.ui.techTree.isOpen();` with `this.input.enabled = !this.ui.modals.isOpen();` and update the comment ("any modal dialog open"). Keep `this.ui.techTree.update()`. Everything else unchanged; file stays under 120 lines.

**constraints**: no Phaser import in `hud.ts`; no `override` on `create`; `update` keeps `override`.

**acceptance**: typecheck clean for these files; `#hud-system` click emits `openSystemMenu`; WorldScene has no `techTree.isOpen()` call; bootstrap.ts errors on `WorldScene` construction are expected until T10.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "override (init|preload|create)\b|techTree\.isOpen" src/game/scenes/WorldScene.ts && echo FAIL || echo OK
grep -n "from 'phaser'" src/ui/hud.ts && echo FAIL || echo OK
wc -l src/game/scenes/WorldScene.ts
```

## T10 — Bootstrap + debug hook

**wave**: 3. **files_owned**: `src/game/bootstrap.ts`, `src/game/debugHook.ts`

**objective**: Compose everything: load, offline, UI, autosave, audio, modal stack, unload saves.

**context**: boot order (exact):
1. `const saveManager = new SaveManager(browserStorage());` `const startup = startSession(saveManager, Date.now()); const session = startup.session;` (imports from `../persistence/saveManager` and `../persistence/startup`; drop `createInitialState` and the manual `applyOffline`).
2. `const modals = createModalStack(); bindEscapeToStack(modals, window);` (page-lifetime; do not store the disposer). `const ctx: GameContext = { session, commands: { refocus: createSignal(), openTechTree: createSignal(), openSystemMenu: createSignal() }, feedback: { purchaseDenied: createSignal<PurchaseFailure>(), partLanded: createSignal<MachineComponentId>() }, modals };`
3. `root`, `hud = createHud(root, ctx.commands)`, `toasts = createToasts(root)`, `session.on('reset', () => toasts.clear())` (keep), `techTree = createTechTree(root, ctx)`.
4. `saveController = createSaveController({ session, saveManager }); saveController.start();`
5. `systemMenu = createSystemMenu(root, { isMuted: () => session.settings.muted, setMuted: (m) => session.setMuted(m), saveNow: () => saveController.saveNow(), resetProgress: () => saveController.resetProgress(), modals });` Wire: `ctx.commands.openSystemMenu.on(() => { techTree.close(); systemMenu.open(); })` and `ctx.commands.openTechTree.on(() => systemMenu.close())` (the tech tree's own openTechTree subscription opens it; listener order does not matter because they touch different dialogs).
6. Startup toasts, after the toasts exist: if `startup.load.status === 'recovered'` -> `toasts.show(recoveredMessage())`; `const welcome = welcomeBackMessage(startup.offline); if (welcome) toasts.show(welcome);`. Then `connectNotifications(session, toasts)`, `connectOfflineNotices(session, toasts)`, `connectSystemLog(session, toasts)` (no stored disposers).
7. Unload saves: `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveController.saveNow(); })`, `window.addEventListener('pagehide', () => { saveController.saveNow(); })`, `window.addEventListener('beforeunload', () => { saveController.saveNow(); })`.
8. `const audio = createGameAudio(session, ctx.feedback, window);`
9. Phaser config: add `audio: { noAudio: true }`; scene `new WorldScene(ctx, { hud, techTree, modals })`.
10. `installDebugHook(session, game, techTree, { modals, systemMenu, saveController, audio })`.
`debugHook.ts`: add the exported `DebugExtras` interface and the new signature; extend the global type with `saveNow(): boolean`, `systemMenuOpen(): boolean`, `modalCount(): number`, `audioUnlocked(): boolean`; implement via the extras (`saveController.saveNow()`, `systemMenu.isOpen()`, `modals.size()`, `audio.unlocked`). Keep `session`, `crankClientPoint`, `componentState`, `techTreeOpen` exactly. No cheat or mutation helpers beyond `saveNow`. Keep the comment "test-only hook, safe to ship".
Update the header comment of `bootstrap` to mention the load/save flow. `bootstrap()` still returns the `Phaser.Game`.

**constraints**: no behaviour change besides the above; no `override` on `create`; `bootstrap.ts` stays the only composition root.

**acceptance**: `npx tsc --noEmit` clean for the whole repo; `npm run build` passes; a recovered load shows the recovered toast, a reload after 2 h away shows one welcome-back toast; reset only runs through `saveController.resetProgress`; exactly one Escape listener is registered by the app (the stack's), none by tech tree or system menu.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit && npm run build
grep -rn "createInitialState\|applyOffline" src/game && echo FAIL || echo OK
grep -rn "addEventListener('keydown'\|addEventListener(\"keydown\"" src --include=*.ts | grep -v test
```

---

# WAVE 4 — EM Mode B

Run: `npm run typecheck`, `npm test` (>= 387 old + new, all green), `npm run build`. Purity greps:
```
grep -rn "phaser" src/simulation src/data src/persistence src/utils src/audio src/ui
grep -rnE "\b(document|window|AudioContext)\b" src/persistence src/data src/audio/audioMath.ts src/ui/*Rules.ts src/ui/systemMenuModel.ts src/ui/modalStack.ts
git diff --stat HEAD -- src/simulation public    # must be empty; SAVE_VERSION === 1
```
Check: only ONE `keydown` listener registered by app code (`bindEscapeToStack`); `WorldScene` gates input on `modals.isOpen()`; `GameFeedback` emitted by techTree (denied) and MachineView (landed, animated only); no sound on `'unlock'`; Phaser config has `audio: { noAudio: true }`. Allowed glue: one-line integration fixes only.

## Director smoke test additions (on top of `WP4.md`)

1. Esc stack: open the TECH INDEX, press Esc -> closed. Open SYSTEM -> press RESET (armed) -> Esc: menu still open and button back to `RESET PROGRESS`; Esc again -> menu closed. `__wedtmd.modalCount()` is 2 while armed, 1 after the first Esc, 0 after the second.
2. Mutual exclusion: with the tech tree open click HUD SYSTEM -> tech tree closes, menu opens; and the reverse. Canvas clicks while either is open do not change `session.state.totalClicks`.
3. Denied tap: with ME 0, select Gear Ratio and press PURCHASE -> `INSUFFICIENT` feedback; no console errors (audio exists only after a gesture; with `AudioContext` blocked nothing throws).
4. Landed tap: buy Gear Ratio -> after ~0.7 s the part lands (`componentState('gearSmall').assembling === false`); a reload re-assembles nothing.
5. Welcome-back toast after `session.update(Date.now() + 120000)` and the recovered toast after `localStorage['wedtmd.save'] = '{broken'` + reload (as in `WP4.md`); verify toasts show above the open menu (toasts z-index 200 > menu 150).

---

# Risks

- `bootstrap.ts` fails typecheck between waves 1 and 3 by design (see top). Do not "fix" it earlier; no wave 2 worker may touch it.
- T5/T6 are the least testable (WebAudio, no DOM tests). They rely on strict reasoning checks and the Director's browser run; the EM cannot hear audio.
- T8 changes `createTechTree`'s signature while T10 (wave 3) is the only caller.
- The Esc handler is `capture` + `stopPropagation`, so any later page-level Esc use would be shadowed while a modal is open. Acceptable now; no Phaser keyboard use exists.
- Two reset layers share the stack: a stale `'system-reset'` entry would trap Esc. T7 acceptance and the smoke test (`modalCount`) cover it.
