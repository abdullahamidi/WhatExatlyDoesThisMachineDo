// Living-world smoke. WP23a T12: denizens freeze and step, the first line's bubble and its layout at UI 100 and 150, hard silence per
// state, the placements per framing, the WORLD VOICES setting, the save, the frame budget and the tier port (cases A to H).
// WP23b T18: eras III-V placements and states (I, M), the finale film (J, JR), the postgame (K), cycles 2+ (L) and the bubble box
// flip guard (F23, 1280x800). One fresh context per case. Why: the living world is a layer, so every check reads the debug hook
// (window.__wedtmd) and the DOM only.
// Usage: PW_PATH=<playwright> node scripts/smoke/world.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty. Runs on :4174 and :4177.
// ONLY=H,I,M (env, optional): a comma list of case keys to run alone (A B C D E F G H I M J JR K L F23); unset runs every case.
// Timing is deterministic: worldAdvance moves the scheduler clock and the play time, worldLogShown feeds the SYS LOG port,
// worldSay forces a line past gaps and caps (not past hard silence). The demo edition refuses era III and everything after it, so
// every check that needs era III or later records value.skipped there (I, M, J, JR, K, L, G_era3_visible, G_display_peak).
import fs from 'fs';
import path from 'path';
import {
  S7, S9, S11, S13, S15, makeReport, watchPage, waitReady, crankClicks, buyInPage, buyList, dismissEraCard, loadChromium, withQuery,
} from './lib/common.mjs';

const [rawUrl, outArg] = process.argv.slice(2);
if (!rawUrl || !outArg) {
  console.error('usage: PW_PATH=<playwright> node scripts/smoke/world.mjs "<url with ?debug=1>" <outdir>');
  process.exit(2);
}
// The debug hook exists only with ?debug=1 (which also skips the title screen).
const target = withQuery(rawUrl, { debug: '1' });
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const chromium = loadChromium();

const report = makeReport();
const { results, fail, errors } = report;
let currentKey = 'setup';
const tag = () => currentKey;
const firstLine = (e) => String(e && e.message ? e.message : e).split('\n')[0];
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Stage lists. S8 = S7 + generator blueprint and generator (era II entry). S10 = S9 + substation blueprint and boiler (era III).
const S8 = [...S7, '@blueprint', 'generator'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
// S12, S14 and S16 are not exported by lib/common.mjs (S11, S13, S15 are). S16 = S15 + primaryFunction (the ending starts).
const S12 = [...S11, 'resonatorSpire'];
const S14 = [...S13, 'nullChamber'];
const S16 = [...S15, 'primaryFunction'];

// Canon line (STORY_BIBLE §5.2, verbatim). The first moment is INS-01; the live region reads "Inspector: <text>".
const INS01_TEXT = "Unchanged. I'm not on the count either.";
const INS01_LIVE = `Inspector: ${INS01_TEXT}`;

// Placement rules (worldPlacement.ts): feet x clear of the machine box by 24 world px and of the crank hub by 96 (hit circle 72 + 24).
const HUB_X = 1920;
const HUB_CLEAR = 96;
const WING_CLEAR = 24;
// Visible machine x-range per framing, world px (DENIZEN_ART §3: S7 1576-2316, S8 1576-2552, S9 1576-2808).
const MACHINE = { e1: { left: 1576, right: 2316 }, s8: { left: 1576, right: 2552 }, s9: { left: 1576, right: 2808 } };
// Feet x per id (DENIZEN_ART §3, WORLD_PLACEMENTS); null = off-stage. Scraps are not in the table: the overlap rule covers them.
const PLACED = {
  e1: { sensor7: 1384, inspector: 1472, dog: 2364, payphone: 2420, lamp: 2476, crow: 2476, clock: 2516, stakeChain: 2348, hole: 2394 },
  s8: { inspector: 1472, dog: 2604, payphone: 2604, lamp: 2656, crow: 2656, stakeChain: 2588, hole: 2634, sensor7: null, clock: null },
  s9: { sensor7: 1384, inspector: 1472, dog: 2856, clock: 2900, payphone: 2944, lamp: 2996, crow: 2996, stakeChain: 2840, hole: 2886 },
};

// Records one check. A failing check carries worldState().silence in its detail; `keep` records the detail on a pass too.
async function check(page, name, cond, extra, keep = false) {
  if (cond && !keep) {
    report.check(name, true);
    return;
  }
  const silence = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null).catch(() => null);
  report.check(name, cond, { silence, ...(extra ?? {}) });
}

const bubbleVisible = (page) => page.evaluate(() => window.__wedtmd.worldBubble()?.visible === true).catch(() => false);
const worldSay = (page, id) => page.evaluate((lineId) => window.__wedtmd.worldSay(lineId), id);
const seenOf = (page) => page.evaluate(() => window.__wedtmd.worldState()?.seen ?? []);
// Queue state of one line: waiting (pending), playing (activeLines) or seen (ids as worldState reports them). null without a director.
const lineState = (page, id) => page.evaluate((lineId) => {
  const s = window.__wedtmd.worldState();
  if (!s) return null;
  return { pending: s.pending.includes(lineId), playing: s.activeLines.includes(lineId), seen: s.seen.includes(lineId) };
}, id);
// True when a lineState result says the line is queued, playing or seen.
const lineHeld = (st) => st !== null && (st.pending || st.playing || st.seen);

// Polls the bubble until it shows `want` (true or false) or capMs passed. Returns whether it does.
async function waitBubble(page, want, capMs) {
  const deadline = Date.now() + capMs;
  let v = await bubbleVisible(page);
  while (v !== want && Date.now() < deadline) {
    await sleep(100);
    v = await bubbleVisible(page);
  }
  return v === want;
}

// Waits (cap 8 s) until no bubble is up and no toast is shown, so the next line gets a clean screen.
async function settle(page, capMs = 8000) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const quiet = await page.evaluate(() => {
      const stack = document.getElementById('toast-stack');
      const toasts = stack ? [...stack.querySelectorAll('.toast')].filter((t) => t.getClientRects().length > 0) : [];
      return toasts.length === 0 && window.__wedtmd.worldBubble()?.visible !== true;
    });
    if (quiet || Date.now() >= deadline) return quiet;
    await sleep(100);
  }
}

// Waits until the placements match the table (the framing settles a few frames after the buys). Returns the last result.
async function waitPlaced(page, framing, want) {
  const spec = { framing, want, machine: MACHINE[framing], hub: HUB_X, clear: HUB_CLEAR, wing: WING_CLEAR };
  const deadline = Date.now() + 3000;
  let r = await page.evaluate(placedInPage, spec);
  while (!r.ok && Date.now() < deadline) {
    await sleep(150);
    r = await page.evaluate(placedInPage, spec);
  }
  return r;
}

// Variant of the Inspector and the Dog; null until both entries exist and are drawn (visible), so the constructor's placeholder frames never count.
async function livingOf(page) {
  return page.evaluate(() => {
    const list = window.__wedtmd.livingWorld() ?? [];
    const variant = (id) => list.find((e) => e.id === id && e.visible === true)?.variant ?? null;
    const inspector = variant('inspector');
    const dog = variant('dog');
    return inspector !== null && dog !== null ? { inspector, dog } : null;
  });
}

// Buys a list with the TECH INDEX open, as real play does. The relocation gate moves the placements only while the tree is open
// or when no denizen is on screen, and it checks on the 250 ms visual cadence, so the tree stays open 600 ms after the buys.
// Returns the failed entries, like buyList.
async function buyInTree(page, list) {
  await page.keyboard.press('t');
  await sleep(400);
  const failed = await buyList(page, list);
  await sleep(600);
  await page.keyboard.press('Escape');
  await sleep(600);
  return failed;
}

// The first moment (bible §7.1 and §7.3). One click clears the crank prompt; 16 clicks pay for Gear Ratio (15 ME); one purchase.
// Then the play time passes 90 s and the observer-count log is shown. The advances run in ONE evaluate, so no frame runs
// between them: the core log reply (priority 1) takes the slot before the 45 s idle line (priority 4) can.
async function firstMoment(page) {
  await crankClicks(page, 1, 0);
  await crankClicks(page, 15, 0);
  const bought = await page.evaluate(buyInPage, ['gearRatio']);
  await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(120000);
    w.worldLogShown('observer-count');
    w.worldAdvance(6000);
  });
  return bought;
}

// Runs in the page. The placements against the table, the framing, and the wing and hub rules for every placed id.
function placedInPage(spec) {
  const s = window.__wedtmd.worldState();
  if (!s) return { ok: false, problems: ['no world state'], silence: null };
  const problems = [];
  if (s.framing !== spec.framing) problems.push(`framing ${s.framing}`);
  const pl = s.placements || {};
  for (const [id, x] of Object.entries(spec.want)) {
    const p = pl[id] ?? null;
    if (x === null) {
      if (p !== null) problems.push(`${id} placed at ${p.x}`);
    } else if (p === null || p.x !== x) {
      problems.push(`${id} ${p === null ? 'null' : p.x} != ${x}`);
    }
  }
  for (const [id, p] of Object.entries(pl)) {
    if (p === null || p === undefined) continue;
    if (!(p.x <= spec.machine.left - spec.wing || p.x >= spec.machine.right + spec.wing)) problems.push(`${id} at ${p.x} over the machine box`);
    if (Math.abs(p.x - spec.hub) < spec.clear) problems.push(`${id} at ${p.x} inside the crank circle + 24`);
  }
  return { ok: problems.length === 0, problems, silence: s.silence ?? null };
}

// Runs in the page. The visible bubble box (client px), the HUD boxes it must clear, the ARIA state of every .wv node and the live text.
function measureInPage() {
  const rectOf = (el) => {
    if (!el || el.getClientRects().length === 0) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
  };
  const stack = document.getElementById('toast-stack');
  const toastUp = stack !== null && [...stack.querySelectorAll('.toast')].some((t) => t.getClientRects().length > 0);
  return {
    bubble: window.__wedtmd.worldBubble(),
    dom: rectOf(document.querySelector('.wv.on')),
    named: {
      'hud-panel': rectOf(document.getElementById('hud-panel')),
      'hud-buttons': rectOf(document.getElementById('hud-buttons')),
      'hud-hint': rectOf(document.getElementById('hud-hint')),
      'toast-stack': toastUp ? rectOf(stack) : null,
    },
    wv: [...document.querySelectorAll('.wv')].map((el) => ({
      aria: el.getAttribute('aria-hidden'),
      tabindex: el.hasAttribute('tabindex'),
      focusable: el.tabIndex >= 0,
    })),
    live: document.getElementById('world-voice-live')?.textContent ?? null,
  };
}

