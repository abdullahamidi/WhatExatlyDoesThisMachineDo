# WP16a — Release verification tooling (part A): save compat matrix, browser e2e, a11y smoke + fixes, soak smoke, store screenshots, ASSET_GUIDE guard

First half of `docs/plan/WP16.md`, slimmed by `docs/plan/STEAM_DEMO_PROGRAM.md` D8 (program decisions win). Worktree
`C:/Users/sanan/wedtmd-shell`, branch `claude/release-wp16`, baseline 66fa021: typecheck clean, 108 files / 3155 tests, build OK,
bundle PASS (app `index-*.js` 396,165 B raw ≤ 460 KB; css 38,416 B ≤ 40 KB → **css headroom ≈ 1.5 KB**).
Already done, do not redo: T1 fullRun.e2e, T3 signoff.sim, T4 debug gate (`src/utils/debugFlag.ts`), T5 version v0.9.0.
WP16b (after WP21 merges): Art Director audit, quiet GPU perf re-check, demo e2e, 30–60 min soak run, README/CHANGELOG/STEAM_RELEASE/
GAME_SPEC §18, PROJECT_STATUS final, the deferred a11y items below.

Measured at planning (scratch probes on the 66fa021 preview, nothing committed):
- All 7 new fixtures below were run through codec, SaveManager + startSession, saveController export → parseImport and pickStorage
  (fake host): every expectation in the C1 table holds; v2-current-full round-trips deep-equal.
- a11y: title/HUD/menu/credits/finale choice/photo chip/cycle confirm all Tab-reachable with a visible ring; title, menu, credits,
  choice, confirm trap focus. Fails today: (1) `.sys-tab.is-active` text `#d2bf9c` on `#8c4a2a` = **3.73:1** (15 px) on every menu tab;
  (2) `#sys-reset.is-armed` `sys-reset-pulse` keeps running with in-game REDUCED MOTION on (only the OS media query stops it).
  WP21-owned (deferred, see D6): tech tree does not trap focus (Tab from `#tech-buy` reaches `#hud-tech/#hud-refocus/#hud-system`);
  milestone node ink text on `linear-gradient(135deg, amber, rust-dark)` (1.49:1 at the dark stop); purchased node
  `.tech-node-level/.tech-node-cost` `#a8957a` on `#4e2a1a` = 4.34:1.
- UI scale 150 at 1280×720: credits panel, finale column, memory tab panel, cycle confirm panel all inside the viewport (credits panel
  scrolls: `overflow: auto`).

## D Decisions
- D1 **Fixtures are hand-authored JSON in historical shapes, loaded as raw text** (`?raw` imports) so the exact stored string is what
  goes into storage and what the backup must equal. Existing fixtures (`v1-save.json`, `v2-wp11-primary.json`, `v2-cycle2.json`) are
  read-only. No change to codec/schema/load logic (tests + fixtures only).
- D2 **One matrix test, three load paths**: codec (`deserialize`), session (`MemoryStorage` → `SaveManager` → `startSession`), host
  (`pickStorage` with a fake `WedtmdHost` bridge → `startSession` → `flush`). Plus export/import through `createSaveController`.
- D3 **New smokes share one helper lib** `scripts/smoke/lib/common.mjs` (buy lists copied verbatim from `stages.mjs`). Old smokes are NOT
  refactored onto it. New smokes take the **base URL without query** (like `shell.mjs`) and add `debug=1` / `title=1` themselves.
  Each prints ONE JSON object, writes `<outdir>/<name>.json`, exit 1 when `fail` or `errors` is non-empty, exit 2 on usage error.
- D4 **Every new smoke cranks ≥ 45 real clicks before its first `buyList`** (wornMotor costs 40 ME; with 0 ME/s the 8 h jumps cannot
  pay it).
- D5 **One build per wave.** Only T4 changes shipped code in W1; the EM runs `npm run build` once at the end of W1. W2 workers never run
  `npm run build` (the preview on :4174 re-reads `dist` per request; a rebuild mid-run breaks other smokes). W3 rebuilds only if T10 ran.
- D6 **a11y findings inside WP21-owned UI are deferred, not failed.** `DEFERRED_SCOPES = ['#tech-overlay', '#toast-stack', '#era-card']`
  (files `src/ui/techTree*`, `src/ui/toasts*`, `src/ui/eraCard*`). Items there go to `deferred` in the a11y JSON; WP16b fixes them.
- D7 **a11y fixes = CSS/aria only, small hunks, total css delta ≤ +600 B raw**, palette colours only (`src/data/palette.ts`).
- D8 **Contrast rules** (WCAG 1.4.3): normal text ≥ 4.5:1; large text (font ≥ 24 px, or ≥ 18.66 px and weight ≥ 700) ≥ 3:1; inactive
  text (inside `:disabled`, `[aria-disabled="true"]`, `.is-locked`) exempt → reported in `inactive`; gradient backgrounds use the
  **minimum** over all colour stops; text with no opaque background before `body` (over the canvas) → `indeterminate` (report only).
- D9 **Store shots**: `1080` = viewport 1920×1080 at deviceScaleFactor 1 (what a 1080p player sees); `2160` = viewport 1920×1080 at
  deviceScaleFactor 2 (3 device px per game px, same as `showcase.mjs` 1280×720 @3). `hud` variant = live UI; `clean` variant = photo
  mode (`photoMode(true, { hint: false })`), except the finale where `#ui-root` is hidden by style (photo mode is not used mid-sequence).
- D10 **Soak flatness = constants in the script + caps from `scripts/smoke/perf-budget.json`** (heapMb 150, displayObjects 500,
  liveVoices 48). Validation run is `SOAK_MIN=5`; the 30–60 min run is WP16b.
- D11 **No package.json edits** in WP16a (WP21 adds `build:demo`; avoids a merge conflict). `package-lock.json` shows ` M` at planning
  time (line endings only, empty diff): never stage it.
- D12 **ASSET_GUIDE guard checks facts, not prose**: per manifest id exactly one table row, file cell, size cell, frames cell. Layer and
  description cells are informational. The test can regenerate the tables (env-gated write) so the guide stays cheap to refresh.

## C Contracts

### C1 Save compat matrix — `src/persistence/compat.test.ts` (new) + fixtures `src/persistence/fixtures/` (new files)
Fixture files, exact content (validated at planning; one line each, `corrupt-save.txt` without trailing newline is fine either way):

