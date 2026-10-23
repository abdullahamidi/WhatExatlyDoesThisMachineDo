# Steam Demo Program — Director decisions (2026-10-23)

User request (2026-10-23): "Polish the game to prepare a Steam demo release, show me the machine's last version at the end
of the game, and make sure every energy type is still used after the era changes."

Evidence: five read-only audits + completeness critic (session scratchpad `audit/*.json`, summarised here). Baseline HEAD
00a06d4: typecheck clean, 73 files / 2274 tests, build OK, smokes wp2/wp3/wp12/stages green.

## D — Decisions (these win over older plan docs)

### D1 Energy continuity (user ask 3)
Rule: **for every resource r and every era e after r's era (II..V), at least one tech of era e is priced in r**, and in
greedy profile A every resource's last useful purchase is ≤ 5 min before `primaryFunction` (PF).
Measured gaps at HEAD (greedy A): EE has no sink after 195:33 (59 min dead), PR none after 234:57 (20 min dead); era V
spends 9 % of EE and 39 % of PR produced; stocks at PF EE 2.24B, PR 1.67B. Existing cross-era sinks are flat `autoAdd`
(worth < 1 % of frontier/s late = trap-like).
Design ("Legacy Feeds", measured V2 in scratch harness: all balance.sim windows pass, PF 244:01 A / 258:30 B / 423:30 C):
| id | name | era | costRes | base | growth / max | effect | requires | tree |
|---|---|---|---|---|---|---|---|---|
| bellowsDrive (new) | Bellows Drive | 3 | me | planner tunes | 1.4 / uncapped | autoPct pr (planner tunes) | boiler | free row-2 cell |
| gridExciter | Grid Exciter | 4 | ee | 2e6 | 1.4 / uncapped | autoPct rs +8 | resonatorSpire | (3,2) |
| mainsBackfeed | Mains Backfeed | 5 | ee | 2e7 | 1.4 / uncapped | autoPct xf +6 | nullChamber | (3,2) |
| steamLance | Steam Lance | 5 | pr | 5e6 | 1.4 / uncapped | autoPct xf +6 | nullChamber | (4,2) |
| resonantSiphon (change) | — | 5 | rs | — | — | add effect autoPct xf +5 | — | — |
- Era III ME sink (`bellowsDrive`, name/numbers planner's call) closes the ME/era III cell; tune so vessel stays in its
  window (6300–8100 s). Era I EXACT times and era I/II windows must not move.
- Legacy techs are **uncapped** repeatables (growth ≥ 1.4) so postgame keeps EE/PR sinks; relax the
  "repeatable maxLevel non-null" test to "null or ≥ 1"; UI already renders `LV n/∞`.
- Guard tests: (a) data: the lower-triangular cost matrix above is complete; (b) sim (profile A): era V spend share
  ≥ 75 % for me/ee/pr/rs and per-resource dead time before PF ≤ 5 min; (c) all existing windows pass; PF stays in
  230–290 min (optionally retune PF cost so A ≈ 250 min).
- Each legacy tech gets a **visible part + link into the core** (procedural fallback painter first, PixelLab later):
  exciter feed (cyan cable mast→spire), backfeed (cyan cable up to the null gallery), steam lance (steam riser pipe up
  the spire + a `lance` steam emitter driven by PR/s), bellows (ME-driven bellows at the boiler/firebox).
  The finished machine then visibly shows every energy feeding the core.
- Visual drivers re-fit so saturation is ≥ 3× the PF rate (transformer, gauge maxLog, turbine, chimney smoke, nullCore,
  ring beads); optional `hz` speed curve for frame-cycle parts (flash parts stay ≤ 3 Hz); wire or delete the dead
  per-component `effects` data; generator gets an EE-driven glow.
- Copy: crankServo effect text "+N auto-cranks/s — each yields a full click of every energy".
- Audio parts of the energy work (maxPerSecond retune, purchase cue keyed by `RESOURCES[costRes].era`, bedTrim wiring)
  belong to WP15 T4 (audio files), not WP17.

### D2 HUD and gain text (one spec)
- Pure `currentEra(techLevels): 1..5` in `src/simulation` (highest owned keystone generator/boiler/resonatorSpire/
  nullChamber); used by HUD title, music theme, bed trims (replace planned audioMath copy; MUSIC.keystones may map to it).
- HUD title from a data table: `ERA I · MECHANICAL`, `ERA II · ELECTRICAL`, `ERA III · PRESSURE`, `ERA IV · RESONANCE`,
  `ERA V · ???` (reveal-aware: after reveal the xf name), postgame/choice `RESTORATION ENGINE`.
- Every resource row: SHORT · stock · visible rate `/s` · feeds hint (`›PR`) derived from `RESOURCES[].source`; frontier
  row emphasised (big font) instead of ME; per-click row shows the frontier resource (ME per click secondary);
  `AUTO-CRANK n/s` line once crankServo owned. Stocks: integer below 1000; rates 1 decimal only below 10.
- Crank gain text: one line per active resource, newest era on top, tinted per resource accent, clicks within ~300 ms
  merge into the rising block, font compensated by camera zoom (≥ 14 screen px), spawn clear of the frame beam and the
  name plate. Servo auto-cranks spawn no text.

### D3 Final machine showcase (user ask 2)
- Finale "completion" beat: during the ending (sequence/choice/postgame) the machine renders at **display levels** =
  max(real, visualMax) where `visualMaxLevels()` is DERIVED from MACHINE_COMPONENTS gates (never hand-listed), stepped
  era III→IV→V in S1 (t ≈ 3/4.5/6 s); reset clears the override.
- "Survey" camera move in the idle S3 window (≈ t 38.5–49.3): baseL → baseR → full; skipped under reduced motion.
- Machine is named: postgame HUD title `RESTORATION ENGINE`; finale name plate stays.
- One canonical postgame "portrait" pose (FULL view) for live KEEP and reload; postgame **VIEW MACHINE** photo mode
  (hide HUD/DOM, free pan/zoom, Esc exits) — doubles as store-screenshot mode.
- `MachineSource` type-only interface narrowing MachineView/MachineAnimator/ApertureBeam/SteamFx/Eclipse; reusable
  `ShowcaseScene` (same Phaser game, own camera, stand-in source) for the demo teaser.
- Art Director decides whether postgame gets a restored-machine accent (core violet→white, lamps lit).
- Deliverable to the user: 3840×2160 screenshots of the 100 %-complete machine (era V ruined world + postgame restored)
  and finale keyframes, sent with SendUserFile.

### D4 Edition / demo
- Vite mode `demo` (`vite build --mode demo`, `npm run build:demo`); pure `src/data/edition.ts`:
  `EDITIONS.full | EDITIONS.demo = { id, demo, capTech: 'substationBlueprint', maxEra: 2, storeUrl, steamUrl,
  feedbackUrl, label: 'DEMO' }` + pure `editionFor(mode)`; bootstrap passes the edition in. App id placeholder `0000000`.
- Simulation gate (pure, tested): in demo, purchases of era > maxEra are refused (reason `demo`); load/import clamps
  levels of era > maxEra to 0 (original string kept); tree era III+ tabs read `FULL GAME`.
- Demo end: on the capTech milestone (+4 s) → ShowcaseScene teaser (era II machine → parts fly in era III→IV→V →
  boost, aperture opens, violet world, name redacted e.g. `PRIMARY FUNCTION: R?S????`) → DOM end card
  `END OF DEMO — THE MACHINE IS NOT FINISHED.` [WISHLIST ON STEAM] [KEEP TINKERING] [QUIT] (+ optional feedback link);
  never show RESTORATION ENGINE or the restored sky. Boot with the milestone owned → end card directly.
- Demo hides later-era achievements, MEMORY tab, new-cycle rows. Sim test asserts the cap time for profiles A/B/C/new
  player (A ≈ 60 min, C ≈ 148 min) so balance changes cannot silently stretch the demo.

### D5 Steam desktop shell
- Electron **44.7.0** (pinned exact), `@electron/packager` 20.3.0, `@electron/fuses` 2.1.3 (devDependencies).
  `desktop/main.cjs` + `desktop/preload.cjs`; `app://` privileged protocol serving the built `dist` with a path guard +
  CSP header; single instance; no app menu; F11 / Alt+Enter fullscreen; window bounds persisted; devtools off when
  packaged; `shell.openExternal` allowlist (store.steampowered.com, steam://); zoom shortcuts blocked; fuses flipped.
  `npm run build:steam` (full) / `npm run build:steam-demo` → `out/steam/<edition>/win-x64/` (depot ContentRoot).
- Saves: `hostStorage` (sync-loaded cache + debounced atomic file writes in `userData/saves/*.json`, `.bak`, flush on
  quit/hide) when `window.wedtmdHost` exists, else localStorage; one-time import from localStorage; visible warning
  when saves fall back to memory. Steam Auto-Cloud path documented.
- Robustness: crash overlay (`THE MACHINE STALLED`, save attempt, COPY REPORT / RELOAD / QUIT), window error +
  unhandledrejection handlers, try/catch around bootstrap; renderer log file in Electron.
- Presentation: inline splash with load progress (index.html + BootScene progress), title screen (CONTINUE / NEW GAME /
  SETTINGS / CREDITS / QUIT) over the dimmed live world, QUIT TO DESKTOP row in SYSTEM tab (host only), CREDITS
  (Phaser MIT, Electron/Chromium, PixelLab-assisted art, synth audio) + THIRD_PARTY_NOTICES.txt, app icon/favicon,
  `disableContextMenu`, FPS cap 60 (data constant), fullscreen toggle in SETTINGS (host + web).
- Display: `#ui-root` anchored to the canvas rect and scaled by canvas height (`--ui-zoom`), panels use
  `calc(vh / var(--ui-zoom))` so UI scale 150 % never clips at 1280×720/1280×800; themed letterbox fill.
  Render-scale crispness at 1080p and Scale.EXPAND are a later display-quality package (not demo-blocking).
- Debug hook gated: `debugEnabled(search, dev)` (`?debug`, `?debug=1`; `debug=0` off; dev on); never in packaged host.
- Version `APP_VERSION` from package.json (bump to 0.9.0), footer `v0.9.0 · DEMO · SAVE v2`, title screen line.
- `docs/STEAM_RELEASE.md`: depot/app build VDF templates, steamcmd command, Auto-Cloud, AI-content disclosure draft,
  Steam Input template (A crank, Y tree, Start menu…), store asset checklist, Proton/Deck/Linux notes.
- Steamworks SDK, native gamepad, Linux depot validation: out of scope for the demo (documented).

### D6 First-impression UX (demo-critical, after D1–D3 land)
Part fly-in no longer hidden behind the tree (queue assembly until the tree closes + camera nudge; install flavor line
in tree feedback; toasts above backdrop), onboarding prompt (`> TURN THE CRANK [CLICK / SPACE]`) + TECH INDEX
affordable badge, Space no longer closes the tree (focus selected node / PURCHASE), tree fits ≤ 1140 px + scroll
selected into view + default selection prefers keystones/primaryFunction, next-goal line, tab affordable counts, era
cards on keystones, level-toast coalescing, menu fixed height + themed radios + prestige UI hidden until relevant,
number formatting, text sweep (TECH INDEX, ×, …, US spelling, Servo Chorus level 10, cycle number), click juice.
Era I costs stay (EXACT test) — early dead zone is fixed by visual stages on existing repeatables only.

### D7 WP15 remainder (music / mix / perf)
Keep WP15 T2–T5 + EM decisions 1–7; T4 also owns D1's audio items. T6: formally close + move the boot mark into an
inline script in index.html. T7: re-measure with GPU flags on this machine (headed or `--use-angle=d3d11 --enable-gpu`)
in idle and 0–3 s post-purchase windows; fix only what spikes. T9 perf smoke uses GPU flags; bundle budget asserts raw
sizes only, app chunk ≤ 400 KB.

### D8 Release verification (slim WP16)
Pure full-run e2e, save compat fixtures (incl. pre-legacy-tech save), balance sign-off table (+ demo cap timings),
browser e2e (full + demo), a11y + resolutions (1280×720/800, 1920×1080, 2560×1440, 3440×1440) smokes, soak smoke
(30–60 min, heap/display objects/toasts flat), final Art Director audit (incl. 1080p and Deck), ASSET_GUIDE refresh +
guard test, README / CHANGELOG / STEAM_RELEASE / GAME_SPEC §18, store screenshot script (3840×2160, HUD-free option).

## Sequencing
Two tracks with disjoint files, merged by the Director:
- **Track A (main tree):** WP17 energy continuity + HUD (D1, D2) → A17 art for legacy parts → WP18 final machine
  showcase (D3) → WP20 first-impression UX (D6, after merging track B).
- **Track B (worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/steam-shell`):** WP19 Steam shell (D5) → WP15
  remainder (D7).
- Then WP21 demo edition (D4, needs WP18 ShowcaseScene + WP19 shell) → WP16 release verification (D8) → screenshots to
  the user.

## Environment (Windows)
Repo `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo` (quote paths; non-ASCII). Git Bash. Playwright:
`PW_PATH=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`. Preview: `npm run build` then
`npx vite preview --port 4173 --strictPort` (track B uses port 4174). Smoke outdirs: absolute Windows paths (no `/tmp`).
GPU perf flags: `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`.