const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
// Names of the HUD boxes the bubble overlaps. A missing bubble box counts as a clash.
const clashes = (m) => (m.dom === null
  ? ['no-bubble-box']
  : Object.entries(m.named).filter(([, r]) => r !== null && hit(m.dom, r)).map(([k]) => k));

// A frozen: no input, the Inspector and the Dog hold their frames for 2 s; one real crank click steps them.
async function caseA(page) {
  // Waits for the first drawn frame (livingOf is null until both cast members are visible), then 300 ms more.
  const deadline = Date.now() + 5000;
  while ((await livingOf(page)) === null && Date.now() < deadline) await sleep(100);
  await sleep(300);
  const v0 = await livingOf(page);
  let frozen = v0 !== null;
  for (let i = 0; i < 5; i++) {
    await sleep(400);
    frozen = frozen && JSON.stringify(await livingOf(page)) === JSON.stringify(v0);
  }
  await check(page, 'A_frozen', frozen, { before: v0 });
  await shot(page, 'world-A-s0.png');
  const before = await livingOf(page);
  await crankClicks(page, 1, 0);
  await sleep(300);
  const after = await livingOf(page);
  const stepped = before !== null && after !== null && (before.inspector !== after.inspector || before.dog !== after.dog);
  await check(page, 'A_crank_step', stepped, { before, after });
}

// B first line: INS-01 through its observer-count log reply. Bubble, its rects at UI 100 and 150, the live region, the ARIA state.
async function caseB(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 100 }));
  const bought = await firstMoment(page);
  const shown = await waitBubble(page, true, 8000);
  await check(page, 'B_bubble', shown, { bought });
  const at100 = await page.evaluate(measureInPage);
  await shot(page, 'world-B-100.png');
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await sleep(300);
  // INS-01 lasts 4.8 s at most. At UI 150 a forced INS-02 (non-core, worldSay) shows the bubble layout again.
  await waitBubble(page, false, 8000);
  const forced = await worldSay(page, 'INS-02');
  await waitBubble(page, true, 3000);
  const at150 = await page.evaluate(measureInPage);
  await shot(page, 'world-B-150.png');
  const c100 = clashes(at100);
  const c150 = clashes(at150);
  await check(page, 'B_rects', c100.length === 0 && c150.length === 0, { ui100: c100, ui150: c150, forced });
  await check(page, 'B_live', at100.live === INS01_LIVE, { live: at100.live });
  const aria = at100.wv.length > 0 && at100.wv.every((x) => x.aria === 'true' && !x.tabindex && !x.focusable);
  await check(page, 'B_aria', aria, { wv: at100.wv });
}

// C silence: worldSay is refused in each hard-silence state (tree, era card, photo mode, SYSTEM menu). Each state first proves
// the line plays in the plain state (control), so a refusal is never a vacuous pass.
async function caseC(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  const control = await worldSay(page, 'INS-02');
  await sleep(300);
  await page.keyboard.press('t');
  await sleep(500);
  const treeOpen = await page.evaluate(() => window.__wedtmd.techTreeOpen());
  const say1 = await worldSay(page, 'INS-02');
  const vis1 = await bubbleVisible(page);
  await check(page, 'C_tree', control === true && treeOpen && !say1 && !vis1, { control, treeOpen, say1, vis1 });
  await page.keyboard.press('Escape');
  await sleep(400);

  // Era II: 45 clicks pay for the Worn Motor, then the S8 list (generator) opens the era card.
  await crankClicks(page, 45, 0);
  const buyFail = await buyList(page, S8);
  let cardUp = false;
  for (let i = 0; i < 30 && !cardUp; i++) {
    await sleep(100);
    cardUp = await page.locator('#era-card').first().isVisible().catch(() => false);
  }
  await sleep(300);
  const say2 = await worldSay(page, 'INS-02');
  const vis2 = await bubbleVisible(page);
  await check(page, 'C_card', cardUp && !say2 && !vis2, { buyFail, cardUp, say2, vis2 });
  await dismissEraCard(page);
  await sleep(300);

  await page.evaluate(() => window.__wedtmd.photoMode(true, { hint: false }));
  await sleep(800);
  const photo = await page.evaluate(() => window.__wedtmd.photoState()?.active === true);
  const say3 = await worldSay(page, 'INS-02');
  const vis3 = await bubbleVisible(page);
  await check(page, 'C_photo', photo && !say3 && !vis3, { photo, say3, vis3 });
  await page.evaluate(() => window.__wedtmd.photoMode(false));
  await sleep(500);

  await page.keyboard.press('Escape');
  await sleep(500);
  const menu = await page.evaluate(() => window.__wedtmd.systemMenuOpen());
  const say4 = await worldSay(page, 'INS-02');
  const vis4 = await bubbleVisible(page);
  await check(page, 'C_menu', menu && !say4 && !vis4, { menu, say4, vis4 });
  await page.keyboard.press('Escape');
}

// D framings: the placements of era I (S7, framing e1), era II entry (S8, framing s8) and era II full (S9, framing s9) at UI 150.
// The buys run through buyInTree (the TECH INDEX open), as in real play.
async function caseD(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const s7 = await waitPlaced(page, 'e1', PLACED.e1);
  await check(page, 'D_s7_placed', s7.ok && buyS7.length === 0, { problems: s7.problems, buyFail: buyS7 });
  await shot(page, 'world-D-s7-150.png');

  const buyS8 = await buyInTree(page, S8.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const s8 = await waitPlaced(page, 's8', PLACED.s8);
  await check(page, 'D_s8_placed', s8.ok && buyS8.length === 0, { problems: s8.problems, buyFail: buyS8 });
  await shot(page, 'world-D-s8-150.png');

  const buyS9 = await buyInTree(page, S9.slice(S8.length));
  await sleep(300);
  const s9 = await waitPlaced(page, 's9', PLACED.s9);
  await check(page, 'D_s9_placed', s9.ok && buyS9.length === 0, { problems: s9.problems, buyFail: buyS9 });
  await shot(page, 'world-D-s9-150.png');
}

// E settings: RARE refuses non-core lines (control: ON accepts them); OFF plays nothing, no blips, no seen change.
async function caseE(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'rare' }));
  const say1 = await worldSay(page, 'INS-02');
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'on' }));
  const say2 = await worldSay(page, 'INS-02');
  await check(page, 'E_rare', !say1 && say2 === true, { say1, say2 });
  await settle(page);

  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'off' }));
  await sleep(300);
  const readOff = () => page.evaluate(() => ({
    blips: window.__wedtmd.audioStats()?.worldBlips ?? null,
    seen: (window.__wedtmd.worldState()?.seen ?? []).join(','),
  }));
  const before = await readOff();
  const say3 = await worldSay(page, 'DOG-02');
  await sleep(800);
  const after = await readOff();
  const vis = await bubbleVisible(page);
  const noChange = before.blips !== null && after.blips === before.blips && after.seen === before.seen;
  await check(page, 'E_off', !say3 && !vis && noChange, { say3, vis, before, after });
}

// F persist: INS-01 seen, saveNow, reload keeps it. After 400 s the same log does not bring it back.
async function caseF(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  for (let i = 0; i < 60 && !(await seenOf(page)).includes('INS-01'); i++) await sleep(250);
  await page.evaluate(() => window.__wedtmd.saveNow());
  await sleep(300);
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  const seen = await seenOf(page);
  await check(page, 'F_seen', seen.includes('INS-01'), { seen });

  await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(400000);
    w.worldLogShown('observer-count');
  });
  let repeated = false;
  for (let i = 0; i < 24 && !repeated; i++) {
    await sleep(250);
    const s = await page.evaluate(() => ({
      text: window.__wedtmd.worldBubble()?.text ?? null,
      live: document.getElementById('world-voice-live')?.textContent ?? null,
    }));
    repeated = s.text === INS01_TEXT || s.live === INS01_LIVE;
  }
  await check(page, 'F_no_repeat', !repeated, { repeated });
}

// G budget: the display list and the per-frame cost at era II full; era III visible once the TECH INDEX has opened and closed.
async function caseG(page) {
  await crankClicks(page, 45, 0);
  const buyS9 = await buyList(page, S9);
  await sleep(300);
  const objects = await page.evaluate(() => window.__wedtmd.displayObjects());
  await check(page, 'G_display', typeof objects === 'number' && objects <= 100 && buyS9.length === 0, { objects, buyFail: buyS9 }, true);

  // G_cost is a cost reading only with the world awake. A silent world (asleep in the demo edition) is report-only: no sampling, no gate.
  const silence = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null);
  if (silence !== null) {
    await check(page, 'G_cost', true, { skipped: 'world silent (' + silence + '): not a cost reading', silence }, true);
  } else {
    const samples = [];
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      samples.push(await page.evaluate(() => window.__wedtmd.worldStats()?.meanMs ?? null));
    }
    const numeric = samples.every((x) => typeof x === 'number');
    const meanMs = numeric ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
    await check(page, 'G_cost', numeric && meanMs <= 0.3, { meanMs, samples: samples.length }, true);
  }

  if (await isDemo(page)) {
    await check(page, 'G_era3_visible', true, { skipped: 'demo edition: era III is refused, so there is no era III entry' }, true);
    return;
  }
  const bought = await buyList(page, S10.slice(S9.length));
  await page.keyboard.press('t');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(600);
  const st = await page.evaluate(() => {
    const w = window.__wedtmd;
    const list = w.livingWorld() ?? [];
    const s = w.worldState();
    return {
      entries: list.length,
      anyVisible: list.some((e) => e.visible === true),
      hidden: s?.hidden ?? null,
      era: s?.era ?? null,
    };
  });
  // WP23b: era III is in play (maxEra 5), so its entries are visible and the state is not hidden.
  await check(page, 'G_era3_visible', st.entries > 0 && st.anyVisible && st.hidden === false, { bought, ...st }, true);
}

