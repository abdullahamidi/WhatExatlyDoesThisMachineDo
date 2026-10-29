// WP25 T9 economy smoke: the passive-first economy in a real browser (plan WP25 C4-C7, A5-A6).
// Case A (own context): nothing pops before the first click; after 45 clicks and Worn Motor the first popup reads '+n ME'.
// Cases B-G (one shared page, era II only, so the demo build runs it too: step B_demo skips the cap teaser and KEEP TINKERING closes the card): the Crank Servo tab and the AUTO-CRANK line,
// the click worth text and title, the photo and reduced-motion popup gates, the quiet switch, the HUD fit at UI 100 / 125 / 150,
// and the output cost (a quiet-PC check).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/economy.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty.
import fs from 'fs';
import path from 'path';
import { S9, buyList, crankClicks, dismissEraCard, hudState, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const chromium = loadChromium();
const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: PW_PATH=<playwright dir> node scripts/smoke/economy.mjs "<url with ?debug=1>" <outdir>');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });

const report = makeReport();
// the case key that page errors are tagged with (watchPage reads it when an event fires)
let tag = 'setup';

// Output line patterns (C4 / C7); the middle dot is U+00B7 with a space on each side.
const LAST_RE = new RegExp('^[+][^ ]+ ME$');
const AUTO_RE = new RegExp('^AUTO-CRANK 3/s · [+][^ ]+ EE/s$');
const WORTH_RE = new RegExp(' · (<0[.]01|[0-9]+([.][0-9]+)?)s$');
const TITLE_RE = new RegExp('^One turn of the crank = .+ s of machine output$');
// F_hud_fit per UI scale (the overall check is F_hud_fit below)
const FIT_NAME = { 100: 'F_hud_fit_100', 125: 'F_hud_fit_125', 150: 'F_hud_fit_150' };

const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];
// A thrown error becomes FAILED:<key>:<first line of the message> in fail; the run goes on.
const recordThrow = (key, e) => { report.fail.push(`FAILED:${key}:${firstLine(e)}`); };
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });

// Output hook reads: a build without the hook reads null, so the checks fail by name instead of throwing.
const outputStats = page => page.evaluate(() => window.__wedtmd.outputStats?.() ?? null);
const setOutputTicks = (page, on) => page.evaluate(v => { window.__wedtmd.setOutputTicks?.(v); }, on);
const setSettings = (page, patch) => page.evaluate(p => { window.__wedtmd.session.updateSettings(p); }, patch);
const attrOf = (page, sel, name) => page.$eval(sel, (el, n) => el.getAttribute(n), name).catch(() => null);
// Re-reads (every 100 ms until capMs) until read() matches re; returns the last value.
const pollMatch = async (page, read, re, capMs = 3000) => {
  const deadline = Date.now() + capMs;
  let value = await read();
  while (!(value !== null && re.test(value)) && Date.now() < deadline) {
    await page.waitForTimeout(100);
    value = await read();
  }
  return value;
};

// Fresh page on the target URL with the hook and the hand crank ready.
const openPage = async ctx => {
  const page = await ctx.newPage();
  watchPage(page, report.errors, () => tag);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  return page;
};

// One fresh context per case (1280 x 720, deviceScaleFactor 1); the context closes even after a throw.
const runContext = async (browser, key, fn) => {
  tag = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await fn(ctx);
  } catch (e) {
    recordThrow(key, e);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
};

// One check group on the shared page: a throw is recorded under its key and the next group still runs.
const step = async (key, fn) => {
  tag = key;
  try {
    await fn();
  } catch (e) {
    recordThrow(key, e);
  }
};

// Case A (own context): nothing pops before the first click; after 45 clicks and Worn Motor the first popup reads '+n ME'.
const caseA = async ctx => {
  const page = await openPage(ctx);
  await page.waitForTimeout(5000);
  const quiet = await outputStats(page);
  report.check('A_no_tick_before_click', quiet !== null && quiet.shown === 0 && quiet.visible === 0, quiet);
  await crankClicks(page, 45, 0);
  const failedBuys = await buyList(page, ['wornMotor']);
  report.check('A_buy', failedBuys.length === 0, failedBuys);
  await poll(page, () => (window.__wedtmd.outputStats?.()?.shown ?? 0) >= 1, null, 4500, 100);
  const tick = await outputStats(page);
  const tickOk = tick !== null && tick.shown >= 1 && LAST_RE.test(tick.last ?? '');
  report.check('A_tick', tickOk, { shown: tick?.shown ?? null, last: tick?.last ?? null });
};

// B tab II: Crank Servo is shown on tab II. Tab IV is disabled until its era is reached, so it cannot open here: then no node
// of it can be shown (fourLocked). Hidden nodes stay in the DOM, so only rendered nodes are counted.
const crankServoShown = page => page.evaluate(() => [...document.querySelectorAll('.tech-node[data-tech=crankServo]')]
  .filter(n => n.getClientRects().length > 0).length);
