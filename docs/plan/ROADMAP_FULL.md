# Full-Game Roadmap — What Exactly Does This Machine Do?

Supersedes GAME_SPEC §14 (out-of-scope list was for the vertical slice) and §2.9 (purpose revealed at the very end).
Vision held: rusty crank → colossal machine moving incomprehensible energy; purpose unknown until the final unlock.
Principles kept: every major unlock visibly changes the machine; no micromanagement; no traps; deterministic sim; pure data tables.
All numbers below are **initial**; each content WP tunes them only in `src/data/` until its balance sim targets pass.

## 1. Game shape (target: ~4.5 h active greedy, ≤8 h casual incl. offline)
| Era | Resource (short) | Source / conversion | Machine grows | Accent hue | Greedy end (cumulative) |
|---|---|---|---|---|---|
| I Mechanical (done) | Mechanical Energy (ME) | crank + motors | centre | orange (existing) | 20–30 min |
| II Electrical | Electrical Energy (EE) | from ME/s | right (+x) | cyan | 55–75 min |
| III Thermal/Pressure | Pressure (PR) | from EE/s | left (−x) + chimney | ember red / steam white | 105–135 min |
| IV Resonance | Resonance (RS) | from PR/s | up (spire) | pale verdigris | 165–205 min |
| V Exotic | Unknown Flux (shown `???`) | from RS/s | top + both far ends | violet | 230–290 min |
| Finale | — | `primaryFunction` purchase | whole machine | restored sky blue / green | +5 min sequence |

**Conversion rule (one formula, no stock drain):** for resources in order me→ee→pr→rs→xf
`base[r] = Σ autoAdd[r]·lvl + Σ convert[r]·lvl × perSecond[source(r)]^convExp[r]` (convExp 0.5 → magnitudes compress);
`perSecond[r] = base[r] × (1 + Σ autoPct[r]·lvl/100) × Π rateMult[r|all]^lvl × metaMult`.
Clicks: `perClick.me = Σ clickAdd·lvl × Π clickMult^lvl`; `perClick[r≠me] = Σ clickEcho[r].seconds·lvl × perSecond[r]` (crank stays relevant every era).
Spending: each tech costs one resource (`costRes`). Each era has one sink tech priced in an older resource so old stock stays useful.
Era template (keeps complexity gradual): keystone converter (old-resource cost) · converter repeatable · old-resource sink · click-echo unlock · ×2 unlock · % repeatable · feedback unlock (boosts an older resource, which feeds back via the chain) · one special mechanic · convergence milestone.
Effect notation: `conv(r,k)`, `add(r,a)`, `pct(r,p)`, `mult(r|all,f)` (per-second only), `echo(r,s)`, `click+a`, `click×f`, `offline+h`, `autoClick n/s`. U=unlock R=repeatable M=milestone.

### Era II — Electrical (EE). Special: power lines re-energise the background pylons.
| id | type | cost | growth/max | effect | requires |
|---|---|---|---|---|---|
| generator | U | 150K ME | – | conv(ee,0.5) | generatorBlueprint |
| copperWinding | R | 40 EE | 1.25/25 | conv(ee,+0.25) | generator |
| motorRetrofit | R | 50K ME | 1.35/20 | add(me,40) | generator |
| dynamoCrank | U | 400 EE | – | echo(ee,1s) | copperWinding 3 |
| capacitorBank | U | 1.5K EE | – | mult(ee,2) | copperWinding 5 |
| sparkGap | U | 4K EE | – | click×3 | dynamoCrank |
| transformer | R | 2.5K EE | 1.3/20 | pct(ee,15) | capacitorBank |
| powerLines | U | 12K EE | – | mult(me,2) | transformer 3, motorRetrofit 5 |
| substationBlueprint | M | – | – | none | powerLines, sparkGap, lifetime EE 100K |
Components: generator 96×64 on plinth right of flywheel, belt from flywheelPulley; copper coils (3 stages at lv 1/10/20); capacitor rack 48×64; spark gap 32×48 (arc anim, flash ≤3 Hz); transformer 64×64 far right; cable mast + sagging `cable` link to nearest pylon. Right edge → +420 art px.
Story: plaque `PRIMARY FUNCTION: R?S????`. Logs: "Grid handshake sent. No grid answered." · "Load detected 4 km beneath the surface." · "Copper remembers a current older than the copper." Milestone flavor: "Grid handshake... no response from grid."

