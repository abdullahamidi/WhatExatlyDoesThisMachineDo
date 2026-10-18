# WP15 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP15.md` (D1-D10, C1-C5, T1-T9) + repo read at HEAD `2217a66`. Template: `WP14-assignments.md`.
Save stays **v2** (additive optional `musicVolume`). Era I-V balance bit-identical. No art, no `public/**`, no balance change.
Baseline: Director records `npx vitest run 2>&1 | grep -E "Test Files|Tests "` at WP14 final HEAD; never lower it.

## GATE (hard)
W1 starts ONLY after WP14 T9 merged + WP14 Mode B PASS + WP14 committed (WP14 T9 owns bootstrap, debugHook, WorldScene, context, scripts/smoke/{prestige,finale}.mjs now).
Before W1 the Director re-reads these WP14 FINAL facts and tells the EM if any differ (assignments get patched, not guessed):
`SettingsState.confirmNewCycle` + toggle in `settingsView` · session events `cycle`/`prestige`/`reset` · `GameAudio.playStamp` on `cycle` (synth/gameAudio/audioMath/`AUDIO.stamp`) · `StartupResult` carries `prestige` · MEMORY tab in `MENU_TABS` (6 tabs) · debugHook has `prestige()`/`cycleState()` · `CycleTransition` in WorldScene update · wp12-menus tab count.

## SHARED FILES WITH WP14 (WP14 finished first; WP15 workers re-read, extend only, never revert foreign hunks)
| File | WP14 owner | WP15 owner | Rule |
|---|---|---|---|
| `src/game/bootstrap.ts` | T9 | T8 | add boot-achievement toast after welcome only; keep stub->controller wiring, hotkey guards |
| `src/game/debugHook.ts` | T9 | T6 (W1: uiStats, perfMarks), T4 (W3: audioStats) | keep `prestige()`/`cycleState()`; T4 re-reads T6 hunk |
| `src/game/scenes/WorldScene.ts` | T9 | T6 | keep `CycleTransition` after FinaleDirector, dispose first; HUD throttle must not skip reset/cycle renders |
| `src/data/types.ts` | T1, T4 | T1 | add `musicVolume` to SettingsState only |
| `src/data/settings.ts`, `src/simulation/settings(.test).ts` | T1 | T1 | keep `confirmNewCycle` code/tests |
| `src/ui/menu/settingsView.ts` (+test), `settingsPanel.ts` | T8a | T5 | keep CONFIRM NEW CYCLE toggle |
| `src/ui/systemMenu.ts` (+test), `src/data/systemMenu.ts` | T7 (MENU_TABS memory) | T8 | keep 6 tabs, memory panel registration |
| `src/persistence/startup.ts` (+test) | T4 (`prestige` option) | T8 | keep prestige passthrough |
| `src/audio/{synth,gameAudio,audioMath(+test)}.ts`, `src/data/audio.ts` | T8b (stamp) | T1 (data), T2 (audioMath), T3 (synth), T4 (gameAudio) | keep stamp/chord/chirp/wind code |
| `scripts/smoke/README.md` | T9 | T9 | append section only |
| `scripts/smoke/wp12-menus.mjs` | T9 maybe | T5 | re-read; slider count 3 -> 4 only |
| `scripts/smoke/{prestige,finale}.mjs` | T9 | nobody | READ-ONLY |
Not shared: `src/data/music.ts`, `src/audio/musicMath*`, `src/game/rendering/{SteamFx,MachineLinks}.ts`, `src/game/entities/Machine{View,Animator}.ts`, `src/main.ts`, `src/data/world.ts`, `scripts/perf/**`, `scripts/smoke/perf*`.

## Waves
| Wave | Ids | Gate |
|---|---|---|
| 1 | **T1** music data + setting, **T6** probes + HUD throttle, **T7** spike fix, **T8** debts | WP14 final + committed |
| 2 | **T2** music + mix maths, **T3** synth, **T5** MUSIC slider, **T9** perf smoke + budgets | W1 merged, tsc clean |
| 3 | **T4** controller wiring + audioStats | W2 merged, tsc clean |
| 4 | EM Mode B: run smokes, tune numbers in `src/data/music.ts` / `src/data/audio.ts` only | W3 merged |

