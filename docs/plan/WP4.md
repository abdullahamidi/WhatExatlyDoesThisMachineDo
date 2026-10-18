# Work Package 4: Persistence, Feedback, Audio

Goal: progress survives reloads and tab closes. Returning players get one short welcome-back summary. A SYSTEM menu offers mute, manual save and a two-step reset. The machine makes procedural WebAudio sounds that never block play. Rare system logs add environmental storytelling.

Baseline (verified): 387 tests pass, typecheck clean. `SaveManager`, `deserialize`, `GameSession.applyOffline/update/reset/setMuted` and the `'offline'|'settings'|'reset'` events already exist and are tested, but none is wired: `bootstrap.ts` uses `createInitialState(Date.now())`. `MachineView` and `techTree` already rebuild on `'reset'`. `docs/PROJECT_STATUS.md` is stale (it says WP2 planning); the Director refreshes it after this package.

## Conventions
- Pure (no Phaser, no DOM, Vitest `environment: node`): `src/data/**`, `src/persistence/**`, `src/audio/audioMath.ts`, `src/ui/*Rules.ts`, `src/ui/systemMenuModel.ts`. DOM/WebAudio modules (`src/ui/*.ts`, `src/audio/synth.ts`, `src/audio/gameAudio.ts`) never import Phaser.
- Tuning numbers and texts go in `src/data/`. No WP1 simulation changes, and no save-schema change (`SAVE_VERSION` stays 1).
- Nothing in this package may throw into the game loop. Storage and audio failures degrade silently, with at most a `console.warn`.
- Text is written with `textContent`. Styling reuses the HUD CSS variables and monospace fonts.

