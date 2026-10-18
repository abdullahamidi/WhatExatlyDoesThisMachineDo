# WP12 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP12.md` (contracts C1-C8, decisions D1-D10, tasks T1a..T11) + real code read at HEAD `4f52263` (WP11: W1 committed `bb69108`, W2 T4/T5 done, T3a/T3b running, W3 not started).
Template: `WP11-assignments.md`. Numbering: WP11 = Era V, WP12 = this, **WP13 = finale, WP14 = prestige**. Save stays **v2** (additive optional fields). No balance change, no new art (all `ui.*` PNGs exist in `public/assets/ui/`: badges, badges-locked, icons16, button, panel). **Workers never touch `public/**`.**
Baseline: Director records `npx vitest run 2>&1 | tail -6` (tests + files) BEFORE W1; every later run must keep it >=.

## How the Director uses this file
For every worker: spawn `implementation-worker`, paste **(1) the Common preamble** (fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4 concurrent workers overall, WP11 workers included). After each wave: that wave's tests (`npx vitest run <files>`) + `npx tsc --noEmit`, compare with the transient table, then next wave.

| Wave | Ids | Workers | WP11 state REQUIRED before start | Files shared with WP11 W2/W3? |
|---|---|---|---|---|
| 1 | **T1a** settings+types+stats, **T1b** achievements data+evaluator (+ settings-literal glue), **T5** notation+hotkeys, **T6** menu shell | 4 | WP11 W1 merged (done, `bb69108`) | none. Disjoint from T3a/T3b/T4/T5 and from all W3 files. May start as soon as a concurrency slot is free (T3a/T3b running = 2 slots used). |
| 2 | **T2** GameSession, **T4** audio volumes, **T7** settings+stats panels, **T8** records+data panels+toast | 4 | WP11 W1 merged (T8 audio, done). T4 touches the same audio files WP11 T8 touched: that is committed, so free. | none with W3. |
| 3 | **T3** persistence+export/import, **T9** integration+tree a11y, **T10** smoke+reachability | 3 | WP11 **W2 fully done** (`persistence.test.ts` owner T4 = done; era V final costs for the T10 sim test = done; T3a/T3b must be finished so `npm run build` is meaningful) | none with W3 files (`bootstrap.ts`, `techTree*.ts`, `hud*`, css are WP12-only). **Gate caveat:** WP11 W3 transient tsc errors (`WorldScene.ts`, `MachineView.ts`) may be live if W3 runs concurrently: judge W3-wave tsc only by the grep filter in each validation block. T10's **smoke RUN** (Director, not worker) needs WP11 W3 + its Mode B done (build green, renderers consistent). |
| 4 | **T11** reduced motion in game | 1 | WP11 **W3 + its Mode B done** | **YES**, see below. |
| 5 | EM Mode B (validate, glue only), reviewer, Director smokes | - | W1-W4 | - |

### Files shared with WP11 W3 (Director: never two workers on one file)
Plan table had T6a/T6b/T7a/T7b mapped wrongly; real WP11-assignments ownership:
| WP12 task | file | WP11 W3 owner | Rule |
|---|---|---|---|
| T11 | `src/game/entities/MachineAnimator.ts` | **T6a** animator | T11 only after T6a + WP11 Mode B |
| T11 | `src/game/entities/MachineView.ts` | **T6b** view/links/debugHook | same |
| T11 | `src/game/rendering/CameraController.ts` | **T7a** world renderers (also PylonLine, Terrain, DustField) | same |
| T11 | `src/game/rendering/Eclipse.ts` | **T7b** sky/eclipse/beam/scene (CREATES it; also ParallaxBackground, ApertureBeam, WorldScene) | file does not exist until T7b lands |
| T11 | `src/game/rendering/SteamFx.ts`, `src/game/entities/HandCrank.ts` | none (WP10 / WP12 T5) | free |
| T5 | `src/game/entities/HandCrank.ts`, `src/game/context.ts`, `src/game/bootstrap.ts` (ONE line) | none | free; T9 later owns bootstrap fully |
| T10 | `scripts/smoke/{stages,wp3-techtree,wp2-crank,wp4-persistence,full-machine}.mjs` (Escape guards only) | WP11 T9 (committed) | **Director: run WP11 Mode B smokes (stages, wp3...) BEFORE T9 lands**: after T9 a bare `Escape` with no modal opens the menu. After T10 the smokes are guarded. |
| T1b | `src/persistence/schema.ts` (readSettings lines), `src/persistence/{persistence,saveController,startup}.test.ts`, `src/simulation/GameSession.test.ts` (settings literals only) | WP11 T4 owned `persistence.test.ts` (done, committed) | free unless a WP11 review fix lands: re-read before editing |
If T11 needs `WorldScene.ts` (T7b-owned) to hand `session` to a renderer: STOP, report; do not edit. (`CameraController(scene, session)` and the machine view already have the session.)

### Expected transient tsc errors (not a worker fault; Director gate = end of wave)
| After | Allowed to fail (inside the wave only) | End of wave |
|---|---|---|
| W1 | `src/data/types.ts` import of `AchievementId` until T1b creates `src/data/achievements.ts` (T1b writes the id list FIRST); `src/utils/format.ts` import of `NumberNotation` from types until T1a lands; `src/game/entities/HandCrank.ts` import of `motionPolicy` until T1a lands; `src/ui/systemMenu.ts` import of `trapFocus` from `./hotkeys` until T5 lands; `src/persistence/schema.ts` / tests until T1a `DEFAULT_SETTINGS` full | typecheck clean. `SaveEnvelope` / `LoadResult` are NOT touched in W1 (T3 owns them) so persistence stays compiling. |
| W2 | `src/ui/toasts.ts` `session.on('achievement')` until T2 lands events; `src/audio/*` `session.updateSettings`/settings fields none (settings type already full) | clean |
| W3 | WP11-owned `WorldScene.ts` / `MachineView.ts` if WP11 W3 is concurrent (ignore) | clean on WP12 files (grep filter); full clean after WP11 W3 + Mode B |
| W4 | none | clean |
Any other tsc error is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## EM decisions / deviations from WP12.md
1. **Keep tsc green without optional fields.** `SettingsState` gets all new fields REQUIRED in W1 (T1a). Sites that built `{ muted }` literals are fixed in W1 by glue: T1a owns `state.test.ts`; T1b owns `schema.ts` `readSettings` (behaviour-preserving: still strict on `muted`, returns `{ ...DEFAULT_SETTINGS, muted }`, other fields default) and the literal/expectation fixes `{ muted: x }` -> `{ ...DEFAULT_SETTINGS, muted: x }` in `GameSession.test.ts`, `persistence.test.ts`, `saveController.test.ts`, `startup.test.ts` (literals + `toEqual` of settings only, nothing else). T3 later swaps `readSettings` to `normalizeSettings` and flips the one "bad muted -> recovered" row.
2. **`SaveEnvelope` / `LoadResult` type additions move to T3** (W3, with ALL consumers: codec, saveManager, schema, startup, tests). Reason: required `stats`/`achievements` there would break `codec.ts` / `saveManager.ts` in W1/W2. T3 therefore also owns `src/data/types.ts` (the two interfaces only).
3. **`SystemMenuDeps.panels` is OPTIONAL in T6** (`panels?:`), so `bootstrap.ts` compiles before T9. **`GameCommands.crank` is REQUIRED** (T5) and T5 adds the single line `crank: createSignal()` to `bootstrap.ts` `commands`.
4. **Panels never import GameSession.** They take narrow dep interfaces (below), so T7/T8 do not depend on T2/T3 types. T9 builds the closures from `session` / `saveController`.
5. **Pure root-attribute helper** `uiRootAttrs(settings)` lives in `settingsView.ts` (T7, tested); T9 only applies it.
6. **Smoke Escape audit** (new vs plan): Esc with no modal now opens the menu, so T10 guards every bare `Escape` in the existing smokes (press only when `techTreeOpen()` / `systemMenuOpen()` is true).
7. `NumberNotation` is defined in `types.ts` (T1a); `utils/format.ts` imports + re-exports it (`export type { NumberNotation }`), so every old import keeps working.
8. Re-read each file RIGHT BEFORE editing (WP11 workers run concurrently); small unique-anchor Edits; never revert foreign hunks.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP12: settings (volumes, notation, motion, shake, status markers, UI scale), accessibility (keyboard play, focus trap, aria),
lifetime stats, 31 cosmetic achievements, base64 save export/import. NO balance change, NO new art, save stays version 2 (additive optional fields).
Everything in eras I-V must behave EXACTLY as before: numbers, rates, event order, pixels, strings (at default settings).
Specs: docs/plan/WP12.md (contracts C1-C8), this assignment text wins where they differ. Art contract for badges: docs/plan/ART_ERA5.md §8/§9.
Baseline: typecheck clean, all tests green (count recorded by the Director before W1; never lower it).

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/. CSS only if a *.css is in your files_owned.
- CONCURRENCY: other workers (also WP11 era V workers) edit other files at the same time. Re-read every file RIGHT BEFORE you edit it (and again before final
  validation). Keep edits SURGICAL (Edit tool, small unique anchors; never rewrite a whole existing file from memory). Never revert or "fix" a foreign change.
