# Project Status

## Current milestone
**Steam demo program (2026-10-23)** — see docs/plan/STEAM_DEMO_PROGRAM.md (decisions D1–D8, two tracks).
**v0.9.0 demo release-ready (2026-10-24)**: every roadmap WP done; docs/STEAM_RELEASE.md section 15 rows 1–15 PASS.
Left for the user: Steam app/depot ids, capsule art, trailer, SteamPipe upload (section 12).

**Vertical slice — release-quality.** WP1–WP6 done. GAME_SPEC §16/§17 PASS; Art Director verdict RELEASE-READY (docs/plan/ART_AUDIT.md phases 1–5).

## Roadmap
| WP | Scope | State |
|---|---|---|
| WP1 | Tooling + pure simulation core | ✅ done |
| WP2 | Wasteland scene, asset registry, camera, crank, HUD | ✅ done |
| WP3 | Tech tree overlay + modular machine components | ✅ done |
| WP4 | Save/load, offline welcome-back, system menu, audio, system logs | ✅ done |
| WP5 | Balance, ASSET_GUIDE, README, build split, §16 checklist | ✅ done |
| WP6 | Mechanical correctness + art polish (Art Director audit → drive train, assets, RotSprite) | ✅ done |
| WP7 | Multi-resource core (ME/EE/PR/RS/XF), save v2 migration, number suffixes to Dc, greedy sim harness | ✅ done |
| WP8 | Multi-era infra + Era II Electrical (generator, coils, capacitor rack, spark gap, transformer, mast, lit pylons, era tabs, camera auto-frame, plaque) | ✅ done |
| WP9 | Era III Thermal/Pressure (boiler, chimney, steam hammer, turbine, pipes, steam/smoke FX, relief valves offline buffer) | ✅ done |
| WP10 | Era IV Resonance (spire, coils, crystal, dishes, calliope, fork, crank servo autoClick) | ✅ done |
| WP11 | Era V Exotic (crown, rings, siphons, lens, aperture/beam, anchors, world 3840×2160, violet sky, eclipse) | ✅ done |
| WP12 | Settings, accessibility, stats, achievements, save export/import, reduced motion (roadmap WP10) | ✅ done |
| WP13 | Ending sequence, reveal, postgame, restored world (roadmap WP14) | ✅ done |
| WP14 | New-cycle prestige: Echoes, Memory perks, MEMORY tab, cycle transition (roadmap WP15) | ✅ done |
| WP15 | Music bed, audio mix, perf pass (roadmap WP16) | ✅ done (close-out WP15R: purchase cue by paying energy, audio refit, GPU re-measure) |
| WP17 | Energy continuity (legacy sinks, every energy used every era) + era-aware HUD + gain text | ✅ done |
| WP18 | Final machine showcase (completion beat, survey camera, postgame name/portrait/photo mode, ShowcaseScene) + WP18b restored warm core | ✅ done |
| A17 | Art Director pass: legacy-feed part art, generator glow, gain-text placement, restored-core variants | ✅ done |
| WP19 | Steam desktop shell (Electron, file saves, crash overlay, splash, title, quit/credits, fullscreen, UI anchoring) | ✅ done |
| WP20 | First-impression UX polish (onboarding, fly-in visible, tree fit, era cards, text sweep) | ✅ done |
| WP21 | Demo edition (cap at Substation Blueprint, end card + final-machine teaser, wishlist) | ✅ done |
| WP16 | Release verification for the Steam demo (sign-off, e2e, a11y, soak, art audit, docs, store shots) | ✅ done (WP16a · WP16b-1 store polish · WP16b-2 docs + a11y/UX · WP16b-3 soak/GPU perf/final AD audit) |
| WP22 | Part evolution tiers (3/5 visual MK tiers per repeatable part, tier-up beat; user directive 2026-10-24) | ✅ done (merged e5b97c4; Opus review APPROVE, EM PASS, AD round 5 RELEASE-READY after F11 HUD-inset fix) |
| WP23a | Living world: denizens, environment arc, world voice bubbles, eras I–II + demo cut | paused at fix round 2 (run wf_b2535911-eb6, resumable; worktree wedtmd-shell, branch claude/world-wp23a); resumes now, one track at a time (user is on the PC) |
| WP23b | Living world eras III–V, finale, postgame, cycle 2+; then §R release refresh | planned (after WP22 + WP23a merge) |