### Era III — Thermal/Pressure (PR). Special: relief valves extend the offline cap (idle-friendly).
| id | type | cost | growth/max | effect | requires |
|---|---|---|---|---|---|
| boiler | U | 150K EE | – | conv(pr,0.3) | substationBlueprint |
| firebox | R | 30 PR | 1.25/25 | conv(pr,+0.15) | boiler |
| inductionHeater | R | 50K EE | 1.35/20 | add(pr,5) | boiler |
| steamHammer | U | 300 PR | – | echo(pr,1s) | firebox 3 |
| superheater | U | 1.2K PR | – | mult(pr,2) | firebox 5 |
| condenser | R | 2K PR | 1.3/20 | pct(pr,15) | superheater |
| turbine | U | 8K PR | – | mult(ee,2) | condenser 3 |
| reliefValves | U | 20K PR | – | offline+4h (8→12 h) | steamHammer, turbine |
| pressureVesselBlueprint | M | – | – | none | reliefValves, condenser 5, lifetime PR 150K |
Components: boiler 128×96 left of motor; firebox glow (3 stages); chimney 32×160 on boiler (steam via `fx.steam`); pressure gauge 24×24 (needle ∝ log PR/s); `pipe` links boiler→turbine; turbine 80×64; steam hammer 48×96 reciprocating on θM. Left edge → −440, top → −320.
Story: plaque `RES?OR?`. Logs: "Pressure rising. Safe limit field left blank." · "Steam tastes of rain. Logged as error." Milestone: "Containment rating exceeded by design."

### Era IV — Resonance (RS). Special: crank servo auto-cranks (automation of the manual choice).
| id | type | cost | growth/max | effect | requires |
|---|---|---|---|---|---|
| resonatorSpire | U | 200K PR | – | conv(rs,0.2) | pressureVesselBlueprint |
| harmonicCoil | R | 25 RS | 1.25/25 | conv(rs,+0.1) | resonatorSpire |
| pressureResonator | R | 60K PR | 1.35/20 | add(rs,3) | resonatorSpire |
| crankServo | R | 1M ME | 1.6/10 | autoClick +1/s (counts offline: it is automation) | resonatorSpire |
| echoCrank | U | 250 RS | – | echo(rs,2s), click×5 | harmonicCoil 3 |
| phaseLock | U | 1K RS | – | mult(all,1.25) | harmonicCoil 5 |
| standingWave | R | 2K RS | 1.3/20 | pct(rs,15) | phaseLock |
| crystalLattice | U | 10K RS | – | mult(pr,2), mult(ee,2) | standingWave 3 |
| harmonicConvergence | M | – | – | none | crystalLattice, echoCrank, lifetime RS 200K |
Components: spire 64×320 above piston block (to −430); coil rings stacked by level (1/8/16/25); servo arm 48×48 that visibly turns the crank; crystal 48×48 glow; twin emitter dishes 48×64 L/R. Dust drifts upward (unsettling).
Story: plaque `REST?RE`. Logs: "Synchronization successful." (answers Worn Motor) · "Frequency matches a signal from below the ground." · "Observer count: 1."

### Era V — Exotic (xf, label `???` until finale). Special: sky darkens; final purchase starts the ending.
| id | type | cost | growth/max | effect | requires |
|---|---|---|---|---|---|
| nullChamber | U | 300K RS | – | conv(xf,0.1) | harmonicConvergence |
| containmentRing | R | 20 xf | 1.25/25 | conv(xf,+0.05) | nullChamber |
| resonantSiphon | R | 80K RS | 1.35/20 | add(xf,2) | nullChamber |
| graviticAnchor | R | 1B ME | 1.5/10 | mult(all,1.1) | nullChamber |
| inversionCrank | U | 200 xf | – | echo(xf,3s) | containmentRing 3 |
| lensArray | U | 1K xf | – | mult(xf,2) | containmentRing 5 |
| horizonField | R | 2K xf | 1.3/20 | pct(xf,15) | lensArray |
| skyAperture | U | 15K xf | – | mult(all,3) | horizonField 5, graviticAnchor 3 |
| finalAlignment | M | – | – | none | skyAperture, inversionCrank, lifetime xf 250K |
| primaryFunction | U | 1M xf | – | ending | finalAlignment |
Components: null core 96×96 atop spire with 2–4 procedural orbiting rings; lens array (3×24×24); gravitic anchors 32×128 driven into ground at ±520; aperture beam column (additive sprite). Sky lerps toward violet, sun dims.
Story: plaque `RESTORE (TARGET: ?)`. Logs: "Units not recognised. Continuing." · "Cycle 0041 nearly complete." (echoes existing "Log 0041") · "Operator identity: located."