## Contracts
`src/persistence/startup.ts` (T1)
```ts
export interface StartupResult { session: GameSession; load: LoadResult; offline: OfflineReport; saved: boolean }
// load(nowMs) → new GameSession({state, settings, now: clock}) → applyOffline(nowMs) → saveManager.save(...) → return
export function startSession(saveManager: SaveManager, nowMs: number, clock?: () => number): StartupResult;
```
`src/persistence/saveController.ts` (T1)
```ts
export interface Scheduler { setInterval(fn: () => void, ms: number): unknown; clearInterval(h: unknown): void }
export interface SaveController {
  saveNow(): boolean;          // saveManager.save(session.state, session.settings, now()); never throws
  resetProgress(): void;       // saveManager.reset(); session.reset(); saveNow()
  start(): void;               // interval AUTOSAVE_INTERVAL_MS + subscribe 'purchase' and 'settings' → saveNow (idempotent)
  dispose(): void;             // clears interval + unsubscribes
  readonly lastSaveOk: boolean | null;
}
export function createSaveController(o: { session: GameSession; saveManager: SaveManager; now?: () => number;
  scheduler?: Scheduler; intervalMs?: number }): SaveController;
```
`src/ui/notificationRules.ts` additions (T2). Texts and timings go in `src/data/notifications.ts`.
```ts
export function welcomeBackMessage(r: OfflineReport): ToastMessage | null;
// null if !(gained > 0) or elapsedSeconds < WELCOME_MIN_ELAPSED_SECONDS (=60, in data; avoids a toast on quick reloads). key 'welcome-back', tone 'system', durationMs TOAST_CONFIG.welcomeDurationMs (≈7000)
// title 'WELCOME BACK'; body `Unattended for ${formatDuration(elapsedSeconds)}. +${formatNumber(gained)} ME accumulated.`
// + ' Buffer capped at ' + formatDuration(cappedSeconds) + '.' when elapsedSeconds > cappedSeconds
export function recoveredMessage(): ToastMessage; // key 'save-recovered', tone 'system', e.g. 'MEMORY CORRUPTED' / 'Factory state restored.'
```
`src/data/systemLogs.ts` + `src/ui/systemLogRules.ts` (T2)
```ts
export type SystemLogTrigger = { kind: 'lifetimeMe'; atLeast: number } | { kind: 'playSeconds'; atLeast: number }; // playSeconds = (now − createdAt)/1000
export interface SystemLogEntry { id: string; text: string; trigger: SystemLogTrigger }
export const SYSTEM_LOGS: readonly SystemLogEntry[];   // 8–10 entries, unique ids, cryptic §10 tone, ≤60 chars,
                                                       // no duplicate of INSTALL_LINES/FIRST_CLICK_MESSAGE text
export const SYSTEM_LOG_CONFIG: { minGapMs: 120000; checkIntervalMs: 5000; durationMs: 5000 };
export interface SystemLogTracker { readonly shown: ReadonlySet<string>; readonly lastShownAt: number }
export function seedTracker(s: { lifetimeMe: number; createdAt: number }, nowMs: number): SystemLogTracker; // already-met → shown; lastShownAt = nowMs
export function nextSystemLog(t: SystemLogTracker, s: { lifetimeMe: number; createdAt: number }, nowMs: number,
  cfg?: typeof SYSTEM_LOG_CONFIG): { entry: SystemLogEntry; tracker: SystemLogTracker } | null; // ≤1 per call, table order, respects minGap
export function systemLogMessage(e: SystemLogEntry): ToastMessage; // key `log:${id}`, tone 'system', title 'SYS LOG', body text
```
`src/data/audio.ts` + `src/audio/audioMath.ts` (T3)
```ts
export const AUDIO = { masterGain, rampSeconds, updateIntervalMs,
  crank: { hz, ticks, tickGapMs, decayMs, gain }, clunk: { hz, decayMs, noiseGain, gain }, sting: { notesHz: number[], noteMs, gain },
  hum: { minHz, maxHz, minGain, maxGain, refPerSecond, maxPerSecond }, gearTick: { minPerSecond, maxPerSecond, gain },
  wind: { gain, lowpassHz, gustPeriodS, gustDepth } } as const;
export function activityLevel(perSecond: number, ref: number, max: number): number; // log(1+ps/ref)/log(1+max/ref) clamped [0,1]; ≤0/NaN → 0
export function humFrequency(perSecond: number, cfg = AUDIO.hum): number;  // lerp(minHz,maxHz,level), always within range
export function humGain(perSecond: number, cfg = AUDIO.hum): number;       // 0 when ps ≤ 0, else lerp(minGain,maxGain,level)
export function gearTickRate(perSecond: number, cfg = AUDIO.gearTick): number; // 0 when ps ≤ 0, else in [min,max], monotonic
export function masterTarget(muted: boolean, unlocked: boolean, base = AUDIO.masterGain): number; // 0 if muted or locked
```
`src/audio/gameAudio.ts` (T5)
```ts
export interface GameAudio { readonly unlocked: boolean; dispose(): void }
export function createGameAudio(session: GameSession, target?: Window): GameAudio; // never throws; no AudioContext until first gesture
```
`src/data/systemMenu.ts` + `src/ui/systemMenuModel.ts` + `src/ui/systemMenu.ts` (T4)
```ts
export const SYSTEM_MENU_CONFIG = { resetArmMs: 5000, saveFeedbackMs: 1600 } as const;
export type ResetState = { stage: 'idle' } | { stage: 'armed'; armedAt: number };
export function reduceReset(s: ResetState, ev: { type: 'press' | 'cancel' | 'tick'; nowMs: number },
  armMs?: number): { state: ResetState; execute: boolean };       // press idle→armed; press armed (not expired)→execute+idle; tick past armMs→idle
export function muteLabel(muted: boolean): string;                 // 'AUDIO: ON' | 'AUDIO: OFF'
export function resetLabel(s: ResetState): string;                 // 'RESET PROGRESS' | 'CONFIRM: ERASE ALL?'
export function saveFeedbackLabel(ok: boolean): string;            // 'STATE WRITTEN' | 'WRITE FAILED'
export interface SystemMenuDeps { isMuted(): boolean; setMuted(m: boolean): void; saveNow(): boolean; resetProgress(): void }
export interface SystemMenu { open(): void; close(): void; toggle(): void; isOpen(): boolean; destroy(): void }
export function createSystemMenu(root: HTMLElement, deps: SystemMenuDeps): SystemMenu;
// ids: #system-menu, #sys-mute, #sys-save, #sys-reset, #sys-reset-cancel, #sys-close; Escape/close cancels armed reset
```
`GameCommands` (T7): add `openSystemMenu: Signal<void>`. HUD adds `#hud-system` "SYSTEM".

