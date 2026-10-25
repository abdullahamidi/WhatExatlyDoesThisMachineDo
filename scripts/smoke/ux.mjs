// WP20 T15 UX smoke: first-impression behaviour in a real browser (screenshots ux-*.png in the outdir).
// Cases: A (crank prompt, hint, tree buy, fly-in), B (era cards), C (no era card in the finale),
// D_100 / D_150 (TECH INDEX and SYSTEM menu layout at uiScale 100 / 150), perf (30 clicks, report only).
// WP21 adds A_toast_clear_tabs and D_<s>_buy_visible / _buy_visible_e2 / _toast_clear_tabs (tree toast clear of tabs, PURCHASE in view).
// WP16b-2 adds A_one_prompt_t0 / _hint / _goal, A_hint_chip_hidden, A_chip_back, A_feedback_beside_buy, D_100_graph_centered and case T (T_<w>x<h>_<s>_toast_shown / _toast_clear).
// WP16b-3 adds case M (M_cycle_start, M_one_prompt_t0, M_one_prompt_goal): new cycle with Muscle Memory, one prompt.
// WP23a T13b adds A_no_bubble_prompt and A_crank_point_unchanged (case A: no bubble over the crank prompt, the crank point stays put).
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

// WP21: no more than one visible toast, and none overlaps an era tab, CLOSE or PURCHASE.
// WP16b-2: the TECH INDEX heading (#tech-title) and the #tech-me line are blockers too (a missing one is skipped).
const toastClearTabs = () => {
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const shown = [...document.querySelectorAll('.toast')].filter(t => t.getClientRects().length > 0);
  const blockers = [...document.querySelectorAll('.tech-tab'), document.querySelector('#tech-close'), document.querySelector('#tech-buy'), document.querySelector('#tech-title'), document.querySelector('#tech-me')]
    .filter(b => b !== null).map(b => b.getBoundingClientRect());
  return shown.length <= 1 && shown.every(t => blockers.every(b => !hits(t.getBoundingClientRect(), b)));
};
// WP21: PURCHASE has a size, sits inside the tech panel and the detail pane and the viewport (1 px tolerance) and is the element hit at its centre.
const buyVisible = () => {
  const b = document.getElementById('tech-buy'), panel = document.getElementById('tech-panel'), detail = document.getElementById('tech-detail');
  if (!b || !panel || !detail) return false;
  const r = b.getBoundingClientRect(), p = panel.getBoundingClientRect(), d = detail.getBoundingClientRect();
  const inside = (a, c) => a.left >= c.left - 1 && a.top >= c.top - 1 && a.right <= c.right + 1 && a.bottom <= c.bottom + 1;
  if (!(r.width > 0 && r.height > 0)) return false;
  if (!inside(r, p) || !inside(r, d)) return false;
  if (r.left < -1 || r.top < -1 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) return false;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return hit !== null && (hit === b || b.contains(hit));
};

// WP16b-2: which guidance prompts are on screen. count = number of true values (must be 1 at every stage of the first run).
const promptState = async page => {
  const s = { prompt: await crankPrompt(page), hint: await isVisible(page, '#hud-hint'), goal: await isVisible(page, '#hud-goal') };
  return { ...s, count: [s.prompt, s.hint, s.goal].filter(Boolean).length };
};
// WP16b-2 (runs in the page): feedback text sits to the right of PURCHASE on the same row and the level line starts below both.
const feedbackBesideBuy = () => {
  const buy = document.getElementById('tech-buy'), fb = document.getElementById('tech-feedback'), lvl = document.getElementById('tech-level');
  if (!buy || !fb || !lvl || !(fb.textContent || '').trim()) return false;
  const b = buy.getBoundingClientRect(), f = fb.getBoundingClientRect(), l = lvl.getBoundingClientRect();
  return f.left >= b.right + 4 && f.top < b.bottom && f.bottom > b.top && l.top >= Math.max(b.bottom, f.bottom) - 1;
};
// WP16b-2 (runs in the page): the visible nodes sit centred in #tech-graph (equal gaps left / right within 4 px).
const graphCentered = () => {
  const g = document.getElementById('tech-graph');
  const rects = [...document.querySelectorAll('.tech-node')].filter(n => n.getClientRects().length > 0).map(n => n.getBoundingClientRect());
  if (!g || rects.length === 0) return false;
  const gr = g.getBoundingClientRect();
  const left = Math.min(...rects.map(r => r.left)) - gr.left, right = gr.right - Math.max(...rects.map(r => r.right));
  return left >= 0 && right >= 0 && Math.abs(left - right) <= 4;
};

