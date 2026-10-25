// WP16a T6b a11y smoke: keyboard reach, focus traps, focus rings, accessible names, 12 px floor, WCAG contrast,
// reduced motion and UI scale 150 across title, credits, HUD, tech tree, SYSTEM menu, finale, photo mode, cycle confirm.
// WP16b-2: the tech tree, purchase toast and era card gate too (case H: era card, tree tabs 2 and 1, toast).
// WP23a T13b: case W (living world bubble): W_live_region, W_bubble_aria_hidden, W_tab_walk_unchanged.
// Usage: PW_PATH=... node scripts/smoke/a11y.mjs <base-url-without-query> <outdir>
// base = preview URL with a trailing slash and NO query (e.g. http://localhost:4174/); each case adds its own query.
// Prints ONE JSON object { results, fail, deferred, inactive, indeterminate, errors } to stdout and to <outdir>/a11y.json.
// Exit 1 when fail or errors is non-empty. Expected run: fail [], errors [], deferred [] (deferred is empty since WP16b-2).
// inactive / indeterminate are report-only and never fail the run; the milestone toast (gradient with a translucent top
// over the canvas) stays indeterminate. Inactive items (:disabled, [aria-disabled="true"], .is-locked) stay exempt.
import fs from 'fs';
import path from 'path';
import { S15, S9, buyList, crankClicks, loadChromium, makeReport, poll, watchPage, waitReady, withQuery } from './lib/common.mjs';
import {
  auditScope,
  focusId,
  installFocusLog,
  missingFocus,
  rectInViewport,
  resetFocusLog,
  setUiScale,
  tabWalk,
} from './lib/a11y-audit.mjs';

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: PW_PATH=<playwright module> node scripts/smoke/a11y.mjs <base-url-without-query> <outdir>');
  process.exit(2);
}
const chromium = loadChromium();
fs.mkdirSync(outDir, { recursive: true });

const report = makeReport();
const { fail, errors } = report;
const deferred = [];
const inactive = [];
const indeterminate = [];
let cur = 'setup';
const tag = () => cur;

// Records one check. A name that already failed keeps its first failure (SYSTEM tab 'system' reuses D_system_reach).
const check = (name, cond, detail) => {
  const prev = report.results[name];
  if (prev !== undefined && (prev === false || prev.ok === false)) return;
  report.check(name, cond, detail);
};

// Pushes the audit findings onto the global lists (each tagged with the label). Returns the audit unchanged.
const record = (label, audit) => {
  for (const item of audit.deferred) deferred.push({ at: label, ...item });
  for (const item of audit.inactive) inactive.push({ at: label, ...item });
  for (const item of audit.indeterminate) indeterminate.push({ at: label, ...item });
  return audit;
};

const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];

// Runs one case body; an exception becomes FAILED:<case>:<first line> in fail.
const guard = async (key, fn) => {
  cur = key;
  try {
    await fn();
  } catch (e) {
    fail.push(`FAILED:${key}:${firstLine(e)}`);
  }
};

const wait = (page, ms) => page.waitForTimeout(ms);
const count = (page, sel) => page.locator(sel).count();
const shot = (page, name) => page.screenshot({ path: path.join(outDir, `a11y-${name}.png`) });
const totalClicks = page => page.evaluate(() => window.__wedtmd.session.state.totalClicks);

// One fresh 1280x720 context per case group; watchPage tags errors with the running case.
const openContext = async browser => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watchPage(page, errors, tag);
  return { ctx, page };
};

const gotoGame = async (page, params) => {
  await page.goto(withQuery(base, params), { waitUntil: 'load' });
  await waitReady(page);
};

// Escape while a modal is open (max 3 presses), so the next Escape opens the SYSTEM menu.
const noModal = async page => {
  for (let i = 0; i < 3; i++) {
    if ((await page.evaluate(() => window.__wedtmd.modalCount())) === 0) return;
    await page.keyboard.press('Escape');
    await wait(page, 150);
  }
};

// Waits until no toast / era card is fading or playing its intro (milestone toast pulse ignored). Returns the last poll value.
const settleOverlays = page => poll(page, () => {
  const moving = el => el.getAnimations().some(a => a.playState === 'running' && !(a instanceof CSSAnimation && a.animationName === 'toast-pulse'));
  return [...document.querySelectorAll('#toast-stack .toast, #era-card')].every(el => !el.classList.contains('is-fading') && !moving(el));
}, null, 3000, 100);

