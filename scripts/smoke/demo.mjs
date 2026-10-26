// WP21 Steam demo smoke (demo build, real browser). Cases A and B are here; C to F live in demo-cases.mjs.
// A: fresh start (title, tech tree with the era cap, SYSTEM menu). B: reach the Substation Blueprint cap (waiting,
// teaser, END OF DEMO card, wishlist, keep, tree, SYSTEM row). C continues the page of B.
// WP23a living world: B_bubble_hidden_teaser (no bubble during the teaser), B_no_spoiler_bubble (the RESTOR scan with a
// bubble on screen, end of B), G = POST-CAP on a fresh page (KEEP TINKERING, one tape freeze, PAY-05 / INS-07 / GRL-06 / DOG-12, reload).
// Usage: PW_PATH=... node scripts/smoke/demo.mjs "<demo preview base URL, no query>" <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { caseC, caseD, caseE, caseF } from './demo-cases.mjs';
import { APP_VERSION } from './lib/common.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);

const [rawBase, outArg] = process.argv.slice(2);
if (!rawBase || !outArg) {
  console.error('usage: node scripts/smoke/demo.mjs "<base URL, no query>" <outdir>');
  process.exit(2);
}
// The base takes no query: each run adds its own (?debug=1, or ?debug=1&title=1 for the title screen).
const base = rawBase.split('?')[0].replace(/\/?$/, '/');
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });

// Copies of the stages.mjs lists. S7 is the first machine; S9 is the list that reaches the era II cap.
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];

const VERSION_LINE = `v${APP_VERSION} · DEMO · SAVE v2`;
// The cap caption keeps the function name masked: the teaser must not spoil the full game.
const CAP_CAPTION = 'PRIMARY FUNCTION: RES?OR?';
// The name plate frame at the cap (RES?OR?). Text on canvas is invisible to innerText, so the frame is the check.
const PLATE_REDACTED = 2;
const CARD_TITLE = 'END OF DEMO — THE MACHINE IS NOT FINISHED.';
// The store page is answered offline by the route in run(); the popup must land on this app page.
const WISHLIST_PREFIX = 'https://store.steampowered.com/app/0000000/';
// The trigger delay is 4000 ms; 3800 leaves slack for the gap between the purchase and capAt.
const TEASER_START_TIMEOUT_MS = 8000;
const TEASER_MIN_DELAY_MS = 3800;
const TEASER_RUN_TIMEOUT_MS = 60000;
const TEASER_SAMPLE_MS = 100;
// WP23a living world. Canon lines verbatim from STORY_BIBLE §5.2 (plain Node smokes cannot import src/data/livingWorld.ts).
const GRL05 = { id: 'GRL-05', text: 'It gets bigger. Then it gets strange.' };
// POST-CAP (bible §8.2): PAY-05 20 s after KEEP TINKERING, then each line at least 2 min after the one before (125 s
// clears the 120 s gap). The tape freeze is 1.2 s (tapeFreezeMs).
const POST_CAP_FIRST_MS = 21000;
const POST_CAP_GAP_MS = 125000;
// Minimum hold the G_freeze watch accepts. tapeFreezeMs is 1200 of scene time; 1000 leaves slack for the frame the
// freeze starts on (scene time never runs faster than wall time).
const TAPE_FREEZE_MIN_HOLD_MS = 1000;
const POST_CAP = [
  { id: 'PAY-05', text: "We're sorry. This call cannot be completed.", check: 'G_pay05' },
  { id: 'INS-07', text: "Rusting doesn't fit anymore.", check: 'G_ins07' },
  { id: 'GRL-06', text: 'The rest of it is further up. I saw it too.', check: 'G_grl06' },
  { id: 'DOG-12', text: 'Stay. Wait for it. Good boy.', check: 'G_dog12' },
];