## Tasks
### Wave 1 (parallel, pure)
- **T1 Startup + save controller.** Files: `src/persistence/startup.ts`, `src/persistence/saveController.ts`, `src/persistence/startup.test.ts`, `src/persistence/saveController.test.ts`. Depends on: none.
  Acceptance: matches the contracts. Tests use `MemoryStorage` and a fake scheduler. (a) Empty storage → status 'new', gained 0, and a save is written. (b) Save with lastSimTime 2h back and wornMotor owned → gained = perSecond×7200 (±1e-6). A second `startSession` on the same storage 1s later → gained ≈ perSecond×1, so no double award. (c) Over 8h → capped. (d) Corrupt JSON → 'recovered', fresh state, `SAVE_BACKUP_KEY` holds the raw text. (e) `muted: true` round-trips. Controller: an interval tick saves; purchase/settings events save; `resetProgress` leaves storage holding a fresh state with settings kept; `dispose` stops saving; a storage throw → `saveNow()` false with no throw.
- **T2 Welcome-back, recovered and system-log rules.** Files: `src/data/notifications.ts` (add `welcomeDurationMs` + texts), `src/data/systemLogs.ts`, `src/ui/notificationRules.ts`, `src/ui/systemLogRules.ts`, `src/ui/notificationRules.test.ts`, `src/ui/systemLogRules.test.ts`. Depends on: none.
  Acceptance: gained 0, gained NaN, or elapsed under 60s → null. Body uses `formatDuration`/`formatNumber`, and the cap note appears only when capped. The log table is valid (unique ids, positive thresholds, text ≤60 chars, no duplicates of install lines). `seedTracker` suppresses logs already met. `nextSystemLog` returns null inside minGap and one entry otherwise. Existing WP3 rule tests stay green.
- **T3 Audio parameter math.** Files: `src/data/audio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`. Depends on: none.
  Acceptance: functions are clamped, monotonic and finite for 0, negative, NaN, Infinity and 1e12 input. `humGain(0) === 0` and `gearTickRate(0) === 0`. `masterTarget` returns 0 when muted or locked. No DOM or WebAudio types are imported.
- **T4 System menu.** Files: `src/data/systemMenu.ts`, `src/ui/systemMenuModel.ts`, `src/ui/systemMenuModel.test.ts`, `src/ui/systemMenu.ts`, `src/ui/systemMenu.css`. Depends on: none (it uses the contract interfaces only).
  Acceptance: reducer tests cover arm, confirm, expiry, cancel and a double press after expiry (re-arms, does not execute). The DOM panel is a terminal-style modal (z-index between the tech tree's 100 and the toasts' 200) using `pointer-events: auto`. Save shows the feedback label for `saveFeedbackMs`. Reset calls `deps.resetProgress()` only on a confirmed second press and then closes the menu. The mute label refreshes on open and on toggle. Escape closes it.

### Wave 2 (parallel)
- **T5 WebAudio synth + controller.** Files: `src/audio/synth.ts`, `src/audio/gameAudio.ts`. Depends on: T3.
  Acceptance: a one-shot `pointerdown`/`keydown` listener (capture, on the window) creates `AudioContext` (or `webkitAudioContext`). If it is missing or throws, everything is a no-op. Sounds: ratchet ticks on session `'click'`, a noise+sine clunk on `'purchase'`/`'unlock'` (heavier on unlock), a 3-note sting on `'milestone'`. A timer every `updateIntervalMs` reads `session.rates.perSecond`: the hum oscillator follows `humFrequency`/`humGain` (silent with no automation), gear ticks are scheduled at `gearTickRate` (lookahead scheduling), and lowpass-filtered looped-noise wind with a slow gust LFO plays after unlock. Master gain ramps to `masterTarget(session.settings.muted, unlocked)` on `'settings'`. The context is suspended while the document is hidden and resumed when visible and unmuted. `dispose` removes all listeners and timers and closes the context. No asset files and no Phaser.