// A fresh: crank prompt, hint after 15 clicks, tree focus and tab chip, buy from the tree, fly-in on close.
const caseA = async page => {
  ok('A_prompt_visible', (await crankPrompt(page)) === true);
  ok('A_no_hint', !(await isVisible(page, '#hud-hint')));
  const p0 = await promptState(page);
  ok('A_one_prompt_t0', p0.count === 1 && p0.prompt === true, p0);
  // WP23a: with the crank prompt up no bubble may show (onboarding silence); the crank point is read before any bubble.
  const pt0 = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  const say0 = await page.evaluate(() => window.__wedtmd.worldSay('INS-01'));
  const bubble0 = await page.evaluate(() => window.__wedtmd.worldBubble());
  const silence0 = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null);
  ok('A_no_bubble_prompt', say0 === false && bubble0?.visible !== true && silence0 === 'onboarding', { say0, bubble: bubble0?.visible ?? null, silence: silence0 });
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
  const p1 = await promptState(page);
  ok('A_one_prompt_hint', p1.count === 1 && p1.hint === true, p1);
  ok('A_hint_chip_hidden', await page.evaluate(() => getComputedStyle(document.getElementById('hud-tech'), '::after').display === 'none'));
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
  ok('A_feedback_beside_buy', await page.evaluate(feedbackBesideBuy));
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
  ok('A_toast_clear_tabs', await page.evaluate(toastClearTabs));
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
  const p2 = await promptState(page);
  ok('A_one_prompt_goal', p2.count === 1 && p2.goal === true, p2);
  ok('A_chip_back', await page.evaluate(() => { const el = document.getElementById('hud-tech'); return (el.getAttribute('data-affordable') ?? '') === '' || getComputedStyle(el, '::after').display !== 'none'; }));
  await shot(page, 'ux-A5-goal');
  // WP23a: a bubble appears later in the run (quiet off, 120 s of play, INS-02 forced in one evaluate); the crank point must not move.
  const say1 = await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(120000);
    return w.worldSay('INS-02');
  });
  await page.waitForFunction(() => window.__wedtmd.worldBubble()?.visible === true, null, { timeout: 3000 }).catch(() => {});
  const bubbleUp = await page.evaluate(() => window.__wedtmd.worldBubble()?.visible === true);
  const pt1 = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  ok('A_crank_point_unchanged', say1 === true && bubbleUp && pt0 !== undefined && pt1 !== undefined && pt0.x === pt1.x && pt0.y === pt1.y, { say1, bubbleUp, before: pt0, after: pt1 });
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
  ok(`D_${s}_buy_visible`, await page.evaluate(buyVisible));
  await shot(page, `ux-D-${s}-tree`);
  if (s === 100) {
    await page.click('#tech-tab-1');
    await page.waitForTimeout(200);
    ok('D_100_graph_centered', await page.evaluate(graphCentered));
  }
  await page.click('#tech-tab-2');
  await page.waitForTimeout(200);
  await page.click('.tech-node[data-tech=powerLines]');
  await page.waitForTimeout(200);
  ok(`D_${s}_buy_visible_e2`, await page.evaluate(buyVisible));
  await page.evaluate(() => window.__wedtmd.session.purchase('copperWinding'));
  await page.waitForTimeout(300);
  ok(`D_${s}_toast_clear_tabs`, await page.evaluate(toastClearTabs));
  await shot(page, `ux-D-${s}-tree-e2`);
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