const results = {}, fail = [], errors = [];
let currentKey = 'setup';
let browser = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const firstLine = (e) => String(e && e.message ? e.message : e).split('\n')[0];
// A detail is recorded only on failure, so a passing check stays a plain boolean in results.
const failDetail = (cond, value) => (cond ? undefined : value);

const demoState = (page) => page.evaluate(() => window.__wedtmd.demoState());
const showcaseState = (page) => page.evaluate(() => window.__wedtmd.showcaseState());
const totalClicks = (page) => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
const cardOpen = (page) => page.evaluate(() => document.getElementById('demo-end')?.classList.contains('is-open') === true);
const focusInCard = (page) => page.evaluate(() => {
  const card = document.getElementById('demo-end');
  return card !== null && card.contains(document.activeElement);
});

// Era tabs as the player sees them: label and disabled flag of each `.tech-tab`.
const tabRow = (page) => page.$$eval('.tech-tab', (tabs) => tabs.map((t) => ({ text: (t.textContent || '').trim(), disabled: t.disabled === true })));
// The demo cap: five era tabs, era I open, eras III to V shown as FULL GAME and disabled.
function demoTabsOk(tabs) {
  const [first] = tabs;
  return tabs.length === 5 && first !== undefined && first.text.startsWith('ERA I') && !first.disabled
    && tabs.slice(2).every((t) => t.text === 'FULL GAME' && t.disabled);
}

// Generic save editor, registered on every context. The flag makes it apply once. It runs before the app reads the
// save, so the edit survives the app's pagehide flush, which would overwrite a direct localStorage edit.
function saveEditor() {
  try {
    const flag = sessionStorage.getItem('wedtmd.smokeEdit');
    if (flag === null) return;
    sessionStorage.removeItem('wedtmd.smokeEdit');
    const data = JSON.parse(localStorage.getItem('wedtmd.save'));
    const sim = data.state.lastSimTime;
    for (const op of JSON.parse(flag)) {
      const keys = op.path.split('.');
      const last = keys.pop();
      let node = data;
      for (const k of keys) node = node[k];
      if ('add' in op) node[last] = node[last] + op.add;
      else node[last] = op.set === '$lastSimTime' ? sim : op.set;
    }
    const s = JSON.stringify(data);
    localStorage.setItem('wedtmd.save', s);
    sessionStorage.setItem('wedtmd.smokeEditS', s);
  } catch {
    // the case fails on its own checks
  }
}

// In-page buy loop, same rules as the ux.mjs buyList, but it returns one 'id:result' string per entry.
// '@<tech>:<n>' buys until level n; '@<tech>' jumps 8 h until owned ('@blueprint' = generatorBlueprint);
// a plain id jumps once wornMotor is owned, then buys and retries after a jump up to 6 times.
function buyInPage(list) {
  const s = window.__wedtmd.session;
  const lines = [];
  let t = Math.max(Date.now(), s.state.lastSimTime || 0);
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of list) {
    if (id.startsWith('@') && id.includes(':')) {
      const [tech, nStr] = id.slice(1).split(':');
      const n = +nStr;
      for (let k = 0; k < 128 && s.state.techLevels[tech] < n; k++) {
        let r = s.purchase(tech);
        while (r.ok && s.state.techLevels[tech] < n) r = s.purchase(tech);
        if (s.state.techLevels[tech] < n) jump();
      }
      lines.push(`${id}:${s.state.techLevels[tech] >= n}`);
      continue;
    }
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      lines.push(`${id}:${s.state.techLevels[tech] === 1}`);
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
    lines.push(`${id}:${r.ok}`);
  }
  return lines;
}

// Real mouse clicks on the crank. The point is re-read before each click, so a moved camera is followed.
async function crankClicks(page, n) {
  for (let i = 0; i < n; i++) {
    const p = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    await page.mouse.click(p.x, p.y);
  }
}

// 45 crank clicks first (the first machine needs them), then the in-page buy loop.
async function buys(page, list) {
  await crankClicks(page, 45);
  return page.evaluate(buyInPage, list);
}

