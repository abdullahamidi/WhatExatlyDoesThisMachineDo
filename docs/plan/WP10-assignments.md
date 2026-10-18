# WP10 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP10.md` (contracts C1-C4, decisions D1-D5, tasks T1-T9) + `docs/plan/ART_ERA4.md` (art contract) + real code read at HEAD `ce9bc37` (+ uncommitted Art Director edits in `src/data/machineComponents.ts`, `steamFx.ts` and tests: era III numbers / W1 pipe `via` / condenser `condensate` point / smoke + puff tuning). Template: `WP9-assignments.md`.
Goal: Era IV (Resonance, RS) playable `pressureVesselBlueprint` -> `harmonicConvergence`: 9 techs, `autoClick` effect (crank servo, counts offline), 16 parts on the delivered PNGs, `resonance` driver, pin-to-pin rod R1, pipe P4, calliope round-robin puffs, rising dust, milestone crystal hold + chord, pad / fork ping / servo / chord audio, logs, plaque.
Baseline (WP10.md): typecheck clean, 1061 tests / 43 files. **Workers never touch `public/**`.** No new fallback painters. All 15 PNGs exist.

## How the Director uses this file
For every worker: spawn `implementation-worker`, paste **(1) the Common preamble** (fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4). Between waves run that wave's tests (`npx vitest run <files>`) and `npx tsc --noEmit`, compare errors with the transient table, then start the next wave.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** Era IV data + logs + plaque, **T2** autoClick effect, **T9** smoke scripts | 3 |
| 2 | **T3a** machine components data, **T3b** palette + world + steamFx + assets data, **T4** balance sim + harness perf + save compat, **T5** pure maths | 4 |
| 3 | **T6** Era IV audio, **T7** machine rendering (animator, view, R1 rod), **T8** calliope FX + rising dust wiring | 3 |
| 4 | EM Mode B (validate, remove deprecated `MILESTONE_BURST`, one-line glue), reviewer, Director smoke | - |

Deviation from WP10.md: T3 is split into **T3a** (machineComponents + test) and **T3b** (everything else in T3) so each Haiku worker has a small seam; T3b lands `assetIds.ts` FIRST so T3a's `AssetId` type resolves. Dependencies: T2, T9 none. T3a/T3b need T1 (tech ids). T4 needs T1 + T2. T5 needs T3a types (same wave, contract-first, `import type` only). T6 needs T1. T7 needs T3a, T3b, T5. T8 needs T3b, T5.

### Expected transient tsc errors (not a worker fault)
| After | Allowed to fail typecheck (inside the wave only) | Runtime-only at end of wave (typecheck clean) |
|---|---|---|
| W1 | `src/simulation/progression/status.ts` (`describeEffect` switch TS2366/TS2678) and `src/simulation/production/rates.ts` until T1 (Effect variant) AND T2 (cases) both land. End of W1: none. | none |
| W2 | `src/game/math/animation.ts` TS2366 (`driverValue` switch) until T3a (`'resonance'`) + T5 land; `src/data/machineComponents.ts` unknown `AssetId` literals until T3b lands `assetIds.ts`; `src/data/steamFx.ts` unknown `'resonance'` until T3a. End of W2: none. | era IV parts all show but are static (frames run only after T7), no R1 rod, calliope silent, dust not rising, no era IV audio. |
| W3 | `src/game/scenes/WorldScene.ts` until T8; `MachineLinks.ts` / `MachineView.ts` (`LinkDrawContext.angleOf`) until both T7 files land. End of W3: typecheck, tests, build clean. | none |
Any other tsc error is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## EM decisions / deviations from WP10.md
1. **R1 rod endpoint uses the displayed angle.** `MachineAnimator.angleOf(id)` returns the angle snapped to the RotSprite frame (`rotationFrame(deg, n) * 360 / n`, n = rot sheet frame count) so the pin matches the knob pixel and both pins (servo + crank, same n=80) snap identically -> rod exactly vertical.
2. **Pin-to-pin rod Graphics:** a separate `pinRods` Graphics map (one per distinct R1 depth), the existing slider rod Graphics and its pixels are untouched. `drawRods` takes the Graphics as a parameter.
3. **`burstPoints` / `rotatePoint` / `pinEnd` locations:** `rotatePoint`, `pinEnd` in `math/machineLinks.ts`; `burstPoints` in `math/steamFx.ts`; `driverValue` in `math/animation.ts`. Multiples of 90 deg use exact sin/cos (0 / +-1) so pixels never wobble.
4. **Dust:** two Phaser emitters (normal + rising) toggled with `start()`/`stop()`; live motes of the stopped one finish naturally (no pop, no property-API risk). `setRising(on, immediate = false)`: `immediate` pre-fills the rising emitter via `fastForward` (used once at scene create for a loaded save).
5. **Calliope burst gate** keeps the existing strict code (`v >= threshold && v > minDriver`): bursts while RS/s > 1.
6. **Auto-clicks fold** exactly as C2; the chain, echo and conversion use pre-fold values. `totalClicks`, `click` events and floating text unaffected.
7. **Concurrent edits:** (a) Art Director edits numbers in `src/data/*`; (b) another worker is editing `src/game/math/camera.ts(+test)`, `src/data/world.ts(+test)` (`CAMERA.hudTopInsetPx`, `PylonFeed.leadTo`), `src/game/math/pylonLine.ts`, `src/game/rendering/PylonLine.ts`. WP10 never touches camera.ts / pylonLine.ts / PylonLine.ts; T3b edits `world.ts` additively (new const after `DUST`); T8 re-reads `WorldScene.ts` right before editing. Never revert a foreign hunk.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP10: Era IV (Resonance, resource RS). Era I-III must behave EXACTLY as before: numbers, greedy times (era I: gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326 s; era II windows generator 1500-2100, substationBlueprint 3300-4500; era III windows boiler 3900-4500, pressureVesselBlueprint 6300-8100), pixels and strings.
Baseline: typecheck clean, 1061 tests / 43 files green.
Specs: docs/plan/WP10.md (contracts), docs/plan/ART_ERA4.md (art contract). This assignment text wins over both where they differ.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/, or ANY src/**/*.css.
- CONCURRENCY: (a) the Art Director may edit NUMBERS in src/data/*.ts (era III rows, steamFx, machineComponents); (b) another worker edits src/game/math/camera.ts, src/data/world.ts (CAMERA.hudTopInsetPx, PylonFeed.leadTo), src/game/math/pylonLine.ts, src/game/rendering/PylonLine.ts.
  Re-read every file RIGHT BEFORE you edit it (and again before final validation). Keep edits SURGICAL (Edit tool, small unique anchors; never rewrite a whole file from memory). Era IV changes are ADDITIVE.
  Never revert or "fix" a foreign change. Never touch era I / II / III rows, ids or numbers. If a foreign edit makes your test fail, report it in NOTES.
- PURE (no 'phaser' import, no window/document/AudioContext): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/ui/*View.ts, src/ui/*Rules.ts, src/audio/audioMath.ts.
  `import Phaser from 'phaser'` only in src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts, src/assets/painters/painterTypes.ts (type use only).
- All balancing / tuning numbers live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio. No tech-id string literals in src/audio or src/game logic (read ids from data tables).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats, avoid -0 in expectations. Never delete coverage: when a count / list changes, update the assertion to the new value and keep the test's intent.
- Other workers edit OTHER files concurrently or in earlier waves. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list them in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these) ===

// ---- C1 Tech data (T1): src/data/{types,technologies,notifications,systemLogs,story}.ts ----
TECH_IDS += 'resonatorSpire','harmonicCoil','pressureResonator','crankServo','echoCrank','phaseLock','standingWave','crystalLattice','harmonicConvergence'   // append only, this order
Effect |= { type: 'autoClick'; perSecond: number }     // perSecond * level automatic crank clicks per second
Era IV rows (era 4 for all; every `effects` item keyed as the Effect type):
| id | name | kind | branch | costRes | baseCost | growth | maxLevel | effects | requires (in order) | tree col,row |
| resonatorSpire | Resonator Spire | unlock | convergence | pr | 1500000 | null | null | [convert 0.2 res rs] | [tech pressureVesselBlueprint 1] | 0,1 |
| harmonicCoil | Harmonic Coil | repeatable | mechanical | rs | 200 | 1.3 | 25 | [convert 0.1 res rs] | [tech resonatorSpire 1] | 1,0 |
| pressureResonator | Pressure Resonator | repeatable | automation | pr | 1000000 | 1.35 | 20 | [autoAdd 3 res rs] | [tech resonatorSpire 1] | 1,2 |
| crankServo | Crank Servo | repeatable | origin | me | 300000 | 1.5 | 10 | [autoClick perSecond 1] | [tech resonatorSpire 1] | 2,2 |
| echoCrank | Echo Crank | unlock | origin | rs | 10000 | null | null | [clickEcho seconds 2 res rs, clickMult factor 5] | [tech harmonicCoil 3] | 2,0 |
| phaseLock | Phase Lock | unlock | mechanical | rs | 50000 | null | null | [rateMult factor 1.25 res 'all'] | [tech harmonicCoil 5] | 2,1 |
| standingWave | Standing Wave | repeatable | mechanical | rs | 100000 | 1.3 | 20 | [autoPct percent 15 res rs] | [tech phaseLock 1] | 3,1 |
| crystalLattice | Crystal Lattice | unlock | automation | rs | 1500000 | null | null | [rateMult 2 res pr, rateMult 2 res ee] | [tech standingWave 3] | 4,1 |
| harmonicConvergence | Convergence | milestone | convergence | rs | 0 | null | null | [none] | [tech crystalLattice 1, tech echoCrank 1, lifetime rs 30000000] | 5,1 |
Descriptions: resonatorSpire "A lattice tower over a steam oscillator. Converts PR into resonance." · harmonicCoil "Toroidal winding on the tower. More RS from the same pressure." · pressureResonator "Steam whistles on the manifold. +3 RS/s per level." · crankServo "A gearbox turns the crank for you. +1 crank/s per level, offline too." · echoCrank "A fork rings with every turn. Clicks echo 2s of RS; x5 manual ME." · phaseLock "Twin mirrors broadcast the locked phase. x1.25 all production." · standingWave "The rod holds its note. +15% RS production per level." · crystalLattice "Quartz in the crown. Doubles PR and EE production." · harmonicConvergence description "Every part of the machine now rings at one frequency." flavor same text as its install line.
INSTALL_LINES (<= 60 chars): resonatorSpire "Tower raised. It was already humming." (= flavor, add `flavor` to the tech) · harmonicCoil "Coil wound. The tower rang a note lower." · pressureResonator "Whistles fitted. Nobody pulled the cord." · crankServo "Operator input automated. Operator retained." · echoCrank "The fork answers every turn of the crank." · phaseLock "Phase locked. To what, not specified." · standingWave "The wave stopped moving. The tower did not." · crystalLattice "Crystal seated. It was cut for this socket." · harmonicConvergence "All frequencies agree. Agreement logged." (= flavor).
Logs appended at the END of SYSTEM_LOGS: { id 'sync-success', text 'Synchronization successful.', lifetime rs atLeast 1000 }, { id 'signal-below', text 'Frequency matches a signal from below the ground.', lifetime rs 1000000 }, { id 'observer-one', text 'Observer count: 1.', lifetime rs 20000000 }.
PLAQUE_LINES += { milestone: 'harmonicConvergence', text: 'PRIMARY FUNCTION: RESTORE (TARGET: ?)' }  (last).
Save: additive tech keys default 0 -> NO save version bump.

// ---- C2 autoClick (T2): src/simulation/production/{rates,tick}.ts, progression/status.ts ----
computeRates: autoClicks = sum(effect.perSecond * level) over 'autoClick' effects of owned techs (level <= 0 skipped by the existing loop).
  1) perSecond chain exactly as today  2) perClick exactly as today (echo uses step-1 perSecond)
  3) AFTER perClick is built: for every r of RESOURCE_IDS: perSecond[r] += autoClicks * perClick[r]    (only when autoClicks !== 0)
describeEffect({ type: 'autoClick', perSecond }, n) === `+${fmt(perSecond * n)} auto-cranks/s`
Auto-clicks emit no click event, do not bump totalClicks, spawn no floating text. advance() / computeOffline() / HUD / animator / greedy include the fold for free.

// ---- C3 Machine + asset + FX data (T3a, T3b) ----
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric' | 'thermal' | 'resonance';   // resonance = rates.perSecond.rs
MACHINE_BOUNDS = { left: -448, right: 448, top: -470, bottom: 8 }
MachineLink.depth?: number now also applies to kind 'rod' (R1).  rod semantics: both endpoint components 'driven' => pin-to-pin rod (end = attach + rotatePoint(pin.at, angle)); otherwise the existing slider-crank rod (mainShaft -> pistonYoke).
export const RESONANCE_MILESTONE_FX = { techId: 'harmonicConvergence', crystal: 'crystal', holdFrame: 2, holdMs: 1000, restart: ['dishWavesL', 'dishWavesR'] } as const;   // machineComponents.ts
Sockets appended (this order): spireBase(64,-110) spireRod(64,-142) coilRing1(64,-157) coilRing2(64,-223) coilRing3(64,-274) coilRing4(64,-330) dishL(35,-360) dishR(93,-360) dishWavesL(-5,-360) dishWavesR(133,-360) crystalSeat(64,-418) calliopeSeat(-44,-178) forkBase(16,-110) servoBase(0,-14) servoHub(0,-24)    // 30 -> 45
Component ids appended (this order; 45 -> 61): spireTower spireExciter spireWave coilRing1 coilRing2 coilRing3 coilRing4 calliope servoBase servoArm koenigFork emitterDishL emitterDishR dishWavesL dishWavesR crystal
Asset ids appended after 'fx.smoke' (this order, +14): 'machine.spireTower','machine.spireExciter','machine.spireWave','machine.coilRing1','machine.coilRing2','machine.coilRing3','machine.coilRing4','machine.calliope','machine.servoBase','machine.servoArm','machine.koenigFork','machine.emitterDish','machine.dishWaves','machine.crystal'
src/data/steamFx.ts:
  EmitterMode burst += roundRobin?: boolean   // periodic bursts put all `count` puffs on ONE point, the point advancing per burst; purchase / milestone bursts use every point (puff i at point i % n)
  STEAM_EMITTERS += { id: 'calliope', assetId: 'fx.steamPuff', at: [(-72,-193), (-44,-193), (-16,-194)], gate: { techId: 'pressureResonator', minLevel: 1 }, driver: 'resonance', threshold: 0, mode: { kind: 'burst', count: 2, spacingMs: 150, everyMinS: 5, everyMaxS: 8, minDriver: 1, roundRobin: true } }   // appended LAST
  purchase burst of a roundRobin emitter = count * at.length puffs
  export const MILESTONE_BURSTS = [ { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 }, { techId: 'harmonicConvergence', emitter: 'calliope', count: 6 } ] as const;
  MILESTONE_BURST stays exported unchanged + `/** @deprecated use MILESTONE_BURSTS */` until the EM removes it in Mode B.
src/data/world.ts: export const DUST_RISING = { techId: 'resonatorSpire', minLevel: 1, speedY: [-18, -6], spawnTopY: GROUND_Y - 900 } as const;   (typed so `speedY` is [number, number])

// ---- C4 Pure maths (T5) ----
animation.ts:   driverValue(driver, manual, automation, electric = 0, thermal = 0, resonance = 0): number     // 'resonance' -> resonance
machineLinks.ts: rotatePoint(p: Vec2, deg: number): Vec2   // x' = x cos - y sin, y' = x sin + y cos (screen coords, +deg clockwise); exact 0 / +-1 sin/cos at multiples of 90 deg; never -0
                 pinEnd(attach: Vec2, pinAt: Vec2, deg: number): Vec2   // { x: attach.x + r.x, y: attach.y + r.y } with r = rotatePoint(pinAt, deg)
steamFx.ts:     burstPoints(points: readonly Vec2[], count: number, single: number | null): Vec2[]   // n = points.length; n 0 or count <= 0 -> []; single null -> point i % n for i < count; else `count` copies of points[single % n] (single normalised >= 0)
MachineAnimator.angleOf(id: MachineComponentId): number | null      // T7
LinkDrawContext += angleOf(component: MachineComponentId): number | null   // T7 (MachineLinks.ts)
```