// H tier port (WP23 A10, X1): the WP22 tier maths behind the living world. Era I and II only, so the demo runs every check.
// H_dog_line: DOG-04 (improvedPistons tier 3) is queued at level 10 and not at 9; the buy's tier event or the TECH INDEX close
// re-check queues it (an over-cap swap emits no event). H_first_top: the first MK V (motorTuning 25) queues INS-13 the same way.
// H_heartbeat: worldState().tierHeartbeat (the Sensor 7 LED beat) is off before the first top tier and on after it.
// H_hole: worldState().holeStage at motorRetrofit 8 / 13 / 18 once lifetime EE reached the load-beneath level (WORLD_HOLE).
// caseHOver (also case H): H_overcap_pre and H_overcap (a fresh era II save, then one TECH INDEX release that changes five tracks;
// the fifth change is past the four-beat cap, so it swaps with no partEvolved event, and INS-13 must come from the close re-check),
// and H_boot_seed (the same save reloaded: the heartbeat is on before any TECH INDEX close).
// Every H check carries tierProbe() in its detail: era, heartbeat, hole stage, lifetime EE, cameraState(), the Inspector and the Dog.
const HOLE_EE = 100000; // WORLD_HOLE.loadBeneathEe
const HOLE_STAGE = { 8: 2, 13: 3, 18: 4 }; // motorRetrofit tiers 3 / 4 / 5, less WORLD_HOLE.tierOffset (1)
const OVERCAP_BUYS = ['@gearRatio:6', '@flywheel:4', '@motorTuning:10', '@improvedPistons:5', '@motorRetrofit:18'];
const OVERCAP_TIERS = { gearRatio: 2, flywheel: 2, motorTuning: 3, improvedPistons: 2, motorRetrofit: 5 };

// Tier probe for the H checks: the heartbeat and hole stage, the era, lifetime EE, the camera, and where the Inspector and the Dog
// stand (R6: a line needs its speaker on screen).
const tierProbe = (page) => page.evaluate(() => {
  const w = window.__wedtmd;
  const s = w.worldState();
  const cast = (id) => (w.livingWorld() ?? []).find((e) => e.id === id) ?? null;
  return {
    era: s?.era ?? null,
    tierHeartbeat: s?.tierHeartbeat ?? null,
    holeStage: s?.holeStage ?? null,
    lifetimeEe: w.session.state.lifetime.ee,
    camera: w.cameraState(),
    inspector: cast('inspector'),
    dog: cast('dog'),
  };
});

// Polls partTiers() until every wanted track shows its tier (the beats swap about 1 s after a release). Returns the last snapshot.
async function waitTiers(page, want, capMs) {
  const deadline = Date.now() + capMs;
  const matches = (got) => Object.entries(want).every(([id, t]) => got?.[id] === t);
  let got = await page.evaluate(() => window.__wedtmd.partTiers());
  while (!matches(got) && Date.now() < deadline) {
    await sleep(150);
    got = await page.evaluate(() => window.__wedtmd.partTiers());
  }
  return got;
}

// Polls tierProbe until the heartbeat is on or capMs passed. A loaded save seeds the tracker on its first applied frame.
async function waitHeartbeat(page, capMs) {
  const deadline = Date.now() + capMs;
  let probe = await tierProbe(page);
  while (probe.tierHeartbeat !== true && Date.now() < deadline) {
    await sleep(150);
    probe = await tierProbe(page);
  }
  return probe;
}

// Lifetime EE up to need: 8 h stretches (the buy loop's own jump) while it is short, at most 40. Returns the EE reached.
// Clicks KEEP TINKERING when the demo END OF DEMO card is open (demo edition only); returns whether it was open.
async function closeDemoCard(page) {
  const open = await page.evaluate(() => document.getElementById('demo-end')?.classList.contains('is-open') === true).catch(() => false);
  if (open) {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await sleep(600);
  }
  return open;
}

async function topUpLifetimeEe(page, need) {
  return page.evaluate((target) => {
    const s = window.__wedtmd.session;
    for (let k = 0; k < 40 && s.state.lifetime.ee < target; k++) s.update(s.state.lastSimTime + 8 * 3600 * 1000);
    return s.state.lifetime.ee;
  }, need);
}

async function caseH(page) {
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const buy9 = await buyInTree(page, ['@improvedPistons:9']);
  const dog9 = await lineState(page, 'DOG-04');
  const buy10 = await buyInTree(page, ['@improvedPistons:10']);
  const dog10 = await lineState(page, 'DOG-04');
  const dogFail = [...buyS7, ...buy9, ...buy10];
  // No top tier is bought yet, so the heartbeat is still off.
  const beforeTop = await tierProbe(page);
  await check(page, 'H_dog_line', dogFail.length === 0 && !lineHeld(dog9) && lineHeld(dog10), { buyFail: dogFail, dog9, dog10, ...beforeTop });

  // The first MK V: motorTuning 25 is the top tier of a 5-tier track, so the TECH INDEX close queues INS-13 (once per cycle).
  const buyTop = await buyInTree(page, ['@motorTuning:25']);
  const top = await lineState(page, 'INS-13');
  const afterTop = await tierProbe(page);
  const tuning = await page.evaluate(() => window.__wedtmd.partTiers()?.motorTuning ?? null);
  await check(page, 'H_first_top', buyTop.length === 0 && lineHeld(top), { buyFail: buyTop, top, motorTuningTier: tuning, ...afterTop });
  await check(page, 'H_heartbeat', beforeTop.tierHeartbeat === false && afterTop.tierHeartbeat === true, {
    heartbeatBeforeTop: beforeTop.tierHeartbeat, heartbeatAfterTop: afterTop.tierHeartbeat, motorTuningTier: tuning, ...afterTop,
  });

  // Era II: the rest of the S9 list (the generator opens the era card). Lifetime EE first reaches the load-beneath level, then
  // motorRetrofit to levels 8, 13 and 18 (tiers 3, 4, 5) each read the hole stage.
  const buyEra2 = await buyInTree(page, S9.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const ee = await topUpLifetimeEe(page, HOLE_EE);
  const holeRows = [];
  for (const level of [8, 13, 18]) {
    // Demo edition: the EE top-up reaches the plate cap, so the END OF DEMO card opens and holds the world; keep tinkering first.
    const demoCard = await closeDemoCard(page);
    const failed = await buyInTree(page, ['@motorRetrofit:' + level]);
    const demoCardAfter = await closeDemoCard(page);
    // the world state applies on its own cadence after the release: wait up to 3 s for the stage (demo runs were read too early)
    let probe = await tierProbe(page);
    for (let t = 0; t < 30 && probe.holeStage !== HOLE_STAGE[level]; t++) {
      await sleep(100);
      probe = await tierProbe(page);
    }
    const displayedTier = await page.evaluate(() => window.__wedtmd.partTiers()?.motorRetrofit ?? null);
    const actualLevel = await page.evaluate(() => window.__wedtmd.session.state.techLevels.motorRetrofit ?? 0);
    holeRows.push({ level, actualLevel, demoCard, demoCardAfter, failed, expected: HOLE_STAGE[level], holeStage: probe.holeStage, displayedTier });
  }
  const holeOk = holeRows.every((r) => r.failed.length === 0 && r.holeStage === r.expected);
  const holeProbe = await tierProbe(page);
  await check(page, 'H_hole', buyEra2.length === 0 && ee >= HOLE_EE && holeOk, { buyFail: buyEra2, lifetimeEe: ee, rows: holeRows, ...holeProbe });
}

// H_overcap (WP23 A10): a fresh era II save, then ONE TECH INDEX release that changes five tracks. The release plays at most four
// tier-up beats (PART_TIER_FX.maxBeatsPerRelease); the fifth change (motorRetrofit 5 -> 18, tier 5 = top) swaps instantly with no
// partEvolved event, so INS-13 must come from the close re-check. H_boot_seed: the same save reloaded, and the heartbeat is on
// before any TECH INDEX close.
async function caseHOver(page) {
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const buyEra2 = await buyInTree(page, S9.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const pre = await tierProbe(page);
  const preIns = await lineState(page, 'INS-13');
  await check(page, 'H_overcap_pre', buyS7.length === 0 && buyEra2.length === 0 && pre.era === 2 && pre.tierHeartbeat === false && !lineHeld(preIns), {
    buyFail: [...buyS7, ...buyEra2], preIns, ...pre,
  });

  const release = await buyInTree(page, OVERCAP_BUYS);
  const tiers = await waitTiers(page, OVERCAP_TIERS, 3000);
  const ins = await lineState(page, 'INS-13');
  const post = await tierProbe(page);
  const tiersOk = Object.entries(OVERCAP_TIERS).every(([id, t]) => tiers?.[id] === t);
  await check(page, 'H_overcap', release.length === 0 && tiersOk && lineHeld(ins) && post.tierHeartbeat === true, {
    buyFail: release, tiers, expectedTiers: OVERCAP_TIERS, ins, ...post,
  });

  // Save, reload, and read the heartbeat before any TECH INDEX open: the boot seed is the only thing that can turn it on.
  const saved = await page.evaluate(() => window.__wedtmd.saveNow());
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  const booted = await waitHeartbeat(page, 5000);
  await check(page, 'H_boot_seed', saved === true && booted.tierHeartbeat === true, { saved, ...booted });
}

// ---- WP23b (T18): eras III-V, the finale film, the postgame, cycles 2+, the bubble box guard ----
// Expected values mirror the design numbers the checks compare with (DENIZEN_ART §3 rows, WORLD_ENDING, FINALE_WIPE, FINALE_REVEAL).
// The game derives its own film and postgame times: every time the film or the postgame reaches is read back through the hook.
const INNER_CLEAR = 88;   // WORLD_LAYOUT.innerClearPx (anchor 64 + wing 24)
const MACHINE_RANGE = { s10: { left: 1302, right: 2808 }, s11: { left: 1036, right: 2808 }, s15: { left: 848, right: 2992 } };
const WIPE = { startS: 21.3, regrowthLagS: 2, pxPerS: 120 };   // FINALE_WIPE (finale.ts) and worldFinale.restoreTimeOf
const restoreAt = (x) => WIPE.startS + WIPE.regrowthLagS + Math.abs(x - HUB_X) / WIPE.pxPerS;
const FILM_HOME = { inspector: 784, dog: 2856, crow: 3104, girl: 976, sensor7: 712 };   // WORLD_ENDING.homeX
const LAST_LOOK_S = 59.83;   // FINALE_REVEAL: 49.3 + 0.8 + 1.0, then the first three lines (25 / 39 / 18 chars at 30 cps, 2 s pauses)
const ANCHOR_BOXES = [[848, 912], [2928, 2992]];   // portrait anchor boxes (world px); Z1: the dog never overlaps one while visible
const DOG_HALF_PX = 28;
const INS14_TEXT = 'Same rounds. Page one. You look familiar.';   // INS-14 (cycle 2+, replaces INS-01), verbatim from §5.2
const GIRL_STEP_MAX_PX = 12;   // WORLD_GIRL.stepMaxWorldPx (B-A3): one committed change moves the girl at most this far
const GRL12_CYCLE3 = 'Cycle 0044. You came back. So did we.';   // GRL-12 at cycle 3: {cycle} is the label 42 + 3 - 1 = 0044
const DEMO_WHY = 'demo edition: eras III-V, the finale, the postgame and cycle 2 are refused';
const I_NAMES = ['I_s10_placed', 'I_s11_placed', 'I_s13_placed', 'I_s15_placed', 'I_umbrella', 'I_puddle_sprout', 'I_girl_steps', 'I_girl_step_clamp',
  'I_nothing_unhappens', 'I_double_exposure', 'I_reverse', 'I_stare_dog', 'I_chladni'];
const M_NAMES = ['I_virga_frozen', 'I_sync', 'I_one_observer', 'I_accent_still'];
const J_NAMES = ['J_restore_times', 'J_shield', 'J_last_look', 'J_crow_flight', 'J_drawn', 'J_no_bubble', 'J_skip'];
const JR_NAMES = ['J_reduced'];
const K_NAMES = ['K_turn_away', 'K_mark42', 'K_loop', 'K_pay12', 'K_pay12_ui100', 'K_sensor_turn', 'K_ins_pg', 'K_drawn'];
const L_NAMES = ['L_marks', 'L_red_ball', 'L_readout', 'L_girl_stage', 'L_pay13', 'L_cyc_lines'];
// Era V peak object count (case I), read by case K's G_display_peak.
let eraVPeak = null;

// Feet x and row per framing (WP23b R6, WORLD_PLACEMENTS, DENIZEN_ART §3); null = off-stage. s11 covers stages S11-S14; the girl joins
// at era IV (R6_ERA4). Inner ids (INNER) sit in the inner gap: machine left + INNER_CLEAR .. machine right - INNER_CLEAR.
const rowAt = (x, r, extra = {}) => ({ x, row: r, ...extra });
const R6 = {
  s10: {
    inspector: rowAt(1252, 'back'), dog: rowAt(2858, 'front'), payphone: rowAt(2858, 'back'), stakeChain: rowAt(2842, 'front'), hole: null,
    sensor7: null, clock: null, lamp: null, crow: null, scraps: null, puddles: null, sprout: null, lantern: null, girl: null,
  },
  s11: {
    sensor7: rowAt(712, 'back'), inspector: rowAt(784, 'back'), dog: rowAt(2856, 'front'), clock: rowAt(2890, 'back'),
    payphone: rowAt(3050, 'back'), lamp: rowAt(3104, 'back'), crow: rowAt(3104, 'back'), stakeChain: rowAt(2840, 'front'),
    hole: rowAt(2886, 'front'), scraps: rowAt(690, 'back'), puddles: rowAt(960, 'back'), sprout: rowAt(996, 'back'), lantern: null, girl: null,
  },
  s15: {
    sensor7: rowAt(712, 'back'), inspector: rowAt(784, 'back'), payphone: rowAt(3050, 'back'), lamp: rowAt(3104, 'back'),
    crow: rowAt(3104, 'back'), scraps: rowAt(690, 'back'), dog: rowAt(2856, 'front'), clock: rowAt(2890, 'back'),
    stakeChain: rowAt(2840, 'front'), hole: rowAt(2886, 'front'), puddles: rowAt(960, 'back'), sprout: rowAt(996, 'back'),
    lantern: rowAt(965, 'front', { dy: 40 }), girl: rowAt(976, 'front', { dy: 40 }),   // five girl steps of 8 world px
  },
};
const R6_ERA4 = { ...R6.s11, girl: rowAt(880, 'back') };
const INNER = { s15: ['dog', 'clock', 'stakeChain', 'hole', 'puddles', 'sprout', 'lantern', 'girl'] };

// Records a check the demo build cannot reach as passed, with value.skipped.
const skipCheck = (name, why = DEMO_WHY) => report.check(name, true, { skipped: why });
const skipAll = (names, why = DEMO_WHY) => names.forEach((n) => skipCheck(n, why));
const isDemo = (page) => page.evaluate(() => window.__wedtmd.demoState() !== null).catch(() => false);

// The living-world fields the WP23b checks read (null without a director).
const worldSnap = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  if (!s) return null;
  return {
    era: s.era, cycle: s.cycle, phase: s.phase, stare: s.stare, vents: s.vents, reverse: s.reverse, readout: s.readout,
    girlStage: s.girlStage, girlSteps: s.girlSteps, marks: s.marks, puddle: s.puddle, sprout: s.sprout, holeStage: s.holeStage,
    unison: s.unison, doubleExposures: s.doubleExposures, hidden: s.hidden, framing: s.framing, placements: s.placements,
    pending: s.pending, activeLines: s.activeLines, seen: s.seen, script: s.script ?? null,
  };
});
// A line is queued, playing or seen (lineHeld on a worldSnap).
const heldIn = (s, id) => s.pending.includes(id) || s.activeLines.includes(id) || s.seen.includes(id);
// Ids of the living-world entries drawn now (livingWorld(), visible only).
const visibleIds = (page) => page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => e.id));
// Ids of the drawn entries (visible). The restored girl window reports as girlWindow, so the girl id is the girl figure only.
const drawnIds = (page) => page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => (e.id === 'girl' && e.variant === 'window-restored' ? 'girlWindow' : e.id)));
// True when livingWorld() shows the id with variant `want` within capMs (polled every 150 ms).
async function variantSeen(page, id, want, capMs) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const hit = await page.evaluate(([i, v]) => (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === i && e.visible === true && e.variant === v), [id, want]);
    if (hit || Date.now() >= deadline) return hit;
    await sleep(150);
  }
}