Plans/assignments: `docs/plan/WP*.md`. Art direction: `docs/plan/ART_BRIEF.md`.

## Completed work
- **WP1** pure simulation: data-driven techs, cost/production formulas, progression, milestones,
  tick/offline (8h cap), `GameSession` facade with events, versioned saves with recovery/migration.
- **WP2** wasteland parallax + dust, manifest asset registry with procedural fallbacks, camera
  pan/zoom/refocus, frame + clickable crank (rotation, floating +ME, shake), terminal HUD.
- **WP3** tech tree overlay (nodes, prerequisite lines, locked/available/purchased, details,
  purchase feedback), toasts, procedural machine animation driven by clicks/ME/s (clamped),
  unlock assembly, belts/shafts, Generator Blueprint milestone.
- **WP4** save/load + corrupt recovery, autosave + unload saves, offline welcome-back once,
  system menu (save, mute, two-step reset), modal/Esc stack, WebAudio synth SFX/hum/gear ticks/wind,
  rare system logs.
- **WP5** balance retune + greedy sim test, `docs/ASSET_GUIDE.md`, `README.md`, Phaser chunk split,
  browser smoke scripts in `scripts/smoke/`.
- **WP6** (Art Director loop): web-researched audit of the machine; mechanically coherent drive train
  (one master angle, gear ratios, meshing module-4 gears, belts tangent+wrapped over real pulleys with
  moving dashes, crank-pin connecting rod → piston yoke, flywheel on pedestal, motor on plinth, bearings,
  crank brace); coherent at every unlock stage; art-resolution RenderTexture; RotSprite pre-rendered
  rotation frames (clean 1-px outlines, exact gear mesh per frame); banded sky with sun, ground haze,
  contact shadows, readable +ME text, first-click crank pulse, snapped zoom, toasts top-right.
- **WP17** energy continuity: 4 uncapped legacy techs (Bellows Drive ME→PR era III, Grid Exciter EE→RS era IV,
  Mains Backfeed EE→??? and Steam Lance PR→??? era V) + Resonant Siphon +5% ???; guard tests (cost matrix
  lower-triangular complete; profile A era V spend share ≥75 %, dead time ≤5 min per energy). Legacy machine
  parts + generator glow (procedural painters, src/assets/painters/legacy.ts); visual drivers saturate ≥3× PF
  rates; dead per-component effects data removed. Era-aware HUD (pure `currentEra`, title table in
  src/data/hud.ts, one row per energy with feeds hint, frontier row, AUTO-CRANK line); crank gain text = stacked
  tinted lines, merged within 300 ms, zoom-compensated. Smoke `@tech:n` markers reach Resonant Siphon 20 /
  Gravitic Anchor 10 (all 99+5 parts visible at the end).
- **WP18** final machine showcase: ending renders the machine at display levels = max(real, visualMax) where
  visualMaxLevels() is derived from component gates (rendering-only DisplaySource; simulation untouched); completion
  beat steps era III→IV→V at S1 t 3/4.5/6 s; survey camera baseL→baseR→full in S3 (skipped under reduced motion);
  canonical postgame portrait pose (FINALE_VIEWS.full) for KEEP/reload/refocus; "lamps lit" restored accent;
  VIEW MACHINE photo mode (modal, HUD hidden, drag/wheel/arrow pan-zoom, Esc exits); ShowcaseScene (lazy, own camera,
  stand-in source, teaser API in src/game/math/teaser.ts for WP21); scripts/smoke/showcase.mjs → 13 PNGs at 3840×2160.
