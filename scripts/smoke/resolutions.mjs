// WP19 T11 resolutions smoke: HUD, tech tree and SYSTEM menu rects against the canvas at 5 viewports x uiScale 100 / 150,
// plus the title panel at uiScale 150 (1280x720, 1280x800). Usage: PW_PATH=... node scripts/smoke/resolutions.mjs <url-with-?debug=1> <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty.
// WP23a T13b: at uiScale 150 every viewport also shows one living-world bubble: <w>x<h>-150_bubble_inside and _bubble_clear_hud.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { buyList, crankClicks } from './lib/common.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const VIEWPORTS = [[1280, 720], [1280, 800], [1920, 1080], [2560, 1440], [3440, 1440]];
const SCALES = [100, 150];
const TITLE_ROWS = [[1280, 720], [1280, 800]];
const TITLE_SCALE = 150;
const TOL = 1; // px
const ZOOM_TOL = 0.001;
// [viewport height ratio base, factor]: hud-panel height at these viewports vs 1280x720 of the same scale.
const HUD_RATIOS = [[1920, 1080, 1.5], [2560, 1440, 2]];
const RATIO_TOL = 0.12;

// App formula: uiZoom = round4(min(6, max(1, canvasH / 720) * scale / 100)); round4 = 4 decimal places.
const round4 = x => Math.round(x * 10000) / 10000;
const uiZoom = (canvasH, scale) => round4(Math.min(6, Math.max(1, canvasH / 720) * scale / 100));

const results = { rects: {} }, fail = [], errors = [];
let cur = 'setup';
// Records one check. Optional detail is the observed value (shown as { ok, value }).
const check = (name, cond, detail) => {
  results[name] = detail === undefined ? !!cond : { ok: !!cond, value: detail };
  if (!cond) fail.push(name);
};
const note = text => errors.push(`${cur}: ${text}`);
const withQuery = (u, q) => u + (u.includes('?') ? '&' : '?') + q;
const compact = r => (r ? [r.l, r.t, r.w, r.h].map(v => Math.round(v)) : null);
// Element rect as { l, t, w, h } (CSS px), or null when the element is missing.
const rect = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height };
}, sel);
// A missing or zero-size rect (a panel that did not open) never passes: sized() guards both comparisons.
const sized = r => r !== null && r.w > 0 && r.h > 0;
const inside = (a, c) => sized(a) && sized(c)
  && a.l >= c.l - TOL && a.t >= c.t - TOL
  && a.l + a.w <= c.l + c.w + TOL && a.t + a.h <= c.t + c.h + TOL;
// Strict overlap of two rects: touching edges do not count.
const overlaps = (a, c) => a.l < c.l + c.w && a.l + a.w > c.l && a.t < c.t + c.h && a.t + a.h > c.t;
const sameRect = (a, c) => sized(a) && sized(c)
  && Math.abs(a.l - c.l) <= TOL && Math.abs(a.t - c.t) <= TOL
  && Math.abs(a.w - c.w) <= TOL && Math.abs(a.h - c.h) <= TOL;
const waitFor = (page, sel, timeout = 15000) =>
  page.waitForSelector(sel, { state: 'attached', timeout }).then(() => true, () => false);
const shot = (page, file) => page.screenshot({ path: path.join(out, file) });
const ready = page => page.waitForFunction(
  () => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'),
  null,
  { timeout: 15000 },
);
const setScale = (page, scale) => page.evaluate(s => window.__wedtmd.session.updateSettings({ uiScale: s }), scale);
// One fresh context per run; deviceScaleFactor 1 so CSS px = device px.
const newRun = async (browser, w, h, key) => {
  cur = key;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') note('console: ' + m.text()); });
  page.on('pageerror', e => note('pageerror: ' + e.message));
  page.on('requestfailed', r => note('requestfailed: ' + r.url() + ' ' + (r.failure() ? r.failure().errorText : '')));
  return { ctx, page };
};
const failRun = (key, e) => {
  const msg = String(e && e.message ? e.message : e).split('\n')[0];
  fail.push(`FAILED:${key}:${msg}`);
};

// WP23a T13b: one living-world bubble on screen (run at uiScale 150). Escape until no modal is open (the tree and the SYSTEM menu
// hide bubbles), then 16 clicks + Gear Ratio (a first moment), the scheduler clock advanced and INS-01, or the first fallback line
// that plays on this framing, in one evaluate. Returns { bought, id, rects } with the rects of every shown bubble (client px).
const bubbleRects = async page => {
  for (let i = 0; i < 3 && (await page.evaluate(() => window.__wedtmd.modalCount())) > 0; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  await crankClicks(page, 16, 0);
  const bought = await buyList(page, ['gearRatio']);
  const id = await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(120000);
    return ['INS-01', 'INS-02', 'DOG-01', 'CRW-01'].find(line => w.worldSay(line)) ?? null;
  });
  await page.waitForFunction(() => document.querySelector('.wv.on') !== null, null, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const rects = await page.evaluate(() => [...document.querySelectorAll('.wv.on')].map(el => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  }));
  return { bought, id, rects };
};