// Waits for the debug hook; handCrank exists once the World scene is built.
const waitForHook = (page) => page.waitForFunction(
  () => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'),
  null,
  { timeout: 15000 },
);

async function reload(page) {
  await page.reload({ waitUntil: 'load' });
  await waitForHook(page);
  await sleep(400);
}

// Polls the demo phase every 50 ms. Resolves the ms waited, or null on timeout (0 is a valid wait).
async function waitPhase(page, phase, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    if ((await demoState(page))?.phase === phase) return Date.now() - t0;
    if (Date.now() - t0 >= timeoutMs) return null;
    await sleep(50);
  }
}

// The ops go to sessionStorage; saveEditor applies them on the next navigation (see saveEditor above).
const editOnNextLoad = (page, ops) => page.evaluate((list) => sessionStorage.setItem('wedtmd.smokeEdit', JSON.stringify(list)), ops);
const editedSave = (page) => page.evaluate(() => sessionStorage.getItem('wedtmd.smokeEditS'));

// One fresh context and page per run. Errors are tagged with the case key that is current when they happen.
async function run(key, fn, opts = {}) {
  currentKey = key;
  const query = opts.query ?? '?debug=1';
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    // the wishlist button opens the store page; answer it offline so the popup resolves
    await ctx.route('https://store.steampowered.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    await ctx.addInitScript(saveEditor);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${currentKey}: console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${currentKey}: pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`${currentKey}: requestfailed: ${r.url()} ${r.failure() ? r.failure().errorText : ''}`));
    await page.goto(base + query, { waitUntil: 'load' });
    await waitForHook(page);
    await fn(page);
  } catch (e) {
    // the key is the current one: a case that tagged itself (B hands over to C) reports under its own key
    fail.push(`FAILED:${currentKey}:${firstLine(e)}`);
  } finally {
    if (ctx) await ctx.close();
  }
}

// The kit demo-cases.mjs consumes. Names and signatures are a contract: do not rename.
const kit = {
  base,
  out,
  ok(name, cond, detail) {
    results[name] = detail ?? !!cond;
    if (!cond) fail.push(name);
  },
  note(name, value) {
    results[name] = value;
  },
  shot: (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) }),
  sleep,
  text: (page, sel) => page.$eval(sel, (el) => (el.textContent || '').trim()).catch(() => null),
  visible: (page, sel) => page.locator(sel).first().isVisible().catch(() => false),
  crankClicks,
  buys,
  S9: [...S9],
  demo: demoState,
  showcase: showcaseState,
  waitPhase,
  reload,
  editOnNextLoad,
  editedSave,
  tag(key) {
    currentKey = key;
  },
  run,
};

// Case A, fresh game with the title screen: the title names the demo, the tree stops at era II, the SYSTEM menu
// has no MEMORY tab and no DEMO ENDING row yet.
async function caseA(page) {
  kit.ok('A_title_demo', (await kit.text(page, '#title-version')) === VERSION_LINE);
  await kit.shot(page, 'demo-A1-title');
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.keyboard.press('t');
  await sleep(400);
  const tabs = await tabRow(page);
  const tabsOk = demoTabsOk(tabs);
  kit.ok('A_tabs_full_game', tabsOk, failDetail(tabsOk, tabs));
  await kit.shot(page, 'demo-A2-tree');
  // the demo refusal comes before the lock and cost checks, so a fresh save still gets reason 'demo'
  const refused = await page.evaluate(() => {
    const r = window.__wedtmd.session.purchase('boiler');
    return { ok: r.ok, reason: r.reason ?? null };
  });
  const refusedOk = refused.ok === false && refused.reason === 'demo';
  kit.ok('A_era3_refused', refusedOk, failDetail(refusedOk, refused));
  // Esc closes the tree; the next Esc opens the SYSTEM menu
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await sleep(400);
  kit.ok('A_footer_demo', (await kit.text(page, '#sys-footer')) === VERSION_LINE);
  kit.ok('A_memory_hidden', !(await kit.visible(page, '#sys-tab-memory')));
  kit.ok('A_demo_row_hidden', !(await kit.visible(page, '#sys-demo-end')));
  await page.click('#sys-tab-records', { timeout: 3000 }).catch(() => {});
  await sleep(300);
  // the demo edition lists 20 records; the full game lists more
  kit.ok('A_records_20', /\/20 /.test((await kit.text(page, '.ach-counter')) ?? ''));
  await kit.shot(page, 'demo-A3-menu');
}