---

# WAVE 1 (parallel: T1, T2, T9 - disjoint files; repo green at start)

## T1 - Era IV data, logs, plaque, install lines

**wave**: 1. **files_owned**: `src/data/types.ts`, `src/data/technologies.ts`, `src/data/technologies.test.ts`, `src/data/notifications.ts`, `src/data/systemLogs.ts`, `src/data/story.ts`, `src/simulation/state.test.ts`, `src/ui/systemLogRules.test.ts`, `src/ui/techTreeView.test.ts`, `src/ui/hudView.test.ts` (only if broken)

**objective**: land C1 exactly; era I-III rows untouched; fix foreign tests that hard-code counts.

**context** (read all files first; re-read right before editing):
- `types.ts`: append the nine ids to the `TECH_IDS` array (line 4 ends with `'pressureVesselBlueprint'`); add the Effect variant after `offlineHours` (line 24): `| { type: 'autoClick'; perSecond: number } // perSecond * level automatic crank clicks per second`. Nothing else.
- `technologies.ts`: append nine definitions AFTER `pressureVesselBlueprint` (ends line 441 `},` before `};` at 442), keys in TECH_IDS order, same field order/format as the era III rows (id, name, kind, branch, era, costRes, baseCost, growth, maxLevel, effects, requires, description, [flavor], tree). Values: C1 table. Do not touch any other row (Art Director may edit era III numbers; `git diff -U0 -- src/data/technologies.ts | grep '^-[^-]'` must show only foreign hunks).
- `notifications.ts`: add nine entries at the end of `INSTALL_LINES` (after `pressureVesselBlueprint`).
- `systemLogs.ts`: append three entries after `steam-rain` (same one-line format).
- `story.ts`: append the plaque line.
- `state.test.ts`: only if a tech count is hard-coded (use `TECH_IDS.length`).
- `systemLogRules.test.ts`: line ~28 `has 8 to 14 entries` -> `8 to 17 entries` (title and `toBeLessThanOrEqual(17)`); every `logState(T0, { me: 1e9, ee: 1e9, pr: 1e9 })` (lines ~64, 88, 95, 111, 128, 135) also gets `rs: 1e9` (check `logState`'s param type accepts `rs`; keep `shown.size === SYSTEM_LOGS.length` true; 17 entries <= the 50-call loops). Keep all other cases.
- `techTreeView.test.ts`: real-data tab assertions: line ~289 `toHaveLength(3)` -> `4` plus an added line `expect(tabs[3]).toEqual({ era: 4, label: 'SIGNAL ?', reached: false, selected: false, resourceText: '' })` (only if that test uses the real table; if it injects tables, adapt to what fails); line ~309 `[1, 2, 3]` -> `[1, 2, 3, 4]`; line ~300 `toEqual([false, true, false])` -> `[false, true, false, false]`. Fix whatever else fails because there is a 4th era; derive from data where possible.
- `technologies.test.ts` (existing structure: `ERA_THREE_IDS`, literal tables, describe 'era III technology table'): `TECH_LIST toHaveLength(27)` -> 36; line ~306 `[1, 2, 3]` -> `[1, 2, 3, 4]`; line ~610 `PLAQUE_LINES toHaveLength(4)` -> 5 (+ the fifth entry exact text); the test at ~411 `costRes: pr only on era III...` must stay true for eras I-III only: restrict its id lists to eras I-III (era IV uses me / pr / rs). Add `const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4)` and a `describe('era IV technology table')` with: (1) literal table of all nine rows (id -> kind, era, costRes, baseCost, growth, maxLevel, tree, branch, effects, requires) equal to C1 (copy the shape of the era III literal test); (2) every tech reachable from `handCrank` (existing BFS test must cover 36); (3) tree positions unique per era 4; (4) costRes per era IV: me only crankServo, pr only resonatorSpire + pressureResonator, rs the other six; (5) names <= 19 chars for every tech; (6) PLAQUE_LINES has five entries in order (null, generatorBlueprint, substationBlueprint, pressureVesselBlueprint, harmonicConvergence) with exact texts; (7) `autoClick` appears exactly once in the table (`crankServo`, perSecond 1); (8) INSTALL_LINES has a line for every tech id, unique, <= 60 chars, resonatorSpire and harmonicConvergence lines equal their flavors; (9) the three new log entries are the last three, exact ids / texts / thresholds, and lifetime thresholds increase within resource `rs`; (10) the prerequisite graph is acyclic (extend existing if present, else a DFS).

**constraints**: pure data; no Phaser / DOM; no `any`; no other file. `describeEffect` / `rates.ts` belong to T2.

**acceptance**: C1 table exact; 36 techs; acyclic; every tech reachable; unique tree pos per era; INSTALL_LINES complete; 3 logs; plaque line; Effect variant added; era I-III rows byte-identical.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/state.test.ts src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/data|^src/ui|^src/simulation/state" && echo FAIL || echo OK     # status.ts / rates.ts may fail until T2: ignore
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/types.ts src/data/technologies.ts src/data/notifications.ts src/data/systemLogs.ts src/data/story.ts && echo FAIL || echo OK
git diff -U0 -- src/data/technologies.ts | grep -E "^-[^-]" && echo CHECK_REMOVED_LINES || echo ONLY_ADDITIONS
npx vitest run 2>&1 | tail -8     # list failing files that are NOT yours in NOTES
```

## T2 - autoClick effect

**wave**: 1. **files_owned**: `src/simulation/production/rates.ts`, `rates.test.ts`, `tick.ts`, `tick.test.ts`, `src/simulation/progression/status.ts`, `progression.test.ts`

**objective**: C2 exactly. Tests use INJECTED tech tables only (override an existing id's effects); never depend on the real era IV rows.

**context**: read the six files. In `rates.ts`: after `let allMult = 1;` (line 49) nothing else changes; add `let autoClicks = 0;` next to the accumulators (line ~51); in the effect switch add `case 'autoClick': autoClicks += effect.perSecond * level; break;` (before `case 'none'`); AFTER the loop that fills `perClick` (the `for (const r of RESOURCE_IDS) { if (r !== 'me') perClick[r] = ... }` block, line ~102) insert `if (autoClicks !== 0) { for (const r of RESOURCE_IDS) perSecond[r] += autoClicks * perClick[r]; }` with a comment `// servo auto-cranks: each automatic click yields exactly one manual click (after perClick, so no feedback)`; extend the header comment (`autoClick -> autoClicks += perSecond x L; folded into perSecond after perClick: perSecond[r] += autoClicks x perClick[r]`). `status.ts`: add `case 'autoClick': return \`+${fmt(effect.perSecond * n)} auto-cranks/s\`;` after the `offlineHours` case. `tick.ts`: only the doc comment of `computeOffline`: change "automation only (never clicks)" to "automation only, incl. servo auto-cranks; never manual clicks". (`Effect` variant is added by T1 in parallel; unknown-variant errors vanish when T1 lands.)

**acceptance (tests)** (helper `withEffects` already exists in `rates.test.ts` / `tick.test.ts`; copy it into `progression.test.ts` only if needed):
- `rates.test.ts`, new `describe('autoClick fold')`. Table A = `withEffects({ gearRatio: [{ type: 'autoClick', perSecond: 2 }] })`, state `withLevels({ gearRatio: 3 })` (handCrank is owned by the initial state: perClick.me 1): `perClick.me` = 1 and `perSecond.me` = 6 (2 x 3 x 1); repeatable levels multiply: gearRatio level 5 -> `perSecond.me` 10; level 0 -> `perSecond.me` 0 (ignored). Table B = `withEffects({ gearRatio: [{ type: 'autoClick', perSecond: 2 }], wornMotor: [{ type: 'autoAdd', amount: 10, res: 'ee' }, { type: 'clickEcho', seconds: 3, res: 'ee' }, { type: 'convert', amount: 1, res: 'pr' }] })`, state `withLevels({ gearRatio: 3, wornMotor: 1 })`: `perClick.ee` = 30 (3 x 10, pre-fold); `perSecond.ee` = 10 + 6 x 30 = 190; `perSecond.me` = 6; `perSecond.pr` = sqrt(10) (conversion uses the PRE-fold ee: NOT sqrt(190)); `perClick` deep-equals the `perClick` of the same table with the autoClick effect removed (`gearRatio` effects `[]`); `perClick.pr` 0. The existing real-table rate tests stay green (no autoClick in era I-III).
- `tick.test.ts`: with Table A and 3 gearRatio levels: `advance(state, 10, techs).res.me` gains 60 and `.lifetime.me` gains 60, `totalClicks` unchanged; `computeOffline(state, state.lastSimTime + 100000, undefined, techs)` -> `gained.me` 6 x elapsed (elapsed 100 s -> 600); `applyClick(state, techs).gained` unchanged (1) and `totalClicks` +1; Table B `advance` gains ee 190/s x seconds.
- `progression.test.ts` (in `describe('describeEffect')`): `describeEffect({ type: 'autoClick', perSecond: 1 }, 1) === '+1 auto-cranks/s'`, n = 3 -> `'+3 auto-cranks/s'`, `{ perSecond: 0.5 }`, n = 1 -> `'+0.5 auto-cranks/s'`.
- Every existing test green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo FAIL || echo OK     # unknown-variant errors vanish once T1 landed
grep -nE "from ['\"](phaser|vitest)['\"]|\b(window|document)\b|console\.|\bany\b" src/simulation/production/tick.ts src/simulation/production/rates.ts src/simulation/progression/status.ts && echo FAIL || echo OK
git diff --stat -- src/simulation/GameSession.ts     # must be empty
```

## T9 - Stage + tree smoke scripts

**wave**: 1. **files_owned**: `scripts/smoke/stages.mjs`, `scripts/smoke/wp3-techtree.mjs`, `scripts/smoke/README.md`

**objective**: smoke stages for Era IV and a tree smoke that tolerates four tabs. Tech ids are plain strings (the real techs land in the same wave).

**context**: read the three files (current `stages.mjs` has constants `S7`, `S9`, `S10`, `PARTS` and stages up to `s11_era3_full`; `wp3-techtree.mjs` ends with the `11_*` block then `res.errors = errors`).
- `stages.mjs`: s0-s11 unchanged. Add constants after `S10`: `const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint'];` and make `s11_era3_full: S11`. Add `const S12 = [...S11, 'resonatorSpire'];` and stages `s12_spire: S12`, `s13_era4_full: [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence']`. Add `const PARTS4 = ['spireTower','spireExciter','spireWave','coilRing1','coilRing2','coilRing3','coilRing4','calliope','servoBase','servoArm','koenigFork','emitterDishL','emitterDishR','dishWavesL','dishWavesR','crystal'];` and extend the existing `parts` print: for `s12_spire` and `s13_era4_full` print `console.log(name, 'parts4', JSON.stringify(<same evaluate over PARTS4>))` (keep the era III `parts` print for s10 / s11 only). The plaque, camera, `@` marker logic, `nframes`, `FRAME_MS`, `ONLY`, final `errors` line unchanged.
- `wp3-techtree.mjs`: keep every existing check and key. Add `res['11_tabCount']` (number of `.tech-tab`) right after `11_tabs`. After the `11_boiler` line and before the final `Escape` / `res.errors` lines append: fast-forward to Era IV inside one `page.evaluate` with the same jump / retry rules as the block at lines 74-89 (reuse the `jump` pattern; `buys` = `[...S9, '@substationBlueprint', 'boiler', ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint']`), reopen via `#hud-tech`, record `12_tabs` (same shape as `11_tabs`; expect ERA IV enabled, text starting `ERA IV`), `12_tabCount` (expect 4), click `#tech-tab-4`, record `12_header` (`#tech-me`, expect ends `RS`), `12_nodes` (visible `.tech-node` count, expect 9), `12_spire` (class list of `[data-tech=resonatorSpire]`, fallback `'missing'`). Do not assert; only `ok(...)`.
- `README.md`: stage list text: add s12_spire and s13_era4_full (these also print `parts4`); keep the `@<techId>` line.

**constraints**: `.mjs` only; no `src/` edits.

**acceptance**: `node --check` passes both; new stage names exactly `s12_spire`, `s13_era4_full`; new result keys exactly `11_tabCount`, `12_tabs`, `12_tabCount`, `12_header`, `12_nodes`, `12_spire`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/stages.mjs && node --check scripts/smoke/wp3-techtree.mjs && echo SYNTAX_OK
grep -n "s12_spire\|s13_era4_full\|parts4\|12_tabs\|11_tabCount" scripts/smoke/stages.mjs scripts/smoke/wp3-techtree.mjs
git diff --stat -- src     # must show no change by you
```

---

# WAVE 2 (parallel: T3a, T3b, T4, T5 - disjoint files; wave 1 done and green)

## T3a - Machine components data

**wave**: 2. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`

**objective**: C3 machine part: types, sockets, 16 components, 2 links, bounds, milestone FX const. Era I-III component data byte-identical except `steamManifold` gains `outR` and `handCrank` gains `pin`. Types FIRST (T5 / T3b rely on them).

**context** (read file + test first; re-read before each edit; the Art Director has uncommitted era III hunks in both files: keep them):
1. Types: `AnimationDriver` (line 26) += `| 'resonance'` and its comment `resonance: RS/s (rates.perSecond.rs)`; `MachineLink` comment (line 57) / `depth` comment: depth also applies to pin-to-pin `rod` links; `MACHINE_BOUNDS` (line 66) -> `{ left: -448, right: 448, top: -470, bottom: 8 }`.
2. `MACHINE_COMPONENT_IDS` (lines 4-9): append the 16 ids after `'turbineRotor'`. `SOCKET_IDS` (lines 12-15): append the 15 ids after `'manifoldSeat'`; `MACHINE_SOCKETS` (lines 69-80): add the 15 coordinates after `manifoldSeat` with a comment line `// Era IV seats: spire (tower, exciter, rod, coil rings, dishes, crystal), calliope, fork, servo.`
3. Add the 16 definitions after `turbineRotor` (before the closing `};` of `MACHINE_COMPONENTS`), same field layout as the existing ones, `effects: []`. Columns: tech>=level / assetId / size / origin / socket (offset 0,0) / layer + depthBias ("-" = omit) / animation / connections:

| id | tech>=lvl | assetId | size | origin | socket | layer/bias | animation | connections |
|---|---|---|---|---|---|---|---|---|
| spireTower | resonatorSpire>=1 | machine.spireTower | 80x320 | .5,1 | spireBase | mid/- | none | - |
| spireExciter | resonatorSpire>=1 | machine.spireExciter | 24x32 | .5,1 | spireBase | mid/2 | none | steam (-12,-16) pipe |
| spireWave | standingWave>=1 | machine.spireWave | 16x270 | .5,1 | spireRod | mid/1 | `{ kind: 'frames', frames: 8, maxHz: 12, driver: 'resonance' }` | - |
| coilRing1 | harmonicCoil>=1 | machine.coilRing1 | 62x8 | .5,.5 | coilRing1 | mid/3 | `{ kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' }` | - |
| coilRing2 | harmonicCoil>=8 | machine.coilRing2 | 48x8 | .5,.5 | coilRing2 | mid/3 | same | - |
| coilRing3 | harmonicCoil>=16 | machine.coilRing3 | 36x8 | .5,.5 | coilRing3 | mid/3 | same | - |
| coilRing4 | harmonicCoil>=25 | machine.coilRing4 | 30x8 | .5,.5 | coilRing4 | mid/3 | same | - |
| calliope | pressureResonator>=1 | machine.calliope | 72x40 | .5,1 | calliopeSeat | back/3 | none | - |
| servoBase | crankServo>=1 | machine.servoBase | 28x20 | .5,1 | servoBase | mid/3 | none | - |
| servoArm | crankServo>=1 | machine.servoArm | 48x48 | .5,.5 | servoHub | front/3 | `{ kind: 'driven', ratio: -1.75, phaseDeg: 0 }` | pin (0,-19) kind 'pin' (no radius) |
| koenigFork | echoCrank>=1 | machine.koenigFork | 22x44 | .5,1 | forkBase | mid/- | `{ kind: 'frames', frames: 4, maxHz: 12, driver: 'manual' }` | - |
| emitterDishL | phaseLock>=1 | machine.emitterDish | 40x64 | .5,.5 | dishL | mid/4 | none | - |
| emitterDishR | phaseLock>=1 | machine.emitterDish | 40x64 | .5,.5 | dishR | mid/4, `flipX: true` | none | - |
| dishWavesL | phaseLock>=1 | machine.dishWaves | 40x64 | .5,.5 | dishWavesL | mid/4 | `{ kind: 'frames', frames: 6, maxHz: 8, driver: 'resonance' }` | - |
| dishWavesR | phaseLock>=1 | machine.dishWaves | 40x64 | .5,.5 | dishWavesR | mid/4, `flipX: true` | same | - |
| crystal | crystalLattice>=1 | machine.crystal | 32x48 | .5,1 | crystalSeat | mid/4 | `{ kind: 'frames', frames: 4, maxHz: 4, driver: 'resonance' }` | - |

   Comments in the file's style (era IV block; "dish waves draw after the dish: same depth, later id"; "crystal tip -466 inside bounds").
4. Existing parts: `steamManifold.connections` (line ~498) gets a second point `{ id: 'outR', at: { x: 33, y: -8 }, kind: 'pipe' }` after `steam`; `handCrank.connections` (line ~257, currently `[]`) becomes `[{ id: 'pin', at: { x: 0, y: -19 }, kind: 'pin' }]`. Nothing else in those two definitions.
5. `MACHINE_LINKS` (lines 144-162): append two links after the `C1` cable link (14 total):
   P4 `{ from: { component: 'steamManifold', point: 'outR' }, to: { component: 'spireExciter', point: 'steam' }, kind: 'pipe', via: [{ x: 48, y: -176 }, { x: 48, y: -126 }], bore: 4, pipeStyle: 'steam' }` (endpoints resolve to (-11,-176) and (52,-126));
   R1 `{ from: { component: 'servoArm', point: 'pin' }, to: { component: 'handCrank', point: 'pin' }, kind: 'rod', depth: MACHINE_LAYER_DEPTH.front + 4 }`.
   Preface with a comment `// Era IV: steam to the exciter (P4) and the servo coupling rod (R1, parallel crank).` `MACHINE_SHADOWS` unchanged (7).
6. After `MACHINE_LINKS` or near `MACHINE_ASSEMBLY`: `export const RESONANCE_MILESTONE_FX = { techId: 'harmonicConvergence', crystal: 'crystal', holdFrame: 2, holdMs: 1000, restart: ['dishWavesL', 'dishWavesR'] } as const;` with a comment (milestone: crystal holds frame 2 for holdMs, dish waves restart at frame 0).
7. Tests in `machineComponents.test.ts` (find by the literals): `toBe(45)` (line ~338) -> 61 and `toBe(30)` -> 45; canonical id order list extended (era I-III prefix unchanged); line ~998 bounds `toEqual({ left: -448, right: 448, top: -470, bottom: 8 })`; shadows stay 7; cable links still 4. **Links:** total 14; pipe links now five (P1 P2 P3 W1 P4): P4 resolved polyline `[(-11,-176), (48,-176), (48,-126), (52,-126)]` axis-aligned, bore 4 equals `MACHINE_LINK_STYLE.pipe.steam.prof.length`, default depth; rod links now two: the existing slider rod test must filter to the `mainShaft -> pistonYoke` link; new R1 tests: `servoArm.pin -> handCrank.pin`, both points kind 'pin', both components `driven`, equal ratio (-1.75) and equal phase (0), equal |pin.at| radius (19), depth `MACHINE_LAYER_DEPTH.front + 4`, resolved ends (0,-43) and (0,-75) (servo hub (0,-24)+(0,-19), crank hub (0,-56)+(0,-19)), rod length 32. Generic tests updated: "every connection point appears in a link except `turbine.export`" now also holds for `outR` and the two `pin` points; "rod links join two pin points". **Era IV data:** one table-driven test over the 16 components (tech, level, asset, size, origin, socket, layer, bias, animation, connections exactly as the table); sockets match the 15 coordinates; `emitterDishR` / `dishWavesR` have `flipX` and their socket x = 128 - socket x of the L twin; `servoArm.animation` deep-equals `handCrank.animation`; coil ring levels 1/8/16/25 and widths 62/48/36/30; frames-count / maxHz values; every `resonance` driver part is a `frames` part; `RESONANCE_MILESTONE_FX` exact, its `crystal` / `restart` ids are components with `frames` animation and `holdFrame < crystal frames`; every box inside the new bounds (generic test); era IV sockets all used (generic); `steamManifold` and `handCrank` equal their old definitions plus the new connection. A helper `levelsForEra4(prefix)` (all era I-III techs maxed as `levelsForEra3` does, then resonatorSpire, harmonicCoil at 1/8/16/25, pressureResonator, crankServo, echoCrank, phaseLock, standingWave, crystalLattice) drives visibility prefix tests: `coilRing4 => coilRing3 => coilRing2 => coilRing1`; `spireWave => spireTower`; `servoArm => servoBase`; every dish part appears exactly with `phaseLock`; `crystal` only with `crystalLattice`; `spireTower`, `spireExciter` visible exactly from resonatorSpire 1; all 61 visible at the full stage; every era I-III visibility test still green.

**constraints**: pure data; `import type`; do not edit era I-III values; no `any`. `AssetId` literals resolve once T3b lands `assetIds.ts` (same wave): vitest does not typecheck, so run tests; tsc errors on the 14 new asset literals are transient (NOTES).

**acceptance**: C3 exact: 61 components, 45 sockets, 14 links, 7 shadows, bounds, milestone FX; updated invariants pass.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/machineComponents.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/data/machineComponents" | grep -v "machine\.\(spire\|coil\|calliope\|servo\|koenig\|emitterDish\|dishWaves\|crystal\)" ; echo "(only transient AssetId errors may remain)"
grep -nE "from ['\"]phaser" src/data/machineComponents.ts && echo FAIL || echo OK
git diff -U0 -- src/data/machineComponents.ts | grep -E "^-[^-]"     # only foreign Art Director hunks + the 5 lines you changed (bounds, AnimationDriver, comments, 2 connections)
```

## T3b - Palette, world, steamFx, assets data

**wave**: 2. **files_owned**: `src/data/palette.ts`, `palette.test.ts`, `src/data/world.ts`, `world.test.ts`, `src/data/steamFx.ts`, `steamFx.test.ts`, `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`

**objective**: C3 data part. **Edit `assetIds.ts` FIRST** (T3a typechecks against it). `world.ts` is also edited by another worker (camera / pylon feed changes): re-read right before editing, additive only.

**context** (read all; re-read before each edit):
1. `assetIds.ts`: append the 14 ids after `'fx.smoke'` in the exact order of C3.
2. `manifest.ts`: 14 entries after `fx.smoke` (same layout as the existing `machine.gaugeNeedle` / `machine.turbineRotor` entries; `tileable: 'none'`; one-sentence `description`). width / height = WHOLE image; `frame` = one cell:

| id | file (under public/assets/) | width x height | origin | frame / rotation |
|---|---|---|---|---|
| machine.spireTower | machine/era4/spire-tower.png | 80x320 | .5,1 | - |
| machine.spireExciter | machine/era4/spire-exciter.png | 24x32 | .5,1 | - |
| machine.spireWave | machine/era4/spire-wave.png | 128x270 | .5,1 | frame 16x270 count 8 |
| machine.coilRing1 | machine/era4/coil-ring-1.png | 248x8 | .5,.5 | frame 62x8 count 4 |
| machine.coilRing2 | machine/era4/coil-ring-2.png | 192x8 | .5,.5 | frame 48x8 count 4 |
| machine.coilRing3 | machine/era4/coil-ring-3.png | 144x8 | .5,.5 | frame 36x8 count 4 |
| machine.coilRing4 | machine/era4/coil-ring-4.png | 120x8 | .5,.5 | frame 30x8 count 4 |
| machine.calliope | machine/era4/calliope.png | 72x40 | .5,1 | - |
| machine.servoBase | machine/era4/servo-base.png | 28x20 | .5,1 | - |
| machine.servoArm | machine/era4/servo-arm.png | 48x48 | .5,.5 | rotation `{ file: 'machine/era4/rot/servo-arm-rot.png', frames: 80 }` (sheet 432x432 = 9x9 cells of 48x48) |
| machine.koenigFork | machine/era4/koenig-fork.png | 88x44 | .5,1 | frame 22x44 count 4 |
| machine.emitterDish | machine/era4/emitter-dish.png | 40x64 | .5,.5 | - |
| machine.dishWaves | machine/era4/dish-waves.png | 240x64 | .5,.5 | frame 40x64 count 6 |
| machine.crystal | machine/era4/crystal.png | 128x48 | .5,1 | frame 32x48 count 4 |
   Verify files with `file public/assets/<f>` (read-only).
3. `palette.ts`: add to `PALETTE` and `PALETTE_CSS` (`css(...)` helper like the neighbours): `verdigrisDark 0x3f5e52`, `verdigris 0x7fae96`, `verdigrisLight 0xcfe8d6`.
4. `world.ts`: after the `DUST` constant add `/** Rising dust once the spire stands (Era IV): mote speedY [-18, -6] world px/s, spawn top GROUND_Y - 900. */ export const DUST_RISING: { techId: TechId; minLevel: number; speedY: [number, number]; spawnTopY: number } = { techId: 'resonatorSpire', minLevel: 1, speedY: [-18, -6], spawnTopY: GROUND_Y - 900 };`. Nothing else.
5. `steamFx.ts` (the Art Director has tuned `STEAM_FX` / chimney numbers: keep them): `EmitterMode` burst variant gains `roundRobin?: boolean` (update the doc comment: "roundRobin: each periodic burst fires all its puffs from ONE point, the point advancing per burst; purchase / milestone bursts use every point"); append the calliope emitter LAST in `STEAM_EMITTERS` (C3 values, comment `// Calliope: three whistles on the manifold; one whistle per burst, round robin, while RS/s > 1.`); add `export const MILESTONE_BURSTS = [...] as const;` after `MILESTONE_BURST`; mark `MILESTONE_BURST` `/** @deprecated use MILESTONE_BURSTS (removed once SteamFx switches) */`, value unchanged.
6. Tests:
   - `palette.test.ts`: spot values of the three keys in `PALETTE` and `PALETTE_CSS` (CSS strings of the same colours), key sets equal.
   - `world.test.ts`: `DUST_RISING` exact (techId, minLevel 1, speedY [-18, -6], spawnTopY `GROUND_Y - 900`); `speedY[0] <= speedY[1] < 0`; `spawnTopY >= 0` and `< DUST.spawnTopY`; its tech id is a known tech; fit test: `MACHINE_ANCHOR.y + PIXEL_SCALE * MACHINE_BOUNDS.top >= 0` (1120 - 940 = 180) and the x test stays; any assertion on the old bounds updated to the new ones; existing tests untouched.
   - `steamFx.test.ts`: emitter ids exactly `chimney, relief, hammer, manifold, calliope`; calliope values exact (assetId, three points, gate pressureResonator 1, driver resonance, threshold 0, mode count 2, spacingMs 150, everyMinS 5, everyMaxS 8, minDriver 1, roundRobin true); every `at` point inside `MACHINE_BOUNDS` (generic test already); `roundRobin` only on burst modes; `MILESTONE_BURSTS` has two entries in order (vessel/relief/4, convergence/calliope/6), each emitter exists and is a burst, each techId is a `milestone` tech; `MILESTONE_BURST` still equals `MILESTONE_BURSTS[0]` values; the calliope gate / the milestone tech ids are known techs.
   - `manifest.test.ts`: the dims test (cell == component size for sheets) covers the 14 new machine ids (shared files `machine.emitterDish` and `machine.dishWaves` are used by two components each: relax any "one component per asset" assertion to allow exactly those two); contract-dimension table extended with the table above; rotation entries now **twelve** (add `machine.servoArm`); the `#rot` url prefix check also accepts `assets/machine/era4/rot/`; sheet entries (`spireWave`, `coilRing1-4`, `koenigFork`, `dishWaves`, `crystal`) plan as `spritesheet` with the right frame; `sheetFrameRects`: `machine.spireWave` -> 8 rects at x 0..112 step 16, y 0, 16x270; `machine.crystal` -> 4 rects at x 0,32,64,96, 32x48; `machine.coilRing1` -> 4 rects x 0,62,124,186, 62x8; every new entry has a non-null existing file, unique .png paths. If a cross-check with `MACHINE_COMPONENTS` fails only because T3a (same wave) has not landed yet, re-run at the end and report in NOTES.

**constraints**: pure data; no `0x` outside palette / data; do not edit era I-III values; `world.ts` additive only.

**acceptance**: 14 asset ids with real files matching manifest sizes; palette keys; `DUST_RISING`; calliope emitter + `MILESTONE_BURSTS` + deprecated alias.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/palette.test.ts src/data/world.test.ts src/data/steamFx.test.ts src/assets
npx tsc --noEmit 2>&1 | grep -E "^src/(assets|data/(palette|world|steamFx))" && echo FAIL || echo OK     # 'resonance' driver error clears when T3a lands
grep -nE "from ['\"]phaser" src/data/palette.ts src/data/world.ts src/data/steamFx.ts src/assets/assetIds.ts src/assets/manifest.ts && echo FAIL || echo OK
for f in spire-tower spire-exciter spire-wave coil-ring-1 coil-ring-2 coil-ring-3 coil-ring-4 calliope servo-base servo-arm koenig-fork emitter-dish dish-waves crystal; do file public/assets/machine/era4/$f.png | cut -c1-100; done; file public/assets/machine/era4/rot/servo-arm-rot.png | cut -c1-110
git diff -U0 -- src/data/world.ts | grep -E "^-[^-]"     # only foreign hunks
```

## T4 - Balance sim Era IV + harness perf + save compat

**wave**: 2. **files_owned**: `src/simulation/balance.sim.test.ts`, `src/simulation/sim/greedy.ts`, `src/simulation/sim/greedy.test.ts`, `src/persistence/persistence.test.ts`, and the **era IV rows only** of `src/data/technologies.ts` (+ matching literal-table lines in `src/data/technologies.test.ts`, era IV table test only)

**objective**: prove the Era IV pacing targets; speed the harness (D5); prove save compat and offline servo output. Retune era IV numbers only if a window is missed.

**context** (read all; re-read `technologies.ts` before any edit):
- **Harness (greedy.ts) FIRST.** Before editing, copy the CURRENT `pickCheapest` and the `runGreedy` loop into `greedy.test.ts` as test-local `referenceRun` (the old per-resource recompute: `getAllTechViews(state, techs)` inside `for (const res of RESOURCE_IDS)`). New code in the buy tick (`greedy.ts` lines ~75-87): `let views = getAllTechViews(state, techs);` once per buy tick; inside the resource loop use `pickCheapest(views, res)`; after a successful `purchase` (`result.ok`) set `state = result.state`, push the purchase and recompute `views = getAllTechViews(state, techs)`. Results must be identical (same picks, same order). Also hoist nothing else. Keep exports unchanged. Comment `// views are rebuilt only after a successful purchase: identical picks, far fewer rebuilds`.
- `greedy.test.ts` new test: `runGreedy({ seconds: 1500, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1 })` equals `referenceRun(...)` for `firstAt`, `purchases`, `maxValue` (deep equal), and era I exact times hold (gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326).
- `balance.sim.test.ts`: keep every existing test and assertion. Profiles (`stepSeconds 1`, no offline): A `4 cps, buy 1 s, 12600 s` (change `MAIN_SECONDS` to 12600), B `4 cps, buy 30 s, 13800 s`, C `1 cps, buy 30 s, 23400 s`. Replace the `aAgain = runGreedy(PROFILE_A)` full rerun with `aPrefix = runGreedy({ ...PROFILE_A, seconds: 3600 })`; the era I / II / III determinism tests become: for every id, `aPrefix.firstAt[id] === (a.firstAt[id] <= 3600 ? a.firstAt[id] : Infinity)` and `aPrefix.purchases` deep-equals `a.purchases.filter((p) => p.t <= 3600)`. `console.table` already lists all `TECH_IDS` (36 now). New `describe('era IV pacing targets (WP10 Resonance)')` with `ERA_FOUR_IDS`:
  - A: `resonatorSpire` in [7050, 7800]; `harmonicConvergence` in [9900, 12300]; every era IV tech has a finite `firstAt`.
  - B: `harmonicConvergence` <= 12900. C: `harmonicConvergence` <= 22800; C final `crankServo` level >= 5 (`c.final.techLevels.crankServo`).
  - `maxPurchaseGap(run.purchases, run.firstAt.pressureVesselBlueprint, run.firstAt.harmonicConvergence)` <= 1200 for A, B, C.
  - B never earlier than A for any tech (existing test covers 36); `maxValue` finite and `< DESIGN_MAX_VALUE` for A, B, C.
  - The whole file runs under 10 s (vitest summary; the existing `aMs < 10000` test stays).
  Expected (planner prototype, A): resonatorSpire 7371, crankServo 7454, echoCrank 8143, phaseLock 8294, standingWave 8386, crystalLattice 9386, harmonicConvergence 10453; B 11347; C 21093.
- `persistence.test.ts` (use the existing helpers `withLevels`, `raw`, `serialize`, `deserialize`; the v1 fixture import exists): (1) a v2 save WITHOUT the nine era IV keys: build `serialize(withLevels({ gearRatio: 2 }), settings, 2000)`, `JSON.parse`, delete the nine ids from `state.techLevels`, `JSON.stringify`, `deserialize(..., 3000)` -> status `loaded` and each era IV level `0`; (2) round trip lossless with `{ resonatorSpire: 1, harmonicCoil: 12, crankServo: 3, echoCrank: 1, harmonicConvergence: 1 }` and non-zero rs; (3) the v1 fixture still `migrated` (existing test must stay); `SAVE_VERSION` still 2; (4) offline: state `withLevels({ wornMotor: 1, crankServo: 2 })`, `lastSimTime: 0`, `applyOffline(state, 3600 * 1000)` (import from `../simulation/production/tick`): `report.gained.me` equals `computeRates(state).perSecond.me * 3600` and is strictly greater than the same state without `crankServo` (auto-cranks counted offline).
- Retune rule (only if a window is missed): change ONLY numbers in the nine era IV rows (`baseCost`, `growth`, `maxLevel`, numeric fields inside `effects`, `minLevel` / `amount` inside `requires`) and the same numbers in the era IV literal-table test; never ids, kinds, costRes, tree, branch, names, texts, requirement structure, or any era I-III row. Never edit expected windows. If numbers alone cannot reach them STOP and report the A / B / C mm:ss tables.

**acceptance**: all assertions green; final era IV numbers (changed or not) and the A / B / C mm:ss table in the report; file time reported.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/balance.sim.test.ts src/simulation/sim src/data/technologies.test.ts src/persistence --silent=false 2>&1 | grep -E "mm:ss|resonator|harmonic|pressureRes|crankServo|echoCrank|phaseLock|standingWave|crystal|passed|failed|Duration"
git diff --stat -- src/data/technologies.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(simulation|data|persistence)" && echo FAIL || echo OK
```

## T5 - Pure maths

**wave**: 2. **files_owned**: `src/game/math/animation.ts`, `animation.test.ts`, `machineLinks.ts`, `machineLinks.test.ts`, `steamFx.ts`, `steamFx.test.ts`

**objective**: C4. Pure, no Phaser. Existing exports stay byte-identical. (`src/game/math/camera.ts` / `pylonLine.ts` are another worker's: do not touch.)

**context** (read the six files; `AnimationDriver` widens to `'resonance'` in T3a in parallel: `import type` only):
- `animation.ts`: `driverValue(driver, manual, automation, electric = 0, thermal = 0, resonance = 0)` (line 34) + `case 'resonance': return resonance; // resonance only` (update the doc comment: "...thermal (PR/s), or resonance (RS/s)").
- `machineLinks.ts`: add (after `resolveConnectionPoint`) `rotatePoint(p, deg)`: `const d = ((deg % 360) + 360) % 360;` if `d % 90 === 0` use exact `[cos, sin]` = d 0 -> (1,0), 90 -> (0,1), 180 -> (-1,0), 270 -> (0,-1); else `Math.cos/sin(d * PI / 180)`; return `{ x: nz(p.x * c - p.y * s), y: nz(p.x * s + p.y * c) }` with the file's `noNegativeZero`; non-finite deg or p -> `{ x: nz(p.x), y: nz(p.y) }` (unrotated). `pinEnd(attach, pinAt, deg)` = `{ x: nz(attach.x + r.x), y: nz(attach.y + r.y) }` with `r = rotatePoint(pinAt, deg)`.
- `steamFx.ts`: add `import type { Vec2 } from '../../data/machineComponents';` and `burstPoints(points, count, single)` per C4 (`const n = points.length; if (n === 0 || !(count > 0)) return []; ... Math.floor(count)`; for `single !== null` use `points[((single % n) + n) % n]`; skip undefined entries safely, no `!`).

**acceptance (tests; literal data only, do not import era IV data)**:
- `animation.test.ts`: `driverValue('resonance', 2, 3, 7, 9, 11) === 11`; `driverValue('thermal', 2, 3, 7, 9) === 9` (5 args, resonance defaults 0) and the 3 / 4-arg calls unchanged; `driverValue('resonance', 1, 2) === 0`.
- `machineLinks.test.ts`: `rotatePoint({x:0,y:-19}, d)` for d = 0, 90, 180, 270, 360, -90 -> (0,-19), (19,0), (0,19), (-19,0), (0,-19), (-19,0); every component `Object.is(v, -0)` false; 45 deg of (0,-19) -> (13.435..., -13.435...) `toBeCloseTo(13.4350288, 6)`; length preserved at 33 deg; non-finite deg -> unchanged point. `pinEnd({x:0,y:-24},{x:0,y:-19},90)` = (19,-24). **R1 geometry**: servo hub (0,-24) and crank hub (0,-56), pin (0,-19), equal angle d in [0, 45, 90, 135, 180, 270]: `a = pinEnd(servoHub, pin, d)`, `b = pinEnd(crankHub, pin, d)`: `a.x === b.x` (toBeCloseTo 9), `a.y - b.y` = 32 (toBeCloseTo 9), rod length 32 at every angle; servo pin y never > -5 (max over a 5-degree sweep, toBeLessThanOrEqual(-5 + 1e-9)).
- `steamFx.test.ts` (keep existing; add): `burstPoints(P, 3, null)` with `P = [a, b, c]` -> `[a, b, c]`; count 6 null -> `[a,b,c,a,b,c]`; count 2 single 1 -> `[b, b]`; single 4 (n 3) -> point 1; single -1 -> point 2; empty points -> `[]`; count 0 or negative -> `[]`; the returned points are the same object references (identity) as the inputs.
- Existing tests green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/animation.test.ts src/game/math/machineLinks.test.ts src/game/math/steamFx.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game/math/(animation|machineLinks|steamFx)\.ts" && echo FAIL || echo OK     # animation.ts TS2366 clears when T3a added 'resonance' AND your case exists
grep -nE "from ['\"]phaser" src/game/math/animation.ts src/game/math/machineLinks.ts src/game/math/steamFx.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/game/math/machineLinks.ts src/game/math/animation.ts src/game/math/steamFx.ts && echo CHECK || echo OK
```

---

# WAVE 3 (parallel: T6, T7, T8 - disjoint files; waves 1-2 done and green)

## T6 - Era IV audio

**wave**: 3. **files_owned**: `src/data/audio.ts`, `src/audio/gameAudio.ts`, `src/audio/synth.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`

**objective**: harmonic pad, fork ping (click + era IV purchase), servo whirr, milestone chord; mute respected; era I thunk, era II relay, era III hiss, whistle unchanged.

**context** (read all five; `synth.ts` model functions: `ensureBoiler` (persistent bed), `ensureMains` (oscillator pair), `playWhistleTone` (multi-osc envelope), `run`, `close()`; `gameAudio.ts`: `tick()`, `subscribe()`):
- `data/audio.ts` (add before the closing `} as const;`, comments in the file's style):
  ```
  pad: { baseHz: 110, partials: [1, 2, 3], partialGains: [1, 0.5, 0.33], lfoHz: 0.15, lfoDepth: 0.35, minGain: 0.02, maxGain: 0.08, refPerSecond: 1, maxPerSecond: 100000, techId: 'resonatorSpire' },
  forkPing: { hz: 512, partialRatio: 2.76, partialGain: 0.3, ms: 550, gain: 0.25, techId: 'echoCrank' },
  servo: { lowpassHz: 700, minHz: 55, maxHz: 110, minGain: 0.02, maxGain: 0.07, techId: 'crankServo' },
  chord: { baseHz: 110, ratios: [3, 4, 5], ms: 1200, attackMs: 250, gain: 0.18, techId: 'harmonicConvergence' },
  ```
- `audioMath.ts` (pure, reuse `activityLevel`, `clampRange`, `lerp`): `padGain(rsPerSecond: number, owned: boolean, cfg = AUDIO.pad): number` (0 when `!owned` or `!(rs > 0)`, else `clampRange(lerp(minGain, maxGain, activityLevel(rs, ref, max)), minGain, maxGain)`); `servoFraction(level: number, maxLevel: number): number` (0 for non-finite / level <= 0 / maxLevel <= 0, else `clampRange(level / maxLevel, 0, 1)`); `servoGain(level, maxLevel, cfg = AUDIO.servo)` (0 when fraction 0 else `lerp(minGain, maxGain, fraction)`); `servoHz(level, maxLevel, cfg = AUDIO.servo)` (`lerp(minHz, maxHz, fraction)`, minHz at 0).
- `synth.ts`: interface + implementation (errors never escape via `run`): `setPad(gain: number): void` (persistent: one sine oscillator per `partials[i]` at `baseHz * partial` through its own gain `partialGains[i]` into a pad gain into master; one slow sine LFO at `lfoHz` into a depth gain feeding the pad gain's `gain` AudioParam; depth = `lfoDepth * target gain`... keep simple: LFO depth gain set with `setTargetAtTime(amp * lfoDepth, ...)` like `setWind`; created lazily; `amp === 0` and never started -> return; gain moved with `setTargetAtTime`); `playForkPing(): void` (two sines `hz` and `hz * partialRatio` (the second at `partialGain` of the first) through one envelope: instant attack to `gain`, exponential decay to the floor in `ms / 1000`; nodes disconnected when done; reuse `playVoice` twice with `peak` `gain` and `gain * partialGain`, wave 'sine', decay `ms / 1000`); `setServo(gain: number, hz: number): void` (persistent sawtooth oscillator -> lowpass at `lowpassHz` -> gain; frequency and gain moved with `setTargetAtTime`; lazily created; 0 gain never started -> return); `playChord(delaySeconds = 0): void` (three sines at `baseHz * ratios[i]` through one envelope: linear ramp to `gain` over `attackMs`, exponential decay to the floor by `ms`, oscillators stopped and disconnected when done; same structure as `playWhistleTone`). `close()` also stops / disconnects pad oscillators + LFO and the servo oscillator (inside the existing try).
- `gameAudio.ts`: import `padGain`, `servoGain`, `servoHz` and `TECHNOLOGIES` (already imported). `tick()` not muted: `s.setPad(padGain(session.rates.perSecond.rs, levels[AUDIO.pad.techId] >= 1));` and `const servoLevel = levels[AUDIO.servo.techId]; const servoMax = TECHNOLOGIES[AUDIO.servo.techId].maxLevel ?? 1; s.setServo(servoGain(servoLevel, servoMax), servoHz(servoLevel, servoMax));` where `levels = session.state.techLevels`; muted branch: `s.setPad(0); s.setServo(0, AUDIO.servo.minHz);` next to `s.setBoiler(0)`. Click handler: replace `oneShot('click', (s) => s.playCrank())` by `oneShot('click', (s) => { s.playCrank(); if (session.state.techLevels[AUDIO.forkPing.techId] >= 1) s.playForkPing(); })`. Purchase handler: `if (era >= 4) s.playForkPing(); else if (era === 3) s.playHiss(); else if (era === 2) s.playRelay(); else s.playPurchase();`. Milestone handler: keep, add `if (id === AUDIO.chord.techId) s.playChord((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);` (after the whistle line). Update the `tick` doc comment.

**acceptance (tests, `audioMath.test.ts` only)**: `padGain`: 0 when not owned (even rs 1e9); 0 for rs 0, negative, NaN; > 0 for rs 1 owned; within `[minGain, maxGain]` for rs 1e12; monotone non-decreasing over rs = 1, 10, 1e3, 1e6. `servoFraction`: (0, 10) 0; (5, 10) 0.5; (20, 10) 1; (3, 0) 0; NaN 0; `servoGain`: 0 at level 0 and NaN, `maxGain` at level == maxLevel, `minGain < servoGain(1, 10) < maxGain`; `servoHz(0, 10) === minHz`, `servoHz(10, 10) === maxHz`, monotone. Existing cases untouched. Typecheck clean for `src/audio` and `src/data/audio.ts`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
grep -nE "'(resonatorSpire|echoCrank|crankServo|harmonicConvergence|pressureVesselBlueprint)'" src/audio/gameAudio.ts src/audio/synth.ts src/audio/audioMath.ts && echo FAIL_LITERAL || echo OK
```

## T7 - Machine rendering (animator, view, R1 rod)

**wave**: 3. **files_owned**: `src/game/entities/MachineAnimator.ts`, `src/game/entities/MachineView.ts`, `src/game/rendering/MachineLinks.ts`

**objective**: render the 16 parts and 2 links; `resonance` driver everywhere; servo arm on the crank angle; pin-to-pin rod R1; milestone crystal hold + dish-wave restart. No unit tests (Phaser classes); acceptance = typecheck + Director smoke. Era I-III pixels unchanged. No exciter vibration.

**context** (read all three + `machineComponents.ts` (T3a), `steamFx.ts` data, `math/animation.ts`, `math/machineLinks.ts` (T5), `math/driveTrain.ts` (`rotationFrame`), `math/machineLayout.ts` (`resolveAttachment`); re-read before editing):
- `MachineAnimator.ts`:
  - `const CRANK_PARTS = ['handCrank', 'crankBrace', 'servoArm']` (line 42). The constructor already asserts equal ratio / phase.
  - Add `const rs = this.session.rates.perSecond.rs;` beside `pr` (line 145) and pass it as the 6th argument in EVERY `driverValue(anim.driver, this.manual, me, ee, pr)` call in `update` (assembling `spin`, `vibrate`, `frames`, `spin`, `gauge`: 5 places). `getDriverValues()` also returns `resonance: rates.rs` (extend the return type).
  - New public `angleOf(id: MachineComponentId): number | null`: `const anim = MACHINE_COMPONENTS[id].animation; if (anim.kind !== 'driven') return null; const deg = this.drivenAngle(id, anim); const sprite = this.sprites.get(id); const n = sprite === undefined ? 0 : sprite.texture.frameTotal - 1; if (sprite !== undefined && sprite.texture.key.endsWith('#rot') && n > 1) return rotationFrame(deg, n) * 360 / n; return deg;` (import `rotationFrame` is already available from `../math/driveTrain`: add it to the existing import). Doc: "displayed angle (snapped to the rot frame) so link pins match the sprite".
  - Milestone FX (data `RESONANCE_MILESTONE_FX`, import from machineComponents): fields `private crystalHoldUntil = -1;` and `private readonly frameOrigins = new Map<MachineComponentId, number>();`. Constructor: third subscription `this.unsubscribeMilestone = session.on('milestone', ({ id }) => { if (id !== RESONANCE_MILESTONE_FX.techId) return; this.crystalHoldUntil = this.elapsed + RESONANCE_MILESTONE_FX.holdMs / 1000; for (const part of RESONANCE_MILESTONE_FX.restart) this.frameOrigins.set(part, this.elapsed); });` unsubscribed in `destroy()`; reset handler sets `crystalHoldUntil = -1` and `frameOrigins.clear()`. In `case 'frames'`: `if (id === RESONANCE_MILESTONE_FX.crystal && this.elapsed < this.crystalHoldUntil) { sprite.setFrame(RESONANCE_MILESTONE_FX.holdFrame); break; }` first; the frame clock becomes `this.elapsed - (this.frameOrigins.get(id) ?? 0)` (equals `this.elapsed` for every part without an origin: era I-III unchanged).
  - Update the class doc comment (resonance = RS/s; servo arm joins the crank group; milestone FX).
- `MachineView.ts`: pass the new context field: `this.links.draw({ pointOf: this.pointOf, isLive: this.isActive, masterDeg: drive.masterDeg, angleOf: (id) => this.animator.angleOf(id) })` (line ~290); update the doc comment bounds (`era IV bounds: pixel (448, 470)`). Nothing else (bounds / RT size read `MACHINE_BOUNDS`; `rotates` already covers `driven` -> `servoArm` starts on its `#rot` sheet).
- `MachineLinks.ts`:
  - `LinkDrawContext += angleOf(component: MachineComponentId): number | null;` (doc: displayed angle of a driven part).
  - `interface PinRodPlan { depth: number; pin: Vec2; eye: Vec2 }`; `LinkPlan` gains `pinRods: PinRodPlan[]` and `pinRodKeys: Map<number, string>`. Helper `pinRodDepths(): number[]` = distinct `link.depth ?? MACHINE_LINK_STYLE.rodDepth` of links with `kind === 'rod'` whose BOTH components have `animation.kind === 'driven'`.
  - `buildPlan`, branch `link.kind === 'rod'`: FIRST test `const toAnim = MACHINE_COMPONENTS[link.to.component].animation; const fromAnim = MACHINE_COMPONENTS[link.from.component].animation; if (fromAnim.kind === 'driven' && toAnim.kind === 'driven')` -> pin-to-pin: `depth = link.depth ?? MACHINE_LINK_STYLE.rodDepth`; `const a = ctx.angleOf(link.from.component); const b = ctx.angleOf(link.to.component);` points: `fromDef = MACHINE_COMPONENTS[link.from.component]`, `pinFrom = connectionOffset(fromDef, link.from.point)`, same for `to`; if `!fromLive || !toLive || a === null || b === null || pinFrom === null || pinTo === null` push `'q-'` into that depth's key parts and continue; else `pin = roundPoint(pinEnd(resolveAttachment(fromDef), pinFrom, a))`, `eye = roundPoint(pinEnd(resolveAttachment(toDef), pinTo, b))` (imports: `pinEnd`, `connectionOffset` from `../math/machineLinks`), key part `` `q${pin.x},${pin.y};${eye.x},${eye.y}` ``. Otherwise the existing slider-crank code runs unchanged (keep its `crankAnim` lines as they are).
  - Class: `private readonly pinRodGraphics = new Map<number, Graphics>()` created in the constructor for every `pinRodDepths()` (`scene.make.graphics({}, false).setDepth(depth)`, `parent.add`), a `pinRodKeys = new Map<number, string>()` last-drawn key per depth; in `draw` after the existing rod block: for each depth redraw (`g.clear(); this.drawRods(g, plans of that depth)`) only when that depth's key changed. Change `drawRods` to `drawRods(g: Phaser.GameObjects.Graphics, plans: readonly RodPlan[])` and pass `this.rods` from the existing call (Era I rod pixels unchanged). `plot` already takes a Graphics. `destroy()` also destroys `pinRodGraphics` and clears `pinRodKeys`.
  - A pin-to-pin rod is hidden while either endpoint is hidden / assembling (key `'q-'`).

**constraints**: no `0x` literals; colours only from `MACHINE_LINK_STYLE`; no tech-id literals; belt / cable / pipe / slider rod behaviour unchanged.

**acceptance**: typecheck clean for `src/game/entities` and `src/game/rendering/MachineLinks.ts` (`WorldScene.ts` may fail until T8); greps pass; Director smoke: servo arm + R1 rod move with the crank, rod vertical at every frame, 61 sprites; crystal 1 Hz pulse; on the milestone the crystal holds bright 1 s and the dish waves restart; s0-s11 pixels as before.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/(entities|rendering/MachineLinks)" && echo FAIL || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineView.ts src/game/entities/MachineAnimator.ts src/game/rendering/MachineLinks.ts && echo FAIL || echo OK
grep -n "angleOf\|RESONANCE_MILESTONE_FX\|pinEnd\|'servoArm'\|rs)" src/game/entities/*.ts src/game/rendering/MachineLinks.ts
```

## T8 - Calliope FX + rising dust wiring

**wave**: 3. **files_owned**: `src/game/rendering/SteamFx.ts`, `src/game/rendering/DustField.ts`, `src/game/scenes/WorldScene.ts`

**objective**: SteamFx reads the resonance driver, round-robin calliope bursts, milestone bursts from `MILESTONE_BURSTS`; `DustField.setRising`; WorldScene toggles it. Phaser allowed; no unit tests. Do NOT touch `PylonLine.ts` / `camera.ts` (another worker's); `WorldScene.ts` may have foreign edits: re-read right before editing.

**context** (read the three files + `data/steamFx.ts`, `data/world.ts` (`DUST`, `DUST_RISING`), `math/steamFx.ts` (`burstPoints`), `math/animation.ts`):
- `SteamFx.ts`:
  - Imports: `MILESTONE_BURSTS` instead of `MILESTONE_BURST` (line 2); `burstPoints` from `../math/steamFx`.
  - `EmitterState` gains `burstPoint: number` (round-robin whistle counter; `freshState()` -> 0).
  - `stepLane` (line ~124): `const v = driverValue(emitter.driver, 0, rates.me, rates.ee, rates.pr, rates.rs);`.
  - Burst branch (line ~144): periodic burst: `const single = mode.roundRobin === true ? state.burstPoint : null; if (mode.roundRobin === true) state.burstPoint += 1;` then `this.scheduleBurst(emitter, mode.count, mode.spacingMs, this.clock, single);`.
  - `scheduleBurst(emitter, count, spacingMs, startAt, single: number | null = null)`: `const pts = burstPoints(emitter.at, count, single); pts.forEach((point, i) => this.scheduled.push({ at: startAt + (i * spacingMs) / 1000, point, assetId: emitter.assetId }));` (replaces the `pointAt` loop; relief / purchase / milestone behaviour for non-round-robin emitters identical: puff i at point i % n).
  - `onUnlock`: burst count = `mode.roundRobin === true ? mode.count * emitter.at.length : mode.count`, `single` null (all whistles once).
  - `onMilestone(id)`: `for (const m of MILESTONE_BURSTS) { if (m.techId !== id) continue; const lane = this.lanes.find((l) => l.emitter.id === m.emitter); if (lane === undefined) continue; const mode = lane.emitter.mode; if (mode.kind !== 'burst') continue; this.scheduleBurst(lane.emitter, m.count, mode.spacingMs, this.clock, null); }`. The vessel relief burst stays 4 puffs.
  - Update comments; pool cap unchanged.
- `DustField.ts`: keep the existing emitter as `normal`; add a second emitter `rising` built from the same config but `y: { min: DUST_RISING.spawnTopY, max: DUST.spawnBottomY }`, `speedY: { min: DUST_RISING.speedY[0], max: DUST_RISING.speedY[1] }`, `emitting: false`, same depth; `private risingOn = false`. Public `setRising(on: boolean, immediate = false): void`: no-op when `on === this.risingOn`; else set the flag; `on` -> `this.normal.stop(); this.rising.start(); if (immediate) this.rising.fastForward(DUST.lifespanMs[1]);` off -> `this.rising.stop(); this.normal.start();`. Live motes of the stopped emitter finish their life (never killed). `destroy()` destroys both. If `immediate` and `on` and the constructor `fastForward` already filled `normal`, call `this.normal.killAll()` only in that immediate case (the loaded save never shows the old motes). Verify the Phaser API names in `node_modules/phaser/types/phaser.d.ts` (`ParticleEmitter#start`, `stop`, `fastForward`, `killAll`, `emitting`); if a name differs use the typed equivalent and report it.
- `WorldScene.ts`: field `private dust: DustField | null = null;` (replace the local `const dust` use: `this.dust = dust`), `import { DUST_RISING, PYLON_FEEDS } from '../../data/world'` (merge with the existing import). In `create()` right after constructing the dust: `dust.setRising(this.ctx.session.state.techLevels[DUST_RISING.techId] >= DUST_RISING.minLevel, true);`. In `update()` after the machine / steam lines: `this.dust?.setRising(this.ctx.session.state.techLevels[DUST_RISING.techId] >= DUST_RISING.minLevel);` (cheap flag compare; reconfigures only on change; a session reset lowers the level -> back to normal). The dust disposable sets `this.dust = null` before `dust.destroy()`. Nothing else changes; keep the shutdown try / catch loop.

**constraints**: colours / numbers only from data; no `0x`; all objects destroyed on shutdown; 0 console errors.

**acceptance**: typecheck clean for `src/game`; greps pass; Director smoke: calliope one whistle puffs 2 times every 5-8 s while RS/s > 1 (points rotate), all three whistles puff 2 times each (6 puffs) on the `pressureResonator` purchase after 700 ms, a 6-puff all-whistle burst on `harmonicConvergence`, relief burst on the vessel unchanged; dust drifts upward once `resonatorSpire` is owned (a loaded save shows it immediately), back to normal after a reset.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo FAIL || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/SteamFx.ts src/game/rendering/DustField.ts src/game/scenes/WorldScene.ts && echo FAIL || echo OK
grep -n "MILESTONE_BURST\b\|MILESTONE_BURSTS\|setRising\|burstPoints\|rates.rs" src/game/rendering/SteamFx.ts src/game/rendering/DustField.ts src/game/scenes/WorldScene.ts
```

---

# WAVE 4 - EM Mode B (validate)

Run: `npm run typecheck`, `npm test` (baseline **1061 / 43 files**; expect 1061 + new; compare `it(` titles against `git diff` so no touched test file lost cases), `npm run build` (app chunk <= 200 KB). Then:
```
grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/ui/*View.ts src/ui/*Rules.ts src/audio/audioMath.ts   # must be empty
grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test                                                      # must be empty
grep -rn "MILESTONE_BURST\b" src                                                                                                        # glue: delete deprecated export + its test lines (one-line glue, say so)
npx vitest run src/simulation/balance.sim.test.ts --silent=false                                                                        # era I exact + II + III + IV windows, < 10 s
git diff --stat HEAD -- docs/GAME_SPEC.md src/simulation/GameSession.ts public                                                          # must be empty
git diff HEAD -- src/data/technologies.ts | grep -E "^-[^-]"                                                                            # only Art Director hunks
```
**Balance** (A 12600 s, B 13800 s, C 23400 s): era I exact; era II / III windows unchanged; A resonatorSpire in [7050, 7800], harmonicConvergence in [9900, 12300] (every era IV tech finite); B <= 12900; C <= 22800 and C final crankServo >= 5; `maxPurchaseGap(vessel -> convergence)` <= 1200 A / B / C; B never earlier than A; maxValue finite < DESIGN_MAX_VALUE; deterministic 3600 s prefix; file < 10 s.
**Save**: v2 save without era IV keys -> `loaded`, levels 0; v1 fixture migrates; round trip lossless; offline gain with crankServo includes auto-cranks; no SAVE_VERSION change.
**Per-criterion PASS / FAIL**: C1 table exact (36 techs, `autoClick` variant, names <= 19 chars, install lines, 3 logs, plaque); C2 fold (rates, advance, offline, describeEffect, no event / totalClicks change); C3 counts (61 components, 45 sockets, 14 links = 12 + P4 + R1, 7 shadows, 14 new asset ids with real files, rotation entries 12, `MACHINE_BOUNDS`, `RESONANCE_MILESTONE_FX`, steamFx calliope + `MILESTONE_BURSTS`, `DUST_RISING`, palette); C4 maths + tests; `resonance` driver in every animator path; `servoArm` in `CRANK_PARTS`; `angleOf`; pin-to-pin rod branch + per-depth Graphics; milestone FX in animator; SteamFx round robin + milestone loop; `DustField.setRising` + WorldScene toggle + destroy; audio (pad silent without spire, fork ping on click / era IV purchase, servo silent at 0, chord after the sting, mute respected: read code paths, no tech-id literals).
Allowed glue: one-line integration fixes only (state them).

## Director smoke test steps (after the build)
`npm run build && npx vite preview --port 4173 --strictPort &` then per `scripts/smoke/README.md` with `PW=$(npm root -g)/playwright`:
1. `wp2-crank`, `wp3-techtree`, `wp4-persistence`, `full-machine` -> `errors` empty; `wp3-techtree`: `11_tabCount` 4 (ERA IV `SIGNAL ?`), `12_tabs` ERA IV enabled text `ERA IV...`, `12_tabCount` 4, `12_header` ends `RS`, `12_nodes` 9.
2. `stages.mjs` s0-s13 (`ONLY=s13_era4_full` with frames arg `8` shows arm / rod / crank moving together) -> 0 errors. s0-s11 same look and zooms as WP9 (s9 0.75, s11 0.5). s12: tower + exciter on the girder, P4 pipe manifold -> exciter, plaque `REST?RE`, camera 0.5 with spire top on screen, dust drifting upward, `parts4` shows only `spireTower`, `spireExciter` visible. s13: all 16 parts visible, rings 4, standing wave moving, dishes mirrored with pings, crystal 1 Hz glow (<= 3 Hz), calliope puffs, servo arm + R1 rod vertical, plaque `PRIMARY FUNCTION: RESTORE (TARGET: ?)`.
3. Manual: T -> ERA IV `SIGNAL ?` before the vessel, then header `<n> RS`; keyboard-only purchase; crankServo node text `+1 auto-cranks/s`; HUD ME/s rises on servo purchase; crank text shows `+N ME +M EE +K PR +J RS` after echoCrank; audio: fork ping on clicks, pad audible, servo whirr, chord after the sting on the milestone; offline with crankServo includes auto-crank gain.
4. Docs (Director): `docs/PROJECT_STATUS.md` (WP9 done + WP10: era IV numbers, autoClick fold, decisions D1-D5 + EM 1-7), `docs/ASSET_GUIDE.md` era IV entries.

---

# Risks
- **Concurrent edits** (Art Director numbers; camera / world / pylon worker): re-read before edit; additive era IV; T3b / T8 touch `world.ts` / `WorldScene.ts` last in the sequence, others never.
- **T3a size** (16 components + tests): if it stalls split on its seams: (types + sockets + ids + links + FX const) / (16 definitions + tests).
- **T7** (animator + view + R1 rod) is the riskiest Phaser work: if it stalls split (MachineAnimator + MachineView) / (MachineLinks). R1 rod pixels are only verified by smoke: servo cap drawn at `servoHub` sits at capDepth 32 under the arm (33) and may be hidden by an opaque arm centre (acceptable).
- **Balance**: prototype from a scratch harness; T4 must STOP and report tables if windows are missed by numbers alone. Profile A runs 12600 steps: the D5 harness change is required to stay < 10 s.
- **Phaser particle API** (T8): two-emitter design avoids property setters; names verified in `phaser.d.ts`.
- **angleOf snapping** relies on `rot` frame k = k * 360 / n (confirmed in `rotationFrame` doc); servo and crank both use 80 frames.
- **Calliope** emits nothing at RS/s <= 1 (strict gate, accepted); purchase burst fires regardless.
- **Audio** has no unit coverage beyond `audioMath`: reviewed by reading the code path and by ear.