// One viewport x scale run. Returns the measured HUD panel height (null when missing).
const runMatrix = async (browser, w, h, scale) => {
  const key = `${w}x${h}-${scale}`;
  const { ctx, page } = await newRun(browser, w, h, key);
  let hudH = null;
  try {
    await page.goto(url, { waitUntil: 'load' });
    await ready(page);
    await setScale(page, scale);
    await page.waitForTimeout(300);
    const canvas = await rect(page, '#game canvas');
    const ui = await rect(page, '#ui-root');
    const hud = await rect(page, '#hud-panel');
    const buttons = await rect(page, '#hud-buttons');
    const zoom = await page.$eval('#ui-root', el => parseFloat(el.style.zoom)).catch(() => NaN);
    await shot(page, `res-${w}x${h}-${scale}-hud.png`);
    await page.keyboard.press('t');
    await page.waitForTimeout(400);
    const treeOpen = await page.evaluate(() => !!document.querySelector('#tech-overlay.is-open'));
    const tech = await rect(page, '#tech-panel');
    await shot(page, `res-${w}x${h}-${scale}-tree.png`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const systemOpen = await page.evaluate(() => !!document.querySelector('#system-menu.is-open'));
    const system = await rect(page, '#system-panel');
    await page.click('#sys-tab-settings');
    await page.waitForTimeout(300);
    const settingsOpen = await page.evaluate(() => {
      const t = document.querySelector('#sys-tab-settings');
      return !!document.querySelector('#system-menu.is-open') && t !== null && t.getAttribute('aria-selected') === 'true';
    });
    const settings = await rect(page, '#system-panel');
    await shot(page, `res-${w}x${h}-${scale}-menu.png`);
    await page.keyboard.press('Escape');

    check(`${key}_tech-open`, treeOpen);
    check(`${key}_system-open`, systemOpen);
    check(`${key}_settings-open`, settingsOpen);
    check(`${key}_ui-root_equals_canvas`, sameRect(ui, canvas));
    check(`${key}_hud-panel_inside`, inside(hud, canvas));
    check(`${key}_hud-buttons_inside`, inside(buttons, canvas));
    check(`${key}_tech-panel_inside`, inside(tech, canvas));
    check(`${key}_system-panel_inside`, inside(system, canvas));
    check(`${key}_system-settings_inside`, inside(settings, canvas));
    const wantZoom = uiZoom(canvas ? canvas.h : NaN, scale);
    check(`${key}_zoom`, Math.abs(zoom - wantZoom) <= ZOOM_TOL, { got: zoom, want: wantZoom });
    results.rects[key] = {
      canvas: compact(canvas), ui: compact(ui), hud: compact(hud), buttons: compact(buttons),
      tech: compact(tech), system: compact(system), settings: compact(settings),
    };
    if (scale === 150) {
      // WP23a T13b: the bubble inside the canvas, and clear of the HUD panel, the HUD buttons and the toast stack (empty rects skipped).
      const b = await bubbleRects(page);
      const hudRects = [await rect(page, '#hud-panel'), await rect(page, '#hud-buttons'), await rect(page, '#toast-stack')].filter(sized);
      check(`${key}_bubble_inside`, b.rects.length > 0 && b.rects.every(r => inside(r, canvas)), {
        line: b.id, bought: b.bought, bubbles: b.rects.map(compact), canvas: compact(canvas),
      });
      check(`${key}_bubble_clear_hud`, b.rects.length > 0 && b.rects.every(r => sized(r) && hudRects.every(hr => !overlaps(r, hr))), {
        line: b.id, bubbles: b.rects.map(compact), hud: hudRects.map(compact),
      });
      await shot(page, `res-${w}x${h}-${scale}-bubble.png`);
    }
    hudH = hud ? hud.h : null;
  } catch (e) {
    failRun(key, e);
  } finally {
    await ctx.close();
  }
  return hudH;
};

// Title row: uiScale saved at 150, then the title screen (&title=1) must keep #title-panel inside the canvas.
const runTitleRow = async (browser, w, h) => {
  const key = `title-${w}x${h}-${TITLE_SCALE}`;
  const { ctx, page } = await newRun(browser, w, h, key);
  try {
    await page.goto(url, { waitUntil: 'load' });
    await ready(page);
    await setScale(page, TITLE_SCALE);
    await page.evaluate(() => window.__wedtmd.saveNow());
    await page.waitForTimeout(500);
    await page.goto(withQuery(url, 'title=1'), { waitUntil: 'load' });
    await ready(page);
    check(`${key}_title_open`, await waitFor(page, '#title-screen.is-open'));
    await page.waitForTimeout(300);
    const canvas = await rect(page, '#game canvas');
    const panel = await rect(page, '#title-panel');
    results.rects[key] = { canvas: compact(canvas), 'title-panel': compact(panel) };
    check(`${key}_title-panel_inside`, inside(panel, canvas));
  } catch (e) {
    failRun(key, e);
  } finally {
    await ctx.close();
  }
};

let browser = null;
try {
  browser = await chromium.launch();
  const hudH = {};
  for (const [w, h] of VIEWPORTS) {
    for (const scale of SCALES) {
      hudH[`${w}x${h}-${scale}`] = await runMatrix(browser, w, h, scale);
    }
  }
  // HUD height ratio vs 1280x720 of the same scale.
  for (const scale of SCALES) {
    const base = hudH[`1280x720-${scale}`];
    for (const [w, h, factor] of HUD_RATIOS) {
      const got = hudH[`${w}x${h}-${scale}`];
      const ratio = base && got ? got / base : null;
      check(
        `${w}x${h}-${scale}_hud-height-ratio`,
        ratio !== null && Math.abs(ratio / factor - 1) <= RATIO_TOL,
        ratio === null ? null : round4(ratio),
      );
    }
  }
  for (const [w, h] of TITLE_ROWS) {
    await runTitleRow(browser, w, h);
  }
} catch (e) {
  failRun(cur, e);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