// Runs in the page. The placements against one framing's rows: want[id] = { x, row, dy? } or null (off-stage). Inner ids sit in the
// inner gap; every other id keeps the wing rule (outside the machine box by 24) and stays out of the crank circle + 24.
function rowsInPage(spec) {
  const s = window.__wedtmd.worldState();
  if (!s) return { ok: false, problems: ['no world state'] };
  const problems = [];
  if (s.framing !== spec.framing) problems.push(`framing ${s.framing} != ${spec.framing}`);
  const pl = s.placements || {};
  for (const [id, want] of Object.entries(spec.want)) {
    const p = pl[id] ?? null;
    if (want === null) {
      if (p !== null) problems.push(`${id} placed at ${p.x}`);
      continue;
    }
    if (p === null) {
      problems.push(`${id} off-stage`);
      continue;
    }
    if (p.x !== want.x) problems.push(`${id} x ${p.x} != ${want.x}`);
    if (p.row !== want.row) problems.push(`${id} row ${p.row} != ${want.row}`);
    if ((p.dy ?? 0) !== (want.dy ?? 0)) problems.push(`${id} dy ${p.dy} != ${want.dy ?? 0}`);
    const m = spec.machine;
    if (spec.inner.includes(id)) {
      if (p.x < m.left + spec.innerClear || p.x > m.right - spec.innerClear) problems.push(`${id} at ${p.x} outside the inner bounds`);
    } else if (!(p.x <= m.left - spec.wing || p.x >= m.right + spec.wing)) {
      problems.push(`${id} at ${p.x} over the machine box`);
    }
    if (Math.abs(p.x - spec.hub) < spec.clear) problems.push(`${id} at ${p.x} inside the crank circle + 24`);
  }
  return { ok: problems.length === 0, problems, framing: s.framing };
}

// Waits (cap 6 s) until the placements match the rows of one framing. Returns the last result.
async function waitRows(page, framing, want, inner, machine) {
  const spec = { framing, want, inner, machine, hub: HUB_X, clear: HUB_CLEAR, wing: WING_CLEAR, innerClear: INNER_CLEAR };
  const deadline = Date.now() + 6000;
  let r = await page.evaluate(rowsInPage, spec);
  while (!r.ok && Date.now() < deadline) {
    await sleep(200);
    r = await page.evaluate(rowsInPage, spec);
  }
  return r;
}

// The nothing-un-happens reads: holes, puddles, sprout and girl steps (null-safe).
const progressOf = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  return s ? { hole: s.holeStage ?? 0, puddle: s.puddle, sprout: s.sprout, girl: s.girlSteps } : null;
});
const UP_KEYS = ['hole', 'puddle', 'sprout', 'girl'];
// Every count only rises from S9 to S15: each sample is at least the one before it.
const risesOnly = (seq) => seq.every((p) => p !== null) && seq.every((p, i) => i === 0 || UP_KEYS.every((k) => p[k] >= seq[i - 1][k]));

// Buys a list through the TECH INDEX, closes the era card and settles 300 ms. Returns the failed entries.
async function buyEra(page, list) {
  const failed = await buyInTree(page, list);
  await dismissEraCard(page);
  await sleep(300);
  return failed;
}

// Waits (cap 3 s) until the applied girl steps are one of `wants` and the girl placement's dy is 8 world px a step. A list (g4: 4 or 5)
// covers the 8 h jump that lands two steps in one commit.
async function girlStepsAt(page, wants) {
  const list = Array.isArray(wants) ? wants : [wants];
  const met = (x) => x !== null && list.includes(x.girlSteps) && (x.placements?.girl?.dy ?? -1) === 8 * x.girlSteps;
  const deadline = Date.now() + 3000;
  let s = await worldSnap(page);
  while (!met(s) && Date.now() < deadline) {
    await sleep(150);
    s = await worldSnap(page);
  }
  return { want: wants, steps: s?.girlSteps ?? null, dy: s?.placements?.girl?.dy ?? null };
}

// Advances the scheduler clock stepMs at a time (worldAdvance, then 120 ms for a frame) until pred(worldSnap) holds. null after maxSteps.
async function advanceUntil(page, stepMs, maxSteps, pred) {
  for (let i = 0; i < maxSteps; i++) {
    await page.evaluate((ms) => window.__wedtmd.worldAdvance(ms), stepMs);
    await sleep(120);
    const s = await worldSnap(page);
    if (s !== null && pred(s)) return s;
  }
  return null;
}

// The film clock: seek to t and read the world script and the finale phase in the same evaluate (no frame in between).
const probeFilm = (page, t) => page.evaluate((x) => {
  const w = window.__wedtmd;
  w.finaleSeek(x);
  return { t: x, script: w.worldState()?.script ?? null, phase: w.finaleState()?.phase ?? null };
}, t);
const castOf = (snap, id) => snap?.script?.cast?.[id] ?? null;
const brief = (c) => (c === null ? null : { visible: c.visible, frame: c.frame, row: c.row, x: c.x });
// Bisects the film clock in (lo, hi] for the first t where pred(probe) holds (pred monotone on the range).
async function filmEdge(page, lo, hi, pred, iters = 16) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (pred(await probeFilm(page, m))) b = m;
    else a = m;
  }
  return b;
}