`v2-wp8-era2.json` (v2 pre-WP11: state only, WP4 settings, no ending/stats/achievements/prestige):
```json
{"version":2,"savedAt":1750000000000,"state":{"res":{"me":250000,"ee":1800.5,"pr":0,"rs":0,"xf":0},"lifetime":{"me":4200000,"ee":9000,"pr":0,"rs":0,"xf":0},"totalClicks":5200,"techLevels":{"handCrank":1,"gearRatio":15,"reinforcedCrank":1,"flywheel":10,"wornMotor":1,"motorTuning":25,"pistonArray":1,"improvedPistons":12,"generatorBlueprint":1,"generator":1,"copperWinding":8,"motorRetrofit":4,"dynamoCrank":1,"capacitorBank":1},"lastSimTime":1750000000000,"createdAt":1749990000000},"settings":{"muted":false}}
```
`v2-wp13-postgame.json` (WP13 shape: postgame, no prestige, no musicVolume/confirmNewCycle, no legacy ids):
```json
{"version":2,"savedAt":1760000000000,"state":{"res":{"me":5e11,"ee":2e10,"pr":4e9,"rs":3e8,"xf":2e6},"lifetime":{"me":8e14,"ee":4e13,"pr":1e13,"rs":5e11,"xf":2500000000},"totalClicks":60000,"techLevels":{"handCrank":1,"gearRatio":15,"reinforcedCrank":1,"flywheel":10,"wornMotor":1,"motorTuning":25,"pistonArray":1,"improvedPistons":25,"generatorBlueprint":1,"generator":1,"copperWinding":25,"motorRetrofit":20,"dynamoCrank":1,"capacitorBank":1,"sparkGap":1,"transformer":20,"powerLines":1,"substationBlueprint":1,"boiler":1,"firebox":25,"inductionHeater":20,"steamHammer":1,"superheater":1,"condenser":20,"turbine":1,"reliefValves":1,"pressureVesselBlueprint":1,"resonatorSpire":1,"harmonicCoil":25,"pressureResonator":20,"crankServo":10,"echoCrank":1,"phaseLock":1,"standingWave":20,"crystalLattice":1,"harmonicConvergence":1,"nullChamber":1,"containmentRing":25,"resonantSiphon":20,"graviticAnchor":10,"inversionCrank":1,"lensArray":1,"horizonField":20,"skyAperture":1,"finalAlignment":1,"primaryFunction":1},"lastSimTime":1760000000000,"createdAt":1759900000000,"ending":{"phase":"postgame","engagedAt":1759990000000}},"settings":{"muted":false,"masterVolume":80,"sfxVolume":90,"ambientVolume":60,"notation":"scientific","reducedMotion":true,"screenShake":true,"statusMarkers":true,"uiScale":125},"stats":{"activeSeconds":30000,"offlineSeconds":3600,"longestOfflineSeconds":3600,"clicks":60000,"purchases":400,"lifetime":{"me":8e14,"ee":4e13,"pr":1e13,"rs":5e11,"xf":2500000000},"maxPerSecond":{"me":1e9,"ee":2e8,"pr":5e7,"rs":2e6,"xf":1e5},"cycles":1,"bestCycleSeconds":null,"startedAt":1759900000000},"achievements":{"unlocked":{"firstTurn":1759900100000,"restoration":1759990000000}}}
```
`v2-pre-legacy.json` (WP15 shape, era V mid-game, WITHOUT bellowsDrive/gridExciter/mainsBackfeed/steamLance):
```json
{"version":2,"savedAt":1770000000000,"state":{"res":{"me":9e10,"ee":3e9,"pr":7e8,"rs":4e7,"xf":25000},"lifetime":{"me":2e14,"ee":9e12,"pr":2e12,"rs":6e10,"xf":90000},"totalClicks":40000,"techLevels":{"handCrank":1,"gearRatio":15,"reinforcedCrank":1,"flywheel":10,"wornMotor":1,"motorTuning":25,"pistonArray":1,"improvedPistons":25,"generatorBlueprint":1,"generator":1,"copperWinding":25,"motorRetrofit":20,"dynamoCrank":1,"capacitorBank":1,"sparkGap":1,"transformer":20,"powerLines":1,"substationBlueprint":1,"boiler":1,"firebox":25,"inductionHeater":20,"steamHammer":1,"superheater":1,"condenser":20,"turbine":1,"reliefValves":1,"pressureVesselBlueprint":1,"resonatorSpire":1,"harmonicCoil":25,"pressureResonator":20,"crankServo":10,"echoCrank":1,"phaseLock":1,"standingWave":20,"crystalLattice":1,"harmonicConvergence":1,"nullChamber":1,"containmentRing":10,"resonantSiphon":4,"graviticAnchor":2,"inversionCrank":1},"lastSimTime":1770000000000,"createdAt":1769900000000,"ending":{"phase":"none","engagedAt":null}},"settings":{"muted":false,"masterVolume":100,"sfxVolume":100,"ambientVolume":100,"musicVolume":55,"notation":"suffix","reducedMotion":false,"screenShake":true,"statusMarkers":false,"uiScale":100,"confirmNewCycle":true},"stats":{"activeSeconds":20000,"offlineSeconds":0,"longestOfflineSeconds":0,"clicks":40000,"purchases":300,"lifetime":{"me":2e14,"ee":9e12,"pr":2e12,"rs":6e10,"xf":90000},"maxPerSecond":{"me":5e8,"ee":1e8,"pr":2e7,"rs":1e6,"xf":10},"cycles":1,"bestCycleSeconds":null,"startedAt":1769900000000},"achievements":{"unlocked":{"firstTurn":1769900100000,"eraExotic":1769990000000}},"prestige":{"cycle":1,"echoesEarned":0,"perks":[]}}
```
`v2-current-full.json` (current full shape: all 50 TECH_IDS, legacy feeds, cycle 3 + perks, postgame; must round-trip deep-equal):
```json
{"version":2,"savedAt":1800000000000,"state":{"res":{"me":1500000000000,"ee":320000000000,"pr":88000000000,"rs":4400000000,"xf":750000000},"lifetime":{"me":990000000000000,"ee":50000000000000,"pr":20000000000000,"rs":900000000000,"xf":6000000000},"totalClicks":91234,"techLevels":{"handCrank":1,"gearRatio":15,"reinforcedCrank":1,"flywheel":10,"wornMotor":1,"motorTuning":25,"pistonArray":1,"improvedPistons":25,"generatorBlueprint":1,"generator":1,"copperWinding":25,"motorRetrofit":20,"dynamoCrank":1,"capacitorBank":1,"sparkGap":1,"transformer":20,"powerLines":1,"substationBlueprint":1,"boiler":1,"firebox":25,"inductionHeater":20,"steamHammer":1,"superheater":1,"condenser":20,"turbine":1,"reliefValves":1,"pressureVesselBlueprint":1,"resonatorSpire":1,"harmonicCoil":25,"pressureResonator":20,"crankServo":10,"echoCrank":1,"phaseLock":1,"standingWave":20,"crystalLattice":1,"harmonicConvergence":1,"nullChamber":1,"containmentRing":25,"resonantSiphon":20,"graviticAnchor":10,"inversionCrank":1,"lensArray":1,"horizonField":20,"skyAperture":1,"finalAlignment":1,"primaryFunction":1,"bellowsDrive":37,"gridExciter":12,"mainsBackfeed":5,"steamLance":6},"lastSimTime":1800000000000,"createdAt":1799900000000,"ending":{"phase":"postgame","engagedAt":1799990000000}},"settings":{"muted":false,"masterVolume":85,"sfxVolume":70,"ambientVolume":40,"musicVolume":40,"notation":"engineering","reducedMotion":false,"screenShake":false,"statusMarkers":true,"uiScale":150,"confirmNewCycle":false},"stats":{"activeSeconds":54000,"offlineSeconds":7200,"longestOfflineSeconds":3600,"clicks":91234,"purchases":612,"lifetime":{"me":990000000000000,"ee":50000000000000,"pr":20000000000000,"rs":900000000000,"xf":6000000000},"maxPerSecond":{"me":2000000000,"ee":400000000,"pr":90000000,"rs":5000000,"xf":300000},"cycles":3,"bestCycleSeconds":14000,"startedAt":1799000000000},"achievements":{"unlocked":{"firstTurn":1799000100000,"blueprint":1799001000000,"eraElectric":1799002000000,"newCycle":1799500000000,"restoration":1799990000000}},"prestige":{"cycle":3,"echoesEarned":6,"perks":["muscleMemory","residualCharge","longSilence"]}}
```
`v2-out-of-range.json` (clamping / lenient readers):
```json
{"version":2,"savedAt":1780000000000,"state":{"res":{"me":5000,"ee":12},"lifetime":{"me":4000,"ee":12},"totalClicks":77.9,"techLevels":{"handCrank":0,"gearRatio":40,"crankServo":99,"boiler":3,"generator":-2,"bellowsDrive":500,"steamLance":7.9,"quantumFoo":3},"lastSimTime":1780000000000,"createdAt":1779000000000,"ending":{"phase":"postgame","engagedAt":null}},"settings":{"musicVolume":"loud","uiScale":175,"notation":"roman","masterVolume":140,"sfxVolume":-20,"reducedMotion":"yes"},"prestige":{"cycle":0,"echoesEarned":-3,"perks":["ledger","nope"]}}
```
`v3-future.json`:
```json
{"version":3,"savedAt":1900000000000,"state":{"res":{"me":1},"quantum":{"x":1}},"settings":{}}
```
`corrupt-save.txt`: `{"version":2,"savedAt":1800000000000,"state":{"res":{"me":12`