// Visible SYSTEM menu tab ids in document order ('sys-tab-<id>' minus the prefix).
const visibleTabs = page => page.evaluate(() => Array.from(document.querySelectorAll('#sys-tabs [role=tab]'))
  .filter(el => !el.hidden && el.getClientRects().length > 0)
  .map(el => el.id.replace(/^sys-tab-/, '')));

// ---- Standard check helpers. X is the check-name prefix. ----

// Every required id appears among the walk's element ids.
const reachCheck = (prefix, walk, required) => {
  const seen = new Set(walk.map(r => r.id));
  const missing = required.filter(id => !seen.has(id));
  check(`${prefix}_reach`, missing.length === 0, missing);
};

// Every walk record with a non-body focus target shows a focus ring.
const ringCheck = (prefix, walk) => {
  const offenders = walk.filter(r => r.tag !== 'body' && !r.ring);
  check(`${prefix}_rings`, offenders.length === 0, offenders);
};

// Every walk record stays inside the scope.
const trapCheck = (prefix, walk) => {
  const offenders = walk.filter(r => r.inScope !== true);
  check(`${prefix}_trap`, offenders.length === 0, offenders);
};

// Accessible names, WCAG contrast and the 12 px font floor for one audited scope.
const auditChecks = (prefix, audit, { names = true, contrast = true, font = true } = {}) => {
  const scoped = audit.rootCount > 0;
  if (names) check(`${prefix}_names`, scoped && audit.unnamed.length === 0, scoped ? audit.unnamed : 'scope missing');
  if (contrast) check(`${prefix}_contrast`, scoped && audit.contrast.length === 0, scoped ? audit.contrast : 'scope missing');
  if (font) check(`${prefix}_font12`, audit.small.length === 0, audit.small);
};

// Element rect lies inside the viewport at the current UI scale.
const insideCheck = async (page, name, sel) => {
  const r = await rectInViewport(page, sel);
  check(name, r.ok, r);
};

// ---- Case groups ----

// A: title screen, then the CREDITS modal opened from it.
const runA = async browser => {
  cur = 'A_title';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('A_title', async () => {
      await gotoGame(page, { debug: '1', title: '1' });
      await page.waitForSelector('#title-screen.is-open', { timeout: 10000 });
      await focusId(page, 'title-new');
      const walk = await tabWalk(page, 8, '#title-screen');
      reachCheck('A', walk, ['title-new', 'title-settings', 'title-credits']);
      trapCheck('A', walk);
      ringCheck('A', walk);
      auditChecks('A', record('A_title', await auditScope(page, '#title-screen')));
      await shot(page, 'A-title');
    });
    await guard('A_credits', async () => {
      await focusId(page, 'title-credits');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#credits-overlay.is-open', { timeout: 5000 });
      const walk = await tabWalk(page, 4, '#credits-overlay');
      trapCheck('A_credits', walk);
      ringCheck('A_credits', walk);
      auditChecks('A_credits', record('A_credits', await auditScope(page, '#credits-overlay')), { font: false });
      await shot(page, 'A-credits');
      await page.keyboard.press('Escape');
      await wait(page, 300);
      const closed = (await count(page, '#credits-overlay.is-open')) === 0;
      const titleStill = (await count(page, '#title-screen.is-open')) > 0;
      check('A_credits_esc', closed && titleStill, { closed, titleStill });
    });
  } finally {
    await ctx.close();
  }
};