- PURE (no 'phaser' import, no window/document/AudioContext/localStorage): src/data/**, src/simulation/**, src/persistence/**, src/utils/**,
  src/game/math/**, src/ui/*View.ts, src/ui/*Rules.ts, src/ui/*Model.ts, src/ui/menu/*View.ts, src/ui/menu/*Model.ts, src/audio/audioMath.ts.
  Only src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts may import Phaser. DOM files (src/ui/*.ts without View/Rules/Model suffix, src/ui/menu/*Panel.ts, hotkeys.ts) may use document/window, never Phaser.
- All balancing / tuning numbers and UI texts live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio. No tech-id string literals in src/audio or src/game logic.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`.
  No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- DOM text is ALWAYS written with textContent (never innerHTML). Every control is a real <button>/<input>/<textarea>; every icon-only or state control has an accessible name;
  min font size 12 px in any CSS you write; every interactive element gets `:focus-visible { outline: 2px solid <palette css var>; outline-offset: 2px }`.
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats,
  avoid -0 in expectations. Never delete coverage: when a count / list changes, update the assertion to the new value and keep the test's intent.
  Tests that touch the format default notation reset it to 'suffix' in afterEach.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list them in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these) ===

// ---- C1 Types (T1a: src/data/types.ts) ----
export type NumberNotation = 'suffix' | 'scientific' | 'engineering';
export type UiScale = 100 | 125 | 150;
export interface SettingsState {
  muted: boolean;
  masterVolume: number; sfxVolume: number; ambientVolume: number;   // int 0..100, default 100
  notation: NumberNotation;             // default 'suffix'
  reducedMotion: boolean;               // default false
  screenShake: boolean;                 // default true; ignored (off) while reducedMotion
  statusMarkers: boolean;               // default false
  uiScale: UiScale;                     // default 100
}
export interface StatsState {
  activeSeconds: number; offlineSeconds: number; longestOfflineSeconds: number;
  clicks: number; purchases: number;
  lifetime: ResourceMap; maxPerSecond: ResourceMap;
  cycles: number;                       // 1
  bestCycleSeconds: number | null;      // null
  startedAt: number;                    // epoch ms
}
export interface AchievementsState { unlocked: Partial<Record<AchievementId, number>> }   // id -> epoch ms
// AchievementId: `import type { AchievementId } from './achievements'` (const ACHIEVEMENT_IDS lives in data/achievements.ts).
// SaveEnvelope / LoadResult additions: T3 only (W3). Not in W1/W2.

// ---- C2 Settings (T1a) ----
// src/data/settings.ts (pure data)
export const DEFAULT_SETTINGS_VALUES: SettingsState = { muted:false, masterVolume:100, sfxVolume:100, ambientVolume:100, notation:'suffix', reducedMotion:false, screenShake:true, statusMarkers:false, uiScale:100 };
export const VOLUME_RANGE = { min: 0, max: 100, step: 5 } as const;
export const NOTATIONS: readonly NumberNotation[] = ['suffix','scientific','engineering'];
export const UI_SCALES: readonly UiScale[] = [100,125,150];
export const REDUCED_MOTION = { maxDegPerSec: 180, cameraTweenMs: 0, assemblyDropPx: 0 } as const;
export const CRANK_KEYS = { keys: [' ', 'Enter'], maxPerSecond: 15 } as const;
export const HOTKEYS = { techTree: 't', menu: 'Escape' } as const;
export const SETTINGS_LABELS = { ... }   // player-facing label text for every control, notation names (SUFFIX / SCIENTIFIC / ENGINEERING), UI scale "100 %" etc.
// src/simulation/settings.ts
normalizeSettings(raw: unknown, base?: SettingsState): SettingsState
  // lenient per field: wrong type -> base value (default when no base); volumes: finite number -> clamp 0..100 -> Math.round, else default;
  // unknown enum value (notation, uiScale) -> default; unknown keys dropped; null/array/primitive raw -> base/default copy. Never throws. Never returns the same object as base.
motionPolicy(s: SettingsState): { shake: boolean; cameraTween: boolean; flashes: boolean; maxDegPerSec: number | null; assemblyDrop: boolean }
  // reducedMotion -> { shake:false, cameraTween:false, flashes:false, maxDegPerSec: REDUCED_MOTION.maxDegPerSec, assemblyDrop:false }
  // else { shake: s.screenShake, cameraTween:true, flashes:true, maxDegPerSec:null, assemblyDrop:true }
// src/simulation/state.ts: `export const DEFAULT_SETTINGS: SettingsState = normalizeSettings(undefined);` (same export name/path as today; full object)

// ---- C3 Stats + achievements (T1a stats, T1b achievements) ----
// src/simulation/stats.ts (return NEW objects, never mutate inputs)
emptyStats(nowMs: number): StatsState                                  // zeros, cycles 1, bestCycleSeconds null, startedAt nowMs
deriveStats(state: GameState, nowMs: number): StatsState               // clicks = state.totalClicks, lifetime = copy of state.lifetime, startedAt = state.createdAt (nowMs if non-finite), rest zero/1/null
addLifetimeDelta(stats: StatsState, prev: ResourceMap, next: ResourceMap): StatsState   // adds max(0, next[r]-prev[r]) per resource (non-finite ignored); same object back when nothing added
bumpMaxRates(stats: StatsState, perSecond: ResourceMap): StatsState    // maxPerSecond[r] = max(old, perSecond[r]) (non-finite ignored); same object back when nothing raised
// src/data/achievements.ts (T1b)
export const ACHIEVEMENT_IDS = [ 'firstTurn','steadyHand','tireless','unrelenting','shiftWorker','wornMotor','fullStroke','blueprint','tinkerer','engineer','fullIndex',
  'eraElectric','noGrid','kilowatt','eraThermal','ratingExceeded','rollingBoil','eraResonance','convergence','harmonics','eraExotic','alignment','restoration','newCycle',
  'shortNap','longSilence','automation','servoChorus','sevenDigits','thirteenDigits','bigNumber' ] as const;      // 31, this order
export type AchievementId = typeof ACHIEVEMENT_IDS[number];
export type AchievementCondition =
  | { type: 'stat'; key: 'clicks' | 'purchases' | 'activeSeconds' | 'longestOfflineSeconds' | 'cycles'; atLeast: number }
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetime'; res: ResourceId | 'any'; atLeast: number }      // stats.lifetime; 'any' = max over resources
  | { type: 'maxRate'; res: ResourceId; atLeast: number }               // stats.maxPerSecond
  | { type: 'techsOwned'; atLeast: number };                            // count of techs with level >= 1 and kind !== 'starting'
export interface AchievementDefinition { id: AchievementId; name: string; description: string; icon: number /* 0..15 */; condition: AchievementCondition; secret?: boolean }
export const ACHIEVEMENTS: Readonly<Record<AchievementId, AchievementDefinition>>;  export const ACHIEVEMENT_LIST: readonly AchievementDefinition[];   // list = ACHIEVEMENT_IDS order
export const UI_ART = { badges:'assets/ui/badges.png', badgesLocked:'assets/ui/badges-locked.png', icons16:'assets/ui/icons16.png', button:'assets/ui/button.png', panel:'assets/ui/panel.png',
  badgeFrame: 24, iconFrame: 16, icon: { lock: 3, check: 4 }, nineSliceBorder: 8 } as const;