// Buys the whole list (primaryFunction starts the ending) and waits (cap 8 s) for the film script. reduced sets reduced motion first.
async function startFilm(page, reduced) {
  if (reduced) await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await crankClicks(page, 45, 0);
  const bought = await buyList(page, S16);
  await dismissEraCard(page);
  await sleep(300);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && (await page.evaluate(() => window.__wedtmd.worldState()?.script ?? null)) === null) await sleep(150);
  return bought;
}
// Starts the film, SKIPs it to the choice and waits (cap 6 s) for the choice phase: the KEEP and cycle buttons.
async function toChoice(page, reduced = false) {
  const bought = await startFilm(page, reduced);
  await page.evaluate(() => window.__wedtmd.skipFinale());
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline && (await page.evaluate(() => window.__wedtmd.session.state.ending.phase)) !== 'choice') await sleep(150);
  return bought;
}

// Samples the dog across the KEEP walk for capMs (150 ms steps): keepS, visible and the world x.
async function sampleDog(page, capMs) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    const r = await page.evaluate(() => {
      const sc = window.__wedtmd.worldState()?.script ?? null;
      return sc ? { keepS: sc.keepS, visible: sc.cast?.dog?.visible ?? null, x: sc.cast?.dog?.x ?? null } : null;
    });
    if (r !== null) out.push(r);
    await sleep(150);
  }
  return out;
}
// Z1 dog rule: hidden for keepS 4.6-6.9 s (KEEP 4.5-7 s); while visible its centre +- DOG_HALF_PX never overlaps an anchor box.
function dogRule(samples) {
  const gap = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 4.6 && s.keepS <= 6.9);
  const hiddenOk = gap.length > 0 && gap.every((s) => s.visible === false);
  const overlap = samples.some((s) => s.visible === true && typeof s.x === 'number'
    && ANCHOR_BOXES.some(([l, r]) => s.x + DOG_HALF_PX > l && s.x - DOG_HALF_PX < r));
  return { ok: hiddenOk && !overlap, hiddenSamples: gap.length, overlap };
}

// Samples the postgame every 250 ms until keepS reaches stopS (or capMs): cast poses, marks and the script's marksPlus (null when the
// script has none), the ids drawn (livingWorld visible, the restored window as girlWindow), the bubble text, INS-PG seen.
async function sampleKeep(page, stopS, capMs) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    const r = await page.evaluate(() => {
      const w = window.__wedtmd;
      const s = w.worldState();
      const sc = s?.script ?? null;
      const b = w.worldBubble();
      const drawn = (w.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => (e.id === 'girl' && e.variant === 'window-restored' ? 'girlWindow' : e.id));
      return sc ? {
        keepS: sc.keepS, loopS: sc.loopS, cast: sc.cast, marks: s.marks, marksPlus: sc.marksPlus ?? null, drawn,
        bubble: b?.visible === true ? b.text : null, insPgSeen: s.seen.includes('INS-PG'),
      } : null;
    });
    if (r !== null) {
      out.push(r);
      if (typeof r.keepS === 'number' && r.keepS >= stopS) break;
    }
    await sleep(250);
  }
  return out;
}
const LAST_LOOK_POSES = { inspector: ['front', 5], dog: ['head', 5], crow: ['head', 5], sensor7: ['headC', 5] };
const posesAre = (cast, want) => Object.entries(want).every(([id, [frame, r]]) => cast?.[id]?.frame === frame && cast?.[id]?.row === r);
// Turn away (KEEP 1.5 s on): the Inspector idle, the dog sits, the crow perches, Sensor 7 looks up.
const turnedAway = (cast) => /^idle/.test(cast?.inspector?.frame ?? '') && /^sit/.test(cast?.dog?.frame ?? '')
  && /^perch/.test(cast?.crow?.frame ?? '') && cast?.sensor7?.frame === 'headUp';

// Forces a line and waits (cap 2 s) for its bubble. Returns { said, text } (text null when no bubble showed).
async function sayText(page, id) {
  const said = await worldSay(page, id);
  let text = null;
  for (let i = 0; i < 20 && text === null; i++) {
    await sleep(100);
    const b = await page.evaluate(() => window.__wedtmd.worldBubble());
    if (b?.visible === true) text = b.text;
  }
  return { said, text };
}
// Cycle state the L checks read, plus the red ball on the living-world list.
const cycleProbe = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  const ball = (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === 'redBall' && e.visible === true);
  return s ? { cycle: s.cycle, marks: s.marks, girlStage: s.girlStage, readout: s.readout, redBall: ball } : null;
});
// The visible .wv.on box (client px) or null; the DOM the player sees.
const wvBox = (page) => page.evaluate(() => {
  const el = document.querySelector('.wv.on');
  if (!el || el.getClientRects().length === 0) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top };
});
async function waitBox(page, capMs) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const box = await wvBox(page);
    if (box !== null || Date.now() >= deadline) return box;
    await sleep(100);
  }
}

// I eras III-V (full edition): the rows per framing (s10, s11 / s13, s15), vents and the umbrella, puddle and sprout, the girl's five
// steps, nothing un-happens (S9 to S15), the era V double exposure (none under reduced motion), the Chladni rings (I_chladni), the reversed loops and the stare dog.
async function caseI(page) {
  if (await isDemo(page)) { skipAll(I_NAMES); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const progress = [];
  const f9 = await buyEra(page, S9);
  progress.push(await progressOf(page));
  const f10 = await buyEra(page, S10.slice(S9.length));
  const r10 = await waitRows(page, 's10', R6.s10, [], MACHINE_RANGE.s10);
  await check(page, 'I_s10_placed', f9.length === 0 && f10.length === 0 && r10.ok, { buyFail: [...f9, ...f10], problems: r10.problems }, true);

  const f11 = await buyEra(page, S11.slice(S10.length));
  progress.push(await progressOf(page));
  const r11 = await waitRows(page, 's11', R6.s11, [], MACHINE_RANGE.s11);
  await check(page, 'I_s11_placed', f11.length === 0 && r11.ok, { buyFail: f11, problems: r11.problems }, true);
  const ws11 = await worldSnap(page);
  const vis11 = await visibleIds(page);
  const umbrella = await variantSeen(page, 'inspector', 'umbrellaOpen', 4000);
  await check(page, 'I_umbrella', ws11 !== null && ws11.vents === true && umbrella, { vents: ws11?.vents ?? null, inspector: umbrella }, true);
  const era3PuddleSprout = ws11 !== null && ws11.puddle >= 1 && ws11.sprout >= 1 && vis11.includes('puddle') && vis11.includes('sprout');

  const f13 = await buyEra(page, S13.slice(S11.length));
  progress.push(await progressOf(page));
  const r13 = await waitRows(page, 's11', R6_ERA4, [], MACHINE_RANGE.s11);
  await check(page, 'I_s13_placed', f13.length === 0 && r13.ok, { buyFail: f13, problems: r13.problems }, true);
  // I_chladni (FX8, AD4 F7): the S13 standingWave buys raise the Chladni intensity; WORLD_CHLADNI.ringsByIntensity gives rings-3 at 1 and
  // rings-5 at 2. The visible `chladni` entry of livingWorld() shows one of them (rings-3 is polled for 3 s, else rings-5 for 0.5 s).
  const chladniState = await page.evaluate(() => window.__wedtmd.worldState()?.chladni ?? null);
  const rings = (await variantSeen(page, 'chladni', 'rings-3', 3000)) || (await variantSeen(page, 'chladni', 'rings-5', 500));
  await check(page, 'I_chladni', f13.length === 0 && chladniState !== null && chladniState >= 1 && rings, { buyFail: f13, chladni: chladniState, rings }, true);

  // Era V starts with nullChamber: the girl's first step. Then the steps in list order (lensArray, five horizonField, the rest).
  // I_girl_step_clamp: a 50 ms sampler of the girl's dy (nulls skipped), installed before the first era V buy; read and cleared after g5.
  await page.evaluate(() => {
    window.__dySamples = [];
    window.__dyTimer = setInterval(() => {
      const dy = window.__wedtmd.worldState()?.placements?.girl?.dy;
      if (typeof dy === 'number') window.__dySamples.push(dy);
    }, 50);
  });
  const f14 = await buyInTree(page, S14.slice(S13.length));
  await dismissEraCard(page);
  await sleep(300);
  const g1 = await girlStepsAt(page, 1);
  progress.push(await progressOf(page));
  const iLens = S15.indexOf('lensArray');
  const iHor = S15.indexOf('horizonField');
  const iSky = S15.indexOf('skyAperture');
  const fA = await buyInTree(page, S15.slice(S14.length, iLens + 1));
  const g2 = await girlStepsAt(page, 2);
  const fB = await buyInTree(page, S15.slice(iHor, iHor + 5));
  const g3 = await girlStepsAt(page, 3);
  const fC = await buyInTree(page, S15.slice(iHor + 5, iSky + 1));
  const g4 = await girlStepsAt(page, [4, 5]);
  const fD = await buyInTree(page, S15.slice(iSky + 1));
  await dismissEraCard(page);
  const g5 = await girlStepsAt(page, 5);
  progress.push(await progressOf(page));
  const r15 = await waitRows(page, 's15', R6.s15, INNER.s15, MACHINE_RANGE.s15);
  const fS15 = [...f14, ...fA, ...fB, ...fC, ...fD];
  await check(page, 'I_s15_placed', r15.ok && fS15.length === 0, { buyFail: fS15, problems: r15.problems }, true);
  const girls = [g1, g2, g3, g4, g5];
  // g4 may see 4 or 5 steps (the 8 h jump can land both); the others are exact.
  const stepsOk = g1.steps === 1 && g1.dy === 8 && g2.steps === 2 && g2.dy === 16 && g3.steps === 3 && g3.dy === 24
    && [4, 5].includes(g4.steps ?? -1) && g4.dy === 8 * (g4.steps ?? 0) && g5.steps === 5 && g5.dy === 40;
  await check(page, 'I_girl_steps', stepsOk, { girls }, true);
  // I_girl_step_clamp: stop the sampler; every rise between two samples is at most GIRL_STEP_MAX_PX, with at least 5 samples.
  const dySamples = await page.evaluate(() => {
    clearInterval(window.__dyTimer);
    const a = window.__dySamples ?? [];
    window.__dySamples = [];
    return a;
  });
  let maxRise = 0;
  for (let k = 1; k < dySamples.length; k++) maxRise = Math.max(maxRise, dySamples[k] - dySamples[k - 1]);
  await check(page, 'I_girl_step_clamp', dySamples.length >= 5 && maxRise <= GIRL_STEP_MAX_PX, { samples: dySamples.length, maxRise }, true);
  await check(page, 'I_nothing_unhappens', risesOnly(progress), { progress }, true);

  const ws15 = await worldSnap(page);
  const blackPuddle = await page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === 'puddle' && e.visible === true && /black/i.test(e.variant)));
  await check(page, 'I_puddle_sprout', era3PuddleSprout && ws15 !== null && ws15.sprout === 4 && blackPuddle,
    { era3: era3PuddleSprout, sprout15: ws15?.sprout ?? null, blackPuddle }, true);
  await check(page, 'I_reverse', ws15 !== null && ws15.era === 5 && ws15.reverse === true, { era: ws15?.era ?? null, reverse: ws15?.reverse ?? null }, true);
  eraVPeak = await page.evaluate(() => window.__wedtmd.displayObjects());

  // Era V double exposure: a flash within 75 s of scheduler time, then none for 100 s under reduced motion.
  const flash = await advanceUntil(page, 1000, 75, (s) => s.doubleExposures >= 1);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await sleep(300);
  const quietFrom = (await worldSnap(page))?.doubleExposures ?? 0;
  const reducedFlash = await advanceUntil(page, 1000, 100, (s) => s.doubleExposures > quietFrom);
  await check(page, 'I_double_exposure', flash !== null && reducedFlash === null,
    { full: flash?.doubleExposures ?? null, reducedFlash: reducedFlash?.doubleExposures ?? null }, true);

  // I_stare_dog: era V after the observer-one SYS LOG (the stare). STORY_BIBLE 5.5: a denizen at rest faces the camera, in motion it
  // shows its profile, so the dog's roam walk steps keep profile frames under the stare. Two close samples both on the front frame `head` at
  // different x is a sideways glide. Reduced motion goes back off so the dog roams as in play.
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: false }));
  await page.evaluate(() => window.__wedtmd.worldLogShown('observer-one'));
  let stareOn = null;
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const s = await worldSnap(page);
    if (s?.stare === true) {
      stareOn = true;
      break;
    }
  }
  const dogSamples = [];
  for (let i = 0; i < 24; i++) {
    await sleep(150);
    dogSamples.push(await page.evaluate(() => {
      const d = (window.__wedtmd.livingWorld() ?? []).find((e) => e.id === 'dog');
      return d ? { t: performance.now(), visible: d.visible === true, variant: String(d.variant), x: d.x } : null;
    }));
  }
  // A glide: two visible `head` samples at most 300 ms apart (a stall between them is skipped) whose x differs by more than 0.5.
  let glides = 0;
  for (let k = 1; k < dogSamples.length; k++) {
    const a = dogSamples[k - 1];
    const b = dogSamples[k];
    if (a && b && a.visible && b.visible && a.variant === 'head' && b.variant === 'head' && b.t - a.t <= 300 && Math.abs(b.x - a.x) > 0.5) {
      glides++;
    }
  }
  const walkSeen = dogSamples.some((s) => s !== null && s.visible && /^walk/.test(s.variant));
  await check(page, 'I_stare_dog', stareOn === true && glides === 0 && walkSeen,
    { stare: stareOn, glides, walkSeen, samples: dogSamples.map((s) => (s === null ? null : `${s.variant}@${s.x}`)) }, true);
}