// B + C + D share one context: HUD, tech tree, SYSTEM menu.
const runBCD = async browser => {
  cur = 'B_hud';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('B_hud', async () => {
      await gotoGame(page, { debug: '1' });
      const before = await totalClicks(page);
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Space');
        await wait(page, 100);
      }
      const delta = (await totalClicks(page)) - before;
      check('B_space_crank', delta === 10, delta);
      await crankClicks(page, 10);
      const walk = await tabWalk(page, 6, '#ui-root');
      reachCheck('B', walk, ['hud-tech', 'hud-refocus', 'hud-system']);
      ringCheck('B', walk);
      await settleOverlays(page);
      auditChecks('B', record('B_hud', await auditScope(page, '#ui-root')));
      await shot(page, 'B-hud');
    });

    await guard('C_tree', async () => {
      cur = 'C_tree';
      await page.keyboard.press('t');
      await wait(page, 300);
      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          ok: el instanceof Element && el.matches('.tech-node.is-selected'),
          desc: el instanceof Element ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (el.getAttribute('class') || '') : null,
        };
      });
      check('C_focus_selected', focus.ok, focus.desc);
      const walk = await tabWalk(page, 30, '#tech-overlay');
      trapCheck('C', walk);
      const seen = new Set(walk.map(r => r.id));
      const missing = ['tech-close', 'tech-buy'].filter(id => !seen.has(id));
      const nodes = new Set(walk.filter(r => r.cls.includes('tech-node')).map(r => r.tech || `i${r.i}`)).size;
      const tabs = walk.filter(r => r.cls.includes('tech-tab')).length;
      check('C_reach', missing.length === 0 && nodes >= 3 && tabs >= 1, { missing, nodes, tabs });
      ringCheck('C', walk);
      await focusId(page, 'tech-close');
      const back = await tabWalk(page, 3, '#tech-overlay', 'Shift+Tab');
      check('C_trap_back', back.length === 3 && back.every(r => r.inScope === true) && back[0].id !== 'tech-close', back);
      await settleOverlays(page);
      auditChecks('C', record('C_tree', await auditScope(page, '#tech-overlay')));
      await shot(page, 'C-tree');
      await page.keyboard.press('Escape');
      await wait(page, 300);
    });

    await guard('D_menu', async () => {
      cur = 'D_menu';
      await noModal(page);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#system-menu.is-open', { timeout: 5000 });
      await installFocusLog(page);
      const walk = await tabWalk(page, 12, '#system-menu');
      reachCheck('D_system', walk, ['sys-tab-system', 'sys-mute', 'sys-save', 'sys-reset', 'sys-credits', 'sys-close']);
      trapCheck('D', walk);
      ringCheck('D', walk);
      for (const tab of await visibleTabs(page)) {
        await focusId(page, `sys-tab-${tab}`);
        await page.keyboard.press('Enter');
        await wait(page, 250);
        await resetFocusLog(page);
        const tw = await tabWalk(page, 25, '#system-menu');
        const missing = await missingFocus(page, '#system-menu [role=tabpanel]:not([hidden])');
        check(`D_${tab}_reach`, missing.length === 0, missing);
        ringCheck(`D_${tab}`, tw);
        auditChecks(`D_${tab}`, record(`D_${tab}`, await auditScope(page, '#system-menu')));
        await shot(page, `D-menu-${tab}`);
      }
      await page.keyboard.press('Escape');
      await wait(page, 300);
    });
  } finally {
    await ctx.close();
  }
};

// E: reduced motion stops CSS animations; the RESET arm stays readable.
const runE = async browser => {
  cur = 'E_reduced';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('E_reduced', async () => {
      await gotoGame(page, { debug: '1' });
      await crankClicks(page, 20);
      await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
      await wait(page, 300);
      await noModal(page);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#system-menu.is-open', { timeout: 5000 });
      await page.click('#sys-reset');
      await wait(page, 300);
      const attr = await page.getAttribute('#ui-root', 'data-reduced-motion');
      check('E_root_attr', attr === 'on', attr);
      const running = await page.evaluate(() => {
        const desc = el => {
          if (!(el instanceof Element)) return null;
          const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).join('.');
          return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
        };
        return document.getAnimations()
          .filter(a => a instanceof CSSAnimation && a.playState === 'running')
          .map(a => ({ name: a.animationName, target: desc(a.effect && a.effect.target) }));
      });
      check('E_no_animations', running.length === 0, running);
      await shot(page, 'E-reduced');
      await page.click('#sys-reset-cancel');
      await page.keyboard.press('Escape');
    });
  } finally {
    await ctx.close();
  }
};