const checkTabTwo = async page => {
  await page.keyboard.press('t');
  await poll(page, () => window.__wedtmd.techTreeOpen(), null, 3000);
  await page.click('#tech-tab-2');
  const onTwo = await crankServoShown(page);
  await shot(page, 'economy-B-tab2.png');
  const fourLocked = await page.$eval('#tech-tab-4', el => el.disabled === true).catch(() => true);
  let onFour = 0;
  if (!fourLocked) {
    await page.click('#tech-tab-4');
    onFour = await crankServoShown(page);
  }
  await page.keyboard.press('Escape');
  const closed = await poll(page, () => !window.__wedtmd.techTreeOpen(), null, 3000);
  report.check('B_tab_two', onTwo === 1 && onFour === 0 && closed === true, { onTwo, onFour, fourLocked });
};

// B: the AUTO-CRANK line (3 servo cranks per second, frontier EE output) and both servo parts on the machine.
const servoParts = () => ({
  base: window.__wedtmd.componentState('servoBase')?.visible === true,
  arm: window.__wedtmd.componentState('servoArm')?.visible === true,
});
const checkAutoAndParts = async page => {
  const auto = await pollMatch(page, async () => (await hudState(page))?.auto ?? null, AUTO_RE, 3000);
  report.check('B_auto_line', AUTO_RE.test(auto ?? ''), auto);
  let parts = await page.evaluate(servoParts);
  for (let i = 0; i < 30 && !(parts.base && parts.arm); i++) {
    await page.waitForTimeout(100);
    parts = await page.evaluate(servoParts);
  }
  report.check('B_parts', parts.base && parts.arm, parts);
};

// C: the CLICK line ends with the click's worth in seconds, and the CLICK row title explains it.
const checkWorth = async page => {
  const worth = await pollMatch(page, async () => (await hudState(page))?.click ?? null, WORTH_RE, 3000);
  report.check('C_worth', WORTH_RE.test(worth ?? ''), worth);
  const title = await pollMatch(page, () => attrOf(page, '.hud-click', 'title'), TITLE_RE, 3000);
  report.check('C_title', TITLE_RE.test(title ?? ''), title);
};

// D photo: photo mode holds the popups still for 6 s and stays on.
const checkPhoto = async page => {
  await page.evaluate(() => { window.__wedtmd.photoMode(true); });
  let s0 = null, s1 = null, active = null;
  try {
    await page.waitForTimeout(400);
    s0 = (await outputStats(page))?.shown ?? null;
    await page.waitForTimeout(6000);
    s1 = (await outputStats(page))?.shown ?? null;
    active = (await page.evaluate(() => window.__wedtmd.photoState()))?.active ?? null;
  } finally {
    await page.evaluate(() => { window.__wedtmd.photoMode(false); });
  }
  report.check('D_photo', s0 !== null && s1 === s0 && active === true, { s0, shown: s1, active });
};

// One popup sample: visible count, world y of the newest visible popup, rising flag.
const popupSample = page => page.evaluate(() => {
  const s = window.__wedtmd.outputStats?.() ?? null;
  return { visible: s?.visible ?? 0, y: s?.y ?? null, rising: s?.rising ?? null };
});
// D reduced: under reduced motion a visible popup does not rise and keeps its y.
const checkReduced = async page => {
  await setSettings(page, { reducedMotion: true });
  let samples = [];
  let pass = false;
  try {
    // up to 3 attempts: wait for a visible popup (cap 8 s), then four samples 250 ms apart
    for (let attempt = 0; attempt < 3 && !pass; attempt++) {
      await poll(page, () => (window.__wedtmd.outputStats?.()?.visible ?? 0) >= 1, null, 8000, 100);
      samples = [];
      for (let i = 0; i < 4; i++) {
        if (i > 0) await page.waitForTimeout(250);
        samples.push(await popupSample(page));
      }
      const seen = samples.filter(s => s.visible >= 1);
      pass = seen.length >= 3 && seen.every(s => s.rising === false && s.y !== null && s.y === seen[0].y);
    }
  } finally {
    await setSettings(page, { reducedMotion: false });
  }
  report.check('D_reduced', pass, samples);
};

// E quiet: with the ticks off no popup starts and none stays on screen for 6 s (12 samples, 500 ms apart).
const checkQuiet = async page => {
  const samples = [];
  let s0 = null;
  try {
    await setOutputTicks(page, false);
    await page.waitForTimeout(300);
    s0 = (await outputStats(page))?.shown ?? null;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(500);
      const s = await outputStats(page);
      samples.push({ shown: s?.shown ?? null, visible: s?.visible ?? null });
    }
  } finally {
    await setOutputTicks(page, true);
  }
  report.check('E_quiet', s0 !== null && samples.every(s => s.shown === s0 && s.visible === 0), { s0, samples });
};