// I_accent_still (FX8). The Inspector entry of livingWorld() sampled once per rendered frame (requestAnimationFrame) for ms of wall time:
// visible, variant and x. The probe changes only when a frame renders and a headless frame takes 100-150 ms, so a faster timer would only
// repeat a sample. Runs in the page.
const sampleInspector = (page, ms) => page.evaluate((capMs) => new Promise((resolve) => {
  const out = [];
  const t0 = performance.now();
  const tick = () => {
    const e = (window.__wedtmd.livingWorld() ?? []).find((x) => x.id === 'inspector');
    out.push({ t: performance.now(), visible: e?.visible === true, variant: String(e?.variant), x: e?.x });
    if (performance.now() - t0 >= capMs) resolve(out);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), ms);
// A slide: two CONSECUTIVE samples, both visible, the same write0 or front variant, at most 200 ms apart (ACCENT_GAP_MS: a headless frame
// runs 100-150 ms), whose x differs by more than 0.5.
// pairs counts the accent pairs compared (a run with pairs 0 proves nothing about slides).
const ACCENT_FRAMES = ['write0', 'front'];
const ACCENT_GAP_MS = 200;
// A window is covered (no vacuous pass) with at least ACCENT_MIN_SAMPLES samples spanning at least ACCENT_MIN_SPAN_MS.
const ACCENT_MIN_SAMPLES = 40;
const ACCENT_MIN_SPAN_MS = 7500;
function accentPairs(samples) {
  let pairs = 0;
  let slides = 0;
  for (let k = 1; k < samples.length; k++) {
    const a = samples[k - 1];
    const b = samples[k];
    if (!a.visible || !b.visible || a.variant !== b.variant || !ACCENT_FRAMES.includes(a.variant) || b.t - a.t > ACCENT_GAP_MS) continue;
    pairs++;
    if (Math.abs(b.x - a.x) > 0.5) slides++;
  }
  return { pairs, slides };
}
// The length test short-circuits, so an empty array is never indexed.
const accentCovered = (s) => s.length >= ACCENT_MIN_SAMPLES && s[s.length - 1].t - s[0].t >= ACCENT_MIN_SPAN_MS;
const accentSpanMs = (s) => (s.length === 0 ? 0 : Math.round(s[s.length - 1].t - s[0].t));

// M era IV chains (full edition): SYNCHRONIZATION (sync-success: DOG-09 and CRW-06 on one tick, unison, PAY-09 after) and ONE OBSERVER
// (observer-one: readout one, stare, INS-10 then GRL-09). I_accent_still reads the Inspector for 8 s before the stare and 8 s after it.
async function caseM(page) {
  if (await isDemo(page)) { skipAll(M_NAMES); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  // The buys run through the TECH INDEX, as in real play: the relocation gate places the era IV girl (GRL-09's speaker) only while the
  // tree is open, and a line needs its speaker on screen.
  const bought = await buyInTree(page, S13);
  await dismissEraCard(page);
  await sleep(500);
  // I_virga_frozen (AD4 F3): S13 bought in one go from era I; the virga strip shows its frozen frame (it kept falling before FX1).
  const virgaFrozen = await variantSeen(page, 'virga', 'frozen', 3000);
  await check(page, 'I_virga_frozen', bought.length === 0 && virgaFrozen, { virgaFrozen }, true);
  // I_accent_still (FX8): the Inspector for 8 s before the stare (the stare comes up with observer-one, below). Under CPU load a
  // write / front accent may not land in 8 s, so the window grows in 4 s steps (up to 20 s) until one same-variant pair is seen.
  const accBefore = await sampleInspector(page, 8000);
  for (let extra = 0; extra < 3 && accentPairs(accBefore).pairs === 0; extra++) accBefore.push(...(await sampleInspector(page, 4000)));
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  // Cadence (WP23b Z9): a fresh page has played under 90 s, so the first moment, the 60 s warm-up and the 120 s minGap block the lines
  // until the scheduler clock moves on (as F_no_repeat does).
  await page.evaluate(() => window.__wedtmd.worldAdvance(400000));
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldLogShown('sync-success'));
  // The reply queues DOG-09 and CRW-06 behind minGapMs (120 s from the start of the last line, here the INS-09 that the 400 s advance
  // played), so the unison can start up to about 120 s of scheduler time after the log: the cap is 300 s of 1 s steps.
  const sync = await advanceUntil(page, 1000, 300, (s) => s.activeLines.includes('DOG-09') && s.activeLines.includes('CRW-06'));
  const pay09 = sync === null ? null : await advanceUntil(page, 1000, 80, (s) => heldIn(s, 'PAY-09'));
  await check(page, 'I_sync', bought.length === 0 && sync !== null && sync.unison === true && pay09 !== null,
    { buyFail: bought, unison: sync?.unison ?? null, pay09: pay09 !== null }, true);

  // minGapMs (120 s) passes after PAY-09 before the observer-one reply.
  await page.evaluate(() => window.__wedtmd.worldAdvance(130000));
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldLogShown('observer-one'));
  // The readout and the stare come up after the reply: poll (cap 120 x 500 ms) and keep the first sample where both hold.
  let readoutOne = null;
  let stareOn = null;
  for (let i = 0; i < 120 && readoutOne === null; i++) {
    await page.evaluate(() => window.__wedtmd.worldAdvance(500));
    await sleep(120);
    const s = await worldSnap(page);
    if (s === null) break;
    if (s.readout === 'one' && s.stare === true) {
      readoutOne = s.readout;
      stareOn = s.stare;
    }
  }
  // I_accent_still (FX8): the Inspector for 8 s after the stare is on (none when it is not on: the check fails on stareOn).
  const accAfter = stareOn === true ? await sampleInspector(page, 8000) : [];
  let firstIns = null;
  let firstGrl = null;
  // INS-10 then GRL-09 (chain steps). The reply waits behind the minGap of the last line (120 s), so the cap is 300 s of 1 s steps.
  for (let i = 0; i < 300 && (firstIns === null || firstGrl === null); i++) {
    await page.evaluate(() => window.__wedtmd.worldAdvance(1000));
    await sleep(120);
    const s = await worldSnap(page);
    if (s === null) break;
    if (firstIns === null && heldIn(s, 'INS-10')) firstIns = i;
    if (firstGrl === null && heldIn(s, 'GRL-09')) firstGrl = i;
  }
  await check(page, 'I_one_observer', readoutOne === 'one' && stareOn === true && firstIns !== null && firstGrl !== null && firstIns <= firstGrl,
    { readout: readoutOne, stare: stareOn, insStep: firstIns, grlStep: firstGrl }, true);
  // I_accent_still (FX8): no slide in an accent or stare frame before or after the stare, a coverage gate of at least 40 samples spanning
  // at least 7500 ms per phase, and at least one accent pair per phase (so the check cannot pass vacuously). A walk frame is seen after the
  // stare (visible, so a hidden entry does not count).
  const slideB = accentPairs(accBefore);
  const slideA = accentPairs(accAfter);
  const walkSeenAfter = accAfter.some((s) => s.visible && /^walk/.test(s.variant));
  const accSample = (s) => `${s.variant}@${s.x}`;
  await check(page, 'I_accent_still', slideB.slides === 0 && slideA.slides === 0 && stareOn === true && accentCovered(accBefore) && accentCovered(accAfter) && slideB.pairs >= 1 && slideA.pairs >= 1 && walkSeenAfter,
    {
      slidesBefore: slideB.slides, slidesAfter: slideA.slides, stareOn, pairsBefore: slideB.pairs, pairsAfter: slideA.pairs, walkSeenAfter,
      samplesBefore: accBefore.length, samplesAfter: accAfter.length, spanBeforeMs: accentSpanMs(accBefore), spanAfterMs: accentSpanMs(accAfter),
      samples: { before: accBefore.slice(0, 24).map(accSample), after: accAfter.slice(0, 24).map(accSample) },
    }, true);
}

// J finale film (BD3, WP23b B-A5): restore times, shield, LAST LOOK, the crow flight, no bubble in the film, SKIP to the choice and the
// Z1 dog rule on the KEEP walk. The film times come from the hook (finaleSeek / script), the expected values mirror the design.
async function caseJ(page) {
  if (await isDemo(page)) { skipAll(J_NAMES); return; }
  const bought = await startFilm(page, false);
  const buyFail = bought.filter((x) => !x.endsWith(':true'));

  // Restore: row 4 a quarter second before each restore time, row 5 once the 0.4 s crossfade is over (the girl leaves at 31.5 s).
  const restores = [];
  for (const id of ['inspector', 'dog', 'crow', 'sensor7', 'girl']) {
    const t = restoreAt(FILM_HOME[id]);
    const before = brief(castOf(await probeFilm(page, t - 0.25), id));
    const after = id === 'girl' ? null : brief(castOf(await probeFilm(page, t + 0.55), id));
    restores.push({ id, t: Math.round(t * 100) / 100, before, after });
  }
  const restoreOk = buyFail.length === 0 && restores.every((r) => r.before !== null && r.before.visible === true && r.before.row === 4
    && (r.id === 'girl' || (r.after !== null && r.after.visible === true && r.after.row === 5)));
  await check(page, 'J_restore_times', restoreOk, { buyFail, restores }, true);

  // Shield poses from the beam (13 s) to the eclipse restore (19.3 s); the stare pose is back at 19.6 s.
  const sh15 = await probeFilm(page, 15);
  const sh196 = await probeFilm(page, 19.6);
  const shieldOk = castOf(sh15, 'inspector')?.frame === 'shield' && castOf(sh15, 'girl')?.frame === 'shield'
    && castOf(sh15, 'dog')?.frame === 'flat' && castOf(sh15, 'crow')?.frame === 'perch1' && castOf(sh196, 'inspector')?.frame === 'front';
  await check(page, 'J_shield', shieldOk, { at15: brief(castOf(sh15, 'inspector')), at196: brief(castOf(sh196, 'inspector')) }, true);

  // LAST LOOK: the flag edge is bisected in the film (50-62 s); the stare poses at row 5 snap there and the girl is gone.
  const lastAt = await filmEdge(page, 50, 62, (s) => s.script?.lastLook === true);
  const ll = await probeFilm(page, lastAt + 0.05);
  const llOk = Math.abs(lastAt - LAST_LOOK_S) <= 0.05 && ll.script?.lastLook === true && posesAre(ll.script?.cast, LAST_LOOK_POSES)
    && castOf(ll, 'girl')?.visible !== true;
  await check(page, 'J_last_look', llOk, { lastLookAt: Math.round(lastAt * 1000) / 1000, poses: brief(castOf(ll, 'inspector')) }, true);

  // Crow: takeoff 37 s (dx and dy climb), the lead flock 38-47.5 s (the world crow hidden, lead on the fx.bird pool), the glide 47.5-49.3 s.
  const c375 = castOf(await probeFilm(page, 37.5), 'crow');
  const at40 = await probeFilm(page, 40);
  const c485 = castOf(await probeFilm(page, 48.5), 'crow');
  const c498 = castOf(await probeFilm(page, 49.8), 'crow');
  const flightOk = c375?.visible === true && /^fly/.test(c375.frame) && c375.x > 3104 && c375.x < 3404
    && castOf(at40, 'crow')?.visible === false && at40.script?.lead?.row === 5 && /^fly/.test(at40.script?.lead?.frame ?? '')
    && c485?.visible === true && c485.x > 3104 && c485.x < 3624
    && c498?.visible === true && /^perch/.test(c498.frame) && Math.abs(c498.x - 3104) < 0.5;
  await check(page, 'J_crow_flight', flightOk, { takeoff: brief(c375), lead: at40.script?.lead ?? null, glide: brief(c485), back: brief(c498) }, true);

  // J_drawn: the entries livingWorld() draws (visible) at each seek, 350 ms after it. The girl leaves at 31.5 s, the lead flock flies
  // 38-47.5 s, and at LAST LOOK (59.9 s) the girl is gone while the other four and the restored window (girlWindow) are drawn.
  const drawn = {};
  for (const t of [30, 36, 40, 48.5, 59.9]) {
    await page.evaluate((x) => window.__wedtmd.finaleSeek(x), t);
    await sleep(350);
    drawn[String(t)] = await drawnIds(page);
  }
  const drawnAt = (t, id) => (drawn[String(t)] ?? []).includes(id);
  const drawnOk = drawnAt(30, 'girl') && !drawnAt(36, 'girl') && drawnAt(36, 'crow') && !drawnAt(40, 'crow')
    && drawnAt(40, 'inspector') && drawnAt(40, 'dog') && drawnAt(48.5, 'crow') && !drawnAt(59.9, 'girl')
    && ['inspector', 'dog', 'crow', 'sensor7'].every((id) => drawnAt(59.9, id))
    && drawnAt(59.9, 'girlWindow') && !drawnAt(36, 'girlWindow');
  await check(page, 'J_drawn', drawnOk, { drawn }, true);

  // No bubble in the film: the scheduler is silent while the film runs.
  await settle(page);
  const bubbles = [];
  for (const t of [20, 30, 40, 50, 60]) {
    await probeFilm(page, t);
    await sleep(250);
    bubbles.push(await bubbleVisible(page));
  }
  await check(page, 'J_no_bubble', bubbles.every((b) => b === false), { bubbles }, true);

  // SKIP lands in the choice with the LAST LOOK poses; KEEP IT RUNNING then runs the dog's walk (Z1, sampled for 10 s).
  await page.evaluate(() => window.__wedtmd.skipFinale());
  await sleep(400);
  const after = await page.evaluate(() => ({ phase: window.__wedtmd.session.state.ending.phase, lastLook: window.__wedtmd.worldState()?.script?.lastLook ?? null }));
  await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 8000 });
  const dog = dogRule(await sampleDog(page, 10000));
  await check(page, 'J_skip', after.phase === 'choice' && after.lastLook === true && dog.ok, { phase: after.phase, lastLook: after.lastLook, dog }, true);
}