// Rows (id | name | icon | condition), thresholds in data only; "S" = secret:
// firstTurn First Turn 0 stat clicks 1 | steadyHand Steady Hand 1 clicks 100 | tireless Tireless 2 clicks 1000 | unrelenting Unrelenting 2 clicks 10000 | shiftWorker Shift Worker 1 stat activeSeconds 3600
// wornMotor It Moves By Itself 3 tech wornMotor 1 | fullStroke Full Stroke 3 tech pistonArray 1 | blueprint Blueprint 4 tech generatorBlueprint 1 | tinkerer Tinkerer 4 stat purchases 25 | engineer Engineer 4 stat purchases 150 | fullIndex Full Index 4 techsOwned 30
// eraElectric Live Wire 5 tech generator 1 | noGrid No Grid Answered 5 tech substationBlueprint 1 | kilowatt Kilowatt 5 maxRate ee 1000
// eraThermal Under Pressure 6 tech boiler 1 | ratingExceeded Rating Exceeded 6 tech pressureVesselBlueprint 1 | rollingBoil Rolling Boil 6 maxRate pr 1000
// eraResonance Resonant 7 tech resonatorSpire 1 | convergence Convergence 7 tech harmonicConvergence 1 | harmonics Harmonics 7 maxRate rs 1000
// eraExotic Units Unknown 8 tech nullChamber 1 S | alignment Alignment 8 tech finalAlignment 1 S | restoration Primary Function 9 tech primaryFunction 1 S | newCycle Cycle 0043 10 stat cycles 2 S
// shortNap Short Nap 12 stat longestOfflineSeconds 3600 | longSilence Long Silence 12 stat longestOfflineSeconds 28800 | automation Hands Free 13 tech crankServo 1 | servoChorus Servo Chorus 13 tech crankServo 10
// sevenDigits Seven Digits 14 lifetime me 1e6 | thirteenDigits Thirteen Digits 14 lifetime me 1e12 | bigNumber Gauge In The Red 14 lifetime any 1e15
// names <= 24 chars, descriptions <= 60 chars (terminal tone, no spoilers in non-secret rows, write them yourself), icon 0..15.
// src/simulation/achievements.ts (T1b)
conditionMet(c: AchievementCondition, state: GameState | ReadonlyGameStateLike, stats: StatsState): boolean   // ReadonlyGameStateLike = { techLevels: Readonly<Record<TechId, number>> } is enough; techsOwned excludes kind 'starting' (handCrank)
evaluateAchievements(state, stats: StatsState, current: AchievementsState, nowMs: number, defs: readonly AchievementDefinition[] = ACHIEVEMENT_LIST):
  { achievements: AchievementsState; unlocked: AchievementId[] }     // list order; never re-unlocks; keeps existing timestamps (also ids not in defs); SAME `current` object back when nothing new

// ---- C4 GameSession (T2: src/simulation/{GameSession,events,index}.ts) ----
GameSessionOptions += stats?: StatsState; achievements?: AchievementsState; settings?: Partial<SettingsState>   // settings normalized via normalizeSettings; stats default deriveStats(state, clock())
get stats(): Readonly<StatsState>; get achievements(): Readonly<AchievementsState>
updateSettings(patch: Partial<SettingsState>): void    // next = normalizeSettings({ ...current, ...patch }); every field equal -> no-op; else replace object, revision++, emit 'settings' ONCE
setMuted(m) === updateSettings({ muted: m })
SessionEvents += achievement: { ids: AchievementId[] };  SessionEvents.settings comment: emitted when ANY field changes
Rules: click -> stats.clicks+1 · purchase ok -> purchases+1 · update() live path (not delegated to applyOffline) -> activeSeconds += clamped dt only ·
 applyOffline -> offlineSeconds += report.cappedSeconds, longestOfflineSeconds = max(old, report.elapsedSeconds) · every setState(not reset) -> addLifetimeDelta(prev.lifetime, next.lifetime) ·
 rates recomputed (and in the constructor) -> bumpMaxRates(rates.perSecond) · evaluateAchievements AFTER the milestone check in click / purchase / update / applyOffline (NOT in constructor, no event there);
 one 'achievement' event per evaluation that unlocked >= 1 (fires LAST, after unlock/milestone events) · reset() -> emptyStats(t) + { unlocked: {} } then the existing 'reset' event.
 Existing event order and every number unchanged.

// ---- C5 Persistence (T3) ----
schema.ts: readSettings = normalizeSettings (lenient, never fails); readStats(input, state, nowMs): StatsState (missing/invalid -> deriveStats; per field non-finite/negative -> derived value; resource maps per key);
  readAchievements(input): AchievementsState (unknown ids dropped, non-finite timestamps dropped, missing -> empty). validateEnvelope returns envelope.stats + envelope.achievements always filled.
types.ts: SaveEnvelope += stats: StatsState; achievements: AchievementsState.  LoadResult += stats: StatsState; achievements: AchievementsState (always filled, fresh() uses emptyStats / empty).
codec.ts: serialize(state, settings, nowMs, meta?: { stats: StatsState; achievements: AchievementsState }) (meta omitted -> both fields omitted);
  parseEnvelope(raw: string, nowMs, migrations?): { ok: true; envelope: SaveEnvelope; migrated: boolean } | { ok: false; error: string }  (JSON.parse -> migrate -> validateEnvelope); deserialize uses it, behaviour unchanged.
exchange.ts (new): encodeSave(json: string): string (base64 of UTF-8, standard alphabet, padded, via btoa + TextEncoder, no Buffer);
  decodeSave(text: string): { ok: true; json: string } | { ok: false; error: string } (trim whitespace/newlines; text starting '{' accepted as raw JSON; > 1 MB or invalid base64 -> error);
  parseImport(text: string, nowMs: number): { ok: true; envelope; migrated } | { ok: false; error } (decodeSave -> parseEnvelope; never 'recovered'; every error string <= 80 chars, player-readable).
saveManager.ts: save(state, settings, nowMs, meta?): boolean;  backup(key: string): boolean (copies current raw save to `key`, false when none/refused).  balance.ts: SAVE_PREIMPORT_KEY = 'wedtmd.save.preimport'.
saveController.ts: saveNow passes { stats: session.stats, achievements: session.achievements }; exportString(): string (= encodeSave of the serialized current save);
  importString(text): { ok: true } | { ok: false; error: string }: parseImport fails -> { ok:false } and storage UNTOUCHED; ok -> backup(SAVE_PREIMPORT_KEY), save(imported.state, CURRENT session.settings, imported savedAt, { imported stats, achievements }),
  then suspended = true (saveNow returns false without writing; autosave + listeners disposed). Also saveNow on 'achievement' event. Caller reloads the page.
startup.ts: new GameSession({ state, settings, stats: load.stats, achievements: load.achievements, now }).

// ---- C6 Formatting (T5: src/utils/format.ts) ----
setDefaultNotation(n: NumberNotation): void;  getDefaultNotation(): NumberNotation   // module state, initial 'suffix'
formatNumber / formatCost / formatRate: notation param (3rd / 2nd / 2nd) defaults to getDefaultNotation() evaluated at CALL time; explicit argument wins; outputs at 'suffix' identical to today.

// ---- C7 Keyboard + focus (T5: src/ui/hotkeyRules.ts pure, src/ui/hotkeys.ts DOM) ----
export type HotkeyAction = 'crank' | 'techTree' | 'menu';
export type HotkeyTargetKind = 'editable' | 'interactive' | 'other';
export interface HotkeyEventLike { key: string; repeat: boolean; ctrl: boolean; meta: boolean; alt: boolean; targetKind: HotkeyTargetKind; modalOpen: boolean }
resolveHotkey(e: HotkeyEventLike, lastCrankMs: number, nowMs: number): HotkeyAction | null
  // any of ctrl/meta/alt -> null; targetKind 'editable' -> null for every key;
  // crank: key in CRANK_KEYS.keys, !repeat, !modalOpen, targetKind 'other', nowMs - lastCrankMs >= 1000 / CRANK_KEYS.maxPerSecond (66.67 ms: 66 -> null, 67 -> 'crank');
  // techTree: key lower-cased === HOTKEYS.techTree, any targetKind except editable, any modalOpen state, !repeat; menu: key === 'Escape' && !modalOpen && !repeat.
wrapFocusIndex(index: number, count: number, backwards: boolean): number   // count 0 -> -1; index -1/out of range -> first (forward) or last (backwards); wraps
bindHotkeys(target: Window, deps: { modals: ModalStack; crank(): void; toggleTechTree(): void; openMenu(): void; now?(): number }): () => void
  // bubble-phase keydown; classifies event.target (INPUT/TEXTAREA/SELECT/contenteditable -> editable; BUTTON/A/SUMMARY/[role=button|tab|radio|switch|checkbox|slider]/INPUT[type=range|checkbox|radio] -> interactive; else other; check 'editable' first, text inputs only);
  // preventDefault on handled keys; lastCrankMs updated only when the crank action fires; returns disposer.
trapFocus(container: HTMLElement): () => void      // keydown Tab / Shift+Tab: focus cycles over visible focusable descendants (wrapFocusIndex), preventDefault; disposer removes the listener
GameCommands += crank: Signal<void>   (src/game/context.ts)   // HandCrank subscribes: same effect as a pointer click