Test file skeleton (exact names; strict TS, `noUncheckedIndexedAccess` safe):
```ts
import v1Raw from './fixtures/v1-save.json?raw';            // + wp8Raw, wp11Raw, wp13Raw, cycle2Raw, preLegacyRaw,
                                                             //   currentRaw, outOfRangeRaw, v3Raw, corruptRaw ('./fixtures/corrupt-save.txt?raw')
const NOW = 1_800_000_060_000;
interface CompatRow {
  file: string; raw: string; status: LoadStatus;
  error?: string;                                   // recovered rows: load.error must START with this
  phase: EndingPhase; prestige: PrestigeState;
  settings?: Partial<SettingsState>; levels?: Partial<Record<TechId, number>>;
  res?: Partial<ResourceMap>; lifetime?: Partial<ResourceMap>; totalClicks?: number;
  lossless?: true; newCycle?: true; legacyAvailable?: true;
}
const ROWS: readonly CompatRow[] = [/* table below, in this order */];
function memoryBridge(disk: Map<string, string>): HostStorageBridge;   // loadAll → Object.fromEntries(disk); set/remove/flush mutate disk; flush returns true
function fakeHost(bridge: HostStorageBridge): WedtmdHost;               // same literal as fakeHost() in hostStorage.test.ts
const NO_TIMERS: TimeoutPort = { setTimeout: () => 0, clearTimeout: () => {} };
const NO_SCHEDULER: Scheduler = { setInterval: () => 0, clearInterval: () => {} };
function bootFrom(storage: KeyValueStorage): StartupResult;             // startSession(new SaveManager(storage), NOW, () => NOW)
function expectStateInvariants(r: LoadResult): void;                   // see invariants
```
Row table (validated values):

| file | status | phase | prestige | settings | levels / other |
|---|---|---|---|---|---|
| `v1-save.json` | migrated | none | {1,0,[]} | muted true, musicVolume 70, confirmNewCycle true, uiScale 100 | gearRatio 6, motorTuning 9, bellowsDrive 0; res.me 12345.5, lifetime.me 98765.25, totalClicks 321 |
| `v2-wp8-era2.json` | loaded | none | {1,0,[]} | musicVolume 70, confirmNewCycle true, notation 'suffix' | generator 1, copperWinding 8, sparkGap 0, boiler 0, bellowsDrive 0; res.ee 1800.5; stats.cycles 1; achievements.unlocked {} |
| `v2-wp11-primary.json` | loaded | choice | {1,0,[]} | musicVolume 70 | primaryFunction 1, 4 legacy 0; `newCycle` |
| `v2-wp13-postgame.json` | loaded | postgame | {1,0,[]} | masterVolume 80, notation 'scientific', reducedMotion true, uiScale 125, musicVolume 70, confirmNewCycle true | crankServo 10, primaryFunction 1, 4 legacy 0; `newCycle` |
| `v2-cycle2.json` | loaded | none | {2,3,['residualCharge']} | confirmNewCycle false | gearRatio 3, wornMotor 1; stats.cycles 2 |
| `v2-pre-legacy.json` | loaded | none | {1,0,[]} | musicVolume 55 | nullChamber 1, containmentRing 10, 4 legacy 0; `legacyAvailable` |
| `v2-current-full.json` | loaded | postgame | {3,6,['muscleMemory','residualCharge','longSilence']} | musicVolume 40, uiScale 150, notation 'engineering', screenShake false, confirmNewCycle false | bellowsDrive 37, gridExciter 12, mainsBackfeed 5, steamLance 6; `lossless`, `newCycle` |
| `v2-out-of-range.json` | loaded | none | {1,0,[]} | musicVolume 70, uiScale 100, notation 'suffix', masterVolume 100, sfxVolume 0, reducedMotion false | handCrank 1, gearRatio 15, crankServo 10, boiler 1, generator 0, bellowsDrive 500, steamLance 7; no key `quantumFoo`; totalClicks 77; lifetime.me 5000; res.pr 0 |
| `v3-future.json` | recovered | none | {1,0,[]} | = DEFAULT_SETTINGS_VALUES | error `Save is from a newer version` |
| `corrupt-save.txt` | recovered | none | {1,0,[]} | = DEFAULT_SETTINGS_VALUES | error starts `Save data is not valid JSON` |

`describe.each(ROWS)('$file', row => …)` with these `it`s:
1. `codec: status and fields` — `deserialize(row.raw, NOW)`: status, error prefix, `state.ending.phase`, prestige (toEqual), settings subset, levels subset, res/lifetime subset, totalClicks.
2. `codec: invariants` — `expectStateInvariants`: techLevels keys == TECH_IDS (sorted compare); every level integer ≥ 0; capped repeatable
   (`kind === 'repeatable' && maxLevel !== null`) ≤ maxLevel; non-repeatable ≤ 1; handCrank 1; every res/lifetime finite, ≥ 0,
   < `DESIGN_MAX_VALUE`, lifetime ≥ res; `settings` toEqual `normalizeSettings(settings)`; `prestige` toEqual `normalizePrestige(prestige)`;
   phase ∈ `ENDING_PHASES`; phase ≠ none ⇒ primaryFunction 1; stats.cycles ≥ 1.
