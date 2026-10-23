# Changelog

Notable changes per release, newest first. Work packages are named WPn; plans are in `docs/plan/`.

## 0.9.0 — Steam demo candidate — 2026-10-23

### Added
- **WP17** Legacy feed techs, uncapped, so each energy stays in use after its era: Bellows Drive (ME, era III), Grid Exciter (EE, era IV), Mains Backfeed (EE, era V), Steam Lance (PR, era V). Resonant Siphon adds +5 % ??? (Unknown Flux) rate.
- **A17** Hand-pixelled art for the legacy feeds (bellows, exciter insulator, backfeed string, steam lance) and the generator glow.
- **WP18** Final machine completion beat: the ending steps the machine display from era III to era V over the first 6 s. Rendering only; simulation unchanged.
- **WP18** Survey camera move in the ending (skipped under reduced motion).
- **WP18** Postgame portrait: one fixed FULL-view pose for KEEP, reload and refocus.
- **WP18** VIEW MACHINE photo mode (postgame): HUD hidden, drag, wheel and arrow-key pan and zoom, Esc exits.
- **WP18** ShowcaseScene: separate scene with its own camera. Base for the demo teaser.
- **WP18b** Restored warm core in postgame: A17 texture variants, lamps lit.
- **WP19** Steam desktop shell (Electron 44.7.0): `npm run build:steam` and `npm run build:steam-demo`; host file saves (atomic write, `.bak` copy); crash overlay; splash; title screen; credits; quit; fullscreen setting; UI anchored to the canvas.
- **WP20** Onboarding crank prompt; TECH INDEX cue with affordable-purchase badges; next-goal line; era cards on era keystones.
- **WP21** Demo edition, capped at the Substation Blueprint (era II). Eras III to V show FULL GAME in the tree and cannot be bought.
- **WP21** Final-machine teaser after the cap, with the plate name redacted (`PRIMARY FUNCTION: RES?OR?`).
- **WP21** END OF DEMO card: WISHLIST ON STEAM, KEEP TINKERING, REPLAY TEASER, QUIT (desktop only).
- **WP21** Build scripts `npm run build:demo` (output `dist-demo/`) and `npm run build:steam-demo`; demo smokes `scripts/smoke/demo.mjs` and `scripts/smoke/demo-cases.mjs`.
- **WP15** Music bed per era: crossfade on era change, ducking under the finale chord. MUSIC volume slider with its own bus.
- **WP15** Perf probes `uiStats`, `perfMarks`, `audioStats`; perf smoke `scripts/smoke/perf.mjs`.
- **WP15R** GPU perf smoke (`PERF_GPU=1`, median of 3 windows, idle and post-purchase windows).
- **WP16a** Save compatibility tests (`src/persistence/compat.test.ts`, historical-shape fixtures).
- **WP16a** Smokes `e2e-full`, `a11y`, `soak`, `store-shots`; ASSET_GUIDE guard test (`src/assets/assetGuide.test.ts`).
- **WP16b** Release docs: `README.md`, `CHANGELOG.md`, `docs/STEAM_RELEASE.md` (release checklist).

### Changed
- **WP15R** Purchase cue follows the energy that pays. Rate-driven music beds refit to at least 3x the post-finale rate. Music themes and bed trims use the simulation `currentEra`.
- **WP17** HUD: title shows the current era (I to V). Each energy row shows stock, rate and feed hint; frontier row emphasised.
- **WP17** Crank gain text: one tinted line per active energy. Clicks within 300 ms merge into one block. Text size compensates for camera zoom.
- **WP20** Part fly-in is visible after the tree closes (camera nudge), not behind the open tree. Toasts sit above the tree backdrop. Level toasts coalesce.
- **WP20** Tree fits at UI 150 %, keyboard-safe, with the selected node kept in view. System menu has fixed height. Text sweep.
- **WP16a** Active menu tab text contrast raised. Reset pulse stops under in-game reduced motion. Title version text colour fixed.
- **WP16b** Store art: far-plain ramp under the ridge line replaces the flat grey band. Logo plate redrawn with bolts.
- **WP16b** TECH INDEX: Tab focus trapped inside the overlay.
- **WP16b** TECH INDEX: tree text contrast fixed (milestone node ink; purchased node level and cost text).
- **WP16b** Compact in-tree toast.
- **WP16b** One guidance prompt at a time.
- **WP16b** Tree layout: PURCHASE button beside its feedback line; graph centred.

### Verification
- Balance sign-off (`src/simulation/signoff.sim.test.ts`, greedy profile A): era ends 22:06 / 60:23 / 110:36 / 166:30 / 249:31.
- Demo cap timings (`src/simulation/demoCap.sim.test.ts`): profile A 60:23, B 72:52, new player 98:29, C 148:28.
- a11y smoke (`scripts/smoke/a11y.mjs`): `fail []`, `deferred []`.
- Bundle budgets (`scripts/smoke/perf-budget.json`, checked by `scripts/perf/bundle-budget.mjs`): app raw <= 460 KB, css <= 44 KB.
- Open before the final release pass (`docs/STEAM_RELEASE.md` section 15): soak 30–60 min, quiet-machine GPU perf, final art audit.

## 0.1.0 — development builds — 2026-10-18
- WP1: Tooling and pure simulation core.
- WP2: Wasteland scene, asset registry, camera, crank, HUD.
- WP3: Tech tree overlay and modular machine components.
- WP4: Save/load, offline welcome-back, system menu, audio, system logs.
- WP5: Balance, ASSET_GUIDE, README, build split, browser smoke scripts.
- WP6: Mechanical correctness and art polish (drive train, assets, RotSprite).
- WP7: Multi-resource core (ME, EE, PR, RS, XF), save v2 migration, number suffixes to Dc, greedy sim harness.
- WP8: Multi-era infrastructure and Era II Electrical.
- WP9: Era III Thermal/Pressure.
- WP10: Era IV Resonance.
- WP11: Era V Exotic.
- WP12: Settings, accessibility, stats, achievements, save export/import, reduced motion.
- WP13: Ending sequence, reveal, postgame, restored world.
- WP14: New-cycle prestige: Echoes, Memory perks, MEMORY tab, cycle transition.