// Era III is refused by the demo edition: the tech view says demoLocked / locked, purchase says 'demo'.
async function checkBoilerLocked(page) {
  const boiler = await page.evaluate(() => {
    const s = window.__wedtmd.session;
    const view = s.getTechView('boiler');
    const r = s.purchase('boiler');
    return { demoLocked: view.demoLocked, status: view.status, reason: r.reason ?? null };
  });
  const lockedOk = boiler.demoLocked === true && boiler.status === 'locked' && boiler.reason === 'demo';
  kit.ok('B_boiler_locked', lockedOk, failDetail(lockedOk, boiler));
}

// The teaser shows the masked cap caption, hides the HUD and does not leak the function name.
async function checkTeaserFrame(page) {
  const caption = await kit.text(page, '#demo-teaser-caption');
  const captionOk = caption === CAP_CAPTION && (await kit.visible(page, '#demo-teaser'));
  kit.ok('B_caption', captionOk, failDetail(captionOk, caption));
  kit.ok('B_hud_hidden', await page.evaluate(() => {
    const hud = document.getElementById('hud-panel');
    return hud !== null && getComputedStyle(hud).visibility === 'hidden';
  }));
  const bodyText = await page.evaluate(() => document.body.innerText);
  kit.ok('B_no_spoiler', !bodyText.includes('RESTOR'));
}

// WP23a: re-evaluates fn(arg) in the page every 100 ms until it is truthy or capMs passed. Resolves the last value.
async function pollPage(page, fn, arg, capMs) {
  const t0 = Date.now();
  for (;;) {
    const v = await page.evaluate(fn, arg);
    if (v || Date.now() - t0 >= capMs) return v;
    await sleep(100);
  }
}

// Page-side predicates (self-contained: page.evaluate sends the source). A shown bubble is `.wv.on`; the probe never gets `on`.
const bubbleSays = (text) => {
  const b = window.__wedtmd.worldBubble();
  return b !== null && b.visible === true && b.text === text && document.querySelectorAll('.wv.on').length > 0;
};
const seenHas = (id) => (window.__wedtmd.worldState()?.seen ?? []).includes(id);

// WP23a: no bubble during the teaser. GRL-05 is forced and must be refused (teaser silence). The hook has to answer,
// or a missing director would pass the check vacuously.
async function checkTeaserBubble(page) {
  const said = await page.evaluate((id) => window.__wedtmd.worldSay(id), GRL05.id);
  await sleep(300);
  const probe = await page.evaluate(() => {
    const hook = window.__wedtmd;
    const bubble = hook.worldBubble();
    return {
      hook: hook.worldState() !== null,
      phase: hook.demoState()?.phase ?? null,
      shown: document.querySelectorAll('.wv.on').length,
      bubble: bubble === null ? null : bubble.visible,
    };
  });
  // said is the worldSay answer: the World sleeps during the teaser, so the forced line must be refused (false).
  const ok = probe.hook && probe.phase === 'teaser' && probe.shown === 0 && probe.bubble !== true && said === false;
  kit.ok('B_bubble_hidden_teaser', ok, { said, ...probe });
}