## 2. Endgame, reveal, replay
**Reveal:** the machine is a *Restoration Engine*, the last act of the vanished builders: it gathers energy in ever stranger forms to wind the world's entropy back to its prior living state. It needs one operator. It has run before ("Idle cycle logged. Cycle has no beginning.").
**Ending sequence** (`primaryFunction`, ~90 s, skippable, reduced-motion variant): 1) every part spins to max, HUD fades · 2) aperture beam rises, one soft white fade (no strobe) · 3) dust falls in reverse, ruined skyline crossfades to intact skyline with lit windows, ground warms green, sky clears blue · 4) terminal lines: `PRIMARY FUNCTION: RESTORE` / "Restoration target: world state, prior." / "Observer count: 1." / "Operator identity: you." / "Restoration holds while the machine runs." · 5) choice: **[KEEP IT RUNNING]** (postgame: restored world, machine idles, numbers continue) or **[BEGIN A NEW CYCLE]**. Either can be chosen later from the system menu; no lockout.
**New cycle (prestige, simple):** resets resources/techs to start, wasteland returns, label "CYCLE 0043". Grants **Echoes** = 3 + min(3, floor(log10(lifetime xf / 1M))). Each unspent Echo = +10% all per-second. Memory perks (one-time, Echo cost): Muscle Memory (1: start with Worn Motor + Gear Ratio 3), Residual Charge (2: all `convert` +50%), Long Silence (2: offline +4 h), Servo Recall (3: crankServo lv1 at start), Ledger (3: keystone converters −50% cost). Kept across cycles: meta, stats, achievements, settings. Target: cycle 2 ≤65% of cycle-1 time.

## 3. Systems
- **Big numbers — decision: stay on JS `number`.** Sqrt conversion keeps magnitudes ≤~1e15 (ME ≤1e13 at end). Add suffixes Qa Qi Sx Sp Oc No Dc (1e15..1e33), then scientific; notation setting suffix/scientific/engineering. Guard `DESIGN_MAX_VALUE = 1e100` in `balance.ts`; balance sims assert every value finite and below it. No library.
- **Economy:** `GameState.res`/`lifetime: Record<ResourceId, number>`; `ProductionRates.perClick`/`perSecond: ResourceMap`; requirement `{type:'lifetime',res,amount}`; tech fields `era`, `costRes`. Resource shown when lifetime>0 or rate>0.
- **Save:** v1→v2 migration in WP7 (me→res.me, lifetimeMe→lifetime.me). Rule after v2: additive optional fields (settings, stats, achievements, meta, ending) default when missing, no bump; structural changes bump + migration + fixture test. Export/import save string (base64 JSON, validated by the same path) in WP10.
- **Stats & achievements (WP10):** stats: active/offline seconds, clicks, purchases, lifetime per resource (cumulative across cycles), cycles, best cycle time. ~30 data-driven achievements (`src/data/achievements.ts`, pure `evaluateAchievements`), cosmetic only (no balance coupling); panel in system menu.
- **Settings (WP10):** master/sfx/ambience/music volume 0–100, number notation, reduced motion (no shake, clamped anim speed, instant camera, no flashes), UI scale 100/125/150 %, confirm-new-cycle.
- **Accessibility:** Space/Enter cranks (≤15 clicks/s, key-repeat ignored), T tree, Esc menu, Tab order + visible focus in tree/menu, ARIA labels, statuses by text/icon not colour only, min 12 px text, flashes ≤3 Hz.
- **Camera:** pure `visibleMachineBounds(techLevels)` + `fitView(bounds, VIEW, margin)` (snapped zoom); auto-frames on any unlock outside view; refocus = fit. WORLD → 3840×2160, GROUND_Y → 1680; machine RT bounds → x ±560, top −680.
- **Tech tree:** era tabs (one per reached era; unreached shows `SIGNAL ?`), same node/line rendering; cost text uses resource short name.
- **Performance budget:** 60 fps on integrated GPU at 1280×720 full machine; machine RT redraw ≤4 ms/frame; ≤500 display objects; sim+UI JS ≤2 ms/frame; tree rebuild ≤8 ms; heap ≤150 MB; app chunk ≤200 KB (excl. Phaser); assets ≤8 MB; balance sims ≤10 s in CI.