3. `codec: re-save is idempotent` — `s1 = serialize(r.state, r.settings, NOW, {stats, achievements, prestige})`, `s2` = same from
   `deserialize(s1, NOW)`; `s1 === s2`. `lossless` rows: `JSON.parse(serialize(…, JSON.parse(raw).savedAt, meta))` toEqual `JSON.parse(raw)`.
4. `session: boots through SaveManager + startSession` — storage = `new MemoryStorage()` with `SAVE_KEY = raw`; `bootFrom` does not throw;
   `load.status` = row.status; every `session.rates.perSecond[r]` / `perClick[r]` finite, ≥ 0, < DESIGN_MAX_VALUE; every `session.state.res[r]`
   finite < DESIGN_MAX_VALUE; `getAllTechViews().length === TECH_IDS.length`, each `nextCost` null or finite. Recovered rows:
   `storage.getItem(SAVE_BACKUP_KEY) === row.raw`, `deserialize(storage.getItem(SAVE_KEY), NOW).status === 'loaded'`, totalClicks 0.
5. `session: export string imports to the same state` — `createSaveController({ session, saveManager, now: () => NOW, scheduler: NO_SCHEDULER })
   .exportString()` → `parseImport(text, NOW)` ok; `envelope.state` toEqual `JSON.parse(JSON.stringify(session.state))`; settings and
   prestige equal the session's.
6. `host: boots through pickStorage, flush persists` — disk `Map([[SAVE_KEY, raw]])`; `pickStorage({ host: fakeHost(memoryBridge(disk)),
   legacy: () => new MemoryStorage(), timers: NO_TIMERS })` kind `'host'`; `bootFrom(picked.storage).load.status` = row.status;
   `picked.flush() === true`; `deserialize(disk.get(SAVE_KEY) ?? null, NOW).status === 'loaded'` and its techLevels equal the session's;
   recovered rows: `disk.get(SAVE_BACKUP_KEY) === row.raw`.
7. `it.runIf(row.newCycle)('session: new cycle')` — read `xf = session.state.lifetime.xf` and `p = session.prestige` after boot;
   `beginNewCycle(NOW) === true`; cycle = p.cycle + 1; echoesEarned = p.echoesEarned + `echoesForCycle(xf)`; ending phase none.
8. `it.runIf(row.legacyAvailable)('legacy feeds are buyable after load')` — for bellowsDrive, gridExciter, mainsBackfeed, steamLance:
   `getTechView(id)` level 0, status `'available'`, nextCost === `TECHNOLOGIES[id].baseCost` (250000 / 2e6 / 2e7 / 5e6).

### C2 Smoke helper lib — `scripts/smoke/lib/common.mjs` (new, ESM, Node built-ins only)
```js
export const S7, S9, S11, S13, S15;            // byte-identical copies of scripts/smoke/stages.mjs lines 6-14 (S11 inlines S10, S13 inlines S12, S15 inlines S14 — same items, same order)
export const STAGES = [['s7', S7], ['s9', S9], ['s11', S11], ['s13', S13], ['s15', S15]];
export const ERA_TITLES = { s7: 'ERA I · MECHANICAL', s9: 'ERA II · ELECTRICAL', s11: 'ERA III · PRESSURE', s13: 'ERA IV · RESONANCE', s15: 'ERA V · ???' };
export const HUD_ROWS = { s7: 1, s9: 2, s11: 3, s13: 4, s15: 5 };
export const LEGACY_FEEDS = ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'];
export const ASSET_WARNING_RE = /\[assets\] (failed to load|size mismatch)|has no frame/;
export const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
export const PREVIEW_HINT = 'http://localhost:4174/';
export function delta(prev, next)            // next.slice(prev.length); throws Error('delta: prev is not a prefix of next') otherwise
export function withQuery(base, params)      // new URL(base); searchParams.set(k, v) per entry; returns url.toString()
export function loadChromium()               // PW_PATH missing → console.error('PW_PATH is required') + process.exit(2); else createRequire(import.meta.url)(PW_PATH).chromium
export function readBudget()                 // JSON.parse of scripts/smoke/perf-budget.json (fs + new URL('../perf-budget.json', import.meta.url))
export function makeReport()                 // { results: {}, fail: [], errors: [], check(name, cond, detail) } — results[name] = detail === undefined ? !!cond : { ok: !!cond, value: detail }; !cond → fail.push(name)
export function watchPage(page, errors, tag) // tag(): string. console 'error' → `${tag()}: console: <text>`; console 'warning' matching ASSET_WARNING_RE → `${tag()}: asset: <text>`; pageerror → `${tag()}: pageerror: <msg>`; requestfailed → `${tag()}: requestfailed: <url> <errorText>`; response status >= 400 → `${tag()}: http <status>: <url>`
export async function waitReady(page, timeoutMs = 20000)   // waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank')), then 400 ms
export async function crankClicks(page, n, gapMs = 40)     // re-reads __wedtmd.crankClientPoint() per click, page.mouse.click
export function buyInPage(buys)              // self-contained in-page fn: EXACT semantics of the stages.mjs loop ('@<tech>:<n>', '@<tech>', '@blueprint', 8 h jumps, 6 retries); returns ['<id>:<bool>', ...]
export async function buyList(page, buys)    // (await page.evaluate(buyInPage, buys)).filter(x => !x.endsWith(':true'))  → [] = all ok
export async function dismissEraCard(page)   // stages.mjs snippet: click #era-card when shown
export async function hudState(page)         // stages.mjs 'hud' object { title, visibleRows, frontier, click, clickSub, auto, right, bottom }
export async function poll(page, fn, arg, capMs = 5000, stepMs = 100) // re-evaluates fn(arg) until truthy; returns last value
export async function waitPhotoChipHidden(page, capMs = 3000)          // blur #photo-exit; poll computed opacity <= 0.001; returns final opacity
export function pngSize(file)                // reads the PNG IHDR (bytes 16..23, big-endian) → { width, height }; throws on bad signature
```
Self-test: `node scripts/smoke/lib/common.mjs --selftest` (only when the file is the entry script and argv has `--selftest`; no PW_PATH
needed) prints `{"ok":true,"checks":{…}}` / exit 0, else `ok:false` exit 1. Checks: S7⊂S9⊂S11⊂S13⊂S15 prefix chain; `delta(S7,S9).length
=== S9.length - S7.length`; `delta(S9,S7)` throws; `withQuery('http://x/?a=1', { debug: '1' }) === 'http://x/?a=1&debug=1'`;
`pngSize(<repo>/public/assets/machine/gear-small.png)` = 40×40; `readBudget().heapMb === 150`.

### C3 Browser e2e — `scripts/smoke/e2e-full.mjs` (new)
`PW_PATH=… node scripts/smoke/e2e-full.mjs <base-without-query> <outdir>`. One fresh 1280×720 context, `U = withQuery(base, { debug: '1', title: '1' })`.
Steps (check names in `results` / `fail`; screenshot after the step `e2e-<NN>-<name>.png`):