// Takes one shot per teaser stage, at the first sample that shows the stage.
async function snapTeaser(page, sc, seen) {
  if (!seen.era3 && sc.era >= 3) {
    seen.era3 = true;
    await kit.shot(page, 'demo-B1-teaser-era3');
  }
  if (!seen.era5 && sc.era === 5 && !sc.apertureOpen) {
    seen.era5 = true;
    await kit.shot(page, 'demo-B2-teaser-era5');
  }
  if (!seen.end && sc.done === true) {
    seen.end = true;
    await kit.shot(page, 'demo-B3-teaser-end');
  }
}

// Samples the teaser every 100 ms until the card opens. The era III shot is required; the era V and end shots
// are optional and only noted when missed, because the sample may land between two stages. Returns the plate
// frame of every live sample (null samples, teaser not running, are skipped).
async function followTeaser(page) {
  const seen = { era3: false, era5: false, end: false };
  const plates = [];
  const deadline = Date.now() + TEASER_RUN_TIMEOUT_MS;
  let cardOpened = false;
  while (Date.now() < deadline) {
    if ((await demoState(page))?.phase === 'card') {
      cardOpened = true;
      break;
    }
    const sc = await showcaseState(page);
    if (sc !== null) {
      plates.push(sc.plateFrame);
      await snapTeaser(page, sc, seen);
    }
    await sleep(TEASER_SAMPLE_MS);
  }
  kit.ok('B_teaser_to_card', cardOpened);
  kit.ok('B_era3_seen', seen.era3);
  if (!seen.era5) kit.note('B2_missed', true);
  if (!seen.end) kit.note('B3_missed', true);
  return plates;
}

// Once the card is up the teaser has reached era V with the aperture open. The teaser is display only:
// the ending phase stays 'none'.
async function checkTeaserEnd(page) {
  const sc = await showcaseState(page);
  const endPhase = await page.evaluate(() => window.__wedtmd.session.state.ending.phase);
  const endOk = sc !== null && sc.era === 5 && sc.apertureOpen === true && sc.done === true && endPhase === 'none';
  kit.ok('B_teaser_end', endOk, failDetail(endOk, { sc, endPhase }));
}

// The END OF DEMO card: wishlist has focus, QUIT and FEEDBACK are hidden (web, no feedback URL), Tab stays inside.
async function checkCard(page) {
  const d = await demoState(page);
  kit.ok('B_card_open', (await cardOpen(page)) && d?.phase === 'card');
  kit.ok('B_card_title', (await kit.text(page, '#demo-end-title')) === CARD_TITLE);
  kit.ok('B_card_focus', await page.evaluate(() => document.activeElement?.id === 'demo-wishlist'));
  kit.ok('B_quit_hidden', !(await kit.visible(page, '#demo-quit')));
  kit.ok('B_feedback_hidden', !(await kit.visible(page, '#demo-feedback')));
  const inCard = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    inCard.push(await focusInCard(page));
  }
  const trapped = inCard.every(Boolean);
  kit.ok('B_tab_trap', trapped, failDetail(trapped, inCard));
  await kit.shot(page, 'demo-B4-card');
}

// The wishlist button opens the store page and leaves the card open.
async function wishlist(page) {
  let popup = null;
  try {
    [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 5000 }),
      page.click('#demo-wishlist', { timeout: 3000 }),
    ]);
  } catch {
    popup = null;
  }
  // the URL is only final after the popup loads; a load error still leaves the URL to compare
  if (popup !== null) await popup.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  const url = popup === null ? null : popup.url();
  const opened = url !== null && url.startsWith(WISHLIST_PREFIX) && (await cardOpen(page));
  kit.ok('B_wishlist', opened, failDetail(opened, url));
  if (popup !== null) await popup.close().catch(() => {});
}