- **WP19** Steam shell: Electron 44.7.0 (app:// + CSP, fuses, single instance), build:steam / build:steam-demo →
  out/steam/<edition>/win-x64, host file saves (atomic + .bak), crash overlay, splash, title screen, credits, quit,
  fullscreen, #ui-root anchored to the canvas (--ui-zoom), frame cap 60/78, debug hook only with ?debug=1, v0.9.0,
  docs/STEAM_RELEASE.md. Smokes: shell, resolutions, desktop (packaged exe).
- **A17 / WP18b** art: hand-pixelled legacy feeds (bellows, exciter insulator, backfeed string, steam lance, generator
  glow); postgame restored accent = A17 warm-core texture variants swapped on FinaleFrame.restored + lamps lit.
- **WP20** UX: crank prompt, TECH INDEX hint + affordable badges, fly-in after tree close + camera nudge, keyboard-safe
  tree that fits at UI 150 %, next-goal line, era cards, toast coalescing, fixed-height menu, text sweep, crank sparks.
- **WP15R**: purchase cue follows the paying energy; rate-driven beds refit ≥ 3× PF rates; one era source
  (currentEra); GPU perf smoke (PERF_GPU=1, median-of-3).
- **WP16a** release tooling: 7 historical-shape save fixtures through codec/session/host/export (src/persistence/compat.test.ts);
  ASSET_GUIDE guard (src/assets/assetGuide.test.ts, regenerable tables); smokes e2e-full (title → cycle 2), a11y (reachability, focus
  ring, contrast, reduced motion, UI 150; WP21-owned scopes deferred, inactive text flagged), soak (SOAK_MIN, 5 min flat: heap 92.5 MB),
  store-shots (18 shots × 1080/2160, hud/clean); shared libs scripts/smoke/lib/{common,a11y-audit}.mjs. Fixes: active menu tab contrast,
  armed reset pulse stops under in-game reduced motion, title version colour (haze).
- **WP21** demo edition: src/data/edition.ts (full|demo by Vite mode), era > 2 refused ('demo'), demo boot/import clamp
  (original save kept in wedtmd.save.fullgame), capTech milestone +4 s → ShowcaseScene teaser (violet ruined world, plate capped
  RES?OR?) → END OF DEMO card (WISHLIST / KEEP TINKERING / REPLAY TEASER / QUIT on desktop), SYSTEM row DEMO ENDING; demo hides
  later records, MEMORY, new cycle; build:demo → dist-demo, build:steam-demo (separate userData). Cap timing A 60:23 · B 72:52 ·
  new player 98:29 · C 148:28 (guarded). WP20 follow-ups: compact newest toast in the tree, PURCHASE visible at UI 150 %.
- **WP16b-1** store polish: Art Director far-plain ramp under the ridge (grey band gone), transparent skyline underside, bolted logo
  plate; HUD hidden behind the title; store-shots fixes + store-top5.json (07 era V clean, 06 spire, 03 generator, 05 tree,
  09 postgame clean); art script guards (logo_plate.py). AD RELEASE-READY at 1080/2160.
- **WP16b-2** release docs + deferred a11y/UX: README (editions, energies, commands, save locations), CHANGELOG.md 0.9.0,
  STEAM_RELEASE release checklist + store assets (3 rows PENDING WP16b-3), GAME_SPEC §18 note; tech tree focus trap (trapFocus),
  palette contrast for purchased (sand) and milestone (amber→amber-dim) nodes, a11y DEFERRED_SCOPES empty (tree/toast/era card
  gate); compact one-line in-tree toast clear of heading/tabs at UI 100/125/150; one guidance prompt at a time (activePrompt);
  stable tree panel (fixed height, PURCHASE + feedback one row, graph centred). AD RELEASE-READY (round 2).
- **WP16b-3** final release pass: store shots capped at RES?OR? (debug hook setPlateCap, rendering only) + no_spoiler checks;
  ux case M; Opus AD final audit (1080p, 1440p, 3440×1440, Deck 1280×800 and 1280×720 at UI 100/150, full + demo) RELEASE-READY
  after 3 fixes: lance steam vents beside the valve, toasts compact while the era card is up, SYSTEM footer fits at UI 150.
  Quiet GPU perf frame p95 16.8 / post 16.7 ms (≤ 17); 60 min soak heap 91.5 → 92.7 MB, display 74 flat, DOM +0;
  packaged demo + full exes pass desktop.mjs. STEAM_RELEASE section 15 all PASS.
- **WP22** part evolution tiers (merged e5b97c4): 21 repeatable-part tracks, 66 tier steps, MK I SALVAGED → MK V AS BUILT
  (3 or 5 tiers by reach); 91 tier PNGs + rot sheets + rim decals (Opus AD, palette lock); 900 ms tier-up beat (flash, ghost,
  debris, shine, sparks; ≤ 4 per release; never blocks input; reduced-motion crossfade), torque tick, refit audio, MK V heartbeat;
  MK marks in tree + toasts; showcase / finale / teaser / prestige at the right tiers; siphon 5/10 + anchor 2/3 retune, ring1Bead2.
  F11: HUD inset follows UI scale (240/304/368) + release nudge kept below it. vitest 126 files / 3732 pass; tiers.mjs full + demo,
  ux, resolutions, stages, store-shots 1080 clean. Decoded PNG 52.9 MiB (limit 56). Note: the wp-exec waves started dependent
  workers before their inputs landed (round 0 mostly "blocked"); the fix rounds caught up. Check wave ordering before WP23b.
- **Art**: every sprite and background layer is PixelLab Pro in one locked palette from one style
  anchor, curated by an Opus reviewer; seams fixed; ground/pylons hazed for depth.

## Verification
- `npm run typecheck` clean · `npm test` 3732 pass, 16 skipped (126 files; WP22 merged) · `npm run verify` (typecheck, test, build, bundle budget) · `npm run build` clean
  (app 82 KB, phaser chunk 1.48 MB, warning limit 1500 KB).
- Playwright smokes (scripts/smoke): crank, tech tree, persistence/offline/corrupt/mute/reset,
  full machine → Generator Blueprint, unlock stages (scripts/smoke/stages.mjs). 0 console errors.
- Balance (greedy 4 clicks/s): Worn Motor 0:13, Reinforced Crank 3:16, Piston Array 12:02,
  Generator Blueprint 22:06.

## Balance (greedy harness, fast profile)
Era I: blueprint 22:06 · Era II: substation 60:23/72:52/148:28 · Era III (A/B/C): vessel 110:36/124:01/255:01 · Era IV (A/B/C): convergence 166:30/181:33/339:41 · Era V (A/B/C): primaryFunction 249:31/264:00/428:30 (WP17).
Energy continuity (A): dead time before PF me/ee/pr/rs 1.3/0.3/2.6/4.5 min; era V spend share 99/100/90/81 %.

## Known issues
- Pylon cables peak slightly at tile seams (art; minor).
- Audio verified by code review only (no audible check in CI).
- Thin cloud streaks behind the sun (cosmetic, accepted).
- Some WP6 parts (gears, pulleys, yoke) are hand-pixelled to exact geometry rather than PixelLab output.
- Phaser chunk >500 KB by nature; warning limit raised rather than removed.
- App chunk ~260 KB (target relaxed 200→300 KB: era II–V data); lazy-loading era data deferred.

## Important technical decisions
- Art Director agent (`.claude/agents/art-director.md`, Opus) owns visual/mechanical correctness;
  audit + fix log in docs/plan/ART_AUDIT.md; tools in scripts/art and scripts/smoke.
- Rotating parts use RotSprite sheets (`<id>#rot`, frame = rotationFrame(deg, N)); gear sheets 140/80
  frames keep the 1.75 ratio exact. Regenerate with scripts/art/make_rot.py.
- Phaser pinned to 3.90.0 (npm `latest` is Phaser 4). No `override` on create/preload/init; `update` requires it.
- Vitest ^5 (advisories in 3.x). Node ≥22.12 required by Vitest 5.
- Production: `perClick = Σ clickAdd·lvl × Π clickMult^lvl`; `perSecond = Σ autoAdd·lvl × (1 + Σ autoPct·lvl/100)`.
- Cost `ceil(base × growth^level − 1e-9)`, shown with `formatCost` (rounds up).
- **Balance deviation:** spec §6 costs were initial targets; retuned in `src/data/technologies.ts`
  (e.g. Generator Blueprint needs 200K lifetime ME) for a 15–30 min first session. Documented in README.
- `GameSession` is the only gateway for UI; immutable snapshots. Boot: load → session → applyOffline →
  save → loop. `update()` gaps >60 s route through the reported offline path.
- Machine coordinates: machine-local art px, PIXEL_SCALE 2; texture key = asset id.
- Phaser also listens to window mouse events → WorldScene disables input while any modal is open.
- `session.revision` bumps every frame → UI uses events/reference checks for heavy rebuilds.
- Agents: native project agents load at session start; in the creating session roles ran as
  `general-purpose` with model overrides. Verified models: planner/reviewer `claude-opus-5-5`,
  EM `claude-sonnet-5-5`, workers `claude-haiku-5-5`.

## Next recommended task
User directive 2026-10-24 (after v0.9.0 demo release-ready): parts must visibly evolve as they level (3/5 phases), and the lonely scene gets a
living world whose denizens change per era and break the fourth wall (docs/plan/STORY_BIBLE.md, PART_TIERS.md, DENIZEN_ART.md, WP22.md, WP23.md;
GAME_SPEC §18.2). Seed commit 0fab65c on main. WP22 is merged (e5b97c4). Next: resume WP23a (wp-exec run wf_b2535911-eb6, same args)
in wedtmd-shell, one workflow at a time (user shares the PC), then merge main into it (shared files per WP23.md §0, WP22 blocks first),
X1 tier-port wiring, validate merged tree, merge; then WP23b, then §R (store shots, STEAM_RELEASE §15, soak, packaged smokes, CHANGELOG).
Still user-owned for the Steam upload: real app/depot ids, capsule art, trailer, SteamPipe upload (STEAM_RELEASE sections 4, 10, 12).

### Previous (v0.9.0 demo)
Roadmap complete. v0.9.0 demo is release-ready. Remaining steps need the user (Steamworks account):
1. Real Steam ids for placeholders full app `0000000` / depot `0000001`, demo app `0000002` / depot `0000003`: wishlist target
   in `src/data/edition.ts` `STEAM_STORE`; create `steam/*.vdf` from the docs/STEAM_RELEASE.md section 4 templates (not in repo yet).
2. Capsule art (section 10 sizes; recipe: logo.png ×4/×5 nearest-neighbour on a clean store shot) and a 1080p60 trailer (OBS).
3. SteamPipe upload to a beta branch, test from the Steam client (Auto-Cloud, Deck), set live (section 12).
Optional post-demo: SAVE feedback briefly clips the SYSTEM footer at UI 150 on web (AD R2-N1, S3):
`#sys-feedback:not(:empty) + #sys-footer { margin-top: 0; }`.
Budgets: app raw 460 KB (full 402.8, demo 404.8), css 44 KB (full 40.0, demo 42.8 incl. lazy END card css; WP21 D10 sign-off).
Final machine shots (3840×2160, AD RELEASE-READY) and demo teaser/END card shots sent to the user on 2026-10-23.