| step | actions | checks |
|---|---|---|
| 01 title | goto U (networkidle), waitReady | `01_title_open` (`#title-screen.is-open`), `01_continue_hidden`, `01_new_focused` (activeElement id `title-new`) |
| 02 new game | keyboard Enter; 20 mouse crank clicks; 10 × Space 100 ms apart | `02_title_closed` (≤ 2 s), `02_clicks` (totalClicks === 30) |
| 03 tree | `t`; Tab ≤ 30 until `activeElement.dataset.tech === 'gearRatio'`; if not `.is-selected` Enter; Enter; Escape | `03_tree_open`, `03_reached_gearRatio`, `03_bought_gearRatio` (level 1), `03_tree_closed` |
| 04 save | Escape (menu); focus `#sys-save` + Enter; 300 ms; Escape | `04_saved` (`localStorage['wedtmd.save']` parses, techLevels.gearRatio 1) |
| 05 continue | reload U; waitReady; Enter | `05_continue_focused`, `05_progress_kept` (gearRatio 1 and totalClicks 30) |
| 06 eras | 30 mouse crank clicks (D4); for each `[key, list]` of STAGES: `buyList(page, delta(prev, list))`; wait 2.5 s (s13/s15: 12 s); dismissEraCard | per key: `06_<key>_buys` (detail failed list, ok when `[]`), `06_<key>_title` (= ERA_TITLES), `06_<key>_rows` (= HUD_ROWS), `06_<key>_displayObjects` (≤ readBudget().displayObjects); `metrics[key] = { displayObjects, machine: machineStats(), heapMb }` report only |
| 07 finale | `buyList(['primaryFunction'])`; poll `finaleState().phase === 'sequence'`; 3 s; shot; Escape; poll phase `choice` ≤ 5 s | `07_buy`, `07_sequence`, `07_choice`, `07_keep_visible` |
| 08 keep | focus `#finale-keep` + Enter; poll `session.state.ending.phase === 'postgame'` ≤ 5 s; 2.5 s | `08_postgame`, `08_title` (`#hud-title` = `RESTORATION ENGINE`) |
| 09 view machine | focus `#hud-view-machine` + Enter; 1.5 s; shot; Escape; 800 ms | `09_photo_on` (`photoState().active`), `09_hud_hidden` (`#hud-panel` visibility hidden), `09_photo_off`, `09_hud_back` |
| 10 new cycle | Escape (menu); focus `#sys-new-cycle` + Enter; shot; focus `#cycle-confirm-begin` + Enter; poll ≤ 20 s `prestige().cycle === 2 && !cycleState().transition.active`; 5 mouse crank clicks | `10_menu_open`, `10_row_enabled` (visible, `aria-disabled` ≠ true), `10_confirm_open` (`#cycle-confirm` not hidden), `10_cycle2`, `10_cycle_label` (`#hud-cycle` contains `CYCLE 0043`), `10_fresh_run` (generator 0, phase none), `10_crank_works` (+5 clicks) |
| 11 reload | Escape, focus `#sys-save` + Enter, Escape; reload U; waitReady; Enter on `#title-continue` | `11_cycle_kept` (cycle 2), `11_label_kept` |
| 12 footer | Escape; read `#sys-footer`; Escape | `12_footer` (text starts `v0.9.0`, null → fail) |
| end | — | `wall_time` (≤ 300000 ms, detail ms) |

Output `{ results, metrics, wallMs, fail, errors }` → stdout + `<outdir>/e2e-full.json`. `watchPage` on the page (tag = current step).

### C4 a11y smoke — `scripts/smoke/a11y.mjs` (new)
`PW_PATH=… node scripts/smoke/a11y.mjs <base-without-query> <outdir>`. Output `{ results, fail, deferred, inactive, indeterminate, errors }`
→ stdout + `<outdir>/a11y.json`; screenshots `a11y-<case>.png`. `deferred` never fails (D6).
In-page helpers (pure functions passed to `page.evaluate`):
- `RING(el)`: `(cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || cs.boxShadow !== 'none'`.
- `NAME(el)`: first non-empty of `aria-label`, text of `aria-labelledby` targets, text of `el.labels`, `textContent.trim()`, `title`.
- `AUDIT(scopeSel)`: visible = rect w/h > 0, visibility ≠ hidden, display ≠ none, opacity > 0. Controls = `button, [role=button], input,
  select, textarea, [role=tab], [role=radio], a[href]` → `unnamed`. Own-text elements (a direct non-empty text node) → `small` (font-size
  < 12 px) and contrast per D8 (fg = `color` alpha × product of ancestor opacities; bg = composite of `background-color` up the chain to the
  first opaque one; gradient = min over every `rgb()/rgba()` stop composited over the bg below; WCAG relative luminance). Each item
  `{ sel, text (≤ 24 chars), ratio, need, fontPx }`; items with `el.closest(DEFERRED_SCOPES.join(','))` go to `deferred`.
- `tabWalk(page, n)`: n × Tab, record `{ id, cls, tech, ring, inScope }` per step.

Cases (fresh 1280×720 context each, `?debug=1` unless noted):

| case | flow | checks |
|---|---|---|
| A_title (`debug=1&title=1`) | Tab ×8; focus `#title-credits` + Enter; Tab ×4; Escape | `A_reach` (⊇ title-new, title-settings, title-credits), `A_trap` (all in `#title-screen`), `A_rings`, `A_names`, `A_contrast`, `A_font12`, `A_credits_trap` (in `#credits-overlay`), `A_credits_rings`, `A_credits_names`, `A_credits_contrast`, `A_credits_esc` (credits closed, title open) |
| B_hud | 10 × Space 100 ms apart; 10 mouse clicks; Tab ×6; AUDIT `#ui-root` | `B_space_crank` (+10), `B_reach` (hud-tech, hud-refocus, hud-system), `B_rings`, `B_names`, `B_contrast`, `B_font12` |
| C_tree (same ctx) | `t`; Tab ×30; AUDIT `#tech-overlay`; Escape | `C_focus_selected` (initial focus `.tech-node.is-selected`), `C_reach` (`#tech-close`, `#tech-buy`, ≥ 3 `.tech-node`, ≥ 1 `.tech-tab`), `C_rings`; focus leaving `#tech-overlay` → `deferred` `C_trap` (known) |
| D_menu (same ctx) | Escape; Tab ×12; then for every visible `#sys-tabs [role=tab]`: focus + Enter, 250 ms, Tab ×25, AUDIT `#system-menu` | `D_system_reach` (sys-tab-system, sys-mute, sys-save, sys-reset, sys-credits, sys-close), `D_trap`, `D_rings`; per tab `D_<tab>_reach` (every visible enabled control of the active tabpanel focused once; radios: ≥ 1 per `[role=radiogroup]`; detail = missing ids), `D_<tab>_rings`, `D_<tab>_names`, `D_<tab>_contrast`, `D_<tab>_font12` |
| E_reduced | 20 mouse clicks (hint pulse runs); `session.updateSettings({ reducedMotion: true })`; 300 ms; Escape; click `#sys-reset` (armed); 300 ms | `E_root_attr` (`#ui-root` `data-reduced-motion` = `on`), `E_no_animations` (`document.getAnimations()` filtered to `CSSAnimation` with playState `running` = `[]`; detail = `{ name, target }` list); then `#sys-reset-cancel`, Escape |
| F_finale | 45 clicks; `buyList([...S15, 'primaryFunction'])`; 1 s; `skipFinale()`; 1.5 s; Tab ×4; AUDIT `#finale-overlay`; uiScale 150 → rect; back to 100; focus `#finale-keep` + Enter; poll postgame; Tab ×6; VIEW MACHINE (focus + Enter), Tab ×3, Escape; Escape (menu) → `#sys-tab-memory`, AUDIT, uiScale 150 rect, 100; SYSTEM tab; `#sys-new-cycle` Enter; Tab ×4; AUDIT `#cycle-confirm`; uiScale 150 rect, 100; `#cycle-confirm-cancel` Enter | `F_buys`, `F_choice_reach` (finale-keep, finale-cycle), `F_choice_trap`, `F_choice_rings`, `F_choice_names/contrast/font12`, `F_choice_150_inside` (`.finale-column` rect inside viewport, 1 px), `F_post_reach` (hud-view-machine), `F_photo_reach` (`#photo-exit`), `F_photo_ring`, `F_photo_name`, `F_memory_names/contrast/font12`, `F_memory_150_inside` (`#system-panel`), `F_confirm_reach` (cycle-confirm-begin, cycle-confirm-cancel), `F_confirm_trap`, `F_confirm_rings`, `F_confirm_names/contrast/font12`, `F_confirm_150_inside` (`.cycle-confirm-panel`), `F_confirm_cancel` |
| G_scale150 | `updateSettings({ uiScale: 150 })`; `saveNow()`; reload `debug=1&title=1`; check; `#title-credits` Enter, check, Escape; `#title-continue` Enter; checks; `t` check, Escape; Escape; each visible tab check | `G_title_inside` (`#title-panel`), `G_credits_inside` (`#credits-panel` inside AND (scrollHeight ≤ clientHeight + 1 OR overflow-y auto/scroll)), `G_hud_inside` (`#hud-panel`, `#hud-buttons`), `G_tree_inside` (`#tech-panel`), `G_menu_<tab>_inside` (`#system-panel`) |