// F: finale choice, postgame HUD and photo mode, SYSTEM MEMORY, cycle confirm.
const runF = async browser => {
  cur = 'F_finale';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('F_finale', async () => {
      await gotoGame(page, { debug: '1' });
      await crankClicks(page, 45);
      const failed = await buyList(page, [...S15, 'primaryFunction']);
      check('F_buys', failed.length === 0, failed);
      await wait(page, 1000);
      await page.evaluate(() => window.__wedtmd.skipFinale());
      await wait(page, 1500);

      const choiceWalk = await tabWalk(page, 4, '#finale-overlay');
      reachCheck('F_choice', choiceWalk, ['finale-keep', 'finale-cycle']);
      trapCheck('F_choice', choiceWalk);
      ringCheck('F_choice', choiceWalk);
      auditChecks('F_choice', record('F_choice', await auditScope(page, '#finale-overlay')));
      await shot(page, 'F-choice');
      await setUiScale(page, 150);
      await insideCheck(page, 'F_choice_150_inside', '.finale-column');
      await setUiScale(page, 100);

      await focusId(page, 'finale-keep');
      await page.keyboard.press('Enter');
      const postgame = await poll(page, () => window.__wedtmd.session.state.ending.phase === 'postgame', null, 5000, 100);
      check('F_postgame', postgame === true, postgame);
      const postWalk = await tabWalk(page, 6, null);
      reachCheck('F_post', postWalk, ['hud-view-machine']);

      await focusId(page, 'hud-view-machine');
      await page.keyboard.press('Enter');
      await wait(page, 1000);
      const photoWalk = await tabWalk(page, 3, null);
      reachCheck('F_photo', photoWalk, ['photo-exit']);
      check('F_photo_ring', photoWalk.some(r => r.id === 'photo-exit' && r.ring === true), photoWalk.filter(r => r.id === 'photo-exit'));
      const chip = record('F_photo', await auditScope(page, '#photo-exit'));
      check('F_photo_name', chip.rootCount > 0 && chip.unnamed.length === 0, chip.rootCount > 0 ? chip.unnamed : 'scope missing');
      await shot(page, 'F-photo');
      await page.keyboard.press('Escape');
      await wait(page, 600);

      await noModal(page);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#system-menu.is-open', { timeout: 5000 });
      await page.click('#sys-tab-memory');
      await wait(page, 250);
      auditChecks('F_memory', record('F_memory', await auditScope(page, '#system-menu')));
      await shot(page, 'F-memory');
      await setUiScale(page, 150);
      await insideCheck(page, 'F_memory_150_inside', '#system-panel');
      await setUiScale(page, 100);

      await page.click('#sys-tab-system');
      await focusId(page, 'sys-new-cycle');
      await page.keyboard.press('Enter');
      await wait(page, 400);
      const confirmWalk = await tabWalk(page, 4, '#cycle-confirm');
      reachCheck('F_confirm', confirmWalk, ['cycle-confirm-begin', 'cycle-confirm-cancel']);
      trapCheck('F_confirm', confirmWalk);
      ringCheck('F_confirm', confirmWalk);
      auditChecks('F_confirm', record('F_confirm', await auditScope(page, '#cycle-confirm')));
      await shot(page, 'F-confirm');
      await setUiScale(page, 150);
      await insideCheck(page, 'F_confirm_150_inside', '.cycle-confirm-panel');
      await setUiScale(page, 100);

      await focusId(page, 'cycle-confirm-cancel');
      await page.keyboard.press('Enter');
      await wait(page, 300);
      const hidden = await page.evaluate(() => {
        const el = document.getElementById('cycle-confirm');
        return !!el && el.hidden;
      });
      const cycle = await page.evaluate(() => window.__wedtmd.prestige().cycle);
      check('F_confirm_cancel', hidden && cycle === 1, { hidden, cycle });
    });
  } finally {
    await ctx.close();
  }
};

// G: scale 150 after a reload: title, credits, HUD, tech tree, every SYSTEM tab stay inside the viewport.
const runG = async browser => {
  cur = 'G_scale150';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('G_scale150', async () => {
      await gotoGame(page, { debug: '1' });
      await setUiScale(page, 150);
      await page.evaluate(() => window.__wedtmd.saveNow());
      await gotoGame(page, { debug: '1', title: '1' });
      await page.waitForSelector('#title-screen.is-open', { timeout: 10000 });
      await insideCheck(page, 'G_title_inside', '#title-panel');

      await focusId(page, 'title-credits');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#credits-overlay.is-open', { timeout: 5000 });
      const credRect = await rectInViewport(page, '#credits-panel');
      const scroll = await page.evaluate(() => {
        const el = document.getElementById('credits-panel');
        if (!el) return null;
        return { scrollH: el.scrollHeight, clientH: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
      });
      const scrollOk = scroll !== null && (scroll.scrollH <= scroll.clientH + 1 || scroll.overflowY === 'auto' || scroll.overflowY === 'scroll');
      check('G_credits_inside', credRect.ok && scrollOk, { rect: credRect, scroll });
      await page.keyboard.press('Escape');
      await wait(page, 300);

      await focusId(page, 'title-continue');
      await page.keyboard.press('Enter');
      await wait(page, 500);
      const hudPanel = await rectInViewport(page, '#hud-panel');
      const hudButtons = await rectInViewport(page, '#hud-buttons');
      check('G_hud_inside', hudPanel.ok && hudButtons.ok, { panel: hudPanel, buttons: hudButtons });

      await page.keyboard.press('t');
      await wait(page, 300);
      await insideCheck(page, 'G_tree_inside', '#tech-panel');
      await page.keyboard.press('Escape');
      await wait(page, 300);

      await noModal(page);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#system-menu.is-open', { timeout: 5000 });
      await shot(page, 'G-menu');
      for (const tab of await visibleTabs(page)) {
        await focusId(page, `sys-tab-${tab}`);
        await page.keyboard.press('Enter');
        await wait(page, 250);
        await insideCheck(page, `G_menu_${tab}_inside`, '#system-panel');
      }
      await page.keyboard.press('Escape');
    });
  } finally {
    await ctx.close();
  }
};

