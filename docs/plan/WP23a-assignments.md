# WP23a — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP23.md` (§0, §DD, Open product questions, whole WP23a part) + STORY_BIBLE.md + DENIZEN_ART.md + repo read at HEAD `0fab65c`.
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/world-wp23a`. Baseline: typecheck clean, 119 files / 3428 pass / 16 skipped, build OK, app 402.8 / demo 404.8 KB, css 40.0 / 42.8 KB (limit 45), displayObjects peak 76, bootMs 777.6.
Fence: WP22 (part tiers) runs in `C:/Users/sanan/wedtmd-art` on :4175/:4176 — never touch. :4174 serves this worktree's `dist/` (rebuild only, never start/stop). Demo preview only on :4177 (start when needed, kill after). Never touch :4173/:4175/:4176. Nobody commits; never stage `package-lock.json`.
`<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP23a` (dirs `tools/ val/ ad/` exist; `tools/eol.mjs` = line-ending helper `crlf|lf|check`). `<PW>` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`.
Director decisions that win over the plan: all §DD rows and Q1-Q7 defaults stand (keep GRL-02 local-hour line, no teaser cameo, people in the restored world later in WP23b, no interim release). Q6 gate: era I -> II entry must add at least one NEW background-scale change noticeable at the default camera at 1920x1080; the AD proves it with before/after pairs (AD2). Text is English, exactly STORY_BIBLE §5.2. Art is Opus Art Director only. Release refresh (store shots, STEAM_RELEASE, CHANGELOG, PROJECT_STATUS) is not WP23a. X1 (tier port wiring) and T16 wait for the WP22 merge and are not decomposed here.

