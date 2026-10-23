// WP20 T15 UX smoke: first-impression behaviour in a real browser (screenshots ux-*.png in the outdir).
// Cases: A (crank prompt, hint, tree buy, fly-in), B (era cards), C (no era card in the finale),
// D_100 / D_150 (TECH INDEX and SYSTEM menu layout at uiScale 100 / 150), perf (30 clicks, report only).
// Usage: PW_PATH=... node scripts/smoke/ux.mjs <url> <outdir>   (url like http://localhost:4175/?debug=1)
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = /[?&]debug=1/.test(url) ? url : url + (url.includes('?') ? '&' : '?') + 'debug=1';

const results = {}, fail = [], errors = [];
// Records one check: results[name] = detail ?? !!cond; a falsy cond also lists the name in fail.
const ok = (name, cond, detail) => {
  results[name] = detail ?? !!cond;
  if (!cond) fail.push(name);
};
const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const isVisible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.$eval(sel, el => (el.textContent || '').trim()).catch(() => null);
const techTreeOpen = page => page.evaluate(() => window.__wedtmd.techTreeOpen());
const menuOpen = page => page.evaluate(() => window.__wedtmd.systemMenuOpen());
const crankPrompt = page => page.evaluate(() => window.__wedtmd.crankPrompt());
const eraCard = async page => ({
  shown: await isVisible(page, '#era-card'),
  title: await text(page, '#era-card .era-card-title'),
});
const ready = async page => {
  await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
};
// Real pointer clicks on the crank, `gap` ms apart; the crank point is re-read before each click.
const crank = async (page, n, gap = 40) => {
  for (let i = 0; i < n; i++) {
    const p = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(gap);
  }
};

// Buy lists: copies of the stages.mjs S-lists (S16 = S15 + primaryFunction).
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', ...Array(3).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', ...Array(5).fill('gridExciter'), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', ...Array(5).fill('mainsBackfeed'), ...Array(5).fill('steamLance'), '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];

// Buy helper (same logic as stages.mjs): `clicks` real crank clicks first, then each id in order.
// '@<tech>:<n>' buys until level n; '@<tech>' jumps 8 h until owned ('@blueprint' = generatorBlueprint);
// a plain id jumps 8 h once wornMotor is owned, buys, and retries after a jump up to 6 times.
// WP20: the clock starts at the session's last simulated time, so later calls never move it backwards.
const buyList = async (page, buys, clicks = 45) => {
  await crank(page, clicks, 0);
  await page.evaluate((buys) => {
    const s = window.__wedtmd.session;
    let t = Math.max(Date.now(), s.state.lastSimTime || 0);
    const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
    for (const id of buys) {
      if (id.startsWith('@') && id.includes(':')) {
        const [tech, nStr] = id.slice(1).split(':'); const n = +nStr;
        for (let k = 0; k < 128 && s.state.techLevels[tech] < n; k++) {
          let r = s.purchase(tech);
          while (r.ok && s.state.techLevels[tech] < n) r = s.purchase(tech);
          if (s.state.techLevels[tech] < n) jump();
        }
        continue;
      }
      if (id.startsWith('@')) {
        const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
        for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
        continue;
      }
      if (s.state.techLevels.wornMotor) jump();
      let r = s.purchase(id);
      for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
    }
  }, buys);
};