Expected on the 66fa021 build: fail `D_<tab>_contrast` (all tabs, `.sys-tab.is-active` 3.73) and `E_no_animations` (`sys-reset-pulse`);
deferred `C_trap` + tree contrast items. After T4: `fail: []`.

### C5 Soak smoke — `scripts/smoke/soak.mjs` (new)
`PW_PATH=… [SOAK_MIN=30] [SOAK_SAMPLE_S=30] [SOAK_GPU=1] node scripts/smoke/soak.mjs <base-without-query> <outdir>`.
Launch args `--js-flags=--expose-gc`, `--enable-precise-memory-info`, `--autoplay-policy=no-user-gesture-required` (+ GPU_ARGS when
SOAK_GPU=1). 1280×720, `withQuery(base, { debug: '1' })`. Setup: waitReady; 45 mouse clicks; `buyList(S15)` must be `[]` (`setup_buys`);
15 s; dismissEraCard. Loop (wall clock from loop start, until SOAK_MIN minutes):
- every 2 s: one mouse crank click;
- every 30 s (+15 s offset): buy `LEGACY_FEEDS[i % 4]` in page: `r = purchase(id)`; if `!r.ok` → `session.update(Date.now() + 8 * 3600e3)`
  then retry once; count `{ ok, tried }` (report only);
- every 60 s (+20 s offset): `t`, 1.5 s, Escape;
- every 90 s (+40 s offset): Escape (menu), 1 s, click `#sys-tab-stats`, 1 s, Escape;
- every SOAK_SAMPLE_S: first press Escape until `modalCount() === 0` (max 3), then sample `{ tSec, heapMb: gc() then
  performance.memory.usedJSHeapSize / 1e6, displayObjects, toasts: #toast-stack .toast count, domNodes: getElementsByTagName('*').length,
  liveVoices: audioStats()?.liveVoices ?? null, machineMeanMs: machineStats().meanMs }`.
Baseline = first sample with tSec ≥ 60. `SOAK_LIMITS` (constants; caps from `readBudget()`):

| key | rule |
|---|---|
| `heap_cap` | max heapMb ≤ budget.heapMb (150) |
| `heap_growth` | last.heapMb − baseline.heapMb ≤ 16 |
| `heap_slope` | least-squares slope of heapMb over samples tSec ≥ 60, per minute, ≤ 1.0 |
| `display_cap` | max displayObjects ≤ budget.displayObjects (500) |
| `display_growth` | last.displayObjects ≤ baseline.displayObjects × 1.10 |
| `toasts_cap` | max toasts ≤ 4 (TOAST_CONFIG.maxVisible 2 + 2 fading) |
| `dom_growth` | last.domNodes − baseline.domNodes ≤ 200 |
| `voices_cap` | max liveVoices ≤ budget.liveVoices (48); skipped (report `null`) when every sample is null |
| `voices_growth` | last.liveVoices − baseline.liveVoices ≤ 8; skipped when null |
Output `{ minutes, samples, baseline, last, limits, purchases, fail, errors }` → stdout + `<outdir>/soak.json`; shot `soak-end.png`.
SOAK_MIN < 2 → usage error (exit 2).

### C6 Store screenshots — `scripts/smoke/store-shots.mjs` (new)
`PW_PATH=… [SIZES=1080,2160] [VARIANTS=hud,clean] node scripts/smoke/store-shots.mjs <base-without-query> <outdir>`. One fresh context per
size (D9), `withQuery(base, { debug: '1' })`. PNG path `<outdir>/<size>/<stem>-<variant>.png`. Run order:

| order | stem | setup before the shot(s) | variants |
|---|---|---|---|
| 1 | `01-era1-start` | waitReady; 12 mouse clicks 120 ms apart; 1.5 s | hud, clean |
| 2 | `02-era1-full` | 33 mouse clicks (D4); `buyList(S7)`; 2.5 s | hud, clean |
| 3 | `03-era2-generator` | `delta(S7, S9)`; 2.5 s | hud, clean |
| 4 | `04-era3-boiler` | `delta(S9, S11)`; 2.5 s | hud, clean |
| 5 | `05-tree-era3` | `t`; click `#tech-tab-3`; 600 ms; shot; Escape | hud only |
| 6 | `06-era4-spire` | `delta(S11, S13)`; 12 s | hud, clean |
| 7 | `07-era5-ruined` | `delta(S13, S15)`; 15 s | hud, clean |
| 8 | `10-title` | `saveNow()`; reload `withQuery(base, { debug: '1', title: '1' })`; waitReady; 1.5 s; shot; then focus `#title-continue` + Enter | hud only |
| 9 | `08-finale-reveal` | `buyList(['primaryFunction'])`; 2 s; `finaleSeek(56)`; 400 ms. hud = with finale overlay; clean = `#ui-root` style visibility hidden, shot, restore | hud, clean |
| 10 | `09-postgame-portrait` | `skipFinale()`; click `#finale-keep`; poll phase postgame ≤ 5 s; 2.5 s | hud, clean |
Every shot: dismissEraCard; `mouse.move(5, 5)`. `hud` variants of stems 01, 02, 03, 04, 06, 07, 09: 3 mouse crank clicks, 150 ms, then the
shot (gain text visible). `clean` (except 08): `photoMode(true, { hint: false })`, 1.2 s, `waitPhotoChipHidden`, shot, `photoMode(false)`, 600 ms.
Checks: `<size>_<stem>_<variant>_png` (pngSize = 1920×1080 or 3840×2160), `<size>_<stem>_buys` (`[]`), `<size>_<stem>_clean_hud_hidden`
(`photoState().active` and `#hud-panel` visibility hidden at shot time), `<size>_08_sequence` (finaleState().phase `sequence`),
`<size>_09_postgame`, `<size>_10_title_open`. Output `{ shots: [{ file, size, stem, variant, width, height }], results, fail, errors }` →
stdout + `<outdir>/store-shots.json`. Both sizes: 36 PNGs (18 per size).