// J_reduced: the same film under reduced motion: all whole at 24.3 s (no crossfade), the girl gone, shields stay, the crow cut at 38 s
// and back at 49.3 s, LAST LOOK instant.
async function caseJR(page) {
  if (await isDemo(page)) { skipAll(JR_NAMES); return; }
  await startFilm(page, true);
  const s15 = await probeFilm(page, 15);
  const s24 = await probeFilm(page, 24.5);
  const s36 = await probeFilm(page, 36);
  const s385 = await probeFilm(page, 38.5);
  const s50 = await probeFilm(page, 50);
  const s599 = await probeFilm(page, 59.9);
  const whole = ['inspector', 'dog', 'crow', 'sensor7'].every((id) => castOf(s24, id)?.row === 5 && castOf(s24, id)?.visible === true);
  const shields = castOf(s15, 'inspector')?.frame === 'shield' && castOf(s15, 'girl')?.frame === 'shield';
  const crowCut = castOf(s385, 'crow')?.visible === false && s385.script?.lead == null && castOf(s36, 'crow')?.visible === true
    && /^perch/.test(castOf(s36, 'crow')?.frame ?? '') && castOf(s50, 'crow')?.visible === true && castOf(s50, 'crow')?.frame === 'perch0';
  const lastLookNow = s599.script?.lastLook === true && posesAre(s599.script?.cast, LAST_LOOK_POSES);
  const reduced = s24.script?.reduced === true;
  await check(page, 'J_reduced', reduced && whole && castOf(s24, 'girl')?.visible !== true && shields && crowCut && lastLookNow,
    { reduced, whole, shields, crowCut, lastLookNow }, true);
}