- **T6 Notice wiring.** Files: `src/ui/toasts.ts` (add `connectOfflineNotices`), `src/ui/systemLog.ts`. Depends on: T2.
  Acceptance: `connectOfflineNotices(session, toasts): () => void` shows `welcomeBackMessage` for every later `'offline'` event (the tab-return path through `update()`). `connectSystemLog(session, toasts, now?)` seeds on start, polls every `checkIntervalMs` and shows at most one log per `minGapMs`, reseeds on `'reset'`, and returns a disposer. `connectNotifications` behaviour is unchanged.
- **T7 HUD button + input gating.** Files: `src/game/context.ts`, `src/ui/hud.ts`, `src/ui/hud.css` (if needed), `src/game/scenes/WorldScene.ts`. Depends on: T4 (interface only).
  Acceptance: `#hud-system` emits `commands.openSystemMenu`. WorldScene's `ui` gains `systemMenu: SystemMenu`, and canvas input is disabled while either overlay is open. Existing HUD ids and behaviour are unchanged.

### Wave 3
- **T8 Bootstrap integration.** Files: `src/game/bootstrap.ts`, `src/game/debugHook.ts`. Depends on: T1, T4–T7.
  Acceptance:
  - Boot order: `saveManager = new SaveManager(browserStorage())`, then `startSession(saveManager, Date.now())`, then the UI is created.
  - Recovered status → `recoveredMessage()` toast. Boot welcome-back → `welcomeBackMessage(offline)` (null → no toast). Then `connectOfflineNotices`, `connectNotifications` and `connectSystemLog` are connected.
  - `createSaveController(...).start()`.
  - Saves on `document` `visibilitychange` (hidden), `window` `pagehide` and `beforeunload`.
  - System menu deps: `session.setMuted`, `saveController.saveNow`, `saveController.resetProgress`. Opening the system menu closes the tech tree and vice versa.
  - `createGameAudio(session)` is created.
  - Phaser config gets `audio: { noAudio: true }`, so Phaser creates no AudioContext of its own and logs no autoplay warning.
  - The debug hook adds `saveNow(): boolean`, `systemMenuOpen(): boolean` and `audioUnlocked(): boolean`, and keeps the existing fields.

## Package acceptance / validation
- `npm run typecheck` is clean. `npm test` passes: ≥387 existing tests plus the new ones. `npm run build` succeeds.
- Purity: `grep -rn "phaser" src/simulation src/data src/persistence src/utils src/audio src/ui` → no matches. `grep -rn "document\|window\|AudioContext" src/persistence src/data src/audio/audioMath.ts src/ui/*Rules.ts src/ui/systemMenuModel.ts` → no matches.
- No new files in `public/` and no audio assets. `SAVE_VERSION === 1`.

### Director smoke test (Playwright, `npm run dev`)
1. Fresh profile: click the crank about 20 times and buy a tech, then reload. ME, levels and `totalClicks` are preserved (±autosave drift ≤ the clicks after the last purchase or save; call `__wedtmd.saveNow()` before reloading for an exact check).
2. Own wornMotor and note `session.rates.perSecond`. Edit `localStorage['wedtmd.save']` to set `savedAt` and `state.lastSimTime` 2h back, then reload. One WELCOME BACK toast appears with "2h" and gained ≈ perSecond×7200 (ME delta matches). Reload again right away: no welcome-back toast (elapsed under 60s) and no extra 2h worth of ME.
3. Set `localStorage['wedtmd.save'] = '{broken'` and reload. A recovered toast appears, ME is 0 with only the crank owned, and `wedtmd.save.corrupt` holds `{broken`.
4. SYSTEM → AUDIO: OFF, then reload. The menu shows AUDIO: OFF and `session.settings.muted === true`.
5. SYSTEM → RESET (button label changes) → confirm. ME is 0, levels are fresh, `componentState` reports only the frame and crank visible, and a reload stays fresh. A single reset press followed by a 6s wait does nothing.
6. No console errors through the whole run. Hidden-tab return over 60s shows a welcome-back toast (optional: fake it via `session.update(Date.now()+120000)`).

## Out of scope
- Balance tuning, README/ASSET_GUIDE, the §16 walkthrough (WP5).
- Save export/import, cloud saves, multiple slots, volume sliders, music, audio asset files.
- Persisting which system logs have been shown. Schema migrations. Changes to WP1 simulation semantics.