## 4. Art / audio per era (Art Director, PixelLab Pro, locked "Rust Wasteland" palette + one accent ramp per era, accents only on small areas)
| Era | Accent ramp | Assets (manifest ids `machine.*`/`fx.*`/`bg.*`) | Audio (WebAudio synth) |
|---|---|---|---|
| II | cyan #2f5a62 #5fa8b4 #bff0ec | generator, coil×3, capacitorRack, sparkGap(4f), transformer, cableMast, bg.pylonsLit | 50 Hz mains hum, arc crackle (noise bursts), relay clicks |
| III | ember #6a2418 #b8402a + steam #e8e0cc | boiler, firebox(3 glow), chimney, gauge+needle, turbine#rot, steamHammer, pipe tile, fx.steam (wire existing) | boiler roar (filtered noise), hiss, whistle on milestone |
| IV | verdigris #3f5e52 #7fae96 #cfe8d6 | spire, coilRing, servoArm, crystal(4f), emitterDish | harmonic sine pad, tuning-fork pings, servo whirr |
| V | violet #24162f #54367a #9a6ad0 #e0c8ff | nullCore#rot, ring, lens, graviticAnchor, beam, bg.skyViolet | sub-bass drone, reversed swells |
| End | sky #6f9fc8 #a8d0e8, green #5f8a4a #8fb46a | bg.skylineRestored (lit windows), bg.skyRestored, terrain.groundGreen | resolving major chord, wind stops, birds (synth chirps) |
All content WPs ship procedural fallback painters first (game playable, never depends on missing files); Art Director phase A<n> replaces them with PixelLab art + audit (RotSprite for rotating parts), touching only `public/assets`, manifest dims and `docs/ASSET_GUIDE.md`.

