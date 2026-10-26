# WP24 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP24.md` (authoritative, Revisions 1-4) + STORY_BIBLE / DENIZEN_ART / ART_BRIEF / WP23 / ART_AUDIT; repo read at `6c90d57` (main `6258d5a` + lazyWorldKb 120 -> 140).
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/world-wp24`. Baseline: typecheck clean, 148 test files / 4736 pass / 17 skipped, build OK, app 483.2 / demo 483.8 KB (limit 500), lazy world 116.6 KB (limit 140), css 41.0 / 43.8 KB (45), `G_cost` quiet 0.17-0.19 ms (limit 0.3), displayObjects peak era V 73 / postgame 81 (100); every smoke `fail []`, `errors []`.
Fence: :4174 serves `dist/` (rebuild only, never start or stop). :4177 = this package's demo preview (`npx vite preview --outDir dist-demo --port 4177 --strictPort`, background, only when needed; `netstat -ano | grep ':4177 .*LISTENING'` before and after; `taskkill //PID <pid> //F`). Never :4173, :4175, :4176, never `C:/Users/sanan/wedtmd-art` (WP25). Load: at most 3 units per wave, one Playwright browser at a time, `vitest --maxWorkers=2`. Nobody commits; never stage `package-lock.json`.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`, `<O>` = `<S>/WP24` (dirs `tools/ val/ ad/` exist; `tools/eol.mjs` = `crlf|lf|check`), `<PW>` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`. Reference sim for the pick rule (JS, read-only): `<S>/WP24-25/pick/pick-sim-r2.mjs` (+ `final-r2.txt`, its output tables).

## Director decisions that win over the plan
Plan D1-D17 and Revision 4 stand. No element may read as static or as one repeating motion; no instant visual change anywhere. Art (new era-row cells, placeholders, palette) is Opus Art Director only. AD lands PNG + coupled data atomically (D8). X0 (rebase onto WP25) is the Director's, not a worker task; gates run on the current base. Keep `G_cost` <= 0.3 ms quiet, displayObjects <= 100, lazy world <= 140 KB. Release refresh (store-shot approval, STEAM_RELEASE, CHANGELOG release entry) is NOT WP24.