// KEEP TINKERING closes the card and the teaser layer and hands the game back: one crank click counts again.
async function keepAndCrank(page) {
  await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
  await sleep(500);
  const layers = await page.evaluate(() => ({
    cardOpen: document.getElementById('demo-end')?.classList.contains('is-open') === true,
    teaserRoot: document.getElementById('ui-root')?.classList.contains('demo-teaser-on') === true,
    modals: window.__wedtmd.modalCount(),
  }));
  const sc = await showcaseState(page);
  const d = await demoState(page);
  const keptOk = !layers.cardOpen && !layers.teaserRoot && layers.modals === 0
    && d?.phase === 'idle' && (sc === null || sc.active !== true);
  kit.ok('B_keep', keptOk, failDetail(keptOk, { layers, phase: d?.phase ?? null }));
  // after KEEP, focus must be back on TECH INDEX (#hud-tech), the button that opened the tree: outside the tree, visible
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      exists: el !== null,
      tag: el ? el.tagName : null,
      id: el ? el.id : null,
      body: el === document.body,
      connected: el !== null && el.isConnected,
      rects: el !== null ? el.getClientRects().length : 0,
      inTree: el !== null && el.closest('#tech-overlay') !== null,
    };
  });
  const focusOk = focus.exists && !focus.body && focus.connected && focus.rects > 0 && !focus.inTree
    && focus.id === 'hud-tech';
  kit.ok('B_keep_focus', focusOk, failDetail(focusOk, focus));
  const before = await totalClicks(page);
  await kit.crankClicks(page, 1);
  await sleep(250);
  const after = await totalClicks(page);
  kit.ok('B_keep_crank', after === before + 1, failDetail(after === before + 1, { before, after }));
  // the cap leaves two resource rows (era I and era II) on the HUD
  const rows = await page.evaluate(() => [...document.querySelectorAll('.hud-res-row')]
    .filter((e) => e.style.display !== 'none' && e.getClientRects().length > 0).length);
  kit.ok('B_hud_rows', rows === 2, failDetail(rows === 2, rows));
  await kit.shot(page, 'demo-B5-keep');
}

// The tree still shows the cap after keep: same tab predicate as case A.
async function treeAfter(page) {
  await page.keyboard.press('t');
  await sleep(400);
  const tabs = await tabRow(page);
  const tabsOk = demoTabsOk(tabs);
  kit.ok('B_tree_after', tabsOk, failDetail(tabsOk, tabs));
  await page.keyboard.press('Escape');
  await sleep(300);
}

// The SYSTEM row reopens the card from the menu (no teaser behind it); Esc on the card keeps the game.
async function systemRow(page) {
  await page.keyboard.press('Escape');
  await sleep(400);
  const rowVisible = await kit.visible(page, '#sys-demo-end');
  const rowText = await kit.text(page, '#sys-demo-end');
  await page.click('#sys-demo-end', { timeout: 3000 }).catch(() => {});
  await sleep(400);
  const menuClosed = (await page.evaluate(() => window.__wedtmd.systemMenuOpen())) === false;
  const open = await cardOpen(page);
  const rowOk = rowVisible && rowText === 'DEMO ENDING' && menuClosed && open;
  kit.ok('B_system_row', rowOk, failDetail(rowOk, { rowVisible, rowText, menuClosed, open }));
  await page.keyboard.press('Escape');
  await sleep(400);
  const d = await demoState(page);
  kit.ok('B_esc_keeps', !(await cardOpen(page)) && d?.phase === 'idle');
}