### C7 ASSET_GUIDE guard — `src/assets/assetGuide.test.ts` (new) + `docs/ASSET_GUIDE.md`
Row format (one row per manifest id, columns unchanged):
`| \`<id>\` | <file> | <w> x <h> | <ox>, <oy> | <tileable> | <frames> | <layer + depth> | <description> |`
- file: `none (procedural)` when `file === null`, else `` `<file>` `` plus ` (restored \`<restored.file>\`[, \`<rotationFile>\`])` when `restored`.
- frames: parts joined by `; `: `frame` → `<count> (<fw> x <fh>)`; `rotation` → `rot <frames> (\`<rotation.file>\`)`; neither → `none`.
- layer + depth: machine ids → unique `machine layer \`<layer>\`, depth <MACHINE_LAYER_DEPTH[layer] + (depthBias ?? 0)>` over
  `Object.values(MACHINE_COMPONENTS)` with that assetId, joined `; `; PARALLAX_LAYERS ids → `parallax \`<id>\`, scroll <scrollFactor>,
  world depth <depth>`; `terrain.ground` → `ground, world depth <GROUND_LAYER.depth>`; else `PLACEMENT_NOTES[id]`:
  `fx.dust` 'dust field (DUST), world depth 200'; `fx.steam` 'reserved: no renderer (live steam uses fx.steamPuff / fx.smoke)';
  `fx.steamPuff` 'steam emitters (STEAM_EMITTERS), world depth 101'; `fx.smoke` 'chimney smoke (STEAM_EMITTERS), world depth 101';
  `fx.beam` 'aperture beam (APERTURE_BEAM), world depth 101'; `fx.beamWhite` 'finale white beam (FINALE_BEAM)'; `fx.seed` 'finale seeds
  (FINALE_SEEDS), world depth 200'; `fx.bird` 'finale birds (FINALE_BIRDS)'; `bg.eclipse` 'eclipse in the sky (ECLIPSE), world depth -98';
  `bg.regrowth1/2/3` 'finale regrowth (FINALE wipe), world depth 2'; `terrain.groundGreen` 'restored ground (RESTORED_GROUND), world depth
  0.5'; `ui.nameplate/ui.panel/ui.button/ui.icons16` 'DOM UI (CSS background image)'.
- description: manifest `description`, `|` escaped as `\|`.
- Groups (`### <group>` + header + rows in ASSET_IDS order): `World` (bg.*, terrain.*), `Machine — Era I` … `Machine — Era V` (era = min
  `TECHNOLOGIES[c.techId].era` over components using the id), `FX` (fx.*), `UI` (ui.*). Generated block sits between
  `<!-- asset-table:start -->` and `<!-- asset-table:end -->` in `## Asset table`.