// ---- C8 System menu (T6 shell, T7/T8 panels, T9 wiring) ----
export interface SystemMenuPanel { id: string; label: string; mount(host: HTMLElement): { refresh(): void; destroy(): void } }
SystemMenuDeps += panels?: readonly SystemMenuPanel[]   // optional until T9
Tabs (role tablist, roving tabindex, Arrow Left/Right/Home/End, Enter/Space activate): SYSTEM (existing controls, ids kept: #sys-mute #sys-save #sys-reset #sys-reset-cancel #sys-feedback #sys-close) then one tab per deps.panels entry in order
(T9 passes: SETTINGS, STATS, RECORDS, DATA). Tab ids `sys-tab-<id>`, panel ids `sys-panel-<id>`; aria-controls / aria-labelledby wired; only the active tabpanel is visible. Opening the menu selects SYSTEM and focuses #sys-close as today.
refresh() of the active panel on tab show and on menu open. Panel width min(640px, 94vw), max-height 86vh, content scrolls inside.
9-slice: inline CSS vars on #system-menu: --ui-panel: url(<UI_ART.panel>) ; --ui-button: url(<UI_ART.button>); CSS `border-image: var(--ui-panel) 8 fill / 16px; image-rendering: pixelated` with the current border/colour as fallback.
Panel dep interfaces (T7/T8 code against these; T9 supplies them):
  SettingsPanelDeps { get(): Readonly<SettingsState>; update(patch: Partial<SettingsState>): void; subscribe(fn: () => void): () => void }
  StatsPanelDeps    { getStats(): Readonly<StatsState>; subscribe(fn: () => void): () => void }
  RecordsPanelDeps  { getUnlocked(): Readonly<AchievementsState>; subscribe(fn: () => void): () => void }
  DataPanelDeps     { exportString(): string; importString(text: string): { ok: true } | { ok: false; error: string }; reload(): void; modals: ModalStack; copyText?(text: string): Promise<boolean> }
  every createXPanel(host: HTMLElement, deps): { refresh(): void; destroy(): void }
```

---

# WAVE 1 (parallel: T1a, T1b, T5, T6 - disjoint files; repo green at start)
Requires WP11 W1 merged (done). No WP11 W2/W3 file touched.

## T1a - Settings, stats and types

**wave**: 1. **files_owned**: `src/data/types.ts`, new `src/data/settings.ts`, new `src/simulation/settings.ts`, new `src/simulation/settings.test.ts`, new `src/simulation/stats.ts`, new `src/simulation/stats.test.ts`, `src/simulation/state.ts`, `src/simulation/state.test.ts`

**objective**: land C1 (types only: NOT SaveEnvelope/LoadResult), C2 and the stats half of C3 exactly. `DEFAULT_SETTINGS` keeps its export name/path and becomes the full object.

**context**: read `src/data/types.ts` (`SettingsState` is `{ muted: boolean }` on one line near the end; replace that line; add `NumberNotation`, `UiScale`, `StatsState`, `AchievementsState` and `import type { AchievementId } from './achievements'` at the top; the file starts with a long `TECH_IDS` line, edit surgically). `src/data/achievements.ts` is created by T1b in this wave (transient import error until then). `src/simulation/state.ts` (`DEFAULT_SETTINGS = { muted: false }`) -> `normalizeSettings(undefined)`; `state.test.ts`: fix literals to `{ ...DEFAULT_SETTINGS, ... }` and add a test that `DEFAULT_SETTINGS` deep-equals `DEFAULT_SETTINGS_VALUES`. `src/utils/format.ts` defines the same `NumberNotation` union: T5 will switch it to import from types; do NOT edit format.ts.
Tests: `settings.test.ts` table-driven normalizeSettings: for EACH field missing / wrong type / out of range / float volume (72.6 -> 73, 150 -> 100, -5 -> 0, NaN -> default) / unknown enum / extra keys dropped / non-object raw (null, 3, 'x', []) / base honoured per field / result never the same object; `motionPolicy` 4 combos (reducedMotion x screenShake) incl. `maxDegPerSec` values; data sanity (`VOLUME_RANGE`, step divides range, `UI_SCALES` contains the default). `stats.test.ts`: `emptyStats`, `deriveStats` from `createInitialState` and from a state with clicks/lifetime/createdAt, `addLifetimeDelta` (adds positives, ignores negatives and NaN, same object when nothing added, does not mutate inputs), `bumpMaxRates` (max, same object when not raised).

**constraints**: pure; no Phaser/DOM; no `any`; return new objects; labels (`SETTINGS_LABELS`) and every constant in `data/settings.ts`.

**acceptance**: C1/C2/C3-stats exact; all table tests; `DEFAULT_SETTINGS` equals the default values; `muted` behaviour unchanged.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/settings.test.ts src/simulation/stats.test.ts src/simulation/state.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data/(types|settings)|simulation/(settings|stats|state))" && echo CHECK || echo OK    # only the AchievementId import may fail until T1b lands
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/settings.ts src/simulation/settings.ts src/simulation/stats.ts && echo FAIL || echo OK
git diff --stat -- src/data/technologies.ts src/data/machineComponents.ts src/data/world.ts     # must be empty
```

## T1b - Achievements data + evaluator (+ settings-literal glue)

**wave**: 1. **files_owned**: new `src/data/achievements.ts`, new `src/data/achievements.test.ts`, new `src/simulation/achievements.ts`, new `src/simulation/achievements.test.ts`; glue: `src/persistence/schema.ts` (`readSettings` function ONLY), `src/persistence/persistence.test.ts`, `src/persistence/saveController.test.ts`, `src/persistence/startup.test.ts`, `src/simulation/GameSession.test.ts` (settings literals / expectations ONLY)

**objective**: (1) C3 achievements exactly: write the `ACHIEVEMENT_IDS` const + `AchievementId` FIRST (T1a's types.ts imports it), then the rest. (2) Glue so typecheck stays green once T1a makes `SettingsState` full: fix every `{ muted: x }` typed as settings.

**context**: `ART_ERA5.md` §9 holds the badge id/icon map: the bold ids in the C3 table must carry that icon (cross-check, the table in the contract wins on conflict, report it). Tech ids must exist in `TECHNOLOGIES`; resources in `RESOURCE_IDS`. `conditionMet` takes `(c, state, stats)`; `techsOwned` counts `techLevels[id] >= 1 && TECHNOLOGIES[id].kind !== 'starting'` (`handCrank` is `starting`). `evaluateAchievements` returns the SAME `current` object when nothing new and `unlocked: []`.
Glue: `schema.ts` `readSettings(input)`: unchanged logic (undefined -> defaults; non-object -> fail; `muted` wrong type -> fail), but returns `{ ...DEFAULT_SETTINGS, muted }` (DEFAULT_SETTINGS becomes full via T1a, same wave). Test files: replace `settings: { muted: X }` / `toEqual({ muted: X })` by `{ ...DEFAULT_SETTINGS, muted: X }` (import from `../simulation/state` where missing). Change nothing else in those tests.
Tests: `achievements.test.ts` (data): 31 rows, ids unique, order = `ACHIEVEMENT_IDS`, `ACHIEVEMENTS[id].id === id`, every bold §9 id present with its icon, icon 0..15 integer, tech ids exist, names <= 24 / descriptions <= 60 chars, exactly 5 secret rows (eraExotic, alignment, restoration, newCycle) -> assert the set, `UI_ART` frame numbers, thresholds positive. `achievements.test.ts` (sim): conditionMet per type (stat each key, tech minLevel, lifetime specific + 'any', maxRate, techsOwned excluding starting), evaluate: none -> same object, one, several in list order, never re-unlocks, keeps foreign timestamps, custom `defs` argument, `nowMs` recorded.

**constraints**: pure; data file holds all text; no `any`; glue edits are literal/expectation-only.

**acceptance**: 31 rows per C3; §9 icons; evaluator semantics; `npx vitest run src/persistence src/simulation/GameSession.test.ts` green after T1a lands (re-run at the end).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/achievements.test.ts src/simulation/achievements.test.ts
npx vitest run src/persistence src/simulation/GameSession.test.ts     # needs T1a DEFAULT_SETTINGS: if T1a not landed yet, wait / report
npx tsc --noEmit 2>&1 | grep -E "^src/(data/achievements|simulation/achievements|persistence|simulation/GameSession)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/achievements.ts src/simulation/achievements.ts && echo FAIL || echo OK
git diff -U0 -- src/persistence/schema.ts | grep -E "^[-+][^-+]"      # only the readSettings lines
```

## T5 - Notation + keyboard core

**wave**: 1. **files_owned**: `src/utils/format.ts`, `src/utils/format.test.ts`, new `src/ui/hotkeyRules.ts`, new `src/ui/hotkeyRules.test.ts`, new `src/ui/hotkeys.ts`, `src/game/context.ts`, `src/game/entities/HandCrank.ts`, `src/game/bootstrap.ts` (ONE line: `crank: createSignal()` in the `commands` object)

**objective**: C6, C7 and the crank command path. Eras I-V outputs identical at the default notation.

**context**: `format.ts`: replace the local `NumberNotation` type by `import type { NumberNotation } from '../data/types'` + `export type { NumberNotation }` (T1a adds it to types.ts in this wave: transient). `formatNumber(n, mode = 'floor', notation?: NumberNotation)` resolves `notation ?? currentNotation` at call time; `formatCost` / `formatRate` already forward an optional notation. `HandCrank.ts` (read it): extract the `onPointerDown` body into one private method `crank()`; pointer path and `ctx.commands.crank.on(() => this.crank())` both call it (unsubscribe in `destroy()`); replace `this.machine.shake()` by `if (motionPolicy(this.ctx.session.settings).shake) this.machine.shake();` (`import { motionPolicy } from '../../simulation/settings'`, T1a, transient). Pulse stop unchanged. Do not touch `MachineView`. `context.ts`: add `crank: Signal<void>` to `GameCommands`. `hotkeys.ts` uses `HOTKEYS`, `CRANK_KEYS` from `../data/settings` (T1a) and `ModalStack` from `./modalStack`; classification per C7; no key listener for Escape (the capture-phase stack listener already handles Esc-close and stops propagation).
Tests: `format.test.ts`: all existing assertions untouched; default switch (`setDefaultNotation('scientific')` makes `formatNumber(1.5e6)` = `1.5e6`-style per existing scientific outputs; explicit argument wins; `getDefaultNotation`; `formatCost` / `formatRate` follow); `afterEach` resets to 'suffix'. `hotkeyRules.test.ts`: crank table (Space, Enter, other key, repeat ignored, modifiers, editable, interactive, modalOpen, 66 ms -> null / 67 ms -> 'crank', first press with lastCrankMs = -Infinity), 't'/'T' toggle in every non-editable state incl. modalOpen, repeat ignored, Escape only when `!modalOpen`, unrelated keys -> null, `wrapFocusIndex` table (forward wrap, backwards wrap, count 0/1, index -1).

**constraints**: `hotkeyRules.ts` pure (no DOM types beyond plain objects); `hotkeys.ts` DOM only, no Phaser; no tech-id literals.

**acceptance**: C6 + C7 signatures exact; crank command = pointer path; all existing format tests green unchanged; 15/s boundary tested.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/utils src/ui/hotkeyRules.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(utils|ui/hotkey|game/(context|entities/HandCrank|bootstrap))" && echo CHECK || echo OK     # NumberNotation / motionPolicy imports may fail until T1a lands
grep -nE "from ['\"]phaser|\b(window|document)\b" src/utils/format.ts src/ui/hotkeyRules.ts && echo FAIL || echo OK
git diff -U0 -- src/game/bootstrap.ts | grep -E "^[-+][^-+]"      # exactly the one commands line
```

## T6 - System menu shell

**wave**: 1. **files_owned**: `src/ui/systemMenu.ts`, `src/ui/systemMenuModel.ts`, `src/ui/systemMenuModel.test.ts`, `src/ui/systemMenu.css`, `src/data/systemMenu.ts`

**objective**: tabbed shell per C8; every existing id, label, flow and the two-step reset unchanged; panels plug in via `deps.panels` (optional).

**context**: read `systemMenu.ts` (DOM skeleton: `panel` holds title, mute, save, reset, cancel, feedback, close), `systemMenuModel.ts` (`reduceReset`, labels), `systemMenu.css`, `data/systemMenu.ts` (config + labels). Keep `title` `#sys-title` ('SYSTEM'), `#sys-close` ('CLOSE [ESC]') OUTSIDE the tab panels (always visible); the existing mute/save/reset/cancel/feedback move into the SYSTEM tabpanel `#sys-panel-system`. Pure model (add to `systemMenuModel.ts`, tested): `nextTab(index, count, key: 'ArrowRight'|'ArrowLeft'|'Home'|'End'): number` (wraps), `clampTab(index, count)`. Tab buttons: `role="tab"`, `aria-selected`, roving `tabindex` (selected 0, others -1), `aria-controls`; tabpanels `role="tabpanel"` `aria-labelledby`, `hidden` when inactive. Panels from `deps.panels` are mounted ONCE at menu creation into their tabpanel host via `mount(host)`; keep the returned handle; `refresh()` the active one on tab show and on `open()`; `destroy()` all in `destroy()`. `trapFocus(overlay)` from `./hotkeys` (T5 same wave: transient import) activated on `open()`, disposed on `close()` / `destroy()`. `close()` also resets the selected tab to SYSTEM. 9-slice via inline CSS vars `--ui-panel` / `--ui-button` set from `UI_ART` (`../data/achievements`, T1b same wave; if not yet landed use the literal paths from C3 behind a `// TODO` only if truly missing, report) and CSS `border-image` with current border colour kept as fallback. Labels/ids in `data/systemMenu.ts` (`MENU_TABS`: id `system`, label `SYSTEM`). CSS: width `min(640px, 94vw)`, `max-height: 86vh`, panel body `overflow:auto`, tab buttons min 12 px text, `:focus-visible` outlines, `.is-active` tab state; keep existing selectors working.
Tests: model tests (next/prev/home/end/wrap, 1 tab, clamp). wp4 smoke behaviour unchanged (cannot run here; keep ids).

**constraints**: no new key listener for Escape (modal stack owns it); no Phaser; `SystemMenuDeps` keeps all current fields, adds `panels?: readonly SystemMenuPanel[]` (export `SystemMenuPanel` from `systemMenu.ts`).

**acceptance**: one tab with `panels` omitted; N+1 tabs with panels; roving focus + arrow keys; aria wiring; focus trap on open; ids/flows intact; reset two-step intact; 9-slice vars + fallback.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/systemMenuModel.test.ts src/ui/modalStack.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(ui/systemMenu|data/systemMenu)" && echo CHECK || echo OK     # trapFocus / UI_ART imports may fail until T5 / T1b land
grep -nE "from ['\"]phaser" src/ui/systemMenu.ts src/ui/systemMenuModel.ts && echo FAIL || echo OK
grep -n "sys-mute\|sys-save\|sys-reset\|sys-reset-cancel\|sys-feedback\|sys-close\|sys-title" src/ui/systemMenu.ts | head -20     # all seven ids still created
```

---

# WAVE 2 (parallel: T2, T4, T7, T8 - disjoint files; W1 merged + typecheck clean)
Requires WP11 W1 merged (done). No WP11 W3 file touched.

## T2 - GameSession integration

**wave**: 2. **files_owned**: `src/simulation/GameSession.ts`, `src/simulation/events.ts`, `src/simulation/index.ts`, `src/simulation/GameSession.test.ts`, new `src/simulation/GameSession.stats.test.ts`

**objective**: C4 exactly. Depends on T1a (`normalizeSettings`, stats fns) and T1b (`evaluateAchievements`).

**context**: read the whole `GameSession.ts` (`click`, `purchase`, `update`, `applyOffline`, `reset`, `setMuted`, private `setState`, `checkMilestones`). `setState(next)`: `addLifetimeDelta(this.stats, this.current.lifetime, next.lifetime)` BEFORE replacing `current`; when rates are recomputed (`techLevels` changed) call `bumpMaxRates`. Constructor: `bumpMaxRates` once on the computed rates; settings via `normalizeSettings(options.settings ?? {})` (full object, copy); stats default `deriveStats(options.state, this.clock())`; achievements default `{ unlocked: {} }`. `update()`: only the branch that advances time (not delegating to applyOffline) adds `dt` to `activeSeconds` (dt = the clamped value that is passed to `advance`). `applyOffline`: after `applyOfflineState`, `offlineSeconds += report.cappedSeconds`, `longestOfflineSeconds = max(...)`. Private `checkAchievements()` called as the LAST step of click/purchase/update/applyOffline (after `checkMilestones()`): evaluate with `this.current`, `this.stats`; when `unlocked.length > 0` store, bump revision, emit `'achievement'` once. `updateSettings` per C4 (shallow-equal over all fields; reuse `normalizeSettings` and compare keys); `setMuted(m)` -> `updateSettings({ muted: m })`. `reset(t)`: `emptyStats(t)`, empty achievements, then the existing flow. Update the class doc comment and `events.ts` (new event + settings comment); `index.ts` exports `normalizeSettings`, `motionPolicy`, stats + achievement functions (additive).
Tests (`GameSession.stats.test.ts`, deterministic clock, never real time): clicks/purchases counters (failed purchase no count), activeSeconds adds clamped dt and nothing on the offline path, offline credits capped seconds + longest = max(elapsed), lifetime delta across click/purchase(no change)/update, `maxPerSecond` after a rate-raising purchase and at construction, reset zeros stats + achievements + still keeps settings, stats/achievements options honoured, `updateSettings` (no-op on equal: no event, no revision change; single emit on change; volume clamp via normalize; multi-field patch = one event), `setMuted` unchanged behaviour, achievement event: firstTurn on first click, coalesced (two unlocks in one evaluation -> one event with 2 ids in list order), fires AFTER 'milestone' events (record order), not fired from the constructor, no re-fire on later calls, achievements persist across reset? NO: reset clears them. `GameSession.test.ts`: existing cases stay green; update only what the new `settings` event semantics require.

**constraints**: pure; Era I-V numbers and the old event order untouched; no `any`.

**acceptance**: C4 rules each unit-tested; whole existing suite green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/simulation/GameSession.ts src/simulation/events.ts src/simulation/index.ts && echo FAIL || echo OK
npx vitest run src/simulation/balance.sim.test.ts 2>&1 | tail -5      # era I-V times unchanged
```

## T4 - Audio volumes

**wave**: 2. **files_owned**: `src/data/audio.ts` (bus constants only), `src/audio/synth.ts`, `src/audio/gameAudio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`

**objective**: D6. Master / SFX / ambient volumes from `session.settings`, applied live; mute unchanged; no AudioContext before a gesture.

**context**: read all five files (WP11 T8 added drone / swell / bead ticks: committed). `audioMath.ts` (pure): `busGain(volumePct: number): number` (clamp 0..100, /100; non-finite -> 1), `masterTarget(muted, unlocked, base, volume01 = 1): number` (existing semantics, times `volume01`; muted or locked -> 0 still wins; look at the current function signature and keep old call forms working). `synth.ts`: two gain buses under the master node, `sfx` and `ambient`; `setBusGain(bus: 'sfx' | 'ambient', gain: number, rampSeconds: number): void` (`setTargetAtTime`-style ramp with `AUDIO.rampSeconds`); route every `play*` one-shot (click thunk, relay, hiss, fork ping, chord, whistle, sting, swell, bead ticks, ...) to `sfx`, every persistent `set*` loop (hum, pad, drone, steam beds...) and `schedule*` series to `ambient`; nothing may bypass both buses. `data/audio.ts`: add bus constants only if needed (e.g. `buses: { sfx: 1, ambient: 1 }` defaults). `gameAudio.ts`: apply master (`masterTarget(muted, unlocked, AUDIO.masterGain, busGain(masterVolume))`), `setBusGain('sfx', busGain(sfxVolume))`, `setBusGain('ambient', busGain(ambientVolume))` on boot-unlock, on every `settings` event and in `tick()` as today; the existing mute path stays. No tech-id literals.
Tests (`audioMath.test.ts`, existing cases untouched): `busGain` 0 / 50 / 100 / 150 clamp / -10 / NaN; `masterTarget` with volume 0, 0.5, 1; muted with volume 1 -> 0; locked -> 0.

**constraints**: no 0x colour literals; audio nodes created only after the unlock gesture (current lazy logic kept); errors never escape (existing `run` guard).

**acceptance**: `setBusGain` exists with that signature; routing per D6; settings event applies all three volumes; mute unchanged.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo CHECK || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
grep -nE "'(nullChamber|finalAlignment|resonatorSpire|echoCrank|crankServo|harmonicConvergence|pressureVesselBlueprint)'" src/audio/*.ts && echo FAIL_LITERAL || echo OK
```

## T7 - Settings + stats panels

**wave**: 2. **files_owned**: new `src/ui/menu/settingsPanel.ts`, new `src/ui/menu/settingsView.ts`, new `src/ui/menu/settingsView.test.ts`, new `src/ui/menu/statsPanel.ts`, new `src/ui/menu/statsView.ts`, new `src/ui/menu/statsView.test.ts`, new `src/ui/menu/settingsPanel.css`, new `src/ui/menu/statsPanel.css`

**objective**: SETTINGS and STATS tab content per C8 using only the panel dep interfaces.

**context**: `settingsView.ts` (pure): `settingsViewModel(s: SettingsState)` -> list of control descriptors (volume rows: id, label, value, `valueText` "70 %", min/max/step from `VOLUME_RANGE`; radio groups `notation` (NOTATIONS) and `uiScale` (UI_SCALES) each with `checked`; toggles `reducedMotion`, `statusMarkers`, `screenShake` with `pressed` + `stateText` 'ON'/'OFF'; shake: when `reducedMotion` -> `stateText` 'OFF (REDUCED MOTION)', `disabled: true`), plus `uiRootAttrs(s: SettingsState): { zoom: string; statusMarkers: 'on' | 'off'; reducedMotion: 'on' | 'off' }` (`zoom` = `String(uiScale / 100)`; T9 applies it), plus `hotkeyHelpLines(): string[]` from `HOTKEYS` / `CRANK_KEYS` (e.g. 'SPACE / ENTER  CRANK', 'T  TECH TREE', 'ESC  MENU'). Texts from `SETTINGS_LABELS` (T1a `data/settings.ts`). `settingsPanel.ts` (DOM): `createSettingsPanel(host, deps: SettingsPanelDeps)`: `<input type=range>` with `aria-valuetext`, label elements, `role="radiogroup"` + native radio inputs (or buttons with `role=radio`, `aria-checked`, arrow-key roving), toggle `<button aria-pressed>` with ON/OFF text; every change -> `deps.update({ field: value })` on the `change` (range: `change` for commit AND `input` for live text update only); `refresh()` re-reads `deps.get()` and rewrites only changed values (never rebuild the DOM, keep focus); `subscribe(refresh)`; `destroy()` unsubscribes + removes nodes. Hotkey help block at the bottom. `statsView.ts` (pure): `statsRows(stats: StatsState, resources = RESOURCES): Array<{ label: string; value: string }>`: PLAYTIME `formatDuration(activeSeconds)`, TIME AWAY `formatDuration(offlineSeconds)`, LONGEST ABSENCE, CLICKS, PURCHASES (formatNumber), CYCLE (`cycles`), then per resource with `lifetime[r] > 0`: `<SHORT> TOTAL` and `<SHORT> BEST RATE` (short name from `RESOURCES`, xf short is `???`; `formatNumber` / `formatRate`, which follow the default notation). `statsPanel.ts` (DOM): `<dl>` rows via textContent; `refresh()` rewrites only changed cells; subscribe on creation. CSS files: `:focus-visible`, min 12 px, layout in the 640 px panel, use CSS vars / `PALETTE_CSS` only through existing variable names found in `src/ui/*.css` (read them, reuse the names).
Tests (`*View.test.ts`): model for default + changed settings, valueText, reducedMotion shake state, radio checked flags, `uiRootAttrs` for 100/125/150, help lines; stats rows for empty stats (only the fixed rows), with `me` + `xf` lifetime (xf row label `???`), duration formatting, notation follows `setDefaultNotation` (reset in afterEach).

**constraints**: panels import nothing from `simulation/GameSession` or `persistence`; textContent only; views pure.

**acceptance**: controls as listed; every change goes through `deps.update`; shake disabled while reduced; stats rows rule; tests green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/menu
npx tsc --noEmit 2>&1 | grep -E "^src/ui/menu" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/ui/menu/settingsView.ts src/ui/menu/statsView.ts && echo FAIL || echo OK
grep -n "innerHTML" src/ui/menu/*.ts && echo FAIL || echo OK
```

## T8 - Records + data panels + achievement toast

**wave**: 2. **files_owned**: new `src/ui/menu/achievementsPanel.ts`, new `src/ui/menu/achievementsView.ts`, new `src/ui/menu/achievementsView.test.ts`, new `src/ui/menu/dataPanel.ts`, new `src/ui/menu/dataModel.ts`, new `src/ui/menu/dataModel.test.ts`, new `src/ui/menu/achievementsPanel.css`, new `src/ui/menu/dataPanel.css`, `src/ui/notificationRules.ts`, `src/ui/notificationRules.test.ts`, `src/ui/toasts.ts`, `src/data/notifications.ts` (texts only)

**objective**: RECORDS grid, DATA export/import UI, coalesced achievement toast (D5).

**context**: `achievementsView.ts` (pure): `achievementCards(unlocked: AchievementsState['unlocked'], defs = ACHIEVEMENT_LIST)` -> per card `{ id, name, description, unlocked, locked, secretHidden, badge: { sheet: path, frameIndex, bgPosition: `-${frame*24*2}px 0` ... } }` for a 24x24 frame drawn at x2 (48 px box, `background-size` = sheet width x2: take sheet width = 16 frames x 24 px = 384 -> 768 px; derive from `UI_ART.badgeFrame`, 16 frames), locked -> `UI_ART.badgesLocked` + lock icon (`UI_ART.icon.lock`, `icons16`) + text 'LOCKED'; secret locked -> name '???', description 'CLASSIFIED'; `counterText(unlocked, total)` = `N/31 LOGGED` (total from the list). `achievementsPanel.ts` (DOM): `createAchievementsPanel(host, deps: RecordsPanelDeps)`: `role="list"` of `role="listitem"` cards (text for every card, so screen readers need no art), counter line, `refresh()` re-reads `deps.getUnlocked()` and updates only changed cards (no rebuild). `dataModel.ts` (pure): `reduceImport(state, event)` = thin wrapper over `reduceReset` from `../systemMenuModel` (idle|armed, same 5 s arm window; texts in a `DATA_LABELS` const added to `data/notifications.ts`), `trimImportText`, `copyStatusLabel(ok: boolean)` ('COPIED' / 'SELECT AND COPY'), `canImport(text)` (non-empty after trim). `dataPanel.ts` (DOM): `createDataPanel(host, deps: DataPanelDeps)`: EXPORT button fills a readonly `<textarea>` with `deps.exportString()`, selects it, best-effort `deps.copyText?.()` (default `navigator.clipboard.writeText`, failure swallowed) -> status text; IMPORT `<textarea>` + IMPORT button -> first press arms (label changes, reuses the 5 s expiry like reset, pushes a modal-stack entry `data-import` so Esc cancels first), second press calls `deps.importString(text)`: `ok` -> `deps.reload()`, error -> text in an `aria-live="polite"` element; textarea typing never triggers hotkeys (no extra code needed: T5 treats 'editable'; do not stop propagation). Notifications: `notificationRules.ts` add `achievementMessage(ids: AchievementId[], defs = ACHIEVEMENTS): ToastMessage` per D5 (1 -> title `RECORD LOGGED`, body = name; >= 2 -> `N RECORDS LOGGED`, body first two names + `…`; tone 'system'; unknown id ignored; empty -> caller must not show) with its tests; `toasts.ts` add `connectAchievements(session: GameSession, toasts: Toasts): () => void` (subscribes `'achievement'` — T2 same wave: transient). Texts in `data/notifications.ts`.
Tests: card model (locked, unlocked, secret locked, secret unlocked, bgPosition for frame 0 / 15, counter text), D5 toast table (1, 2, 3 ids, secret id, unknown id), data model (confirm flow, canImport, copy labels).

**constraints**: textContent only; no Phaser; no GameSession import in the panels (only `toasts.ts` imports the session type); `toasts.ts` edits additive.

**acceptance**: as above; grid 24x24 at x2; 'N/31 LOGGED'; D5 texts exact; importing never touches storage here (deps do).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/ui" && echo CHECK || echo OK      # toasts.ts 'achievement' event may fail until T2 lands
grep -nE "from ['\"]phaser|\b(window|document)\b" src/ui/menu/achievementsView.ts src/ui/menu/dataModel.ts src/ui/notificationRules.ts && echo FAIL || echo OK
grep -n "innerHTML" src/ui/menu/*.ts src/ui/toasts.ts && echo FAIL || echo OK
```

---

# WAVE 3 (parallel: T3, T9, T10)
Requires WP11 **W2 fully done** (T3a/T3b merged, `persistence.test.ts` free, era V costs final). WP11 W3 may run concurrently: files are disjoint; judge tsc by the grep filters.

## T3 - Persistence + export/import

**wave**: 3. **files_owned**: `src/data/types.ts` (`SaveEnvelope`, `LoadResult` ONLY), `src/data/balance.ts` (`SAVE_PREIMPORT_KEY` only), `src/persistence/schema.ts`, `src/persistence/codec.ts`, `src/persistence/saveManager.ts`, `src/persistence/saveController.ts`, `src/persistence/startup.ts`, `src/persistence/persistence.test.ts`, `src/persistence/saveController.test.ts`, `src/persistence/startup.test.ts`, new `src/persistence/exchange.ts`, new `src/persistence/exchange.test.ts`, new `src/persistence/statsSchema.test.ts`

**objective**: C5 exactly. Depends on T1a, T1b, T2 (all landed).

**context**: read every persistence file + `src/persistence/fixtures`. `readSettings` -> `normalizeSettings(input)`; an object that is not plain (`null`, array, primitive) is treated like missing (defaults), never a failure. Flip the existing "bad `settings.muted`" row from `recovered` to `loaded` with default muted (update that test row and its comment). Every other existing case must still load as before (v1 fixture, truncated, wrong version...). `types.ts`: only add `stats` / `achievements` to the two interfaces (imports from the same file). `deserialize` + `fresh()` fill both (fresh = `emptyStats(nowMs)`, empty). `saveManager.load` error branch likewise. Import flow in `saveController` per C5 (`suspended` flag; `dispose()`; `resetProgress` unchanged; `saveNow` while suspended returns false and writes nothing, `lastSaveOk` untouched). The imported state's `lastSimTime` / `savedAt` are kept so offline time is credited by the next boot exactly like a normal load.
Tests: `exchange.test.ts` (encode/decode round-trip incl. unicode, whitespace/newline tolerant, raw JSON accepted, > 1 MB, invalid base64, empty, `parseImport` errors: truncated, non-JSON, JSON array / primitive, future version, bad state -> `{ ok:false }` with error <= 80 chars, never 'recovered'), `statsSchema.test.ts` (readStats/readAchievements per-field lenient table: missing -> derived, NaN / negative / string -> derived value, unknown achievement ids dropped, bad timestamps dropped), `persistence.test.ts` (v2 save without settings/stats/achievements -> defaults/derived status 'loaded'; lossless round trip incl. stats + achievements + all settings; bad settings fields never 'recovered'; old v1 fixture still migrates), `saveController.test.ts` (saves stats; saves on 'achievement'; `exportString` -> `importString` round trip equal state/stats/achievements; bad import -> storage byte-identical; ok import writes preimport backup, keeps CURRENT settings, suspends saves incl. interval + unload-style `saveNow`), `startup.test.ts` (stats/achievements reach the session).

**constraints**: pure (btoa/TextEncoder only, no Buffer, no DOM); `serialize` with `meta` omitted stays byte-compatible with today's output; no `any`.

**acceptance**: as WP12.md T3; every existing persistence test green (except the one flipped row).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/(persistence|data/(types|balance)|simulation)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document|Buffer)\b" src/persistence/*.ts | grep -v test && echo FAIL || echo OK
grep -n "SAVE_PREIMPORT_KEY" src/data/balance.ts
```

## T9 - Integration + tree accessibility

**wave**: 3. **files_owned**: `src/game/bootstrap.ts`, `src/ui/techTree.ts`, `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`, `src/ui/hud.ts`, `src/ui/techTree.css`, `src/ui/hud.css`, `src/ui/toasts.css`

**objective**: wire everything (settings applier, hotkeys, focus trap, panels, achievements toast, notation refresh) and add the tree accessibility. Depends on T2-T8.

**context**: `bootstrap.ts` (read; T5 added `crank`). After `saveController.start()`: (1) **settings applier** `applySettings()` called once and on `session.on('settings')`: `setDefaultNotation(s.notation)`, apply `uiRootAttrs(s)` from `../ui/menu/settingsView` (`root.style.zoom`, `root.dataset.statusMarkers`, `root.dataset.reducedMotion`). (2) **D9**: if `startup.load.status === 'new'` and `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches` -> `session.updateSettings({ reducedMotion: true })` (before the first applySettings). (3) `bindHotkeys(window, { modals, crank: () => ctx.commands.crank.emit(), toggleTechTree: () => techTree.isOpen() ? techTree.close() : ctx.commands.openTechTree.emit(), openMenu: () => ctx.commands.openSystemMenu.emit() })`. (4) `createSystemMenu(root, { ..., panels })` with `panels` = SETTINGS / STATS / RECORDS / DATA `SystemMenuPanel`s whose `mount` call `createSettingsPanel` / `createStatsPanel` / `createAchievementsPanel` / `createDataPanel` with deps built from `session` and `saveController` (`subscribe` = `session.on('settings')`, `session.on('click'|'purchase'|'offline'|'reset')` for stats, `session.on('achievement'|'reset')` for records; `reload: () => window.location.reload()`; `exportString` / `importString` from `saveController`). (5) `connectAchievements(session, toasts)`. (6) the existing `session.on('reset', toasts.clear)` stays. `techTree.ts`: node dirty on `'settings'` (so costs / requirement labels re-format on notation change); node `aria-label` from pure `nodeAriaLabel(view: TechView)` (`techTreeView.ts`, tested): "<name>, <status word>, level <n>, cost <formatCost>" (status words locked / available / purchased; maxed -> "maxed"; no cost when purchased unlockables); keep every id/class the smokes use; `data-status` already present? read and keep. Status markers (D8): CSS only, active under `#ui-root[data-status-markers="on"]`: lock / check glyph via `icons16` (`UI_ART.icon`) as background on the node, locked border dashed, available border double. Also: min 12 px text everywhere in the three css files, `:focus-visible` outline on tree nodes / tabs / buy button / HUD buttons. `hud.ts`: HUD buttons show the keys in their titles/labels: tech button `title` "TECH TREE [T]", menu button "SYSTEM [ESC]" (keep the visible text and ids; add `aria-keyshortcuts`). HUD re-render on `'settings'` (revision already bumps; ensure the render path re-reads formatted strings; a notation change must re-write the dedupe cache). `toasts.css`: min 12 px.
Tests: `techTreeView.test.ts`: `nodeAriaLabel` table (locked / available / purchased / maxed, with `setDefaultNotation('scientific')` variant, reset in afterEach); existing assertions untouched.

**constraints**: bootstrap is the only composition root; no game logic here; no Phaser import except what bootstrap already has.

**acceptance**: as WP12.md T9; 0 console errors at boot (Director smoke).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(game/bootstrap|ui)" && echo CHECK || echo OK
grep -n "innerHTML" src/ui/techTree.ts src/ui/hud.ts && echo FAIL || echo OK
grep -nE "font-size:\s*([0-9]|1[01])px" src/ui/*.css src/ui/menu/*.css && echo SMALL_FONT || echo OK
```

## T10 - Smoke + achievement reachability

**wave**: 3. **files_owned**: new `scripts/smoke/wp12-menus.mjs`, `scripts/smoke/README.md`, new `src/simulation/achievements.sim.test.ts`; Escape-guard edits ONLY in `scripts/smoke/{stages,wp2-crank,wp3-techtree,wp4-persistence,full-machine}.mjs`

**objective**: (1) sim reachability test; (2) the WP12 smoke script (written here, RUN by the Director after WP11 W3 + Mode B); (3) every bare `Escape` in the old smokes guarded (EM decision 6).

**context**: sim test: `runGreedy` (`src/simulation/sim/greedy.ts`, read only) with the profile A options of `balance.sim.test.ts` (4 clicks/s, 1 s step, 17400 s) through to `primaryFunction`. Build a `StatsState` from the run: `clicks = round(cps * seconds)`, `purchases = result.purchases.length`, `activeSeconds = seconds`, `lifetime = result.final.lifetime`, `maxPerSecond = computeRates(final).perSecond`, offline 0, cycles 1. Assert `evaluateAchievements(final, stats, empty, 0)` unlocks every id EXCEPT newCycle, shortNap, longSilence (cycle / offline rows) and asserts those three stay locked. shiftWorker is met (activeSeconds 17400 >= 3600). Also assert the fixed-threshold rows tied to the run: tinkerer / engineer (purchases) and fullIndex (techsOwned 30) per the real counts, reporting the actual numbers in NOTES if any is unmet. If `bigNumber` (lifetime any 1e15) is unmet: do NOT weaken the test; report the largest reached magnitude (log10) to the Director so T1b data is retuned (mark the test with the reached value in the NOTES only). Smoke script (Playwright, same skeleton as `wp4-persistence.mjs`: `PW_PATH`, url, outdir, `res`/`errors`, `ok()`): record keys for the Validation list in WP12.md (Esc opens menu; ArrowRight cycles tabs, Tab stays trapped (`document.activeElement` inside `#system-menu` after 12 Tabs); notation -> scientific then HUD `#hud-me` text contains `e` after cranking past 1000 (use `__wedtmd.session` to grant via crank/buys or `page.evaluate` level jumps like wp3-techtree does); master volume 40 + reduced motion + UI scale 125 survive reload (read `session.settings`); Space x10 raises `state.totalClicks` by exactly 10 and held-key repeat events (dispatch `new KeyboardEvent('keydown', { key: ' ', repeat: true })`) add 0; `t` opens/closes the tree; first crank -> `.toast` text contains `RECORD LOGGED`, RECORDS badge for firstTurn unlocked (selector from `achievementsPanel.ts`), STATS clicks cell matches; export -> `#sys-reset` two-step reset -> import -> reload restores `res.me` / tech levels / `session.stats.clicks`; garbage import shows an error text and leaves `session.state` unchanged; typing `t ` in the import textarea triggers nothing (tree stays closed, clicks unchanged); `errors` empty). Selectors: read `src/ui/menu/*Panel.ts` and `systemMenu.ts` for the real ids (T6-T8 landed). `README.md`: document `wp12-menus.mjs` + keys. Escape guards: replace a bare `page.keyboard.press('Escape')` by a guarded form (`if (await page.evaluate(() => window.__wedtmd.techTreeOpen() || window.__wedtmd.systemMenuOpen())) await page.keyboard.press('Escape')`), only where the preceding step did not guarantee an open modal; presses that close a known-open dialog stay as they are. `node --check` every file.

**constraints**: no `src/` edits except the new sim test; smoke `.mjs` only; smoke checks do not assert, only `ok(...)`.

**acceptance**: sim test green (or the single explicit `bigNumber` report); `node --check` on all six scripts; every `Escape` audited (list the lines changed in NOTES).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/achievements.sim.test.ts
for f in wp12-menus stages wp2-crank wp3-techtree wp4-persistence full-machine; do node --check scripts/smoke/$f.mjs || echo "SYNTAX FAIL $f"; done
grep -n "Escape" scripts/smoke/*.mjs
git diff --stat -- src     # only the new sim test
```

---

# WAVE 4 (single worker: T11)
Requires WP11 **W3 + its Mode B done** (owns MachineView, MachineAnimator, CameraController, Eclipse). Not before.

## T11 - Reduced motion in the game

**wave**: 4. **files_owned**: `src/game/entities/MachineView.ts`, `src/game/entities/MachineAnimator.ts`, `src/game/entities/HandCrank.ts`, `src/game/rendering/CameraController.ts`, `src/game/rendering/SteamFx.ts`, `src/game/rendering/Eclipse.ts`

**objective**: every animation obeys `motionPolicy(session.settings)` read LIVE (no restart). Default settings: pixels and timings identical (stages smoke unchanged).

**context**: re-read each file at the moment you start (WP11 W3 just rewrote four of them; edit surgically, never revert). `shake`: `MachineView.shake()` no-op when `!policy.shake` (covers click AND the landing shake; HandCrank already guards the click one: keep a single source of truth, remove the duplicate if both exist). `assemblyDrop`: part landing = fade-in only (no fly-in offset, no dust puff / landing shake) when false. `cameraTween`: `CameraController` auto-frame / refocus jump instantly (`cameraTweenMs 0`) when false. `maxDegPerSec`: the master angular speed used by the animator (every rotating driver) capped at that value when non-null. `flashes`: no spark-gap flash frames in the animator, `Eclipse` diamond flash skipped (the sprite stays on its stage frame), milestone bursts skipped (SteamFx), crank pulse ring (HandCrank) shown static at `alphaPeak` instead of pulsing. Read the policy from `session.settings` each frame / call (no caching across frames; settings change event not required). Timings / pixel numbers come from `data/world.ts` / `data/settings.ts` (`REDUCED_MOTION`), no literals.
Tests: none (no pure logic extracted; `src/game/math/animation.ts` is not owned, do the angular cap inline). Report manual checks (shake, flashes, camera, assembly) instead.

**constraints**: no change to default-settings behaviour; no `WorldScene` edit (report if the wiring needs it); no tech-id literals.

**acceptance**: as WP12.md T11; `npm run build` green; stages smoke screenshots unchanged at defaults (Director compares).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo CHECK || echo OK
npx vitest run src/game
grep -n "motionPolicy" src/game/entities/*.ts src/game/rendering/*.ts
git diff --stat -- src/game/scenes src/data     # must be empty
```

---

# Mode B checklist (EM, after W4)
`npm run typecheck` · `npm test` (>= baseline + new) · `npm run build` (app chunk <= 300 KB (relaxed: 200 KB predates eras II–V data)) · `npx vitest run src/simulation/balance.sim.test.ts` (era I-V times unchanged) ·
`grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` empty · `grep -rn "innerHTML" src/ui` empty · Director smokes `wp2-crank`, `wp3-techtree`, `wp4-persistence`, `stages`, `full-machine` unchanged + `wp12-menus.mjs` (see T10) · `git diff --stat` shows no file outside the owner lists.