## EM decisions / deviations (these WIN for workers)
1. **Nine waves, 26 units.** Plan tasks split because each was bigger than one Haiku pass: T2 -> T2a (day data) + T2b (transition data); T5 -> T5a (queue core + simple rows) + T5b (sequence rows); T3 -> T3a (helpers + pick rule) + T3b (runner) + T3c (cues, crank, unison) + T3d (metrics + tuning); T6 -> T6a (runner-driven drawing) + T6b (blend, ramps, Sensor, drip); T7 -> T7a1 / T7a2 (WorldProps, two passes) + T7b (WorldAtmos); T10 -> T10b (new pure `worldClocks.ts`) + T10a1 (director, time side) + T10a2 (director, cast side) + T10c (WorldScene + debugHook); T9 -> T9a + T9b (both own `world.mjs`, so two waves); AD1b -> three per-wave AD tasks. T1 stays one task (the data is pasted in its prompt). X0, D13 note, T11 (EM gate), AD2, T12, T13, T14 are NOT in the wave JSON (see Post-gate).
2. **C1 additive extensions** (T1 adds them to `src/data/worldBehaviour.ts`): `Clip.edgeMs?: number` (first and last frame show edgeMs each, the middle frames fill the hold: the umbrella), `Clip.burst?: { onMs: [lo, hi]; restFrame: string; restMs: [lo, hi] }` (the dig: animated bursts between still listens), `Activity.wakeOn?: readonly CueId[]` (sleep ends on ring / rapid), `Activity.emitsAt?: 'start' | 'end'` (default 'end'), `WORLD_BEHAVIOUR.salts`, `WORLD_WALK.maxWalkMs`, `WORLD_UNISON.map` split by set (`map.pre`, `map.post`) with `UnisonClip = Clip & { perBeat?: true; accent?: string; walkFirst?: true; risePx?: number; pulse?: true }`. Static is still derived, never a data flag.
3. **Spots.** `actorBand` scans outward from the actor's base placement x one world px at a time with the same `usableX` rule as `placeOne`; a spot passes when its FEET x lies in [min, max]. The plan's "+- half body width" margin is dropped: the dog placements sit exactly 24 px off the machine edge (dog `stake` -24 lands on the band edge at e1 and s9). T1 trims the s8 / s10 Inspector lists to the spots the band accepts (>= 2, >= 24 px apart; the dog keeps 3) and reports the id / dx lists.
4. **Runner semantics** (T3a-c; plan C2 does not spell these out):
   - Clock: runner time `tMs` since `reset`. Timed modes add `dtMs` unless `ctx.paused`. Crank mode ignores `dtMs`: each crank click adds `WORLD_BEHAVIOUR.crankHoldMsPerClick` to `tMs` and 1 to the tick count (a walk advances one drawn frame per click, a clip one frame per click). Activity boundaries are analytic (next start = previous end, never `tMs`), so the sequence is dt-invariant. `reset` starts the first activity at a hash offset (`hash01(seed + salts.start, 0)` x hold) so the four runners do not start in phase.
   - Drawn frame: timed mode quantizes time to the mode fps (`playbackFps(ctx.mode)`); clip frame = floor((qT - clipStart) x clip.fps / 1000) (looped, or clamped when not looped); `frameHoldMs` clips draw each frame's hold by hash in [lo, hi]; `edgeMs`, `burst`, `dxPx[i]`, `frameAlpha[i]`, `Clip.alpha` as in the data; eras I-II looped clips use the dropped-frame seam (`WORLD_PLAYBACK.seamEras`, the index rule of `loopFrameAt`).
   - Walk: 8 world px per drawn walk frame (`WORLD_WALK.pxPerFrame`) at the mode fps taken at the walk start; frames walk0..walk3 cycle per drawn tick (reversed: walk3..walk0); `walkMs = ceil(|dx| / 8) x 1000 / fps`; `x` steps 8 px per tick (the last step clamps), never more.
   - Facing: art faces +x. A profile frame (not in `WORLD_STARE_SAFE[actor]`) rests with `flip = homeX < MACHINE_ANCHOR.x` for the Inspector and the dog; the crow and the girl never flip; camera-facing frames never flip; a walk has `flip = dir < 0` (reversed: `dir > 0`, the walker backs away).
   - Cues: the runner sees a cue at its first step (even when paused). Reaction: activities whose `reaction` holds the cue id, `when` ok, off cooldown, pair cooldown free (`WORLD_REACT.pairCooldownMs`, per actor + cue id, runner clock), chance `hash01(seed + salts.react, cue.index) < chance`; with several matches pick `floor(hash01(seed + salts.react + 1, cue.index) x n)`; due = `tMs + latency` (`hash01(seed + salts.latency, cue.index)` inside the actor's band). At due: a walk in progress waits for arrival; a current reaction or the same id drops it; else the reaction replaces the current activity (logged with its real length). `wakeOn`: the cue ends the current activity at due (no chance gate) and the normal pick follows.
   - Emits: `emitsAt 'start'` fires on the first step of the hold (after the walk); `'end'` on the step the activity ends. One cue per step.
   - Pause: while `ctx.paused` the previous frame is returned unchanged (clock, frame, x held). Rehome: `rehome(homeX)` puts the position on the new home spot and cancels a walk; the activity continues. Era change: the current activity ends at its next boundary and the next pick uses the new era list; era IV joins the conductor at the first downbeat after the activity ends, at most `WORLD_BEHAVIOUR.unisonJoinBeats` (3) beats after the era change.
   - Parked: `girlStage 'window'`, `demoHold`, or no eligible activity: frame `activity 'parked'`, `frame ''` (renderers draw nothing).
   - `step` returns ONE preallocated frame object per runner (mutated in place; callers never retain it). `BehaviourFrame.frame` is the RAW clip frame; renderers apply `stareFrame` (decision 7).
5. **WorldTween** (T5a creates; shape fixed here; `Blend = { from: number; to: number; k: number }`, settled = `from === to`, `k === 1`): `eraRow: Blend` (sheet row 0-5), `alpha`, `shadowScale`, `shadows` (0-1), `drawFps` (0 crank, 2, 4, 8, ramping), `led: Blend` (0 red, 1 amber), `lamp: Blend` (0 dead, 1 lit, 2 warm; the buzz-on and flicker-out stutters toggle `k` between 0 and 1), `glowAlpha` (0-1), `glowWarm: boolean`, `booth: Blend` (0 dark, 1 lit), `windows: number[6]` (0-1; dim = `WORLD_ENV.windowDimLevel`), `breatheK`, `pulseK`, `girlWindow: { alpha; slowK }`, `motes: number[5]` (alpha), `motesFreezeK`, `moteFall: number[5]` (0-1 progress), `hole: Blend` (stage 0-4), `scrapBurn: number[3]` (0 whole .. 1 gone), `puddle: Blend` (size 0-3), `puddleBlackK`, `sprout: Blend` (stage 0-4), `boothFog`, `sensorFog`, `chladni: number[5]` (ring alpha), `chladniViolet`, `virga: { alpha; speed }` (0-1 normalized), `receiverLevelK`, `stareK` (0-1), `reverseOn`, `unisonOn`, `micro: MicroFlags`. Preallocated, mutated in place.
6. **MicroFlags / MicroKind** live in `src/data/worldDay.ts` (T2a, W1) so every later task can import them: `MicroFlags = { hitch, ledBlink, ledDim, lampDip, boothDip, girlWindowDim, clockTwitch: boolean; pageStarts: number }`, `MicroKind = 'hitch' | 'ledBlink' | 'ledDim' | 'lampDip' | 'boothDip' | 'girlWindowDim' | 'clockTwitch' | 'pages'`. **Ambient / WeatherState** live in `src/game/math/worldDay.ts` (T4, W2): `Ambient = { wind, dustDrift, virgaAlpha, virgaSpeed, lampGain, shadowDx, shadowWidth: number; micro: MicroFlags }` (lampGain = `lampGain(min)`, shadowDx / shadowWidth = `shadowOf(min)`) (presented virga alpha = `tween.virga.alpha` x `ambient.virgaAlpha`, speed likewise: the queue owns the fall / frozen / fade transitions, the weather only scales era III); `WeatherState = { era; label: 'dry' | 'front' | 'calm' | 'still'; baseWind; gusts: boolean; virgaAlpha; virgaSpeed; dustDrift: boolean; vents: boolean }`.
7. **Stare per actor.** `stareActive(actor, stare: boolean, stareK: number): boolean` (T5a, `worldTransitions.ts`) = `stare && stareK >= WORLD_TRANSITIONS.rows.stare.offsets[actor]`. The runner takes `ctx.stare = state.stare` (era IV set choice, looks); the renderer draws `stareFrame(id, frame, walking, stareActive(...))`, so the four walkers turn staggered inside 3 s.
8. **`worldClocks.ts`** (new pure file, T10b) owns the day, weather, micro schedules and the queue instance so the director stays small and the orchestration is unit-tested with fake clocks.
9. **Public renderer signatures** (final in the first task that touches them; later tasks never change them): `LivingWorld.update(dtMs, frames, tween, nowMs, cam, ambient)` (T6a), `WorldProps.update(dtMs, crankSteps, nowMs, tween, ambient, girl)` (T7a1), `WorldAtmos.update(dtMs, nowMs, host, tween, ambient)` (T7b). `WorldProps.props()`, `WorldAtmos.rows()`, `LivingWorld.sensorRows()` return structurally identical `{ id; frame; alpha; x; y }[]` (each file declares its own interface; no cross-imports).
10. **Windows** one by one: gap 3000-6000 ms (the plan's 2-6 s cannot reach its own 15 s minimum over five gaps).
11. **Debug-only**: `worldBehaviourNext`, `worldSettle`, `worldDayHold`; no player path calls them.
12. Pure modules may print metric tables (console.log). Tests pin structure and canon, never tuned hold / weight / cooldown values (T3d tunes those).

## Waves (<= 3 units; a unit never shares a wave with its dependency)
| Wave | Units | Gate after (Director) |
|---|---|---|
| 1 | **AD1a** sheet layout + placeholders + coupled data, **T2a** day / weather / ambient data, **T2b** transition data | typecheck clean; `npx vitest run src/assets src/data --maxWorkers=2` |
| 2 | **T1** behaviour data + `actorBand`, **T4** day maths + `moteOrbit`, **T5a** queue core | typecheck clean |
| 3 | **T3a** helpers + pick rule, **T5b** queue sequence rows, **AD1b-1** inspector + dog cells | typecheck clean |
| 4 | **T3b** runner, **T10b** `worldClocks.ts`, **T7a1** WorldProps pass 1 | typecheck: only `LivingWorldDirector.ts` call-site errors (`props.update`) |
| 5 | **T3c** cues + crank + unison, **T7b** WorldAtmos, **T6a** LivingWorld pass 1 | typecheck: only `LivingWorldDirector.ts` call-site errors (`cast.update`, `props.update`, `atmos.update`) |
| 6 | **T10a1** director time side, **T7a2** WorldProps pass 2, **AD1b-2** crow + girl + mini cells | typecheck clean |
| 7 | **T10a2** director cast side, **T8** parallax / dust / pylon, **T3d** metrics + tuning | typecheck clean; `npx vitest run src/game src/data --maxWorkers=2` |
| 8 | **T10c** WorldScene + debugHook, **T6b** LivingWorld pass 2 + drip, **T9a** world.mjs N cases (1) | typecheck clean; `node --check` on the smoke |
| 9 | **T9b** world.mjs N cases (2) + existing checks + settle lines + README, **AD1b-3** final art QA | typecheck clean; full vitest |
Then (Director / EM, not in the wave JSON): X0 after the WP25 merge -> D13 note (done) -> EM gate T11 -> AD2 -> T12 (conditional) -> T13 -> T14.

Transient tsc errors: W1-W3 none. After W4 and W5 ONLY call-site errors in `src/game/rendering/LivingWorldDirector.ts` for the changed `update` signatures (T7a1 W4; T6a + T7b W5). T10a1 (W6) fixes all three call sites (it passes an all-null frames constant to `cast.update` until T10a2 builds the runners). Anything else is a real error; workers never edit files they do not own to silence these.

## File ownership (exclusive per wave)
| Task | Files |
|---|---|
| AD1a | `public/assets/world/{inspector,dog,crow,girl,girl-mini}.png`, `scripts/art/world/**`, `src/data/livingWorld.ts` (WORLD_FRAMES tails only), `src/data/worldEras.ts` (`WORLD_TRACES.clipboardOffsetArt` only), `src/data/worldEras.test.ts` (`FACE_ON_FRAMES` line only), `src/assets/manifest.ts` (5 entries: width, `frame.count`), `src/assets/manifest.test.ts` (5 rows), `docs/ASSET_GUIDE.md` (regenerated) |
| T2a | `src/data/worldDay.ts`, `src/data/worldDay.test.ts` |
| T2b | `src/data/worldTransitions.ts`, `src/data/worldTransitions.test.ts` |
| T1 | `src/data/worldBehaviour.ts`, `src/data/worldBehaviour.test.ts`, `src/game/math/worldPlacement.ts` (additive `actorBand`), `src/game/math/worldPlacement.test.ts` |
| T4 | `src/game/math/worldDay.ts`, `worldDay.test.ts`, `src/game/math/worldPlayback.ts` (`moteOrbit` only), `worldPlayback.test.ts`, `src/data/worldDay.ts` (`WORLD_WEATHER` numbers only) |
| T5a, T5b | `src/game/math/worldTransitions.ts`, `worldTransitions.test.ts` |
| T3a, T3b, T3c | `src/game/math/worldBehaviour.ts`, `worldBehaviour.test.ts` (never `src/data/worldBehaviour.ts`: report) |
| T3d | `src/game/math/worldBehaviourMetrics.ts`, `worldBehaviourMetrics.test.ts` (new), `src/data/worldBehaviour.ts` (numbers only) |
| T10b | `src/game/math/worldClocks.ts`, `worldClocks.test.ts` |
| T7a1, T7a2 | `src/game/rendering/WorldProps.ts` |
| T7b | `src/game/rendering/WorldAtmos.ts` |
| T6a, T6b | `src/game/rendering/LivingWorld.ts` (+ `CastExtras.ts` in T6b) |
| T10a1, T10a2 | `src/game/rendering/LivingWorldDirector.ts` |
| T10c | `src/game/scenes/WorldScene.ts` (the C6 hunk only), `src/game/debugHook.ts` |
| T8 | `src/data/world.ts` (C1 `world.ts` items only), `src/data/world.test.ts`, `src/game/rendering/ParallaxBackground.ts`, `PylonLine.ts`, `DustField.ts` |
| T9a, T9b | `scripts/smoke/world.mjs`; T9b also `scripts/smoke/finale.mjs`, `showcase.mjs`, `README.md` |
| AD1b-1/2/3 | the PNGs and masters of their sheets, `scripts/art/world/**`, `<O>/ad/**` |

Forbidden for every worker task: files not in its list; WP25-owned files (`src/simulation/**`, `src/data/{technologies,prestige,systemLogs,hud,ux}.ts`, `src/ui/hud*.ts`, `src/game/math/outputTick.ts`, `src/game/rendering/OutputTicker.ts`, `src/assets/assetGuide.test.ts`, `scripts/smoke/economy.mjs`); `src/persistence/**`, `src/data/types.ts`, `package.json`, `package-lock.json`, `public/assets/**` and `scripts/art/**` (AD only), `scripts/smoke/perf-budget.json`, `scripts/smoke/store-shots.mjs`, `docs/plan/ART_AUDIT.md`. Workers never build, never start servers, never run Playwright.

## Shared contracts (canonical TypeScript; the owner task creates it, consumers read the real source)
```ts
// src/game/math/worldBehaviour.ts (T3a creates every export; T3b / T3c fill the bodies)
export interface BehaviourCtx { era: WorldEra; mode: PlaybackMode; crankSteps: number /* clicks since the last step */; reduced: boolean;
  stare: boolean; reverse: boolean; vents: boolean; holeDig: boolean; sensor: boolean; scraps: boolean; demoHold: boolean; paused: boolean;
  homeX: number; girlStage: 'window' | 'mini' | 'ground'; spots: readonly { id: SpotId; x: number }[];
  cues: readonly { id: CueId; index: number }[]; beat: { downbeat: boolean; index: number } }
export interface BehaviourFrame { activity: string; step: number; frame: string; flip: boolean; x: number; walking: boolean;
  poseSet: 'base' | 'umbrella'; risePx: number; alpha: number; emitted: CueId | null }
export interface BehaviourLogEntry { activity: string; atMs: number; durMs: number; walked: boolean; reaction: boolean; look: string }
export interface BehaviourRunner { step(dtMs: number, ctx: BehaviourCtx): BehaviourFrame; rehome(homeX: number): void;
  reset(seed: number, k0: number, homeX: number): void; next(activity: string): boolean;
  snapshot(): { activity: string; sinceMs: number; k: number; x: number; walking: boolean; look: string } }
export interface UnisonConductor { step(beat: { downbeat: boolean; index: number }, post: boolean): void /* idempotent per beat.index */;
  current(): { id: UnisonId; post: boolean; startBeat: number; endBeat: number }; next(id: UnisonId): boolean; reset(seed: number): void }
export function createBehaviourRunner(actor: BehaviourActor, seed: number, conductor: UnisonConductor, onEnd?: (e: BehaviourLogEntry) => void): BehaviourRunner;
export function createUnisonConductor(seed: number): UnisonConductor;
export function behaviourSeed(cycle: number, actor: BehaviourActor): number;   // WORLD_BEHAVIOUR.seed + cycleSalt * cycle + actorSalt[actor]
export function behaviourK0(activeSeconds: number): number;                    // floor(activeSeconds / 60) * k0Stride
export function stareFrame(actor: BehaviourActor, frame: string, walking: boolean, stare: boolean): string;
export function activityLook(actor: BehaviourActor, clip: Clip & { risePx?: number; pulse?: true; accent?: string }, stare: boolean): { key: string; first: string; last: string; static: boolean };

// src/game/math/worldTransitions.ts (T5a / T5b)
export interface Blend { from: number; to: number; k: number }
export interface QueueGates { indexOpen: boolean; eraCardUp: boolean; modalOpen: boolean; ending: EndingPhase; reduced: boolean }
export interface QueueCues { digBouts: number; ventPuffs: number }
export interface TransitionInfo { id: string; startedAtMs: number | null; durMs: number; k: number }
export interface WorldTween { /* decision 5 */ }
export interface TransitionQueue { setTarget(state: WorldVisualState, nowMs: number, gates: QueueGates): void;
  step(nowMs: number, dtMs: number, gates: QueueGates, cues: QueueCues): WorldTween; snap(state: WorldVisualState): void;
  settle(on: boolean): void; pending(): readonly TransitionInfo[]; tween(): WorldTween }
export function createTransitionQueue(cfg?: typeof WORLD_TRANSITIONS): TransitionQueue;
export function stareActive(actor: BehaviourActor, stare: boolean, stareK: number): boolean;

// src/game/math/worldDay.ts (T4)
export interface DayInput { levels: Readonly<Record<TechId, number>>; lifetime: Readonly<Record<ResourceId, number>>; phase: EndingPhase; edition: 'full' | 'demo' }
export function dayProgress(i: DayInput): { era: WorldEra; p: number };
export function dayTargetMin(i: DayInput): number;  export function stepDayMin(presented: number, target: number, dtMs: number): number;
export function dayTint(min: number, era: WorldEra, p: number): number;  export function tintBrightness(rgb: number): number;
export function weatherOf(era: WorldEra, p: number, phase: EndingPhase, vents: boolean): WeatherState;
export function windAt(tMs: number, weather: WeatherState, seed: number): number;  export function easeBaseWind(current: number, target: number, dtMs: number): number;
export function dustDriftAt(tMs: number, weather: WeatherState): number;  export function ventPuffAt(k: number, seed: number): number /* gap ms */;
export function gustAt(k: number, seed: number): { afterMs: number; lengthMs: number };
export function microAt(kind: MicroKind, k: number, seed: number, era: WorldEra): { afterMs: number; holdMs: number };
export function shadowOf(min: number): { dx: number; widthScale: number };  export function lampGain(min: number): number;
```
```ts
// src/game/math/worldClocks.ts (T10b)
export interface ClocksInput { state: WorldVisualState; levels: Readonly<Record<TechId, number>>; lifetime: Readonly<Record<ResourceId, number>>;
  edition: 'full' | 'demo'; phase: EndingPhase; cycle: number; reduced: boolean; gates: { indexOpen: boolean; eraCardUp: boolean; modalOpen: boolean };
  digBouts: number; frozen: boolean }
export interface ClocksOut { tween: WorldTween; ambient: Ambient; tint: number; tintSnap: boolean; ventPuffs: number; gusts: number; min: number; target: number }
export interface WorldClocks { setTarget(i: ClocksInput, nowMs: number): void; step(dtMs: number, nowMs: number, i: ClocksInput): ClocksOut; snap(i: ClocksInput): void;
  settle(on: boolean): void; settling(): boolean; holdDay(min: number | null): void;
  debugDay(): { min: number; target: number; tint: number; wind: number; weather: string; held: boolean }; transitions(): readonly TransitionInfo[]; reset(seed: number): void }
export function createWorldClocks(seed: number): WorldClocks;

// Renderers (decision 9). PropRow = { id: string; frame: string; alpha: number; x: number; y: number } (presented world px, rounded; rows reused)
LivingWorld.update(dtMs: number, frames: Readonly<Record<'inspector' | 'dog' | 'crow' | 'girl', BehaviourFrame | null>>, tween: WorldTween, nowMs: number, cam: CameraPose, ambient: Ambient): void;
LivingWorld.busy(id: LivingId): boolean;   LivingWorld.sensorRows(): readonly PropRow[];
WorldProps.update(dtMs: number, crankSteps: number, nowMs: number, tween: WorldTween, ambient: Ambient, girl: BehaviourFrame | null): void;   WorldProps.props(): readonly PropRow[];
WorldAtmos.update(dtMs: number, nowMs: number, host: Host | null, tween: WorldTween, ambient: Ambient): void;   WorldAtmos.rows(): readonly PropRow[];
// Director (T10a1 / T10a2): ambient(): { tint: number; wind: number; dustDrift: number; snap: boolean } | null;  settling(): boolean;
```
Debug hook (`window.__wedtmd`, T10c; the director `WorldDebugApi` carries the same members): `worldBehaviour(): { id: string; activity: string; step: number; x: number; sinceMs: number; walking: boolean; look: string; k: number }[]`; `worldBehaviourLog(): { id: string; activity: string; atMs: number; durMs: number; walked: boolean; reaction: boolean; look: string }[]` (ring of `WORLD_BEHAVIOUR.logSize`); `worldBehaviourNext(actor: 'inspector' | 'dog' | 'crow' | 'girl' | 'conductor', activity: string): boolean`; `worldDay(): { min: number; target: number; tint: number; wind: number; weather: string; held: boolean } | null`; `worldDayHold(min: number | null): void`; `worldTransitions(): { id: string; startedAtMs: number | null; durMs: number; k: number }[]`; `worldSettle(on: boolean): void`; `worldProps(): PropRow[]`; `livingWorld()` entries gain `alpha: number` and `y: number`.

## Art hand-offs (Opus Art Director only; masters and gates in `scripts/art/world/`)
| After | State of the PNGs |
|---|---|
| AD1a (W1) | widened sheets with PLACEHOLDER cells: `inspector.png` 440x240 (22 frames), `dog.png` 644x120 (23), `crow.png` 288x108 (12), `girl.png` 192x168 (12), `girl-mini.png` 24x12 (3); existing frame indices unchanged |
| AD1b-1 (W3) | inspector `lookUp`, `crouch`, `umbrellaHalf` and dog `scratch0`, `scratch1`, `lookUp` painted (same files, same sizes) |
| AD1b-2 (W6) | crow `frozenTip`, `ruffle`, girl `lanternUp`, `tilt`, girl mini `palm` painted; contact pair `lanternUp` vs `shield` |
| AD1b-3 (W9) | all 11 cells re-gated, in-game-size composites, storyboards, fixes |
Every behaviour works with the placeholders (plan risk 9).

## Post-gate (Director / EM; not in the wave JSON)
X0 (Director, after the WP25 merge): rebase, anchors, the `worldSettle` line in store-shots, ASSET_GUIDE regeneration. T11 (EM gate): the plan validation list (steps 1-14) on the combined tree; the report lists the N variety window-start `k` per runner next to the A2 production-seed runs; heavy runs serialized with WP25's. AD2 (Opus): in-game audit per the plan AD2 text; output `## WP24 — living world v2 audit` in ART_AUDIT with a verdict and an `F<n>` list (file, key, old -> new; data first). T12 (conditional): the AD2-listed fixes to the owners. T13: Opus review of the combined diff, then EM Mode B. T14 (Director): canon and spec deltas, CHANGELOG (Unreleased), PROJECT_STATUS, ROADMAP_FULL, merge, commit.

## Out of scope
Economy, balance, HUD, output popups (WP25), WP25b Surge, save fields, `SAVE_VERSION`, new settings, text, `worldVoice.ts` rules, the finale film and the postgame loop choreography (D17), teaser / ShowcaseScene, machine parts and machine FX, wind / rain audio, a slower era V sky fade, pruning the fixed loops in `livingWorld.ts` / `worldEras.ts`, store shots / STEAM_RELEASE / release entry / version bump (§R), PROJECT_STATUS / merge / commit (Director).