// K postgame (WP23b B-A6, bible §9.2): KEEP turns everyone away, the crow's mark, the 90 s loop (the pat, INS-PG), PAY-12 after 600 s
// (its bubble above the booth hood, clear of the UI 150 and UI 100 buttons), the Sensor 7 turn after 1200 s. worldAdvance moves the postgame gates; the loop runs on the clock.
async function caseK(page) {
  if (await isDemo(page)) { skipAll(K_NAMES); skipCheck('G_display_peak'); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150, worldVoices: 'on' }));
  await toChoice(page, false);
  await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 8000 });
  const samples = await sampleKeep(page, 30, 42000);
  const between = (lo, hi) => samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= lo && s.keepS < hi);

  const lastLookSamples = between(0, 1.2);
  const awaySamples = between(2.2, 2.8);
  const turnOk = lastLookSamples.length > 0 && lastLookSamples.every((s) => posesAre(s.cast, LAST_LOOK_POSES))
    && awaySamples.length > 0 && awaySamples.every((s) => turnedAway(s.cast));
  await check(page, 'K_turn_away', turnOk, { lastLook: lastLookSamples.length, away: awaySamples.length }, true);

  // K_mark42: the drawn tally is state marks + the script's marksPlus (the crow's extra peck mark): 42 from keepS 5.5 on.
  const late = between(5.5, 1000);
  const tally = (s) => s.marks + (s.marksPlus ?? 0);
  const lastLate = late[late.length - 1] ?? null;
  await check(page, 'K_mark42', late.length > 0 && late.every((s) => tally(s) === 42),
    { marks: lastLate?.marks ?? null, marksPlus: lastLate?.marksPlus ?? null }, true);

  // The loop clock (script.loopS): the Inspector rests at home (784), crosses to the pat (742, pat frames at 14.5 s) and the dog sleeps at 732.
  const pat = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 14.6 && s.loopS < 19.9);
  const rest = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 1 && s.loopS < 12);
  const loopOk = pat.length > 0 && pat.every((s) => s.cast?.inspector?.x === 742 && /^pat/.test(s.cast?.inspector?.frame ?? ''))
    && rest.length > 0 && rest.every((s) => s.cast?.inspector?.x === 784 && s.cast?.dog?.x === 732);
  await check(page, 'K_loop', loopOk, { pat: pat.length, rest: rest.length }, true);

  // INS-PG: the pat says Good boy. in-world once; it never enters seen (scripted, not persisted).
  const insWin = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 14.4 && s.loopS < 21);
  await check(page, 'K_ins_pg', insWin.some((s) => s.bubble === 'Good boy.') && samples.every((s) => s.insPgSeen === false),
    { window: insWin.length }, true);

  // K_drawn: the girl figure is never drawn; the restored window (girlWindow) is drawn in every sample; the dog is hidden for keepS 4.6-6.9 and drawn from 9 s; the crow is drawn in every sample.
  const drawnGap = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 4.6 && s.keepS <= 6.9);
  const drawnLate = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 9);
  const drawnOk = samples.length > 0 && samples.every((s) => !s.drawn.includes('girl') && s.drawn.includes('crow'))
    && samples.every((s) => s.drawn.includes('girlWindow'))
    && drawnGap.length > 0 && drawnGap.every((s) => !s.drawn.includes('dog'))
    && drawnLate.length > 0 && drawnLate.every((s) => s.drawn.includes('dog'));
  await check(page, 'K_drawn', drawnOk, { samples: samples.length, gap: drawnGap.length, late: drawnLate.length }, true);

  // PAY-12 after 600 s of postgame: its bubble sits above the booth hood and clear of the UI 150 buttons.
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldAdvance(600000));
  let shown = false;
  for (let i = 0; i < 80 && !shown; i++) {
    await sleep(150);
    shown = await page.evaluate(() => {
      const b = window.__wedtmd.worldBubble();
      return b?.visible === true && b.text === 'Thank you for holding.';
    });
  }
  const m = shown ? await page.evaluate(measureInPage) : null;
  const c = m === null ? ['no-bubble-box'] : clashes(m);
  await check(page, 'K_pay12', shown && m !== null && m.dom !== null && m.bubble?.side === 'above' && !c.includes('hud-buttons'), { clashes: c, side: m?.bubble?.side ?? null }, true);

  // K_pay12_ui100 (AD4 F2): the same line forced at UI 100; its bubble stays above the booth hood and clear of the HUD buttons.
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 100 }));
  await sleep(600);
  await settle(page);
  const said100 = await worldSay(page, 'PAY-12');
  let shown100 = false;
  for (let i = 0; i < 40 && !shown100; i++) {
    await sleep(150);
    shown100 = await page.evaluate(() => {
      const b = window.__wedtmd.worldBubble();
      return b?.visible === true && b.text === 'Thank you for holding.';
    });
  }
  const m100 = shown100 ? await page.evaluate(measureInPage) : null;
  await check(page, 'K_pay12_ui100', said100 && shown100 && m100 !== null && m100.dom !== null && m100.bubble?.side === 'above' && !clashes(m100).includes('hud-buttons'), { said: said100, side: m100?.bubble?.side ?? null, clashes: m100 === null ? null : clashes(m100) }, true);
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await sleep(400);

  // Sensor 7 camera turn after 1200 s of postgame: head on the camera (headC) for 3 s, then back to headUp.
  await page.evaluate(() => window.__wedtmd.worldAdvance(600000));
  const scriptNow = () => page.evaluate(() => window.__wedtmd.worldState()?.script ?? null);
  let on = null;
  for (let i = 0; i < 100 && on === null; i++) {
    await sleep(150);
    const sc = await scriptNow();
    if (sc?.sensorTurn === true) on = { sensor7: sc.cast?.sensor7?.frame ?? null };
  }
  let off = null;
  for (let i = 0; i < 50 && on !== null && off === null; i++) {
    await sleep(150);
    const sc = await scriptNow();
    if (sc?.sensorTurn === false) off = { sensor7: sc.cast?.sensor7?.frame ?? null };
  }
  await check(page, 'K_sensor_turn', on !== null && on.sensor7 === 'headC' && off !== null && off.sensor7 === 'headUp', { on, off }, true);

  const postObjects = await page.evaluate(() => window.__wedtmd.displayObjects());
  await check(page, 'G_display_peak', eraVPeak !== null && eraVPeak <= 100 && postObjects <= 100, { eraV: eraVPeak, postgame: postObjects }, true);
}

// L cycles 2+ (B-A7, bible §9.3): cycle 2 and cycle 3 through session.beginNewCycle (the ending must be revealed: the choice).
async function caseL(page) {
  if (await isDemo(page)) { skipAll(L_NAMES); return; }
  await toChoice(page, false);
  const c1 = await cycleProbe(page);
  const began2 = await page.evaluate(() => window.__wedtmd.session.beginNewCycle());
  await sleep(1200);
  const c2 = await cycleProbe(page);
  await settle(page);
  // Right after beginNewCycle the onboarding prompt is a hard silence: one crank click, then 16 clicks pay for Gear Ratio. That first
  // purchase of the cycle arms the PAY-13 opener, so the INS-14 line comes after it.
  await crankClicks(page, 16, 0);
  const buyFirst = await buyList(page, ['gearRatio']);
  await settle(page);
  const ins14 = await sayText(page, 'INS-14');
  await settle(page);
  // PAY-13: the opener plays 60 s of scheduler time after that purchase (worldAdvance).
  const pay13 = await advanceUntil(page, 1000, 75, (s) => heldIn(s, 'PAY-13'));
  await settle(page);

  await toChoice(page, false);
  const began3 = await page.evaluate(() => window.__wedtmd.session.beginNewCycle());
  await sleep(1200);
  const c3 = await cycleProbe(page);
  // Cycle 3 starts the same way (crank, buy, settle) before the GRL-12 line.
  await crankClicks(page, 16, 0);
  const buyCycle3 = await buyList(page, ['gearRatio']);
  await settle(page);
  const grl12 = await sayText(page, 'GRL-12');

  await check(page, 'L_marks', began2 && began3 && c2?.marks === 42 && c3?.marks === 43, { cycle2: c2?.marks ?? null, cycle3: c3?.marks ?? null }, true);
  await check(page, 'L_readout', c2?.readout === 'one' && c3?.readout === 'one', { cycle2: c2?.readout ?? null, cycle3: c3?.readout ?? null }, true);
  await check(page, 'L_girl_stage', c2?.girlStage === 'mini' && c3?.girlStage === 'ground', { cycle2: c2?.girlStage ?? null, cycle3: c3?.girlStage ?? null }, true);
  await check(page, 'L_red_ball', c1 !== null && c1.redBall === false && c2?.redBall === true && c3?.redBall === true,
    { cycle1: c1?.redBall ?? null, cycle2: c2?.redBall ?? null, cycle3: c3?.redBall ?? null }, true);
  await check(page, 'L_pay13', buyFirst.length === 0 && pay13 !== null, { buyFail: buyFirst }, true);
  await check(page, 'L_cyc_lines', ins14.said && ins14.text === INS14_TEXT && grl12.said && grl12.text === GRL12_CYCLE3 && buyCycle3.length === 0,
    { ins14, grl12, buyFail: [...buyFirst, ...buyCycle3] }, true);
}

// F23 (Z12, the WP23b repo guard): the bubble box must not flip. Viewport 1280x800, era II entry (S8). Six forced PAY-03 lines; per line,
// seven samples of the .wv.on box over 700 ms after it turns on: its left and top stay within 4 px of the first sample.
async function caseF23(page) {
  await crankClicks(page, 45, 0);
  const buyFail = await buyInTree(page, S8);
  await dismissEraCard(page);
  await sleep(300);
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  const rounds = [];
  for (let i = 0; i < 6; i++) {
    await settle(page);
    const said = await worldSay(page, 'PAY-03');
    const box = await waitBox(page, 3000);
    const samples = [box];
    if (box !== null) {
      for (let k = 1; k < 7; k++) {
        await sleep(700 / 6);
        samples.push(await wvBox(page));
      }
    }
    const first = samples[0];
    const flips = samples.filter((b) => b === null || first === null || Math.abs(b.l - first.l) > 4 || Math.abs(b.t - first.t) > 4).length;
    rounds.push({ said, first, flips });
  }
  await check(page, 'F23_no_flip', buyFail.length === 0 && rounds.length === 6 && rounds.every((r) => r.said && r.first !== null && r.flips === 0),
    { buyFail, rounds }, true);
}

// One fresh context per case. Errors are tagged with the case key that is current when they happen.
// An exception becomes FAILED:<case>:<message> in fail. viewport defaults to 1280x720 (F23 runs at 1280x800).
async function runCase(browser, key, fn, viewport = { width: 1280, height: 720 }) {
  currentKey = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watchPage(page, errors, tag);
    await page.goto(target, { waitUntil: 'load' });
    await waitReady(page);
    await fn(page);
  } catch (e) {
    fail.push(`FAILED:${key}:${firstLine(e)}`);
  } finally {
    if (ctx) await ctx.close();
  }
}

// ONLY (env): a comma list of case keys to run alone (A B C D E F G H I M J JR K L F23); unset runs every case. An unknown key exits 2.
const CASE_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'M', 'J', 'JR', 'K', 'L', 'F23'];
const ONLY = (process.env.ONLY ?? '').split(',').map((k) => k.trim()).filter((k) => k !== '');
const badKey = ONLY.find((k) => !CASE_KEYS.includes(k));
if (badKey !== undefined) {
  console.error('ONLY: unknown case key ' + badKey + ' (keys: ' + CASE_KEYS.join(',') + ')');
  process.exit(2);
}
const runs = (key) => ONLY.length === 0 || ONLY.includes(key);

let browser = null;
try {
  browser = await chromium.launch();
  if (runs('A')) await runCase(browser, 'A', caseA);
  if (runs('B')) await runCase(browser, 'B', caseB);
  if (runs('C')) await runCase(browser, 'C', caseC);
  if (runs('D')) await runCase(browser, 'D', caseD);
  if (runs('E')) await runCase(browser, 'E', caseE);
  if (runs('F')) await runCase(browser, 'F', caseF);
  if (runs('G')) await runCase(browser, 'G', caseG);
  if (runs('H')) await runCase(browser, 'H', caseH);
  if (runs('H')) await runCase(browser, 'H', caseHOver);
  if (runs('I')) await runCase(browser, 'I', caseI);
  if (runs('M')) await runCase(browser, 'M', caseM);
  if (runs('J')) await runCase(browser, 'J', caseJ);
  if (runs('JR')) await runCase(browser, 'JR', caseJR);
  if (runs('K')) await runCase(browser, 'K', caseK);
  if (runs('L')) await runCase(browser, 'L', caseL);
  if (runs('F23')) await runCase(browser, 'F23', caseF23, { width: 1280, height: 800 });
} catch (e) {
  fail.push(`FAILED:setup:${firstLine(e)}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
