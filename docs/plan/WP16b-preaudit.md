# WP16b pre-audit — Art Director on the WP16a store shots (2026-10-23, HEAD 7b8bdbd)

Shots: `scripts/smoke/store-shots.mjs` set (9 scenes × hud/clean, 1920×1080 and 3840×2160). 2160 = crisp 2× of 1080,
so every 1080 verdict holds for 2160. Evidence crops: scratchpad `ad16b/` (band-era1, band-finale, logo-x4,
mock-band-plain-04, gains-x3, 2160-title-tl/br).

## Validation notes checked
1. WELCOME BACK toast in 02/04 HUD shots — confirmed (8 h simulated jumps in the script).
2. Title (10): HUD visible behind the title — confirmed. "Buttons not dimmed" — rejected (all dimmed ≈×0.47).
3. Flat grey band between skyline and ground — confirmed, a **game** bug: far-ridge/skyline art have solid grey rows
   below their ground line (111,107,98); visible whenever the camera sits above default (Era III+: ~80 px in 04-hud,
   ~170 px in 07-hud, up to 230 px in clean shots); background pylons float on it. Finale green variant reads as fields (OK).

## A. Per-shot verdict
| Shot | Verdict | Why |
|---|---|---|
| 01-hud | STORE-READY (backup) | bare frame, low interest |
| 01-clean | DROP | tiny machine, empty frame, band |
| 02-hud | FIX | toast |
| 02-clean | FIX | clean shots use final-machine framing → small off-centre machine; band |
| 03-hud | STORE-READY | milestone toast adds story |
| 03-clean | FIX | framing, band |
| 04-hud | FIX | toast, 80 px band |
| 04-clean | FIX | band, top 55 % empty sky |
| 05-tree | FIX | HUD fragments at left and bottom-right edges |
| 06-hud | STORE-READY | band mostly hidden by machine |
| 06-clean | FIX | band, ~300 px empty sky |
| 07-hud | FIX | 170 px band under background pylons |
| 07-clean | FIX | hero shot once band fixed |
| 08-hud | DROP | "PRIMARY FUNCTION: RESTORE" answers the title question; half-empty box; SKIP visible |
| 08-clean | DROP | near-duplicate of 09-clean |
| 09-hud | DROP | HUD reads RESTORATION ENGINE / PRIMARY FUNCTION: RESTORE (spoiler) |
| 09-clean | STORE-READY | payoff without stating the answer |
| 10-title | FIX | HUD behind title, version string, flat logo |

## B. Fix list
- **F1 major, script** (`scripts/smoke/store-shots.mjs`): `hudShot` option `keepToasts` (default false): before
  `writeShot` set `#toast-stack` `style.visibility='hidden'`, restore in `finally`. Stem 03 passes `keepToasts: true`.
- **F2 major, script**: stems 01–04 and 06 take the clean shot FIRST via `uiRootHiddenShot` (live camera framing on the
  current machine, no leftover gain text), then the HUD shot. Stems 07 and 09 keep photo-mode `cleanShot`.
- **F3 major, game** (`src/ui/titleScreen.css`), append:
  `#ui-root:has(> #title-screen.is-open) > :is(#hud-panel, #hud-buttons, #toast-stack) { visibility: hidden; }`
  Script: hide `#title-version` before shot 10.
- **F4 minor, script**: stem 05 hides `#hud-panel`, `#hud-buttons`, `#toast-stack` (visibility) before the shot, restores
  after. Optional game version in `src/ui/hud.css` keyed on `#tech-overlay.is-open` (after WP21: tree is WP21-owned).
- **F5 major, game art + data**:
  - `public/assets/bg/mountains.png` rows 156–255: replace solid #5a5f63 with a 4-step far-plain ramp top→bottom
    dirtyBeige a8957a → skyTop 7a7468 → industrialGray 5a5f63 → grayDark 2b2e31, sparse 1-art-px darker dashes 3–12 px,
    tileable on x.
  - `public/assets/bg/skyline.png` rows 220–319: transparent.
  - `src/data/world.ts` mountains `underfill: PALETTE.grayDark`; skyline `underfill: null`; `src/data/world.test.ts`
    expectations to match (0x2b2e31 / null).
  - `docs/ASSET_GUIDE.md` rows for mountains/skyline: note "rows below ground line = far plain".
  - Optional: 1 px contact pads under pylon feet (`pylons.png`, `pylons-lit.png`).
  - Fallback if no art: lock background layers vertically (`setScrollFactor(sf, 1)`) — parallax.ts,
    ParallaxBackground.ts, pylonLine.ts, PylonLine.ts + tests.
- **F6 major polish, game asset** `public/assets/ui/logo.png` (keep 230×50): 1 px bevel lit upper-left, 2×2 rivets with
  highlight, rust streaks below rivets, stamped-brass letters (top-edge highlight, 1 px inner shade). Current plate: 9
  colours, flat grey, stray rust flecks — reads as placeholder.
- **F7 minor, script (press kit only)**: finale shot with all text typed via `finaleSeek(≈63.4)` (buttons ≈63.7 — verify).
- **After WP21**: toast styling, guidance prompt clutter in 01-hud, tech-tree empty lower-right area, F4 game version.

## C. Steam store top 5 (in order)
1. 07-era5-ruined-clean — recapture after F5 (photo-mode framing: full tower, beam, eclipse).
2. 06-era4-spire-hud — recapture with F1 (four-resource economy + spire).
3. 03-era2-generator-hud — as is (wide machine, cyan EE, "NO RESPONSE FROM GRID" hook).
4. 05-tree-era3-hud — recapture with F4 (systems shot).
5. 09-postgame-portrait-clean — restored-world payoff (mild spoiler). No-reveal alternative: 04-era3-boiler-hud with F1+F5.
Title shot is not a store screenshot (Steam wants gameplay); use the F6 logo for capsule art.

## D. First-impression risks
Grey band + floating pylons (reads as missing background); HUD behind title and around tree edges; WELCOME BACK
"unattended 8h" toast (reads as AFK/debug); placeholder logo plate; 08/09-hud spoil the title question (keep off store);
eras I–IV share the sepia background (top 5 spreads across eras). Minor: system monospace HUD font (style choice, noted),
PR/RS gain text pale on haze, version string on title.