// H: era card, tech tree tabs 2 and 1 after the S9 buy list, one purchase toast.
const runH = async browser => {
  cur = 'H_cards';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('H_cards', async () => {
      await gotoGame(page, { debug: '1' });
      await crankClicks(page, 45);
      const failed = await buyList(page, S9);
      check('H_buys', failed.length === 0, failed);
      const shown = await poll(page, () => !!document.querySelector('#era-card.is-shown:not(.is-fading)'), null, 3000, 100);
      check('H_card_shown', shown === true, shown);
      await settleOverlays(page);
      auditChecks('H_card', record('H_card', await auditScope(page, '#era-card')));
      await shot(page, 'H-card');
      await page.click('#era-card', { timeout: 3000 }).catch(() => {});
      await wait(page, 500);

      await noModal(page);
      await page.keyboard.press('t');
      await wait(page, 400);
      await page.click('#tech-tab-2');
      await wait(page, 250);
      await settleOverlays(page);
      auditChecks('H_tree2', record('H_tree2', await auditScope(page, '#tech-overlay')));
      await shot(page, 'H-tree2');

      await page.click('#tech-tab-1');
      await wait(page, 250);
      const milestone = (await count(page, '.tech-node.is-milestone.is-purchased[data-tech=generatorBlueprint]')) > 0;
      check('H_tree1_milestone', milestone === true, milestone);
      const purchased = await page.evaluate(() => [...document.querySelectorAll('.tech-node.is-purchased:not(.is-milestone)')]
        .filter(el => el.getClientRects().length > 0).length);
      check('H_tree1_purchased', purchased >= 3, purchased);
      auditChecks('H_tree1', record('H_tree1', await auditScope(page, '#tech-overlay')));
      await shot(page, 'H-tree1');

      const bought = await page.evaluate(() => {
        const s = window.__wedtmd.session;
        let r = s.purchase('copperWinding');
        if (!r.ok) {
          s.update(Math.max(Date.now(), s.state.lastSimTime || 0) + 8 * 3600e3);
          r = s.purchase('copperWinding');
        }
        return r.ok === true;
      });
      await wait(page, 500);
      await settleOverlays(page);
      const toasts = await page.evaluate(() => [...document.querySelectorAll('#toast-stack .toast:not(.is-fading)')]
        .filter(el => el.getClientRects().length > 0).length);
      check('H_toast_shown', bought === true && toasts >= 1, { bought, toasts });
      auditChecks('H_toast', record('H_toast', await auditScope(page, '#toast-stack')), { names: false });
      await shot(page, 'H-toast');
      await page.keyboard.press('Escape');
      await wait(page, 300);
    });
  } finally {
    await ctx.close();
  }
};

// W (WP23a T13b): the living-world bubble in one fresh context with the hook. The polite live region speaks one line, the
// bubble nodes stay out of the accessibility tree and the focus order, and a bubble on screen leaves the Tab walk unchanged.
const bubbleOn = page => page.evaluate(() => window.__wedtmd.worldBubble()?.visible === true);

// Polls bubbleOn until it equals want or capMs passes. Returns whether it equals want.
const bubbleIs = async (page, want, capMs = 3000) => {
  const deadline = Date.now() + capMs;
  let v = await bubbleOn(page);
  while (v !== want && Date.now() < deadline) {
    await wait(page, 100);
    v = await bubbleOn(page);
  }
  return v === want;
};

// Waits (cap 8 s) until no toast is shown, so both walks start from the same screen. Returns whether none is shown.
const toastsGone = async page => {
  const deadline = Date.now() + 8000;
  for (;;) {
    const n = await page.evaluate(() => [...document.querySelectorAll('#toast-stack .toast')].filter(t => t.getClientRects().length > 0).length);
    if (n === 0 || Date.now() >= deadline) return n === 0;
    await wait(page, 100);
  }
};