// Measures the CLICK value, the AUTO-CRANK line and the WIND-UP row (WP27 C8): rendered line count (rect tops within 2 px) and a box inside the HUD panel.
// contained: the whole box inside the panel (top and bottom too); panelInView: the panel inside the viewport (1 px slack).
const hudFitNow = () => {
  const panel = document.getElementById('hud-panel');
  if (!panel) return null;
  const p = panel.getBoundingClientRect();
  const measure = id => {
    const el = document.getElementById(id);
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    for (const r of [...range.getClientRects()]) {
      if (!(r.width > 0 && r.height > 0)) continue;
      const top = Math.round(r.top);
      if (!tops.some(t => Math.abs(t - top) <= 2)) tops.push(top);
    }
    const box = el.getBoundingClientRect();
    return {
      lines: tops.length,
      inside: box.width > 0 && box.left >= p.left - 1 && box.right <= p.right + 1,
      contained: box.width > 0 && box.height > 0 && box.left >= p.left - 1 && box.right <= p.right + 1
        && box.top >= p.top - 1 && box.bottom <= p.bottom + 1,
    };
  };
  const panelInView = p.left >= -1 && p.top >= -1 && p.right <= window.innerWidth + 1 && p.bottom <= window.innerHeight + 1;
  // NEXT BUY (WP28): the goal line's buy row, when shown (not hidden, with a box); contained = its whole box inside the panel.
  const buyEl = document.getElementById('hud-goal-buy');
  const buyShown = !!buyEl && !buyEl.hidden && buyEl.getClientRects().length > 0;
  const buy = buyShown ? { shown: true, ...measure('hud-goal-buy') } : { shown: false };
  return { click: measure('hud-per-click'), auto: measure('hud-auto'), windup: measure('hud-windup'), buy, panelInView };
};
// F: the CLICK and AUTO-CRANK rows stay one line each inside the HUD panel, the WIND-UP row (WP27) one line wholly inside it, the NEXT
// BUY line (WP28, when shown) wholly inside it, and the panel inside the viewport, at UI 100 / 125 / 150; the UI scale goes back to 100.
const checkFit = async page => {
  const perScale = [];
  try {
    for (const ui of [100, 125, 150]) {
      await setSettings(page, { uiScale: ui });
      await page.waitForTimeout(400);
      const m = await page.evaluate(hudFitNow);
      // WIND-UP (WP27 C8): shown once Reinforced Crank is owned (S7); one line, wholly inside the panel, and the panel in the viewport.
      const windupOk = m !== null && m.windup !== null && m.windup.lines === 1 && m.windup.contained && m.panelInView === true;
      // NEXT BUY (WP28): only when shown; a shown line must lie wholly inside the panel (its line count is recorded, not gated).
      const buyOk = m === null || m.buy === undefined || m.buy.shown !== true || m.buy.contained === true;
      const pass = m !== null && m.click !== null && m.auto !== null
        && m.click.lines === 1 && m.auto.lines === 1 && m.click.inside && m.auto.inside && windupOk && buyOk;
      report.check(FIT_NAME[ui], pass, m);
      perScale.push(pass);
      await shot(page, `economy-F-${ui}.png`);
    }
  } finally {
    await setSettings(page, { uiScale: 100 });
  }
  report.check('F_hud_fit', perScale.length === 3 && perScale.every(Boolean));
};

// G output cost: 30 s of popups in era II on a quiet PC; the mean update() cost stays <= 0.05 ms.
const checkCost = async page => {
  await setOutputTicks(page, true);
  await setSettings(page, { reducedMotion: false });
  await page.waitForTimeout(30000);
  const s = await outputStats(page);
  report.check('G_output_cost', s !== null && s.shown > 0 && s.meanMs <= 0.05, { shown: s?.shown ?? null, meanMs: s?.meanMs ?? null });
};

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and KEEP TINKERING.
// On the full build demoState() is null and the helper returns at once.
const clearDemoCap = async page => {
  const phase = () => page.evaluate(() => window.__wedtmd.demoState?.()?.phase ?? null);
  if ((await phase()) === null) return;
  await poll(page, () => ['teaser', 'card', 'idle'].includes(window.__wedtmd.demoState().phase), null, 8000, 100);
  if ((await phase()) === 'teaser') {
    await page.click('#demo-skip', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState().phase === 'card', null, 5000, 100);
  }
  if ((await phase()) === 'card') {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState().phase === 'idle', null, 5000, 100);
  }
  await page.waitForTimeout(500);
};

// Cases B-G: one fresh page, 45 clicks, the S9 list and Crank Servo level 3, then the era card click-away.
const caseBG = async ctx => {
  const page = await openPage(ctx);
  await crankClicks(page, 45, 0);
  const failedBuys = await buyList(page, [...S9, '@crankServo:3']);
  report.check('B_buy', failedBuys.length === 0, failedBuys);
  await dismissEraCard(page);
  await step('B_demo', () => clearDemoCap(page));
  await page.waitForTimeout(500);
  await step('B', () => checkTabTwo(page));
  await step('B', () => checkAutoAndParts(page));
  await step('C', () => checkWorth(page));
  await step('D', () => checkPhoto(page));
  await step('D', () => checkReduced(page));
  await step('E', () => checkQuiet(page));
  await step('F', () => checkFit(page));
  await step('G', () => checkCost(page));
};

let browser = null;
try {
  browser = await chromium.launch();
  await runContext(browser, 'A', caseA);
  await runContext(browser, 'B', caseBG);
} catch (e) {
  recordThrow('setup', e);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results: report.results, fail: report.fail, errors: report.errors }, null, 1));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