// WP23a: B_no_spoiler again with a world bubble on screen. Runs after the card and the SYSTEM row, when the world is awake:
// the first moment (a crank click, a purchase, 120 s of play) passes and GRL-05 is shown by force (worldSay). The same
// innerText scan as B_no_spoiler must find no RESTOR. Its own check name, so B_no_spoiler keeps its teaser value.
async function checkBubbleSpoiler(page) {
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  await page.evaluate(() => { const c = document.getElementById('era-card'); if (c && !c.hidden) c.click(); });
  await kit.crankClicks(page, 1);
  const bought = await page.evaluate(() => window.__wedtmd.session.purchase('copperWinding').ok);
  await page.evaluate(() => window.__wedtmd.worldAdvance(120000));
  const said = await page.evaluate((id) => window.__wedtmd.worldSay(id), GRL05.id);
  const shown = await pollPage(page, bubbleSays, GRL05.text, 8000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const ok = shown === true && !bodyText.includes('RESTOR');
  kit.ok('B_no_spoiler_bubble', ok, failDetail(ok, { said, shown, bought, restor: bodyText.includes('RESTOR') }));
}

// Case B, fresh game (no title). Buy the era II list and the Substation Blueprint, the cap. The teaser runs, then
// the END OF DEMO card takes focus. The page stays open for case C.
async function caseB(page) {
  const buyResult = await kit.buys(page, [...kit.S9, '@substationBlueprint']);
  const capAt = Date.now();
  const bad = buyResult.filter((r) => !r.endsWith(':true'));
  kit.ok('B_s9_buys', bad.length === 0, failDetail(bad.length === 0, bad));
  kit.ok('B_cap_owned', (await page.evaluate(() => window.__wedtmd.session.state.techLevels.substationBlueprint)) === 1);
  // read at once: the trigger delay (4 s) has not run out yet
  kit.ok('B_waiting', (await demoState(page))?.phase === 'waiting');
  // the live World plate while the cap waits; the teaser must keep this frame (B_plate_redacted)
  const livePlate = await page.evaluate(() => window.__wedtmd.componentState('namePlate')?.frame ?? null);
  // the tree is open when the teaser starts (opened with the TECH INDEX button, a real opener outside the tree);
  // the teaser start closes it (closeDialogs), which hands focus back to #hud-tech before B_keep_focus
  await page.click('#hud-tech');
  await sleep(300);
  await checkBoilerLocked(page);
  const waited = await kit.waitPhase(page, 'teaser', TEASER_START_TIMEOUT_MS);
  const sinceCap = Date.now() - capAt;
  kit.ok('B_teaser_started', waited !== null && sinceCap >= TEASER_MIN_DELAY_MS, sinceCap);
  await checkTeaserFrame(page);
  await checkTeaserBubble(page);
  const plates = await followTeaser(page);
  await checkTeaserEnd(page);
  // the end sample at the card joins the followed samples
  const endSc = await showcaseState(page);
  if (endSc !== null) plates.push(endSc.plateFrame);
  const plateOk = livePlate === PLATE_REDACTED && plates.length >= 2 && plates.every((f) => f === livePlate);
  kit.ok('B_plate_redacted', plateOk, failDetail(plateOk, { livePlate, samples: plates }));
  await checkCard(page);
  await wishlist(page);
  await keepAndCrank(page);
  await treeAfter(page);
  await systemRow(page);
  await checkBubbleSpoiler(page);
}

// WP23a case G, POST-CAP (bible §8.2), fresh page. Reach the cap, KEEP TINKERING (one tape freeze), then PAY-05, INS-07,
// GRL-06 and DOG-12 in order (worldAdvance moves the scheduler clock; each bubble and its seen mark are polled), then a
// reload: the dog holds the lie-down image and nothing repeats (no second freeze, no line).
async function caseG(page) {
  const advance = (ms) => page.evaluate((m) => window.__wedtmd.worldAdvance(m), ms);
  // the cap, as in case B: the teaser runs, then the END OF DEMO card takes focus
  await kit.buys(page, [...kit.S9, '@substationBlueprint']);
  if ((await kit.waitPhase(page, 'teaser', TEASER_START_TIMEOUT_MS)) === null) throw new Error('teaser did not start');
  if ((await kit.waitPhase(page, 'card', TEASER_RUN_TIMEOUT_MS)) === null) throw new Error('card did not open');
  // KEEP TINKERING starts POST-CAP: every living-world variant holds for the tape freeze right after the click. The click
  // and the watch run in ONE evaluate on animation frames: the first sample is frame 2 (frame 1 may still be pre-freeze),
  // and the freeze ends at the first frame whose variant string differs from it (within 4 s).
  const freeze = await page.evaluate(() => new Promise((resolve) => {
    const variants = () => (window.__wedtmd.livingWorld() ?? []).map((e) => `${e.id}:${e.variant}`).join('|');
    const t0 = performance.now();
    let frames = 0, first = null, movedAtMs = null;
    document.getElementById('demo-keep').click();
    const tick = (t) => {
      frames += 1;
      const v = variants();
      if (frames === 2) first = v;           // frame 1 may still be the pre-freeze frame
      else if (first !== null && v !== first && movedAtMs === null) movedAtMs = t - t0;
      if (t - t0 < 4000) requestAnimationFrame(tick); else resolve({ first, movedAtMs });
    };
    requestAnimationFrame(tick);
  }));
  const held = freeze.first !== null && freeze.first !== '' && freeze.movedAtMs !== null && freeze.movedAtMs >= TAPE_FREEZE_MIN_HOLD_MS;
  const freezes = (await page.evaluate(() => window.__wedtmd.worldState()?.seenEver ?? [])).filter((id) => id === 'beat.tapeFreeze').length;
  const freezeOk = held && freezes === 1;
  kit.ok('G_freeze', freezeOk, failDetail(freezeOk, { first: freeze.first, movedAtMs: freeze.movedAtMs, freezes }));
  // PAY-05 at +20 s, then each line at least 2 min after the one before
  await advance(POST_CAP_FIRST_MS);
  for (let i = 0; i < POST_CAP.length; i++) {
    if (i > 0) await advance(POST_CAP_GAP_MS);
    const line = POST_CAP[i];
    const shown = await pollPage(page, bubbleSays, line.text, 8000);
    const seen = await pollPage(page, seenHas, line.id, 10000);
    const ok = shown === true && seen === true;
    kit.ok(line.check, ok, failDetail(ok, { shown, seen }));
  }
  // reload: the seen state comes back from the save and the dog holds the lie-down image
  await page.evaluate(() => window.__wedtmd.saveNow());
  await kit.reload(page);
  const lies = await pollPage(page, () => (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === 'dog' && e.variant === 'lie'), null, 5000);
  const dogVariant = await page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).find((e) => e.id === 'dog')?.variant ?? null);
  kit.ok('G_hold', lies === true, failDetail(lies === true, { dogVariant }));
  // nothing repeats: no second freeze and no line, so seen / seenEver hold through 5 more minutes of play
  const snap = () => page.evaluate(() => {
    const s = window.__wedtmd.worldState();
    return s === null ? null : { seen: s.seen, seenEver: s.seenEver };
  });
  const before = await snap();
  await advance(300000);
  await sleep(600);
  const after = await snap();
  const repeatFreezes = after === null ? 0 : after.seenEver.filter((id) => id === 'beat.tapeFreeze').length;
  const same = before !== null && after !== null && JSON.stringify(before) === JSON.stringify(after) && repeatFreezes === 1;
  kit.ok('G_no_refreeze', same, failDetail(same, { before, after, repeatFreezes }));
}

let setupError = null;
try {
  browser = await chromium.launch();
  await run('A', caseA, { query: '?debug=1&title=1' });
  // B and C share one page: C reloads from the cap B owns
  await run('B', async (page) => {
    await caseB(page);
    kit.tag('C');
    await caseC(kit, page);
  });
  await run('D', (page) => caseD(kit, page));
  await run('E', (page) => caseE(kit, page));
  await run('F', (page) => caseF(kit, page));
  await run('G', (page) => caseG(page));
} catch (e) {
  setupError = e;
} finally {
  if (browser) await browser.close();
}
if (setupError !== null) fail.push(`FAILED:setup:${firstLine(setupError)}`);

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