Test (node env; `readFileSync(new URL('../../docs/ASSET_GUIDE.md', import.meta.url), 'utf8')` in try/catch → `null`;
`describe.skipIf(guide === null)`). Local functions: `parseGuideRows(md): GuideRow[]` (lines starting ``| ` ``, split on unescaped `|`,
8 cells), `fileCell`, `sizeCell`, `originCell`, `framesCell`, `layerCell`, `guideRow`, `guideGroup`, `guideTables(): string`. Five `it`s, each
collecting a mismatch list and asserting `toEqual([])`: (1) every ASSET_IDS id has exactly one row; (2) file cell matches (`none` prefix for
null, else contains `` `<file>` ``); (3) size cell === `<w> x <h>`; (4) frames cell contains frame count when `frame`, contains rotation file
when `rotation`, equals `none` otherwise; (5) every row id is a manifest id. Sixth `it`: when
`(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['ASSET_GUIDE_OUT']` is set, `writeFileSync(out,
guideTables())`; otherwise no-op (never writes into the repo).
Guide prose refresh (same task): categories `bg`, `terrain`, `fx`, `machine`, `ui`; Spritesheets section: drop "No entry uses frames yet"
and "Sprites are created without a frame index today", state that frame counts are load-bearing (`ComponentAnimation` kind `frames`); new
`### RotSprite sheets` subsection (`rotation: { file, frames }`, key `<id>#rot`, `scripts/art/make_rot.py`, gear sheets 80/140 keep the 1.75
ratio); Fallbacks: painter list replaced by "`PAINTERS` in `src/assets/fallbackTextures.ts` (+ `ERA2_PAINTERS`, `LEGACY_PAINTERS`); every
other id uses `paintGenericPlate`"; regenerate command line under the table:
`ASSET_GUIDE_OUT=<abs path> npx vitest run src/assets/assetGuide.test.ts`.

### C8 Known a11y CSS fixes — `src/ui/systemMenu.css`
- FX1: in the `#system-menu { … }` var block add `--steam:#e8e0cc;` (PALETTE.steam) after `--haze`; `.sys-tab.is-active` `color:
  var(--steam)` (background/border unchanged `var(--rust)`) → 5.1:1 (was 3.73).
- FX2: after the existing `@media (prefers-reduced-motion: reduce)` block add
  `#ui-root[data-reduced-motion="on"] #sys-reset.is-armed { animation: none; }`.

## Work Package 16a tasks
Repo root for every path: `C:/Users/sanan/wedtmd-shell`. Forbidden for all tasks: `src/simulation/**`, `src/game/**`, `src/data/**`,
`src/persistence/*.ts` non-test, `src/ui/toasts*`, `src/ui/eraCard*`, `src/ui/techTree*`, `package.json`, `package-lock.json`, `README.md`,
`CHANGELOG.md`, `docs/GAME_SPEC.md`, existing fixtures, existing smokes.

- **T1 Save compat matrix** — files: 7 new fixtures (C1) + `src/persistence/compat.test.ts` — depends: none (W1).
  Acceptance: fixtures byte-match C1; `npx vitest run src/persistence/compat.test.ts` green, 10 rows × ≥ 6 its (≥ 60 tests); existing
  persistence/hostStorage tests untouched and green; typecheck clean.
- **T2 Smoke helper lib** — files: `scripts/smoke/lib/common.mjs` — depends: none (W1).
  Acceptance: exports exactly as C2; lists byte-identical to `stages.mjs` items/order; `node scripts/smoke/lib/common.mjs --selftest` →
  `{"ok":true,…}` exit 0 without PW_PATH; importing the module has no side effects.
- **T3 ASSET_GUIDE guard + refresh** — files: `src/assets/assetGuide.test.ts`, `docs/ASSET_GUIDE.md` — depends: none (W1).
  Acceptance: C7 test green over all 117 ids; guide tables regenerated with `ASSET_GUIDE_OUT` and pasted between the markers; stale
  `bg.sky` (file: null) row gone; prose fixes of C7 done; removing any row from the md makes the test fail (worker shows it once, then reverts).
- **T4 Known a11y CSS fixes** — files: `src/ui/systemMenu.css` — depends: none (W1).
  Acceptance: exactly FX1 + FX2 (C8); css delta ≤ +200 B; `npm run build` ok; `node scripts/perf/bundle-budget.mjs` PASS. EM builds once
  after W1 (D5).
- **T5 Browser e2e smoke** — files: `scripts/smoke/e2e-full.mjs` — depends: T2, W1 build (W2).
  Acceptance: C3 flow and check names; run vs :4174 → `fail: []`, `errors: []`, ≥ 12 screenshots, `wallMs` ≤ 300000; no build run.
- **T6 a11y smoke** — files: `scripts/smoke/a11y.mjs` — depends: T2, T4 + W1 build (W2).
  Acceptance: C4 cases/check names/D8 rules; run → `fail: []`, `errors: []`; `deferred` lists exactly the WP21-owned items (tree trap + tree
  contrast; toasts/era card only if they fail); any other failing item is reported to the EM for T10 (no fix by this task).
- **T7 Soak smoke** — files: `scripts/smoke/soak.mjs` — depends: T2 (W2).
  Acceptance: C5; `SOAK_MIN=5` run → `fail: []`, `errors: []`, ≥ 9 samples, baseline at tSec ≥ 60; `SOAK_MIN=1` → exit 2.
- **T8 Store screenshot script** — files: `scripts/smoke/store-shots.mjs` — depends: T2, W1 build (W2).
  Acceptance: C6; `SIZES=1080` and `SIZES=2160` runs → 18 PNGs each at exact sizes, `fail: []`, `errors: []`; worker opens 3 PNGs (01 hud,
  07 clean, 09 clean) with the Read tool and confirms: no HUD/chip/era card in clean shots, machine centred, no blank frame.
- **T9 Smoke README** — files: `scripts/smoke/README.md` (append `## Release verification smokes (WP16a)`) — depends: T5–T8 (W3).
  Acceptance: one subsection per lib/e2e-full/a11y/soak/store-shots with the usage line (`<you>` placeholders, base URL without query,
  absolute outdir), env vars, check-name tables copied from the scripts (every check name in the JSON appears in the README), outputs,
  deferred semantics (D6), store-shot table (C6), soak limits table (C5).
- **T10 a11y follow-up fixes (conditional)** — files: only `src/ui/*.css`, `src/ui/menu/*.css` (not toasts/eraCard/techTree), aria-only
  hunks in `src/ui/*.ts` / `src/ui/menu/*.ts` (not toasts/eraCard/techTree) — depends: T6 report (W3). Runs only if T6 reports a non-deferred
  fail beyond C8. Acceptance: CSS/aria only, total css delta (T4 + T10) ≤ +600 B, palette colours only; rebuild; a11y, ux, resolutions, shell
  rerun green.

### Waves (EM, ≤ 4 parallel, exclusive files)
W1 = T1, T2, T3, T4 → EM: `npm run build` once (D5) · W2 = T5, T6, T7, T8 (smokes only, no builds) · W3 = T9 (+ T10 if needed, then one
rebuild) · W4 = EM Mode B validation (below), EM looks at the store PNGs, Director commits (never `package-lock.json`).
Deferred to WP16b (WP21-owned files): tree focus trap (`techTree.ts`), milestone node text contrast and purchased node level/cost contrast
(`techTree.css`), plus any toast/era-card items T6 lists under `deferred`.

## Package acceptance / validation commands
Each line is one Bash call (Git Bash). `O` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP16a` (shell state does not persist: inline it). Preview already serves `dist` on :4174; never start another server.
1. `cd "C:/Users/sanan/wedtmd-shell" && npm run typecheck`
2. `cd "C:/Users/sanan/wedtmd-shell" && npx vitest run src/persistence/compat.test.ts src/assets/assetGuide.test.ts`
3. `cd "C:/Users/sanan/wedtmd-shell" && npm test` → ≥ 110 files, ≥ 3215 tests, 0 failed
4. `cd "C:/Users/sanan/wedtmd-shell" && npm run build && node scripts/perf/bundle-budget.mjs` → PASS (css ≤ 40 KB, app ≤ 460 KB)
5. `cd "C:/Users/sanan/wedtmd-shell" && node scripts/smoke/lib/common.mjs --selftest`
6. `cd "C:/Users/sanan/wedtmd-shell" && PW_PATH=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/e2e-full.mjs "http://localhost:4174/" "<O>/e2e"`
7. `… node scripts/smoke/a11y.mjs "http://localhost:4174/" "<O>/a11y"`
8. `… SOAK_MIN=5 node scripts/smoke/soak.mjs "http://localhost:4174/" "<O>/soak"` (Bash timeout 600000)
9. `… SIZES=1080 node scripts/smoke/store-shots.mjs "http://localhost:4174/" "<O>/store"` and `… SIZES=2160 …` (timeout 600000 each);
   EM opens all 18 `<O>/store/1080/*.png` and ≥ 3 `<O>/store/2160/*.png` with Read.
10. Regression (mkdir -p each outdir first): `wp2-crank.mjs "http://localhost:4174/?debug=1" "<O>/regress/wp2"`, `ux.mjs "http://localhost:4174/?debug=1" "<O>/regress/ux"`,
    `shell.mjs "http://localhost:4174/" "<O>/regress/shell"`, `resolutions.mjs "http://localhost:4174/?debug=1" "<O>/regress/res"` → `errors: []` / `fail: []`.
11. `cd "C:/Users/sanan/wedtmd-shell" && grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` → empty
12. `cd "C:/Users/sanan/wedtmd-shell" && git status --porcelain` → only: the 7 fixtures, `src/persistence/compat.test.ts`,
    `src/assets/assetGuide.test.ts`, `docs/ASSET_GUIDE.md`, `src/ui/systemMenu.css` (+ T10 CSS/aria), `scripts/smoke/lib/common.mjs`,
    `scripts/smoke/{e2e-full,a11y,soak,store-shots}.mjs`, `scripts/smoke/README.md` (and the pre-existing ` M package-lock.json`, not staged).

## Out of scope
WP16b work (Art Director audit, GPU perf re-check, demo e2e, 30–60 min soak run, README/CHANGELOG/STEAM_RELEASE/GAME_SPEC §18,
PROJECT_STATUS final); fixes in WP21-owned files (tree focus trap and tree/toast/era-card contrast → WP16b); any simulation, data,
balance, schema or load-logic change; save version bump; refactoring old smokes onto the lib; package.json scripts; new dependencies
(no axe, no Lighthouse); store asset upload/curation; Steam/Deck/Linux validation; layout redesign.