### Transient tsc errors (inside a wave only)
| After | Allowed |
|---|---|
| W1 | tests building a full `SettingsState` literal fail until T1 adds `musicVolume`; T1 fixes them (list in NOTES) |
| W2 | T2/T3 import T1 exports (landed in W1, so none expected); T5 `VolumeId` needs T1 field (landed) |
| W3 | none |

## EM decisions / deviations from WP15.md (these WIN)
1. **Synth note API**: `playMusicNote(slot: 0|1, theme: MusicThemeId, ev: MusicNoteEvent): void`. Synth reads attack/release/detune/lowpass from `MUSIC.themes[theme]`, sets the slot lowpass at call. `ev.startS` is **absolute AudioContext time** (music clock == `context.currentTime` clock; T4 passes `clockStartS` as a context time). WP15.md C4 `playMusicNote(slot, ev)` is replaced.
2. **Era + bed trims in gameAudio, not synth.** T1 adds `export type BedId = 'hum'|'gear'|'mains'|'boiler'|'pad'|'servo'|'drone'|'wind'` and `AUDIO.bedTrim: Record<BedId, readonly [number,number,number,number,number]>` (era I..V; WP15.md "-" cells = 1). T2 adds `currentEra(techLevels): 1|2|3|4|5` (via `MUSIC.keystones` order: generator 2, boiler 3, resonatorSpire 4, nullChamber 5; no tech-id literals in src/audio) and `bedTrim(bed, era): number`. T4 multiplies bed gains passed to existing `setHum/setMains/setBoiler/setPad/setServo/setDrone/scheduleGearTicks(rate stays; gear gain via trim only if synth cannot -> skip gear trim, document)` and wind via bus-level only if no gain param (document). Synth gets no bed-trim API.
3. `LevelSnapshot += musicBus`; `AudioBus = 'sfx'|'ambient'|'music'`; `levelsChanged` compares `musicBus`. Music scheduling gate: `musicAllowed(muted, masterVol, musicVol, visible)`.
4. Limiter built in `openGraph`: `master -> DynamicsCompressor(AUDIO.limiter) -> destination`. `AUDIO.limiter = { threshold: -10, knee: 6, ratio: 4, attack: 0.005, release: 0.25 }`.
5. HUD throttle applies only to the revision-poll path in WorldScene; session events `reset`/`cycle`/`ending`/`purchase`/`settings`/click force an immediate rebuild.
6. Perf thresholds live ONLY in `scripts/smoke/perf-budget.json`; env override names `PERF_<METRIC>` documented in README.
7. Re-read each file RIGHT BEFORE editing; small unique-anchor Edits.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP15: synthesized music bed per era, one audio mix with a MUSIC slider, perf pass with a profiling smoke.
Authoritative spec you MUST read first: docs/plan/WP15.md — "C Contracts" and "D Decisions" are exact (numbers, names, signatures).
THIS ASSIGNMENT FILE (docs/plan/WP15-assignments.md, "EM decisions" + "SHARED FILES") WINS over WP15.md where they differ.
WP14 (prestige) is landed. Era I-V balance, art, content: NO changes. Save stays version 2. NEVER touch public/**.
Baseline: typecheck clean, all tests green (count recorded by the Director; never lower it).

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json (unless owned), tsconfig.json, vite.config.ts, index.html, docs/**, public/**, src/data/technologies.ts, src/simulation/production/**, src/simulation/progression/**.
- CONCURRENCY: other workers edit other files at the same time. Re-read every file RIGHT BEFORE you edit it (and before final validation). SURGICAL edits (Edit tool, small unique anchors; never rewrite an existing file from memory). Never revert a foreign change.
- PURE (no 'phaser', no window/document/AudioContext/localStorage): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/audio/audioMath.ts, src/audio/musicMath.ts, src/ui/*View.ts, *Rules.ts, *Model.ts.
  Only src/game/{entities,rendering,scenes} may import Phaser. DOM files (src/ui/*.ts without View/Rules/Model suffix) may use document/window, never Phaser.
- All balancing numbers, texts, ids live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio. No tech-id string literals in src/audio or src/game logic (use data tables).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined in src.
- DOM text via textContent (never innerHTML). Controls are real <button>; min font 12 px in CSS; focus-visible outline.
- Tests: Vitest, node env (no DOM, no Phaser, no real AudioContext), `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats, avoid -0. Never delete coverage: when a count/list changes update it, keep intent. Reset module state in afterEach.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list in NOTES. Run only your own tests plus the named regression runs.
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...
```

---

# WAVE 1 (parallel: T1, T6, T7, T8 — disjoint files)

## T1 — Music data + settings field
**wave** 1. **files_owned**: new `src/data/music.ts`, new `src/data/music.test.ts`, `src/data/audio.ts`, `src/data/settings.ts`, `src/data/types.ts` (SettingsState `musicVolume` ONLY), `src/simulation/{settings,settings.test}.ts`, plus any other `*.test.ts` that fails tsc ONLY because `SettingsState` gained a field AND is not owned by T6/T7/T8 (list in NOTES). **SHARED**: audio.ts, types.ts, settings (WP14).
**objective**: WP15.md C1 + C2 data + `musicVolume`. Write exports FIRST (T2, T3, T5 import them).
**context**: C1 verbatim: `MusicThemeId, MusicVoice, MusicNoteEvent, MusicTheme, MUSIC (themes table values from the WP15.md theme table, keystones, busGain 0.6, lookaheadS 0.5, maxEventsPerCall 16, maxVoices 8, crossfadeS 6, startDelayS 0.1, duck{}, space{}, seed 41), AudioStats`. `scale` is semitones, or ratios when `just: true`. `audio.ts` adds `BedId`, `AUDIO.bedTrim` (EM decision 2), `AUDIO.limiter` (EM decision 4). Settings: `musicVolume` default 70, label `MUSIC`, `VOLUME_RANGE` unchanged; `normalizeSettings` missing -> 70, clamps 0..100, NaN/non-number -> default, same style as ambientVolume.
**constraints**: pure data; no change to existing AUDIO numbers; keystone ids typed `TechId` (import type).
**acceptance**: every theme: progression degrees inside scale length, bpm 30-90, peak <= 0.1, bassPeak <= 0.1, scale ascending, density 0..1, bars > 0, variations >= 1; keystone ids exist in TECHNOLOGIES, order generator/boiler/resonatorSpire/nullChamber; `bedTrim` rows length 5, values in (0,1], first-present era = 1; `normalizeSettings` (missing 70, 250 -> 100, NaN -> 70); v2 save without the field loads with 70 (round-trip test in settings tests); existing settings tests green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/settings.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data|simulation/settings)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser" src/data/music.ts && echo FAIL || echo OK
git diff --stat HEAD -- src/data/technologies.ts public     # empty
```

## T6 — Perf probes + HUD throttle
**wave** 1. **files_owned**: `src/game/scenes/WorldScene.ts`, `src/main.ts`, `src/game/debugHook.ts`, `src/data/world.ts` (`HUD_REFRESH_MS = 100` only). **SHARED**: WorldScene, debugHook (WP14 T9) — extend only.
**objective**: C5 probes (`uiStats`, `perfMarks`) + HUD throttle (EM decision 5). `audioStats` is NOT yours (T4).
**context**: `uiStats(): { meanMs; maxMs }` = ring of last 120 frames timing `session.update + HUD render + techTree.update` (use `performance.now()`; no allocation per frame: preallocated Float64Array). `perfMarks(): { bootStartMs; firstFrameMs } | null`: `performance.mark('wedtmd:boot')` first line of `main.ts`; `'wedtmd:first-frame'` on the first WorldScene update (once). Both null-safe (return zeros/null when scene missing). HUD: poll path rebuilds at most every `HUD_REFRESH_MS`; session events `reset`, `cycle`, `ending`, `purchase`, `unlock`, `settings`, and crank/click force immediate `renderHud()` (read how WorldScene already subscribes; unsubscribe in disposables).
**constraints**: no visible lag on crank (+ME text same frame); no economy state in game layer; no console.log.
**acceptance**: hook fields typed in the `Window.__wedtmd` declaration and installed; marks set; HUD throttle active; report uiStats meanMs at s15 before and after in NOTES (PERF run via stages.mjs or `evaluate`); existing tests green; `npm run build` green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/(game|main)" && echo CHECK || echo OK
npx vitest run src/game src/data
grep -nE "0x[0-9a-fA-F]{6}|console\.log" src/game/debugHook.ts src/game/scenes/WorldScene.ts src/main.ts && echo FAIL || echo OK
grep -n "HUD_REFRESH_MS\|uiStats\|perfMarks\|wedtmd:" src/game/debugHook.ts src/game/scenes/WorldScene.ts src/main.ts src/data/world.ts
```

## T7 — Idle frame-spike fix
**wave** 1. **files_owned**: `src/game/rendering/SteamFx.ts`, `src/game/rendering/MachineLinks.ts`, `src/game/entities/MachineView.ts`, `src/game/entities/MachineAnimator.ts` (only those the cause needs). Read-only: `src/data/steamFx.ts`.
**objective**: remove the s13/s15 idle `machineStats` max-ms waves (about 35 ms every 5-9 s).
**context**: suspects (WP15.md): SteamFx bursts (`everyS 5-9`), per-frame allocation (GC), MachineLinks graphics redraw. FIRST measure: Playwright (`PW_PATH` global) `page.context().newCDPSession(page)` + `Profiler.start/stop` over 10 s idle at s13 (stages.mjs buy list), name the top self-time frame. Scratch scripts go in `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/` (NOT the repo). Fix: pre-create/pool burst sprites or emitters, hoist per-frame allocations, redraw Graphics only on change. No visual change.
**constraints**: no change to `src/data/**`; visuals identical (same counts, depths, alphas); no new Phaser object per frame.
**acceptance**: cause named in NOTES (function + ms); s13 and s15 `machineStats().maxMs` <= 20 in three consecutive 120-frame windows after 10 s warm-up, meanMs not worse (report before/after table); existing tests green; build green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/(rendering|entities)" && echo CHECK || echo OK
npx vitest run src/game src/data
npm run build
grep -nE "0x[0-9a-fA-F]{6}|console\.log" src/game/rendering/SteamFx.ts src/game/rendering/MachineLinks.ts src/game/entities/MachineView.ts src/game/entities/MachineAnimator.ts && echo FAIL || echo OK
```

## T8 — Debts: menu stats refresh + boot achievement toast
**wave** 1. **files_owned**: `src/ui/systemMenu.ts`, `src/ui/systemMenu.test.ts` (extend if it exists, else create; test the refresh timer via a small exported pure helper in `systemMenu.ts`), `src/data/systemMenu.ts` (`MENU_REFRESH_MS = 1000` only), `src/persistence/startup.ts`, `src/persistence/startup.test.ts`, `src/game/bootstrap.ts`. **SHARED**: all (WP13/WP14) — extend only.
**objective**: (a) while the menu is open, the active tab panel's `refresh()` runs every `MENU_REFRESH_MS`; (b) boot achievements are not lost.
**context**: (a) interval started on `open()`, cleared on `close()` and destroy, refreshes only the active panel handle (`tabs[activeIndex]?.handle?.refresh()`); STATS playtime cell must advance while visible. (b) `StartupResult += bootAchievements: AchievementId[]` (import type from data); collect via `session.on('achievement', ...)` registered before boot `applyOffline`, unsubscribe after; no change to save writing. bootstrap: after the welcome toast, one `achievementMessage(ids)` toast (find existing helper in `src/ui/notificationRules.ts`; if it needs a new pure helper STOP and report, you do not own that file) when ids non-empty; the later `connectAchievements` must not toast those ids again (listener is attached after boot, so verify no duplicate).
**constraints**: no change to menu ids/rows/tabs; fake timers only in tests (`vi.useFakeTimers`, no real waits); startup stays pure (no DOM).
**acceptance**: fake-timer test: refresh count after 3 s = 3, 0 after close, no leak after destroy; startup fixture with >= 1 h gap -> `bootAchievements` contains `shortNap`; fresh start -> `[]`; existing startup/persistence tests green; WP14 `prestige` passthrough intact.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(ui/systemMenu|persistence/startup|game/bootstrap|data/systemMenu)" && echo CHECK || echo OK
grep -nE "innerHTML|setInterval" src/ui/systemMenu.ts
grep -n "bootAchievements" src/persistence/startup.ts src/game/bootstrap.ts
```

---

# WAVE 2 (parallel: T2, T3, T5, T9 — disjoint files; W1 merged)

## T2 — Pure music + mix maths
**wave** 2. **files_owned**: new `src/audio/musicMath.ts`, new `src/audio/musicMath.test.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`. **SHARED**: audioMath (WP14 stamp code; keep).
**objective**: WP15.md C3 exact + EM decisions 2, 3.
**context**: signatures from C3: `mulberry32, musicTheme(techLevels, phase), barSeconds, chordAt, eventsForBar, eventsInWindow(theme, clockStartS, fromS, toS, cap), crossfadeGains, duckLevel(phase, sinceSwellS|null, sinceChordS|null, sinceMilestoneS|null), musicAllowed`. In `audioMath.ts`: `bedTrim(bed: BedId, era: number)` (clamp era 1..5, bad -> 1), `currentEra(techLevels)`, `ambientPeakSum(era)`, `LevelSnapshot += readonly musicBus: number`, `levelsChanged` compares it. Theme from `MUSIC.keystones` (highest owned wins; techLevels is `Record<TechId, number>` from state). Loop period = `bars * variations` bars; variation index = `bar % (bars*variations)` feeds the seed (`mulberry32(seed ^ hash(themeId) ^ bar)` or similar, stable). Each bar: bass note (chord root, octave down, beat 1, `bass: true`, gain `bassPeak`), 8th slots: density chance -> chord tone (p .7) else scale passing tone. Notes inside the bar, polyphony <= `MUSIC.maxVoices`. `eventsInWindow` loops bars from `clockStartS`, filters `fromS <= startS < toS`, sorted, capped, deterministic (adjacent windows never repeat an event). `duckLevel`: 'sequence' phase: swell 0 -> 3 s ramp to 0 and stays 0 (before swell 1); chord beat: 0.25 for 4 s then linear to 1 at 8 s; milestone: 0.5 for 1.5 s then back to 1; take the min of active ducks; clamp 0..1.
**constraints**: no Phaser/DOM/WebAudio/`Math.random`/`Date`; no tech-id literals; no 0x.
**acceptance**: exactly the WP15.md T2 acceptance list (determinism, loop period, chord-tone membership, hz finite 20-5000, events inside bar, polyphony, window cap + no dupes, theme mapping per keystone and phases incl. reset -> mech, crossfade out^2+in^2 within 1e-6 and exact endpoints, duck curve points, musicAllowed false for muted / master 0 / music 0 / hidden, C2 invariants: bed sum x trim <= 0.45 each era, music contribution <= 0.15, ambient + music + loudest one-shot <= 1.0); existing audio tests green (update `LevelSnapshot` literals in audioMath.test only).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio src/data/music.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/audio" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|Math\.random|Date\.now|0x[0-9a-fA-F]{6}" src/audio/musicMath.ts src/audio/audioMath.ts && echo FAIL || echo OK
```

## T3 — Synth music bus, voices, limiter, stats
**wave** 2. **files_owned**: `src/audio/synth.ts`. **SHARED**: synth (WP13/WP14 voices; keep).
**objective**: WP15.md C4 with EM decisions 1, 3, 4.
**context**: `AudioBus = 'sfx'|'ambient'|'music'`; `Graph` gets `music`; `openGraph`: master -> `DynamicsCompressor` configured from `AUDIO.limiter` -> destination; music bus gain 1 under master (gameAudio sets level via `setBusGain('music', ...)`). New `Synth` methods (exact):
`playMusicNote(slot: 0|1, theme: MusicThemeId, ev: MusicNoteEvent): void` · `setMusicSlotGain(slot: 0|1, gain: number, rampS: number): void` · `setMusicDuck(level: number, rampS: number): void` · `stopMusic(): void` · `stats(): { liveVoices: number; musicVoices: number; dropped: number; peakDb: number | null }`.
Lazy music graph on first note: per slot `slotGain -> duckGain -> musicBus`, one lowpass per slot before slotGain, `space` echo (Delay `MUSIC.space.delayS`, feedback gain, lowpass, wet gain) fed from duckGain; no ConvolverNode. Per note: osc, optional 2nd osc (detune/partial per voice: pluck triangle, pulse square, swell saw, bell sine + 2.76 partial, reverse sine reversed envelope, warm triangle + sine octave), env gain; <= 3 nodes; envelope uses `ev.startS`, `ev.durS`, theme attack/release, `ev.gain`; nodes disconnected in `onended`. Voice counters: `liveVoices` covers one-shots (`playVoice` and other short voices where cheap) and music; `musicVoices` music only; drop a note (and `dropped++`) when `musicVoices >= MUSIC.maxVoices`. `stats()` lazily creates an AnalyserNode on master (after compressor tap) and returns `peakDb` (max abs of `getFloatTimeDomainData`, dB) or null before first call/when it cannot be read. Everything via `run`; no-op after `close()`; never throw; `close()` stops music.
**constraints**: existing voices behave identically; one-shot peak levels unchanged; no 0x; no Phaser; no tech-id literals.
**acceptance**: typecheck clean; `grep` shows `createDynamicsCompressor`, `music` bus, `onended` counter decrement, `maxVoices` drop; node-testable parts not needed (no real AudioContext) but any pure helper you add goes to `src/audio/audioMath.ts`-free private functions; existing audio tests green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/audio" && echo CHECK || echo OK
npx vitest run src/audio
grep -nE "createConvolver|from ['\"]phaser|0x[0-9a-fA-F]{6}|console\.log" src/audio/synth.ts && echo FAIL || echo OK
grep -n "createDynamicsCompressor\|playMusicNote\|setMusicSlotGain\|setMusicDuck\|stopMusic\|stats()" src/audio/synth.ts
```

## T5 — MUSIC slider
**wave** 2. **files_owned**: `src/ui/menu/settingsView.ts`, `src/ui/menu/settingsView.test.ts`, `src/ui/menu/settingsPanel.ts` (only if needed), `scripts/smoke/wp12-menus.mjs`. **SHARED**: settingsView (WP14 T8a toggle), wp12-menus (WP14 T9 maybe).
**objective**: fourth volume slider.
**context**: `VolumeId` and `VOLUME_IDS` gain `'musicVolume'` (order master, sfx, ambient, music); `volumePatch('musicVolume', v)` -> `{ musicVolume: v }`; label from `SETTING_LABELS` (T1); `aria-valuetext` "70 %". Panel code that loops `VOLUME_IDS` needs no change; check. `wp12-menus.mjs`: update slider count / settings checks to 4 only where a count is asserted; keep every other check.
**acceptance**: view tests: four sliders in order, default 70, valuetext, patch for each id; existing settings tests green; `node --check` clean; wp12 smoke expectation updated (run later by EM).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/menu src/data
npx tsc --noEmit 2>&1 | grep -E "^src/ui/menu" && echo CHECK || echo OK
node --check scripts/smoke/wp12-menus.mjs && echo OK
grep -n "musicVolume" src/ui/menu/settingsView.ts
```

## T9 — Profiling smoke + budgets
**wave** 2. **files_owned**: new `scripts/smoke/perf.mjs`, new `scripts/smoke/perf-budget.json`, new `scripts/perf/bundle-budget.mjs`, `scripts/smoke/README.md` (append), `package.json` (add `"perf:bundle": "node scripts/perf/bundle-budget.mjs"` ONLY), new `src/game/math/perfBudget.test.ts`. **SHARED**: README (WP14 T9 section above; append only).
**objective**: WP15.md T9 exact (metrics table, thresholds, stages list, finale t 8-36, `PERF_STRICT=1`, `PERF_GPU=1`, bundle budget, perfBudget test).
**context**: model on `scripts/smoke/stages.mjs` + `finale.mjs` (read both; reuse the buy lists, `@techId` jumps, fresh contexts, `PW_PATH`, `PERF=1` code). Chromium launch args `--js-flags=--expose-gc --autoplay-policy=no-user-gesture-required`. Probes from the hook: `machineStats`, `uiStats` (T6, read null-safe), `finaleState`, `displayObjects`, `perfMarks`, `audioStats` (T4, null-safe: reported `null` until it exists), heap via `performance.memory.usedJSHeapSize` after `gc()`. Tech tree probe: open era V tab, 5 median samples of synchronous open + forced layout (`getBoundingClientRect`). After new cycle (WP14 `cycleState`/button, only if hook present): `displayObjects <= s0 + 10 %`. Prints ONE JSON `{ metrics, budgets, fail: [] , errors: [] }`; `PERF_STRICT=1` exits 1 if `fail` non-empty; frame p95 report-only unless `PERF_GPU=1`. Budgets in `perf-budget.json`, env override `PERF_<METRIC>`. `bundle-budget.mjs`: reads `dist/assets/*` (app chunk <= 340 KB raw / 100 KB gzip via `zlib.gzipSync`, phaser chunk <= 1.5 MB, css <= 30 KB) and `public/assets` <= 8 MB, prints table, exit 1 on breach. `perfBudget.test.ts` (pure): machine render target `MACHINE_BOUNDS` <= 2048 per side and <= 16 MB RGBA; worst-case live particles from data (steam emitters x burst count x lifetime from `src/data/steamFx.ts`, dust `DUST.maxParticles`, finale seeds + birds from `src/data/finale.ts`) <= 300. Read the data modules first to find the exact export names; if a number cannot be derived from data, derive the closest bound and say so in NOTES.
**constraints**: only edit `package.json` scripts block (add one line); scripts must not crash when a hook field is missing; no 0 console errors tolerance in smoke (`errors` reported); scratch outputs in `/tmp/smoke`.
**acceptance**: `node --check` clean on both .mjs; `npx vitest run src/game/math/perfBudget.test.ts` green; `node scripts/perf/bundle-budget.mjs` after `npm run build` runs and prints a table (breach = real finding, report numbers); README documents commands + env vars + metric names.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/perf.mjs && node --check scripts/perf/bundle-budget.mjs && echo OK
npx vitest run src/game/math/perfBudget.test.ts
npm run build && node scripts/perf/bundle-budget.mjs
node -e "JSON.parse(require('fs').readFileSync('scripts/smoke/perf-budget.json','utf8'))" && echo JSON_OK
git diff HEAD -- package.json     # exactly one added script line
```

---

# WAVE 3 (single: T4)

## T4 — Music controller wiring + audioStats
**wave** 3. **files_owned**: `src/audio/gameAudio.ts`, `src/game/debugHook.ts` (`audioStats` ONLY). **SHARED**: gameAudio (WP14 stamp), debugHook (T6 hunks landed; keep).
**objective**: WP15.md T4 acceptance with EM decisions 1-3.
**context**: read T2 (`musicMath`, `audioMath`) and T3 (`Synth`) landed code first. `GameAudio += stats(): AudioStats` (`unlocked, running, theme, slotGains, duck, liveVoices, musicVoices, dropped, peakDb`; before unlock: all zeros/null, `unlocked:false`). Controller state inside `createGameAudio`: `currentTheme`, per-slot clock + slot gains (`crossfadeGains` over `MUSIC.crossfadeS`), theme from `musicTheme(session.state.techLevels, session.state.ending.phase)` re-evaluated each 200 ms tick; theme change -> new slot (other slot) starts at `context.currentTime + MUSIC.startDelayS`, crossfade; each tick, if `musicAllowed(...)` schedule `eventsInWindow(theme, clockStartS, now, now + MUSIC.lookaheadS, MUSIC.maxEventsPerCall)` per live slot (track `scheduledUntil` per slot so windows never repeat) and `playMusicNote(slot, theme, ev)`; when not allowed: no events, `setMusicDuck(0)`/`stopMusic` so `musicVoices` -> 0 within 2 s. Visibility hidden/resume: on resume re-anchor the music clock to the next bar (no catch-up). Ducking: session finale beats (find how gameAudio already subscribes to `ending`/finale beats for chord/swell/wind; reuse) -> `duckLevel` + `setMusicDuck(level, rampS)`; milestone event -> milestone duck; reload in choice/postgame -> `restored` at 1, no chord duck. New cycle / reset -> theme falls back to `mech` through the normal crossfade (listen to `reset`/`cycle` only to clear duck timers). Levels: `applyLevels` adds `musicBus: busGain(settings.musicVolume) * MUSIC.busGain` and `s.setBusGain('music', ...)`. Bed trims: multiply bed gains by `bedTrim(bed, currentEra(techLevels))` (EM decision 2). Dispose stops music and clears timers. Debug hook: `audioStats(): AudioStats | null` (null-safe) in `Window.__wedtmd` + install.
**constraints**: no AudioContext before the first gesture (existing lazy path unchanged); all synth calls wrapped (`oneShot`-style try/catch, `warnOnce`); no tech-id literals; no 0x; no Math.random.
**acceptance**: theme follows D3 within one tick; era change crossfades (slotGains move over 6 s); finale beats duck per D6; milestone duck; trims by era; musicBus from settings; muted / volume 0 / hidden -> zero music events; resume re-anchors; `stats()` matches `AudioStats`; existing audio + game tests green; `npm run build` green. Add a pure test-friendly helper to `musicMath` only if T2 left a gap (STOP and report; you do not own it).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npm run typecheck && npx vitest run src/audio src/game src/data
grep -nE "0x[0-9a-fA-F]{6}|from ['\"]phaser|Math\.random" src/audio/gameAudio.ts && echo FAIL || echo OK
grep -n "audioStats\|stats()\|playMusicNote\|setMusicDuck" src/audio/gameAudio.ts src/game/debugHook.ts
npm run build
```

---

# WAVE 4 — EM Mode B (not a worker)
Run: `npm run typecheck` · `npm test` (>= WP14 HEAD + new) · `npm run build` · `node scripts/perf/bundle-budget.mjs` · `npx vitest run src/audio src/data/music.test.ts src/game/math/perfBudget.test.ts` · `npx vitest run src/simulation/balance.sim.test.ts` (report duration, <= 10 s) · preview + `PW_PATH=$PW PERF_STRICT=1 node scripts/smoke/perf.mjs http://localhost:4173/ /tmp/smoke` -> `fail: []` · `stages.mjs`, `finale.mjs`, `wp12-menus.mjs`, `wp4-persistence.mjs`, `prestige.mjs` -> `errors: []` · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils} src/audio/musicMath.ts` empty · `git diff --stat HEAD -- src/data/technologies.ts src/simulation/production src/simulation/progression public` empty · no file changed outside owner lists.
EM may tune numbers ONLY in `src/data/music.ts` / `src/data/audio.ts` until budgets + mix invariants pass; anything else goes back as a fix assignment. Art Director not needed. Docs (Director): PROJECT_STATUS (perf numbers before/after), roadmap note (own MUSIC bus, deviations 1-6).