// Runs in the page: live region politeness and text, the bubble hook state, and the ARIA state of every .wv node.
const liveState = () => {
  const live = document.getElementById('world-voice-live');
  const b = window.__wedtmd.worldBubble();
  return {
    polite: live !== null && live.getAttribute('aria-live') === 'polite',
    text: live !== null ? live.textContent : null,
    visible: b !== null && b.visible === true,
    bubbleText: b !== null ? b.text : null,
    wv: Array.from(document.querySelectorAll('.wv')).map(el => ({
      aria: el.getAttribute('aria-hidden'),
      tabindex: el.hasAttribute('tabindex'),
      focusable: el.tabIndex >= 0,
      open: el.classList.contains('is-open'),
    })),
  };
};

const runW = async browser => {
  cur = 'W_world';
  const { ctx, page } = await openContext(browser);
  try {
    await guard('W_world', async () => {
      await gotoGame(page, { debug: '1' });
      await page.evaluate(() => window.__wedtmd.worldQuiet(false));
      // First moment: one click, Gear Ratio. worldSay forces INS-02 past gaps and play-time gates, so no play-time advance is
      // needed: an advance would let the idle DOG-02 line start a frame before the force and take the one live region.
      await crankClicks(page, 16, 0);
      const failed = await buyList(page, ['gearRatio']);
      await poll(page, () => window.__wedtmd.worldState()?.silence === null, null, 3000, 100);
      const say = await page.evaluate(() => window.__wedtmd.worldSay('INS-02'));
      const shown = await bubbleIs(page, true);
      await wait(page, 400);
      const st = await page.evaluate(liveState);
      const text = st.text ?? '';
      const oneLine = /^Inspector: .+/.test(text) && text.indexOf('Inspector:', 1) < 0;
      const sameLine = st.bubbleText !== null && st.bubbleText !== '' && text === `Inspector: ${st.bubbleText}`;
      check('W_live_region', say === true && shown && st.polite && oneLine && sameLine, { failed, say, shown, polite: st.polite, live: st.text, bubble: st.bubbleText });
      const aria = st.visible && st.wv.length > 0 && st.wv.every(x => x.aria === 'true' && !x.tabindex && !x.focusable && !x.open);
      check('W_bubble_aria_hidden', aria, { visible: st.visible, wv: st.wv });

      // Tab walk from #hud-tech over the HUD: first with no bubble on screen, then with INS-01 on screen. Same start, same records.
      await page.evaluate(() => window.__wedtmd.worldQuiet(true));
      const offBefore = await bubbleIs(page, false, 6000);
      await toastsGone(page);
      await focusId(page, 'hud-tech');
      const walkOff = await tabWalk(page, 8, '#ui-root');
      await page.evaluate(() => window.__wedtmd.worldQuiet(false));
      await poll(page, () => window.__wedtmd.worldState()?.silence === null, null, 3000, 100);
      const say2 = await page.evaluate(() => window.__wedtmd.worldSay('INS-01'));
      const onScreen = await bubbleIs(page, true);
      await focusId(page, 'hud-tech');
      const walkOn = await tabWalk(page, 8, '#ui-root');
      const stillOn = await bubbleOn(page);
      const strip = walk => walk.map(({ i, ...rest }) => rest);
      const same = JSON.stringify(strip(walkOn)) === JSON.stringify(strip(walkOff));
      check('W_tab_walk_unchanged', offBefore && say2 && onScreen && stillOn && walkOff.length === 8 && same, {
        offBefore, say2, onScreen, stillOn, same, off: strip(walkOff), on: strip(walkOn),
      });
    });
  } finally {
    await ctx.close();
  }
};

// ---- Run ----

const browser = await chromium.launch();
try {
  await runA(browser);
  await runBCD(browser);
  await runE(browser);
  await runF(browser);
  await runG(browser);
  await runH(browser);
  await runW(browser);
} catch (e) {
  fail.push(`FAILED:run:${firstLine(e)}`);
} finally {
  await browser.close();
}

const result = { results: report.results, fail, deferred, inactive, indeterminate, errors };
const json = JSON.stringify(result, null, 2);
fs.writeFileSync(path.join(outDir, 'a11y.json'), `${json}\n`);
process.stdout.write(`${json}\n`);
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
