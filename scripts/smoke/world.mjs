// WP23a living-world smoke (T12): denizens freeze and step, the first line's bubble and its layout at UI 100 and 150, hard
// silence per state, the placements per framing, the WORLD VOICES setting, the save and the frame budget. Cases A to G, one
// fresh 1280x720 context per case. Why: the living world is a layer, so every check reads the debug hook (window.__wedtmd)
// and the DOM only.
// Usage: PW_PATH=<playwright> node scripts/smoke/world.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty. Runs on :4174 and :4177.
// Timing is deterministic: worldAdvance moves the scheduler clock and the play time, worldLogShown feeds the SYS LOG port,
// worldSay forces a line past gaps and caps (not past hard silence). The demo edition refuses era III, so G_era3_hidden is
// recorded as a skip there (value.skipped).
import fs from 'fs';
import path from 'path';
import {
  S7, S9, makeReport, watchPage, waitReady, crankClicks, buyInPage, buyList, dismissEraCard, loadChromium, withQuery,
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

// G budget: the display list and the per-frame cost at era II full; era III hidden once the TECH INDEX has opened and closed.
async function caseG(page) {
  await crankClicks(page, 45, 0);
  const buyS9 = await buyList(page, S9);
  await sleep(300);
  const objects = await page.evaluate(() => window.__wedtmd.displayObjects());
  await check(page, 'G_display', typeof objects === 'number' && objects <= 100 && buyS9.length === 0, { objects, buyFail: buyS9 }, true);

  const samples = [];
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    samples.push(await page.evaluate(() => window.__wedtmd.worldStats()?.meanMs ?? null));
  }
  const numeric = samples.every((x) => typeof x === 'number');
  const meanMs = numeric ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
  await check(page, 'G_cost', numeric && meanMs <= 0.3, { meanMs, samples: samples.length }, true);

  const demo = await page.evaluate(() => window.__wedtmd.session.purchase('boiler').reason === 'demo');
  if (demo) {
    await check(page, 'G_era3_hidden', true, { skipped: 'demo edition: era III is refused, so there is no era III entry' }, true);
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
  await check(page, 'G_era3_hidden', st.entries > 0 && !st.anyVisible && st.hidden === true, { bought, ...st }, true);
}

// One fresh context per case. Errors are tagged with the case key that is current when they happen.
// An exception becomes FAILED:<case>:<message> in fail.
async function runCase(browser, key, fn) {
  currentKey = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
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

let browser = null;
try {
  browser = await chromium.launch();
  await runCase(browser, 'A', caseA);
  await runCase(browser, 'B', caseB);
  await runCase(browser, 'C', caseC);
  await runCase(browser, 'D', caseD);
  await runCase(browser, 'E', caseE);
  await runCase(browser, 'F', caseF);
  await runCase(browser, 'G', caseG);
} catch (e) {
  fail.push(`FAILED:setup:${firstLine(e)}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