## 5. Work packages (each = one planner→EM→workers cycle; each ends typecheck/test/build clean and playable)
| WP | Title | Depends on | Ends with |
|---|---|---|---|
| WP7 | Multi-resource core + save v2 + number suffixes (no new content) | — | era I plays identically on new core |
| WP8 | Expansion infra: world growth, dynamic bounds + camera auto-frame, era-tab tree, HUD resource rows, plaque line | WP7 | era I identical; tree has tabs; camera fits machine |
| WP9 | Era II content: 9 techs, components w/ fallback painters, `cable` link + lit pylons, logs, hum/arc audio, sim targets | WP8 | playable to substationBlueprint |
| A9 | Art Director Era II PixelLab pass + audit | WP9 | era II real art |
| WP10 | Settings, accessibility, stats + achievements panel, save export/import | WP7 (parallel to A9) | menus complete |
| WP11 | Era III content (+ `offline+h` effect, `pipe` link, steam fx, gauge) + sim | WP9 | playable to pressureVesselBlueprint |
| WP12 | Era IV content (+ `autoClick` effect, servo arm, rising dust) + sim | WP11 | playable to harmonicConvergence |
| WP13 | Era V content (+ rings renderer, sky lerp, beam) + sim | WP12 | playable to primaryFunction purchase |
| WP14 | Ending sequence + reveal + postgame "keep it running" + restored-world layers | WP13 | game completable |
| WP15 | New cycle prestige: Echoes, Memory perks, meta save, cycle-2 sim | WP14 | replay loop |
| WP16 | Music bed per era, audio polish/mix, perf pass vs budget (profiling smoke) | WP13 | budget met |
| WP17 | Release: two-profile full balance, end-to-end smoke via debug fast-forward, docs (README/STATUS/ASSET_GUIDE/spec §18 note), final art audit | all | shippable 1.0 |
| WP22 | Part evolution tiers (user directive 2026-10-24): 21 repeatable tracks evolve MK I–V (3 or 5 tiers at reachable levels), tier-up beat, tree/toast MK text, showcase top tiers; Art Director tier art (docs/plan/PART_TIERS.md, plan docs/plan/WP22.md) | WP21, W0 seed | upgrades visibly evolve parts in both editions |
| WP23a | Living world system + eras I–II: 6 denizens, street corner, era I–II environment arc, fourth-wall line scheduler, paper speech bubble + live region, save v2 `world` block, WORLD VOICES setting, demo post-cap arc; Art Director Wave A (docs/plan/STORY_BIBLE.md, docs/plan/DENIZEN_ART.md, plan docs/plan/WP23.md) | WP21, W0 seed (parallel to WP22) | demo world inhabited; full edition hides the layer from era III |
| WP23b | Living world eras III–V, finale choreography, postgame loop, cycle 2+ traces, 2 optional machine logs; Art Director Waves B–C; joint release refresh (store shots, STEAM_RELEASE §15) | WP22, WP23a | full game world complete |
| WP25 | Passive-first economy (user playtest 2026-10-25): the machine carries progression, the click becomes an optional bonus (echo cut, Crank Servo in era II, per-energy passive retune, HUD click worth, machine output popups, manual-optional log); balance sims for active / passive-leaning / idle profiles; demo windows re-targeted (docs/plan/WP25.md) | WP23b | full + demo |
| WP24 | Living world v2 (user playtest 2026-10-25): pure behaviour scheduler (varied weighted activities, travel between spots, reactions), recorded-Tuesday day clock and weather drift, transition queue (no instant swaps), new era-row frames by the Art Director (docs/plan/WP24.md) | WP23b, WP25 (merge order) | full + demo |
| WP25b | Surge (follow-up, reading R2 of the playtest: click = very serious income): capped active burst on top of WP25; only if the user asks | WP25 | full + demo — **superseded by WP27** (the user's 2026-10-27 answer: keep the click warm through tree upgrades and clickable on-screen events) |
| WP24b | Wind / rain audio that follows the weather (follow-up, Director Q6; out of WP24; touches `gameAudio.ts` / `synth.ts` and the audio smokes): the wind bed follows the era wind and gusts; a rain bed follows the virga (on in III, frozen in IV, faded in V) | WP24 | wind and rain beds follow the weather; audio smokes green — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP24c | Slower era V sky fade (follow-up after AD2): `skyViolet` and `horizonGlow` stay at 1.5 s (`PARALLAX_FADE_MS`, WP24 D9); a longer fade of their own in era V only; the finale and showcase settle waits and the A7 frames move with it | WP24 | era V sky fades slowly, never snaps; finale frames re-checked — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP24d | Prune the superseded fixed loops in `src/data/livingWorld.ts` and `src/data/worldEras.ts` (kept in WP24 as clip sources): remove only the tables that no reader uses | WP24 | no unused loop table; typecheck and tests green — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP24e | Cycle 3+ ground girl on the 1530 scrap (AD2 N4; pre-existing WP23b data): the girl stands at 1538, on the scrap. Move the girl's ground stop or the scrap | WP24 | no figure stands on a scrap in cycle 3+ framings; AD check — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP25 AD N1 | Crank Servo arm vs X-brace contrast (follow-up, art): in eras II and IV the dark iron arm is lost against the frame X-brace at 1:1; a lighter lit-side rim (`#7d8286`) or a dark backing plate behind the hub, in the servo-tier repaint | WP25 | arm reads at 1:1 in eras II and IV; art gates green — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP26 | Post-v0.10.0 follow-ups as patch v0.10.1 (docs/plan/WP26.md): WP24b wind/rain audio from a world weather readout, WP24c slow era V sky fade-in, WP24d loop prune, WP24e girl off the scrap, WP25 AD N1 servo arm rim, plus AD §R N2 (7 tech tree edges through a third node: slot moves + geometric guard test) | v0.10.0 close (F4 in) | weather beds follow the world; sky never snaps; no figure on a scrap; arm reads at 1:1; no tree edge through a node; save/economy/text unchanged; §R-lite green — **DONE in WP26, v0.10.1 (2026-10-27)** |
| WP27 | Playtest 2026-10-27 follow-ups (docs/plan/WP27.md): click curve (hand → hand + machine → machine; Worn Motor +2 ME/s), ME click parity (one crank echo pays every energy), Machine Faults (clickable on-screen events, F key) and the wind-up click branch (Discharge Lever, Leak Whistle, Damping Fork, Overrun Clutch), prestige re-tune, era I-II crow perched with folded wings (3 new frames), Sensor 7 next to the Inspector in era II (s8w framing) | v0.10.1 | clickCurve.sim K1-K12; ME parity 0 failures; faults.mjs full + demo; crow and Sensor 7 AD check; §R-lite all 15 rows — **DONE, v0.11.0 (2026-10-28)** |
Art phases A11/A12/A13/A14 follow their content WP and may overlap the next code WP (asset swaps never touch gameplay).
Per-era balance (extend `src/simulation/balance.sim.test.ts` via shared harness): greedy 4 clicks/s era-end windows from §1 table; casual profile (1 click/s, buys every 30 s, 8 h offline blocks overnight) finishes ≤8 h; no greedy stall >20 min without a purchase; all values finite and <1e100.
Later-WP acceptance outline: WP8 era-I sim times unchanged, auto-frame unit tests, tabs keyboard-usable. WP9/11/12/13: new techs in data tests (prereq graph acyclic, every tech reachable, every unlock has ≥1 component), era window asserted, smoke `stages.mjs` extended, 0 console errors. WP14: smoke reaches ending via debug hook; skip works; reload mid-sequence resumes at choice. WP15: v2 additive meta round-trip; cycle-2 time ≤65% in sim. WP16: frame-time smoke under budget. WP17: §16 checklist + full-game checklist pass.

## 6. WP7 — Multi-resource core + save v2 + number suffixes (fully specified)
Goal: replace single-ME economy with a resource map and generic effects so eras II–V are pure data; era I behaviour, numbers and visuals unchanged.
### Contracts (src/data/types.ts, src/data/resources.ts — no Phaser)
```ts
export const RESOURCE_IDS = ['me', 'ee', 'pr', 'rs', 'xf'] as const;
export type ResourceId = typeof RESOURCE_IDS[number];
export type ResourceMap = Record<ResourceId, number>;
export interface ResourceDefinition { id: ResourceId; name: string; short: string; era: number; source: ResourceId | null; convExp: number }
// RESOURCES: me{'Mechanical Energy','ME',1,null,1} ee{'Electrical Energy','EE',2,'me',0.5} pr{'Pressure','PR',3,'ee',0.5}
//            rs{'Resonance','RS',4,'pr',0.5} xf{'Unknown Flux','???',5,'rs',0.5}
export type Effect =
  | { type: 'clickAdd'; amount: number } | { type: 'clickMult'; factor: number }
  | { type: 'autoAdd'; amount: number; res?: ResourceId }     // res defaults to 'me'
  | { type: 'autoPct'; percent: number; res?: ResourceId }    // res defaults to 'me'
  | { type: 'rateMult'; factor: number; res: ResourceId | 'all' }
  | { type: 'convert'; amount: number; res: ResourceId }      // source = RESOURCES[res].source
  | { type: 'clickEcho'; seconds: number; res: ResourceId }
  | { type: 'none' };
export type Requirement = { type: 'tech'; id: TechId; minLevel: number } | { type: 'lifetime'; res: ResourceId; amount: number };
// TechDefinition += era: number; costRes: ResourceId      (all 9 existing techs: era 1, costRes 'me')
// GameState: { res: ResourceMap; lifetime: ResourceMap; totalClicks; techLevels; lastSimTime; createdAt }  (me/lifetimeMe removed)
// ProductionRates: { perClick: ResourceMap; perSecond: ResourceMap }
// OfflineReport: { elapsedSeconds; cappedSeconds; gained: ResourceMap }
// SessionEvents.click: { gained: number /* ME */; gainedAll: ResourceMap }; purchase += res: ResourceId
// SystemLogTrigger 'lifetimeMe' → { kind: 'lifetime'; res: ResourceId; atLeast: number }
```
Formula exactly as §1 (metaMult = 1 for now). `costAt` unchanged; `canAfford(state, res, cost)`; purchase deducts `res[def.costRes]`, never touches `lifetime`. Helpers `emptyResourceMap()`, `addMaps(a,b)`, `scaleMap(m,k)` in `src/simulation/resources.ts`.
### Tasks
- T1 Core types + resource table — `src/data/types.ts`, `src/data/resources.ts` (new), `src/data/technologies.ts` (era, costRes, generatorBlueprint → `lifetime me 200000`), `src/data/systemLogs.ts`, `src/data/technologies.test.ts` — depends: none.
  Acceptance: types compile; RESOURCES test (sources form chain me→…→xf, era ordering); tech table values otherwise byte-identical.
- T2 Simulation on resource maps — `src/simulation/{state,resources,GameSession,events,index}.ts`, `production/{rates,tick}.ts`, `economy/cost.ts`, `progression/{purchase,requirements,status,milestones}.ts` + their tests — depends: T1.
  Acceptance: rates unit tests for every effect type with injected tech tables (convert chain, rateMult 'all', clickEcho, default res 'me'); era-I rates equal old values; lifetime never decreases on purchase; offline gains every resource at capped time; requirement label "200K lifetime ME"; GameSession API unchanged apart from types.
- T3 Number formatting — `src/utils/format.ts`, `format.test.ts` — depends: none.
  Acceptance: suffixes K..Dc; ≥1e36 → `1.23e36`; `formatNumber(n, mode, notation='suffix')` with 'scientific' and 'engineering'; existing outputs below 1e15 unchanged; `DESIGN_MAX_VALUE = 1e100` in `src/data/balance.ts`.
- T4 Save v2 — `src/persistence/{schema,saveController,startup}.ts` + tests, fixture `src/persistence/fixtures/v1-save.json` — depends: T1 (+T2 for createInitialState).
  Acceptance: SAVE_VERSION 2; MIGRATIONS[1] maps me→res.me, lifetimeMe→lifetime.me, other resources 0; v1 fixture loads status 'migrated' with identical ME/levels/clicks; missing map keys → 0, negative/non-finite → recovery; v2 round-trip lossless; corrupt-save backup path unchanged.
- T5 UI/game/audio call sites — `src/ui/{hudView,hud,techTreeView,techTree,notificationRules,systemLogRules}.ts` + tests, `src/game/entities/MachineAnimator.ts`, `src/game/debugHook.ts`, `src/audio/gameAudio.ts`, `scripts/smoke/{wp2-crank,wp4-persistence}.mjs` — depends: T2.
  Acceptance: HUD shows ME rows exactly as before (other resources hidden while lifetime 0 and rate 0); cost text `"<cost> <short>"`; insufficient text names the resource; welcome-back lists each non-zero resource; animator/audio drive from `rates.perSecond.me`; smokes pass, 0 console errors.
- T6 Balance harness — `src/simulation/sim/greedy.ts` (new, pure, reusable), `src/simulation/balance.sim.test.ts` — depends: T2.
  Acceptance: `runGreedy({ seconds, clicksPerSecond, stepSeconds, buyIntervalSeconds })` returns `{ firstAt: Record<TechId, number>, maxValue, final }`, buys cheapest affordable per resource; era-I times exactly 0:13 / 3:16 / 12:02 / 22:06; asserts all values finite and < DESIGN_MAX_VALUE.
Parallel waves (EM): W1 = T1+T3 · W2 = T2 · W3 = T4, T5, T6.
### Package acceptance / validation
`npm run typecheck` · `npm test` (all green, count ≥ 602 + new) · `npm run build` · `npx vitest run src/simulation/balance.sim.test.ts` (era-I times unchanged) · `node scripts/smoke/wp2-crank.mjs`, `wp4-persistence.mjs`, `stages.mjs` (0 console errors) · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils}` empty · manual: old v1 save in localStorage loads with same ME and machine.
### Out of scope for WP7
Any era II+ tech data, new components, tree tabs, camera/world changes, settings fields, stats/achievements, prestige, new art/audio.