## EM decisions / deviations from the plan (these WIN for workers)
1. **Waves expanded W1-W7 (+ gate W8, AD2 W9, T15 W10, AD2b W11).** Several plan tasks were bigger than one Haiku pass and were split: T1 -> T1a data (W1) + T1b tests (W2); T4 -> T4a placement (W2), T4b bubble+glance (W3), T4c playback+turn (W3), T4d visual state + rows (W4); T5 -> T5a rules (W3) + T5b scheduler (W4); T10 -> T10s silence/toast/tier (W5), T10c bubble controller (W5), T10a director (W6); T11 -> T11b (W6) + T11a (W7); T13 -> T13a + T13b (W7). AD1 is four AD tasks (AD-a..AD-d, W1-W4), one per wave.
2. **T2 also lands the audio signal hunk** (`WorldSound` type in `context.ts`, `feedback.worldSound` created in `bootstrap.ts`, one line in `gameAudio.test.ts createFeedback`) so nothing waits on T6. T6 does NOT edit `context.ts` / `bootstrap.ts`.
3. **T3 extra files:** `saveManager.ts` (its error-path `LoadResult` literal needs `world`), `src/simulation/worldSave.ts` (`normalizeWorld`; lives in simulation so `GameSession` never imports persistence) and `src/simulation/index.ts` (one export line). `schema.readWorld` delegates to `normalizeWorld`.
4. **Scheduler API** (T5a/T5b): `offer(offer, ctx)`, `tick(ctx)`, `shown(id, fraction, ctx): WorldSaveState | null` (returns the new save block when the line counted as seen), `interrupt(reason, ctx)`, `force(id, ctx)` (debug `worldSay`), `reset()`, `state()`. Time comes from `ctx.nowMs` (not a separate `tick(nowMs, ctx)` argument). Rules live in `worldVoiceRules.ts` (T5a), assembly in `worldVoice.ts` (T5b).
5. **Renderer split:** `LivingWorld.ts` = inspector, dog, crow, Sensor 7 (tripod + head + LED + readout) + shadows + turn/glance/failedSync/tapeFreeze/notice/ripple effects. `WorldProps.ts` = girl (window, mini), payphone booth + receiver + tally marks, street lamp + glow + ash motes, clock + hands, stake + chain, hole, scraps, six lit windows. The hold image is `WorldVisualState.dogPose = 'lie'` (no `holdImage()` method). `headAnchor` became `anchor(id, cam): SpeakerAnchor | null` in GAME px. One container per ground row, created once by the director via `createWorldRows` (T4d), shared by both renderers (depth offsets in data).
6. **Bubble geometry is in root CSS px** (`#ui-root` zoom does the scaling). CSS `max-width` stays 200 px; on screen that is 200/250/300 px at UI 100/125/150 (`bubbleMaxWidth(uiScale)` returns the on-screen px). `placeBubble(head, feet, size, reserved, viewport)` takes head and feet points (no uiScale argument).
7. **Q6 tuning room:** `WORLD_ENV.windowGlow` (rectangle halo behind each lit window: `padArtPx`, `alpha`, `color`) and the other `WORLD_ENV` / `WORLD_FAR_PLANES.windows` numbers are the AD's allowed tuning keys (AD2 edits them directly, runs `npx vitest run src/data/livingWorld.test.ts`). Placements and code go through the F-list -> T15.
8. **Far-plane literals computed by the EM at e1** (`parallaxStrip` + `patternShift`, skyline sf 0.3 period 1024, pylons sf 0.55 period 512): skyline tile instance k=2 (tile origin strip x 768, top y 428; the girl window art (306,106) lands at strip (1380,640) = screen (996,292) at e1); pylon instance k=2 (origin x 576, top y 846; foot art x 192, foot row y 157 -> strip (960,1160) = screen (256,522) at e1, 177 at s8, 240 at s9: never in the centre third). T4a recomputes and compares.
9. **Poses recomputed:** e1 zoom 1 centre (1920,1520) view 1280-2560; s8 zoom 1 centre (2064,1464) view 1424-2704 machine 1576-2552; s9 zoom 0.75 centre (2192,1504) view 1339-3045 machine 1576-2808. These equal DENIZEN_ART §3. Crank hub world (1920,1568).
10. **Art hand-offs:** 16 PNGs ship in WP23a; `clipboardPages, redBall, lantern, puddle, sprout, page, virga` stay `file: null` (fallback painters) until WP23b; `world.shadow` is procedural forever. Cells needed only by later eras hold a COPY of the idle frame (listed in `scripts/art/world/README.md`). AD-b/c/d wire `file:` in `manifest.ts` + the ASSET_GUIDE rows for the PNGs they delivered (and AD-a's). The `src/assets/worldSheets.test.ts` PNG gate (T7) enforces dims, RGBA, alpha 0/255, palette-only.
11. **Transient hooks:** T7 sets every new manifest `file` to `null` in W1; the manifest test requires a disk file for every non-null `file`, so the AD sets `file` only after the PNG exists.
12. **Hard-silence reason strings** (data `WORLD_SILENCE`, priority order): `quiet, layer-hidden, asleep, tab-hidden, photo, finale, cycle, teaser, demo-card, tech-index, modal, era-card, onboarding`.

## Waves
| Wave | Units | Gate after |
|---|---|---|
| 1 | **T1a** world data, **T2** WORLD VOICES setting + audio signal hunk, **T7** asset registry, **AD-a** (style re-anchor, toolchain, Inspector sheet, window overlay) | tsc clean |
| 2 | **T1b** data tests + textSweep, **T3** save block + session, **T4a** placement maths, **AD-b** (dog, stake, hole, scraps, mote + manifest wiring of AD-a/AD-b) | tsc clean |
| 3 | **T4b** bubble + glance maths, **T4c** playback + turn + tally maths, **T5a** scheduler rules, **AD-c** (crow, girl, mini, window, booth, receiver + wiring) | tsc clean |
| 4 | **T4d** visual state + rows, **T5b** scheduler, **T9** bubble DOM view, **AD-d** (lamp, glow, clock, Sensor 7 + final wiring + gates) | tsc clean |
| 5 | **T8a** cast renderer, **T8b** props renderer, **T10s** silence + toast gate + tier tracker, **T10c** bubble controller | tsc clean |
| 6 | **T10a** director, **T6** world audio, **T12** world.mjs + README, **T11b** systemLog + demoEnd hooks | tsc clean |
| 7 | **T11a** WorldScene + bootstrap + debugHook wiring, **T13a** store-shots + demo.mjs, **T13b** a11y + ux + resolutions | EM gate |
| 8 | **T14 EM gate** (not a worker; commands below) | Fails -> owner tasks |
| 9 | **AD2** in-game audit on the T14 build (verdict + F-list in ART_AUDIT) | Director reads verdict |
| 10 | **T15** AD-listed fixes (conditional) -> EM rebuild | |
| 11 | **AD2b** round 2 (conditional) | RELEASE-READY or back to W10 |

Deferred (not decomposed): **X1** tier port wiring + `worldTierPort.ts` + world.mjs case H, **T16** review + Mode B, after the WP22 merge.

### Allowed transient tsc errors
None expected at the end of any wave (a wave's consumers import only files from earlier waves). Inside a wave, errors in a sibling's half-written file may appear: re-run typecheck at the end. W7 only: `WorldScene` imports `LivingWorldDirector` (done in W6).

## File ownership (exclusive per wave; later waves may re-own)
| Task | Files |
|---|---|
| T1a | `src/data/livingWorld.ts` |
| T2 | `src/data/types.ts` (`WorldVoices`, `SettingsState.worldVoices` only), `src/data/settings.ts`, `src/simulation/settings.ts`, `src/simulation/settings.test.ts`, `src/ui/menu/settingsView.ts`, `settingsView.test.ts`, `settingsPanel.ts`, `src/persistence/compat.test.ts` (lossless rule), `src/persistence/persistence.test.ts` (only if a settings literal breaks), `src/game/context.ts`, `src/game/bootstrap.ts` (one hunk), `src/audio/gameAudio.test.ts` (`createFeedback` only) |
| T7 | `src/assets/assetIds.ts`, `manifest.ts`, `manifest.test.ts`, `fallbackTextures.ts`, `assetGuide.test.ts`, `painters/world.ts`, `painters/world.test.ts`, `worldSheets.test.ts` (new), `docs/ASSET_GUIDE.md` |
| AD-a | `public/assets/world/inspector.png`, `public/assets/bg/window-lit.png`, `scripts/art/world/**`, `docs/plan/ART_BRIEF.md` (style re-anchor), `<O>/ad/**` |
| T1b | `src/data/livingWorld.test.ts`, `src/data/textSweep.test.ts` |
| T3 | `src/data/types.ts` (`SaveEnvelope.world`, `LoadResult.world` only), `src/persistence/schema.ts`, `codec.ts`, `saveManager.ts`, `saveController.ts`, `startup.ts`, `compat.test.ts`, `persistence.test.ts`, `exchange.test.ts`, `saveController.test.ts`, `startup.test.ts`, `fixtures/v2-world.json`, `src/simulation/GameSession.ts`, `GameSession.world.test.ts`, `worldSave.ts`, `index.ts` |
| T4a | `src/game/math/worldPlacement.ts`, `worldPlacement.test.ts` |
| AD-b | `public/assets/world/{dog,stake-chain,hole,scraps,mote}.png`, `scripts/art/world/**`, `src/assets/manifest.ts` (`file:` values only), `docs/ASSET_GUIDE.md` (file cells) |
| T4b | `src/game/math/worldBubble.ts`, `worldBubble.test.ts`, `worldGlance.ts`, `worldGlance.test.ts` |
| T4c | `src/game/math/worldPlayback.ts`, `worldPlayback.test.ts`, `worldTurn.ts`, `worldTurn.test.ts` |
| T5a | `src/game/math/worldVoiceRules.ts`, `worldVoiceRules.test.ts` |
| AD-c | `public/assets/world/{crow,girl,girl-mini,girl-window,payphone,receiver}.png`, `scripts/art/world/**`, `manifest.ts` (`file:`), `docs/ASSET_GUIDE.md` |
| T4d | `src/game/math/worldState.ts`, `worldState.test.ts`, `src/game/rendering/worldRows.ts` |
| T5b | `src/game/math/worldVoice.ts`, `worldVoice.test.ts` |
| T9 | `src/ui/worldVoice.ts`, `worldVoice.css`, `worldVoiceModel.ts`, `worldVoiceModel.test.ts` |
| AD-d | `public/assets/world/{street-lamp,lamp-glow,street-clock,sensor7}.png`, `scripts/art/world/**`, `manifest.ts` (`file:`), `docs/ASSET_GUIDE.md` |
| T8a | `src/game/rendering/LivingWorld.ts` |
| T8b | `src/game/rendering/WorldProps.ts` |
| T10s | `src/game/math/worldSilence.ts`, `worldSilence.test.ts`, `worldTierRules.ts`, `worldTierRules.test.ts` |
| T10c | `src/ui/worldBubbleController.ts` |
| T10a | `src/game/rendering/LivingWorldDirector.ts` |
| T6 | `src/data/audio.ts`, `src/audio/synth.ts`, `src/audio/gameAudio.ts`, `src/audio/gameAudio.test.ts` |
| T12 | `scripts/smoke/world.mjs`, `scripts/smoke/README.md` (new section `## Living world (WP23a)` at the end) |
| T11b | `src/ui/systemLog.ts`, `src/ui/systemLogRules.test.ts`, `src/ui/demoEnd.ts` |
| T11a | `src/game/scenes/WorldScene.ts`, `src/game/bootstrap.ts`, `src/game/debugHook.ts` (after `cycleState` only) |
| T13a | `scripts/smoke/store-shots.mjs`, `scripts/smoke/demo.mjs`, `scripts/smoke/README.md` (append a subsection inside the T12 section) |
| T13b | `scripts/smoke/a11y.mjs`, `scripts/smoke/ux.mjs`, `scripts/smoke/resolutions.mjs` |
| AD2 / AD2b | `docs/plan/ART_AUDIT.md` (append `## WP23a — living world audit`), allowed data tuning keys in `src/data/livingWorld.ts` |
| T15 | only files named in the AD F-list (data in `livingWorld.ts` + its test, `worldVoice.css`) |

Forbidden for every worker: WP22-owned files (`MachineView.ts`, `MachineAnimator.ts`, `machineSource.ts`, `src/game/math/showcase.ts`, `machineComponents.ts`, `techTreeView.ts`, `notificationRules.ts`, `ShowcaseScene.ts`), `src/data/technologies.ts`, `src/ui/toasts.ts`, `package.json`, `package-lock.json`, `public/assets/**` (AD only), `scripts/art/**` (AD only), `docs/plan/ART_AUDIT.md`, `scripts/smoke/perf-budget.json`, `docs/PROJECT_STATUS.md`, `CHANGELOG.md`, `docs/STEAM_RELEASE.md`.

## Cross-task contracts (canonical; the prompts carry the parts each task needs)
```ts
// src/data/livingWorld.ts (T1a)  -- names only; values are in the T1a prompt
DenizenId, SpeakerId, GroundId, FramingKey('e1'|'s8'|'s9'), ChainId('crossedLines'|'postCap'), LineTrigger, WorldOffer, WorldLine, WorldSaveState,
DEFAULT_WORLD_SAVE, WORLD_LINES(31), WORLD_CHAINS, WORLD_BEATS, WORLD_KNOWN_IDS, LIVING_WORLD={maxEra:2}, WORLD_VOICE_CONFIG, WORLD_ERA_CAPS,
WORLD_GLANCE, WORLD_GLANCE_SEED, WORLD_PLACEMENTS, WORLD_ROWS, WORLD_DEPTH_OFFSETS, WORLD_FAR_PLANES, WORLD_SHADOW_WIDTHS, WORLD_A11Y_PREFIX, WORLD_BUBBLE,
WORLD_SILENCE, WorldSheetId, WORLD_FRAMES, WORLD_SHEET_KEYS, WORLD_ERA_ROW, WORLD_ERA_ROW_SHEETS, LoopFrame, WORLD_LOOPS, WORLD_PLAYBACK, WORLD_ENV,
WORLD_HOLE, WORLD_MARKS, WORLD_RIPPLES, WORLD_TIER_PROPS, WORLD_SWEEP
// src/game/math/worldPlacement.ts (T4a)
interface Rect { x; y; w; h }  interface SpeakerAnchor { head: Vec2; feet: Vec2 }   // GAME px
framingPose(levels): CameraPose; framingKey(levels): FramingKey; viewRectOf(pose): Rect; isOnScreen(p, view, insetWorldPx): boolean;
screenOfWorld(pt, sf, pose): Vec2; placeCast(levels, framing, pose?): Record<GroundId, WorldPlacement | null>;
unseenChangeOk({treeOpen, oldOnScreen, newOnScreen}): boolean; farPlaneLiterals()
// src/game/math/worldBubble.ts + worldGlance.ts (T4b)   (root CSS px)
BubbleSide; BubblePlacement {x,y,tailX,side,tailUp}; placeBubble(head, feet, size{w,h}, reserved: Rect[], viewport{w,h}): BubblePlacement | null;
bubbleDurationMs(text); bubbleMaxWidth(uiScale); GLANCE_TARGETS; glanceSchedule(k, seed, era: 1|2): {afterMs, denizen}
// src/game/math/worldPlayback.ts + worldTurn.ts (T4c)
PlaybackMode('crank'|'fps2'|'fps4'|'fps8'); playbackMode(levels, era); playbackFps(mode); castAlpha(levels, era); shadowScale(era);
createTapeClock(): {advance(dtMs, mode, crankSteps), tick(), freeze(ms), frozen(), reset()}; loopFrameAt(loop, tick, seam): LoopFrame;
sheetFrameIndex(sheet, name, eraRow): number; windowFlicker(k, seed): {holdMs, frame}; moteOrbit(i, tMs): {dx, dy}; sensorHead(sensorX, camCenterX);
tallyRects(count): Rect[]  // art px inside the pane
blipCount(text); talkTimeline(durationMs, reduced): TalkTimeline; talkPose(tMs, tl, blips); glanceTimeline(reduced); glancePose(tMs, tl); failedSyncSchedule(visible)
// src/game/math/worldVoiceRules.ts (T5a) + worldVoice.ts (T5b)
WorldSchedulerCtx; WorldCue {kind:'line'|'chainStep'|'beat'; ids; speakers; chainId?; step?}; createWorldScheduler(cfg?, lines?, chains?): WorldScheduler
WorldScheduler { offer(offer, ctx): void; tick(ctx): WorldCue|null; shown(id, fraction, ctx): WorldSaveState|null; interrupt(reason, ctx): void; force(id, ctx): WorldCue|null; reset(): void; state(): WorldSchedulerState }
// src/game/math/worldState.ts (T4d)
WorldStateInput; WorldVisualState; deriveWorldState(input): WorldVisualState;  src/game/rendering/worldRows.ts: WorldRows{back,front}; createWorldRows(scene)
// src/game/math/worldSilence.ts + worldTierRules.ts (T10s)
silenceReason(inputs): WorldSilence|null; createToastGate(cfg?): ToastGate; TierPort; STUB_TIER_PORT; createTierTracker(port): TierTracker
// src/ui/worldVoice.ts + worldVoiceModel.ts (T9), worldBubbleController.ts (T10c)
createWorldVoiceView(root): WorldVoiceView {measure, show, move, hide, visible, rect, text, announce, destroy}
createWorldBubbleController(deps): WorldBubbleController {show, update, hide, hideAll, visible, visibleMs, text, side, rect, destroy}
// src/game/rendering (T8a / T8b / T10a)
class LivingWorld { constructor(scene, rows, heartbeatLow); apply(state, placements, {reducedMotion}); update(dtMs, crankSteps, nowMs, cam); turnToCamera(id, kind); setTalking(id, on); release(id, holdMs);
  failedSync(); tapeFreeze(ms); notice(kind); ripple(era); anchor(id, cam): SpeakerAnchor|null; probe(); hideAll(); stats(); destroy() }
class WorldProps { constructor(scene, rows); apply(state, placements, {reducedMotion}); update(dtMs, crankSteps, nowMs); ripple(era); lampFlicker(); ring(); receiverLevel(on);
  tapeFreeze(ms); anchor(id: 'girl'|'payphone', cam): SpeakerAnchor|null; probe(); hideAll(); stats(); destroy() }
class LivingWorldDirector { constructor(deps); update(dtMs); onLogShown(id); onLogCleared(id); sysLogDefer(): boolean; onKeep(); onSleep(); onWake(); setTreeOpen(open); debug(): WorldDebugApi; destroy() }
// context.ts (T2)
type WorldSound = {kind:'blip'; speaker: SpeakerId; count: number; reversed: boolean} | {kind:'ring'} | {kind:'dialTone'; on: boolean}; GameFeedback.worldSound: Signal<WorldSound>
// synth (T6)  playBlip(voice: SpeakerId, count: number, reversed: boolean); playRing(); setDialTone(on: boolean);  GameAudioStats.worldBlips: number
// systemLog (T11b)  connectSystemLog(session, toasts, now?, hooks?: {defer?(): boolean; onShown?(id); onCleared?(id)});  DemoEndDeps.onKeep?: () => void
```

## Art hand-offs (Opus Art Director only; masters + sheets in `scripts/art/world/`, PNGs in `public/assets/`)
| After | PNG files that exist (exact size) | Manifest `file:` wired |
|---|---|---|
| AD-a (W1) | `world/inspector.png` 380x240, `bg/window-lit.png` 8x6 | no (T7 owns manifest in W1) |
| AD-b (W2) | `world/dog.png` 560x120, `world/stake-chain.png` 20x6, `world/hole.png` 64x6, `world/scraps.png` 24x4, `world/mote.png` 4x2 | inspector, windowLit, dog, stakeChain, hole, scraps, mote |
| AD-c (W3) | `world/crow.png` 240x108, `world/girl.png` 160x168, `world/girl-mini.png` 16x12, `world/girl-window.png` 16x6, `world/payphone.png` 168x312, `world/receiver.png` 48x72 | + crow, girl, girlMini, girlWindow, payphone, receiver |
| AD-d (W4) | `world/street-lamp.png` 48x60, `world/lamp-glow.png` 64x16, `world/street-clock.png` 32x44, `world/sensor7.png` 160x240 | + lamp, lampGlow, clock, sensor7 (all 16 wired) |
Era-row sheets (6 rows I, II, III, IV, V, whole; baked by `scripts/art/world/erarecolor.py`): inspector, dog, crow, girl, payphone, receiver, sensor7. File-null until WP23b: clipboardPages, redBall, lantern, puddle, sprout, page, virga; shadow is procedural.
Art-coordinate data the AD draws to (all in `src/data/livingWorld.ts`, AD may tune and must say so): `WORLD_MARKS.pane` (glass pane rect in the booth cell: x 6, y 8, 16x24), `WORLD_ENV.receiverArt`, `WORLD_ENV.sensor7.ledArt`, `WORLD_ENV.clock.faceCenterArt`, `WORLD_ENV.lampHeadArtPx`, `WORLD_ENV.crowLiftArtPx`, `WORLD_FAR_PLANES.windows`.

## Debug hook contract (C7, `window.__wedtmd`, after `cycleState`)
`worldState(): WorldDebugState | null`, `worldSay(id): boolean`, `worldQuiet(on)`, `worldAdvance(ms)`, `worldLogShown(logId)`, `worldClock(hour | null)`, `livingWorld(): { id, variant, x, visible, speaking }[]` (ids: inspector, dog, crow, sensor7, payphone, receiver, lamp, clock, girl; `variant` = current frame name or `window-flicker | window-dark | mini` for the girl; `x` = world px, 0 for plane props), `worldStats(): { objects, meanMs }`, `worldBubble(): { visible, rect, text, side } | null`.
`WorldDebugState = { era, framing, setting, quiet, hidden, silence, playMs, nowMs, blips, seen, seenEver, eraMoments, youEras, pending, chain, postCap, placements, activeLines }`.

## Smoke check registry
- `world.mjs` (T12): `A_frozen`, `A_crank_step`, `B_bubble`, `B_rects`, `B_live`, `B_aria`, `C_tree`, `C_card`, `C_photo`, `C_menu`, `D_s7_placed`, `D_s8_placed`, `D_s9_placed`, `E_rare`, `E_off`, `F_seen`, `F_no_repeat`, `G_display`, `G_cost`, `G_era3_hidden`.
- `demo.mjs` (T13a): `B_bubble_hidden_teaser`, `B_no_spoiler` (re-run with a bubble on screen), `G_freeze`, `G_pay05`, `G_ins07`, `G_grl06`, `G_dog12`, `G_hold`, `G_no_refreeze`.
- `a11y.mjs` (T13b): `W_live_region`, `W_bubble_aria_hidden`, `W_tab_walk_unchanged`. `ux.mjs`: `A_no_bubble_prompt`, `A_crank_point_unchanged`. `resolutions.mjs`: `<w>x<h>-150_bubble_inside`, `<w>x<h>-150_bubble_clear_hud`.
- `store-shots.mjs`: `worldQuiet(true)` before every stem; its checks are unchanged.

## T14 EM gate (W8; one Bash call per line; repo `C:/Users/sanan/wedtmd-shell`)
1. `npm run typecheck` -> clean
2. `npm test` -> 0 failed; pass >= 3428 + new (report the count)
3. `npx vitest run src/data/livingWorld.test.ts src/game/math src/persistence src/simulation/GameSession.world.test.ts src/simulation/settings.test.ts src/ui src/data/textSweep.test.ts src/assets src/audio/gameAudio.test.ts` -> pass
4. `grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/ui/worldVoiceModel.ts` -> empty (src/game/math has no Phaser)
5. `npm run build && node scripts/perf/bundle-budget.mjs` -> `bundle budget: PASS` (app <= 460 KB, css <= 45 KB); `npx esbuild src/ui/worldVoice.css --minify | wc -c` <= 1000; report app growth and publicAssetsKb growth (<= +100)
6. `npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS (css <= 45 KB)
7. previews: :4174 already serves `dist/` (re-read per request); demo: check `netstat -ano | grep ':4177 .*LISTENING'`, then background `npx vite preview --outDir dist-demo --port 4177 --strictPort`, poll HTTP 200
8. `PW_PATH="<PW>" node scripts/smoke/world.mjs "http://localhost:4174/?debug=1" "<O>/val/world"` -> `fail []`, `errors []`; same on `http://localhost:4177/?debug=1` (`<O>/val/world-demo`)
9. `... demo.mjs "http://localhost:4177/" "<O>/val/demo"` -> `fail []`, `errors []` (case G, `B_no_spoiler`)
10. `... a11y.mjs "http://localhost:4174/" "<O>/val/a11y"` (deferred `[]`), `... ux.mjs "http://localhost:4174/?debug=1" "<O>/val/ux"`, `... resolutions.mjs "http://localhost:4174/?debug=1" "<O>/val/res"` -> `fail []`, `errors []`
11. `... e2e-full.mjs "http://localhost:4174/" "<O>/val/e2e"`, `... finale.mjs`, `... showcase.mjs` (`?debug=1`) -> unchanged results, `errors []`
12. `... perf.mjs "http://localhost:4174/?debug=1" "<O>/val/perf"` -> `fail []` (uiMeanMs <= 2, bootMs <= 3000, displayObjects <= 100)
13. `SOAK_MIN=10 PW_PATH="<PW>" node scripts/smoke/soak.mjs "http://localhost:4174/" "<O>/val/soak"` -> `fail []`
14. `SIZES=1080 PW_PATH="<PW>" node scripts/smoke/store-shots.mjs "http://localhost:4174/" "<O>/val/store-1080"` -> `fail []`, `errors []`, 14 `_no_spoiler` true
15. stop :4177 (netstat + `taskkill //PID <pid> //T //F`); ports free afterwards
16. EM Reads: `<O>/val/world/world-A-s0.png`, `world-D-s7-150.png`, `world-D-s9-150.png`, the UI 150 bubble shots, the demo hold-image shot
17. `git diff --stat 0fab65c -- src/data/technologies.ts src/game/entities src/game/math/showcase.ts src/data/machineComponents.ts src/ui/techTreeView.ts src/ui/notificationRules.ts src/ui/toasts.ts src/game/scenes/ShowcaseScene.ts scripts/smoke/perf-budget.json` -> empty; `git status --porcelain` -> only task files (+ ` M package-lock.json`, never staged)
Fails go to the owning task (table above) as fix assignments, same format.

## Out of scope
Eras III-V states, lines, props and placements; finale, choice, postgame and cycle 2+ traces; the 2 optional machine logs; teaser cameo; answer-the-payphone; any machine part change; balance; save version bump; new full backgrounds (Q6 is met with overlays + tuning); a Toasts API; store set, STEAM_RELEASE, CHANGELOG, PROJECT_STATUS, commit, merge (Director); X1 and T16.

## Task summaries (full self-contained prompts are the `prompt` fields of the wave JSON)
- **T1a (W1)** `livingWorld.ts`: 31 lines (text verbatim from the validated bank), chains, beats, known ids, voice config, caps, glance, placements e1/s8/s9, rows, depth offsets, far-plane literals, sheet frame tables, loops, playback, env/hole/marks/ripple tables, silence reasons, sweep. Accept: tsc clean, no Phaser.
- **T2 (W1)** WORLD VOICES `on|rare|off` (type, default, lenient normalize, labels, radio row after UI SCALE, tests, compat lossless rule) + `WorldSound` type + `feedback.worldSound` signal + `createFeedback` line.
- **T7 (W1)** 25 asset ids (`world.*`, `bg.windowLit`, `bg.virga`), manifest entries (`file: null`, `eraRows`, exact frame sizes), generic ink-silhouette fallback painters, manifest/guide tests, `worldSheets.test.ts` PNG gate, ASSET_GUIDE rows. ASSET_IDS 117 -> 142.
- **AD-a..AD-d (W1-W4)** toolchain + 16 PNGs with six baked era rows, manifest/guide wiring, gates (score >= 90, lint 0/0, silhouette 1, palette-only, alpha 0/255), contact sheets and zoom 1 / 0.75 composites in `<O>/ad/`.
- **T1b (W2)** data rule tests (App. B, you-slot, plaque letters, placements vs DENIZEN_ART, config vs bible, frames vs manifest, chains, triggers vs SYSTEM_LOGS) + textSweep hook.
- **T3 (W2)** optional `world` save block (normalize, schema, codec, controller, startup, session carrier, fixtures, tests). SAVE_VERSION stays 2.
- **T4a (W2)** placement maths + far-plane recompute + stage tests.
- **T4b / T4c (W3)** bubble ladder + glance hash / playback, tape clock, turn timelines, tally marks.
- **T5a / T5b (W3 / W4)** scheduler rules / scheduler (chains, POST-CAP, force, reset, state).
- **T4d (W4)** `deriveWorldState` (+ hole rule, ladder) and `createWorldRows`. **T9 (W4)** bubble DOM view + CSS + model.
- **T8a / T8b (W5)** cast renderer / props renderer. **T10s (W5)** silence + toast gate + tier tracker. **T10c (W5)** bubble controller.
- **T10a (W6)** director. **T6 (W6)** blips, ring, dial tone. **T12 (W6)** `world.mjs`. **T11b (W6)** SYS LOG hooks + `onKeep`.
- **T11a (W7)** scene + bootstrap + debug hook wiring. **T13a / T13b (W7)** edits to the existing smokes.
- **T14 (W8)** EM gate. **AD2 / AD2b (W9 / W11)** in-game audit (s0, s2, s7, s8, s9, cycle 2 era I, demo hold image, teaser; 1280x720 UI 100/125/150, 1920x1080, Deck 1280x800 UI 150; every ladder case; turn/glance storyboard; reduced motion; Q6 before/after pairs). **T15 (W10)** AD F-list fixes.