// A fresh: crank prompt, hint after 15 clicks, tree focus and tab chip, buy from the tree, fly-in on close.
const caseA = async page => {
  ok('A_prompt_visible', (await crankPrompt(page)) === true);
  ok('A_no_hint', !(await isVisible(page, '#hud-hint')));
  await shot(page, 'ux-A1-prompt');
  await crank(page, 1, 0);
  await page.waitForTimeout(300);
  ok('A_prompt_gone', (await crankPrompt(page)) === false);
  await crank(page, 14);
  await page.waitForTimeout(400);
  const hint = await text(page, '#hud-hint');
  ok('A_hint_visible', (await isVisible(page, '#hud-hint')) && hint !== null && hint.includes('TECH INDEX'));
  const affordable = await page.$eval('#hud-tech', el => el.getAttribute('data-affordable')).catch(() => null);
  ok('A_badge', Number.parseInt(affordable ?? '', 10) >= 1);
  await shot(page, 'ux-A2-hint');
  await crank(page, 100);
  await page.keyboard.press('t');
  await page.waitForTimeout(300);
  ok('A_focus_node', await page.evaluate(() => {
    const a = document.activeElement;
    return a !== null && a.classList.contains('tech-node') && a === document.querySelector('.tech-node.is-selected');
  }));
  const chip = await page.$eval('.tech-tab', el => Number.parseInt(el.getAttribute('data-affordable') ?? '0', 10)).catch(() => 0);
  ok('A_tab_chip', chip >= 1);
  await page.click('.tech-node[data-tech=gearRatio]');
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  ok('A_space_keeps_tree', await techTreeOpen(page));
  ok('A_space_buys', (await page.evaluate(() => window.__wedtmd.session.state.techLevels.gearRatio)) === 1);
  const feedback = (await text(page, '#tech-feedback')) ?? '';
  ok('A_feedback_flavor', feedback.toLowerCase().includes('gear mesh recalibrated'));
  // the part is held (assembling, hidden) while the tree is open
  await page.waitForTimeout(900);
  ok('A_held', await page.evaluate(() => {
    const s = window.__wedtmd.componentState('gearSmall');
    return !!s && s.assembling === true && s.alpha < 0.05;
  }));
  // three quick buys merge into one 'LV 1 → 4' toast; the stack sits above the tree buttons
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(50); }
  await page.waitForTimeout(200);
  const toastTitles = await page.$$eval('.toast-title', ts => ts.map(t => (t.textContent || '').trim()));
  const toastCount = await page.locator('.toast').count();
  ok('A_toast_coalesced', toastTitles.some(t => t.includes('LV 1 → 4')) && toastCount <= 2);
  ok('A_toast_above', await page.evaluate(() => {
    const stack = document.getElementById('toast-stack');
    const refs = ['#tech-close', '#tech-buy'].map(s => document.querySelector(s));
    if (!stack || refs.some(r => r === null)) return false;
    const buttons = refs.map(r => r.getBoundingClientRect());
    const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const toasts = [...document.querySelectorAll('.toast')].map(t => t.getBoundingClientRect());
    return getComputedStyle(stack).zIndex === '200' && toasts.every(t => buttons.every(b => !hits(t, b)));
  }));
  await shot(page, 'ux-A3-tree-buy');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await shot(page, 'ux-A4-flyin');
  await page.waitForTimeout(1200);
  ok('A_fly_in_after_close', await page.evaluate(() => {
    const s = window.__wedtmd.componentState('gearSmall');
    return !!s && s.visible === true && s.alpha >= 0.99 && s.assembling === false;
  }));
  ok('A_hint_gone', !(await isVisible(page, '#hud-hint')));
  const goal = (await text(page, '#hud-goal')) ?? '';
  ok('A_goal_line', goal.startsWith('NEXT:'));
  await shot(page, 'ux-A5-goal');
};