// WP16b-2 case T: the compact in-tree toast stays clear of the era tabs, the TECH INDEX heading and the #tech-me line at UI 100 / 125 / 150.
const caseT = async (page, w, h) => {
  await buyList(page, S11);
  await page.waitForTimeout(2500);
  await page.click('#era-card', { timeout: 1000 }).catch(() => {});
  for (const s of [100, 125, 150]) {
    await page.evaluate(sc => window.__wedtmd.session.updateSettings({ uiScale: sc }), s);
    await page.waitForTimeout(300);
    await page.keyboard.press('t');
    await page.waitForTimeout(400);
    await page.click('#tech-tab-3');
    await page.waitForTimeout(200);
    const bought = await page.evaluate(() => {
      const sess = window.__wedtmd.session;
      let r = sess.purchase('firebox');
      if (!r.ok) { sess.update(Math.max(Date.now(), sess.state.lastSimTime || 0) + 8 * 3600e3); r = sess.purchase('firebox'); }
      return r.ok === true;
    });
    await page.waitForTimeout(450);
    const vis = await page.evaluate(() => [...document.querySelectorAll('.toast')].filter(t => t.getClientRects().length > 0).length);
    ok(`T_${w}x${h}_${s}_toast_shown`, bought === true && vis === 1, { bought, vis });
    ok(`T_${w}x${h}_${s}_toast_clear`, await page.evaluate(toastClearTabs));
    await shot(page, `ux-T-${w}x${h}-${s}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
};

// WP16b-3 case M: a new cycle with Muscle Memory (Worn Motor 1 + Gear Ratio 3 at totalClicks 0) shows one prompt: the crank prompt;
// after one click only the next-goal line.
const caseM = async page => {
  await buyList(page, S16);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__wedtmd.skipFinale());
  await page.waitForTimeout(800);
  await page.click('#finale-cycle', { timeout: 5000 });
  await page.waitForTimeout(250);
  await page.click('#cycle-confirm-begin', { timeout: 5000 });
  await page.waitForFunction(() => {
    const w = window.__wedtmd, c = w.cycleState();
    return w.prestige().cycle === 2 && c.busy === false && c.transition.active === false;
  }, null, { timeout: 15000 });
  const perkOk = await page.evaluate(() => window.__wedtmd.session.buyPerk('muscleMemory').ok === true);
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => {
    const s = window.__wedtmd.session;
    return { cycle: window.__wedtmd.prestige().cycle, clicks: s.state.totalClicks, wornMotor: s.state.techLevels.wornMotor, gearRatio: s.state.techLevels.gearRatio };
  });
  ok('M_cycle_start', perkOk && st.cycle === 2 && st.clicks === 0 && st.wornMotor === 1 && st.gearRatio === 3, { perkOk, ...st });
  const p0 = await promptState(page);
  ok('M_one_prompt_t0', p0.count === 1 && p0.prompt === true, p0);
  await shot(page, 'ux-M1-cycle-prompt');
  await crank(page, 1, 0);
  await page.waitForTimeout(400);
  const p1 = await promptState(page);
  ok('M_one_prompt_goal', p1.count === 1 && p1.goal === true, p1);
  await shot(page, 'ux-M2-cycle-goal');
};

// perf: 30 manual clicks 100 ms apart; the frame stats are reported only (no fail).
const casePerf = async page => {
  await crank(page, 30, 100);
  results.perf_click = await page.evaluate(() => ({
    ui: window.__wedtmd.uiStats?.() ?? null,
    machine: window.__wedtmd.machineStats?.() ?? null,
  }));
};

// One fresh context per case (1280x720 unless given); console / page errors and failed requests are tagged with the case key.
// An exception becomes FAILED:<case>:<message> in fail.
const runCase = async (browser, key, fn, viewport = { width: 1280, height: 720 }) => {
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
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
  for (const [w, h] of [[1280, 720], [1920, 1080]]) await runCase(browser, `T_${w}x${h}`, page => caseT(page, w, h), { width: w, height: h });
  await runCase(browser, 'M', caseM);
  await runCase(browser, 'perf', casePerf);
} catch (e) {
  fail.push(`FAILED:setup:${String(e && e.message ? e.message : e).split('\n')[0]}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