// B era cards: the card waits while the tree is open, a click skips it, reduced motion gives no camera nudge.
const caseB = async page => {
  await buyList(page, [...S7, '@blueprint', 'generator']);
  await page.waitForTimeout(400);
  const c1 = await eraCard(page);
  ok('B_card_shown', c1.shown && c1.title === 'ERA II · ELECTRICAL');
  await shot(page, 'ux-B1-card');
  // a missing card fails the named checks below instead of stalling the case on a 30 s click timeout
  await page.click('#era-card', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  ok('B_card_skipped', !(await isVisible(page, '#era-card')));
  await page.keyboard.press('t');
  await buyList(page, S10.slice(S7.length + 2), 0);
  await page.waitForTimeout(400);
  ok('B_card_held', !(await isVisible(page, '#era-card')) && (await techTreeOpen(page)));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const c3 = await eraCard(page);
  ok('B_card_after_close', c3.shown && c3.title === 'ERA III · PRESSURE');
  await shot(page, 'ux-B2-card-after-close');
  await page.click('#era-card', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  // S11 already ends with '@pressureVesselBlueprint', so the rest of S11 plus resonatorSpire is S12 from S10 on
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await page.keyboard.press('t');
  await buyList(page, S12.slice(S10.length), 0);
  const camBefore = await page.evaluate(() => window.__wedtmd.cameraState());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const camAfter = await page.evaluate(() => window.__wedtmd.cameraState());
  const still = Math.abs(camBefore.centerX - camAfter.centerX) <= 0.5
    && Math.abs(camBefore.centerY - camAfter.centerY) <= 0.5
    && Math.abs(camBefore.zoom - camAfter.zoom) <= 0.5;
  ok('B_reduced_no_nudge', still, { before: camBefore, after: camAfter });
  const anim = await page.$eval('#era-card', el => getComputedStyle(el).animationName).catch(() => null);
  ok('B_card_reduced', (await isVisible(page, '#era-card')) && anim === 'none');
  await shot(page, 'ux-B3-card-reduced');
};

// C finale: primaryFunction starts the ending and no era card shows over it.
const caseC = async page => {
  await buyList(page, S16);
  await page.waitForTimeout(500);
  ok('C_no_card_in_finale', !(await isVisible(page, '#era-card')));
};

// D layout: the tree fits, primaryFunction is selected and in view; the SYSTEM panel keeps one height on every tab.
const caseD = async (page, s) => {
  await buyList(page, S15);
  await page.evaluate(sc => window.__wedtmd.session.updateSettings({ uiScale: sc }), s);
  await page.waitForTimeout(300);
  await page.keyboard.press('t');
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const g = document.getElementById('tech-graph');
    return g ? { scrollWidth: g.scrollWidth, clientWidth: g.clientWidth } : null;
  });
  ok(`D_${s}_fit`, fit !== null && fit.scrollWidth <= fit.clientWidth + 1, fit);
  ok(`D_${s}_pf_selected`, await page.evaluate(() => document.querySelector('.tech-node.is-selected')?.getAttribute('data-tech') === 'primaryFunction'));
  ok(`D_${s}_pf_in_view`, await page.evaluate(() => {
    const node = document.querySelector('.tech-node[data-tech=primaryFunction]');
    const graph = document.getElementById('tech-graph');
    if (!node || !graph) return false;
    const a = node.getBoundingClientRect(), g = graph.getBoundingClientRect();
    return a.width > 0 && a.height > 0 && a.left >= g.left - 1 && a.top >= g.top - 1 && a.right <= g.right + 1 && a.bottom <= g.bottom + 1;
  }));
  await shot(page, `ux-D-${s}-tree`);
  // Esc closes the tree; when that did not open the menu, one more Esc opens it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (!(await menuOpen(page))) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  const tabIds = await page.$$eval('#sys-tabs [role="tab"]', ts => ts.filter(t => t.getClientRects().length > 0).map(t => t.id));
  const heights = [];
  for (const id of tabIds) {
    await page.click(`#${id}`);
    await page.waitForTimeout(150);
    heights.push(await page.evaluate(() => { const p = document.getElementById('system-panel'); return p ? p.getBoundingClientRect().height : -1; }));
  }
  ok(`D_${s}_menu_fixed`, heights.length > 0 && Math.max(...heights) - Math.min(...heights) <= 1, heights);
  ok(`D_${s}_memory_hidden`, !(await isVisible(page, '#sys-tab-memory')));
  await page.click('#sys-tab-system');
  await page.waitForTimeout(200);
  await shot(page, `ux-D-${s}-menu-system`);
  await page.click('#sys-tab-settings');
  await page.waitForTimeout(300);
  await shot(page, `ux-D-${s}-menu-settings`);
};

// perf: 30 manual clicks 100 ms apart; the frame stats are reported only (no fail).
const casePerf = async page => {
  await crank(page, 30, 100);
  results.perf_click = await page.evaluate(() => ({
    ui: window.__wedtmd.uiStats?.() ?? null,
    machine: window.__wedtmd.machineStats?.() ?? null,
  }));
};

// One fresh 1280x720 context per case; console / page errors and failed requests are tagged with the case key.
// An exception becomes FAILED:<case>:<message> in fail.
const runCase = async (browser, key, fn) => {
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`${key}: console: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${key}: pageerror: ${e.message}`));
    page.on('requestfailed', r => errors.push(`${key}: requestfailed: ${r.url()} ${r.failure() ? r.failure().errorText : ''}`));
    await page.goto(target, { waitUntil: 'load' });
    await ready(page);
    await fn(page);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).split('\n')[0];
    fail.push(`FAILED:${key}:${msg}`);
  } finally {
    if (ctx) await ctx.close();
  }
};

let browser = null;
try {
  browser = await chromium.launch();
  await runCase(browser, 'A', caseA);
  await runCase(browser, 'B', caseB);
  await runCase(browser, 'C', caseC);
  for (const s of [100, 150]) await runCase(browser, `D_${s}`, page => caseD(page, s));
  await runCase(browser, 'perf', casePerf);
} catch (e) {
  fail.push(`FAILED:setup:${String(e && e.message ? e.message : e).split('\n')[0]}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
