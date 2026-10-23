// WP16a T5 full e2e smoke: one browser run from the title screen to a new cycle and a reload, 12 steps.
// Real keyboard and mouse input throughout. The debug hook (window.__wedtmd) only reads state, makes the 8 h time
// jumps inside buyList, and the flow focuses the named control before an Enter press. Each step has its own guard
// and one screenshot. A step exception adds FAILED:<step>:<first line> to fail and the run goes on.
// Usage: PW_PATH=... node scripts/smoke/e2e-full.mjs <base-url-without-query> <outdir>
// base = preview URL with a trailing slash and NO query (e.g. http://localhost:4174/); the run adds ?debug=1&title=1.
// Prints ONE JSON object { results, metrics, wallMs, fail, errors } to stdout; the same text goes to <outdir>/e2e-full.json.
// Exit code 1 when fail or errors is non-empty, 2 on missing arguments. Screenshots: <outdir>/e2e-<NN>-<name>.png.
import fs from 'fs';
import path from 'path';
import {
  STAGES, ERA_TITLES, HUD_ROWS, delta, withQuery, loadChromium, readBudget, makeReport, watchPage,
  waitReady, crankClicks, buyList, dismissEraCard, hudState, poll,
} from './lib/common.mjs';

const START = Date.now();
const [base, outdir] = process.argv.slice(2);
if (!base || !outdir) {
  console.error('usage: PW_PATH=<playwright dir> node scripts/smoke/e2e-full.mjs <base-url-without-query> <outdir>');
  process.exit(2);
}

const U = withQuery(base, { debug: '1', title: '1' });
fs.mkdirSync(outdir, { recursive: true });
const report = makeReport();
const metrics = {};
let cur = 'setup';

const firstLine = (e) => {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.split('\n')[0];
};

// Runs the 12 steps on one page (one fresh 1280x720 context for the whole run).
async function runSteps(page) {
  const shot = (file) => page.screenshot({ path: path.join(outdir, file) });
  const press = async (key, waitMs = 300) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(waitMs);
  };
  const focusId = (id) => page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement) el.focus();
  }, id);
  const activeId = () => page.evaluate(() => (document.activeElement ? document.activeElement.id : null));
  const visibleId = (id) => page.evaluate((id) => {
    const el = document.getElementById(id);
    return !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }, id);
  const textOf = (id) => page.evaluate((id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || '').trim() : null;
  }, id);
  const modalCount = () => page.evaluate(() => window.__wedtmd.modalCount());
  const totalClicks = () => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
  const techLevel = (id) => page.evaluate((id) => window.__wedtmd.session.state.techLevels[id], id);
  const cycleNumber = () => page.evaluate(() => window.__wedtmd.prestige().cycle);
  const panelVisibility = () => page.evaluate(() => {
    const el = document.getElementById('hud-panel');
    return el ? getComputedStyle(el).visibility : null;
  });
  const heapMb = () => page.evaluate(() => {
    const m = performance.memory;
    return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
  });
  // Escape closes the top modal while one is open (max 3); only then Escape opens the system menu.
  const noModal = async () => {
    for (let i = 0; i < 3 && (await modalCount()) > 0; i++) await press('Escape');
  };
  const openMenu = async () => {
    await noModal();
    await press('Escape');
  };
  // Records the step's failure (if any) and always takes the step screenshot.
  const guard = async (id, name, fn) => {
    cur = `${id}_${name}`;
    try {
      await fn();
    } catch (e) {
      report.fail.push(`FAILED:${cur}:${firstLine(e)}`);
    }
    try {
      await shot(`e2e-${id}-${name}.png`);
    } catch (e) {
      report.fail.push(`FAILED:${cur}:screenshot ${firstLine(e)}`);
    }
  };

  // 01 title: fresh profile, NEW GAME focused, CONTINUE hidden.
  await guard('01', 'title', async () => {
    await page.goto(U, { waitUntil: 'networkidle' });
    await waitReady(page);
    report.check('01_title_open', await page.evaluate(() => !!document.querySelector('#title-screen.is-open')));
    report.check('01_continue_hidden', !(await visibleId('title-continue')));
    const focused = await activeId();
    report.check('01_new_focused', focused === 'title-new', focused);
  });

  // 02 newgame: Enter on NEW GAME, 20 mouse crank clicks, 10 Space presses (30 clicks in all).
  await guard('02', 'newgame', async () => {
    await press('Enter', 0);
    const closed = await page.waitForFunction(
      () => !document.querySelector('#title-screen.is-open'), null, { timeout: 2000 },
    ).then(() => true, () => false);
    report.check('02_title_closed', closed);
    await crankClicks(page, 20);
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
    }
    const clicks = await totalClicks();
    report.check('02_clicks', clicks === 30, clicks);
  });

  // 03 tree: open the tech tree, Tab to Gear Ratio, select (if needed) and buy it, close.
  await guard('03', 'tree', async () => {
    await press('t', 300);
    report.check('03_tree_open', await page.evaluate(() => window.__wedtmd.techTreeOpen()));
    const onGear = () => page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLElement && el.dataset.tech === 'gearRatio';
    });
    let reached = await onGear();
    for (let i = 0; i < 30 && !reached; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(80);
      reached = await onGear();
    }
    report.check('03_reached_gearRatio', reached);
    if (reached) {
      const selected = await page.evaluate(() => document.activeElement instanceof HTMLElement
        && document.activeElement.classList.contains('is-selected'));
      if (!selected) await press('Enter', 200);
      await press('Enter', 300);
    }
    const level = await techLevel('gearRatio');
    report.check('03_bought_gearRatio', level === 1, level);
    await press('Escape', 300);
    report.check('03_tree_closed', !(await page.evaluate(() => window.__wedtmd.techTreeOpen())));
  });

  // 04 save: SYSTEM > SAVE through the menu, then check the stored save.
  await guard('04', 'save', async () => {
    await noModal();
    await press('Escape', 300);
    await focusId('sys-save');
    await press('Enter', 300);
    await press('Escape', 300);
    const saved = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('wedtmd.save')).state.techLevels.gearRatio;
      } catch (e) {
        return null;
      }
    });
    report.check('04_saved', saved === 1, saved);
  });

  // 05 continue: reload, CONTINUE is focused, Enter keeps the progress.
  await guard('05', 'continue', async () => {
    await page.goto(U, { waitUntil: 'networkidle' });
    await waitReady(page);
    const focused = await activeId();
    report.check('05_continue_focused', focused === 'title-continue', focused);
    await press('Enter', 500);
    const level = await techLevel('gearRatio');
    const clicks = await totalClicks();
    report.check('05_progress_kept', level === 1 && clicks === 30, { gearRatio: level, totalClicks: clicks });
  });

  // 06 eras: 30 crank clicks, then each era's buy list, the era card, the HUD and the display list.
  await guard('06', 'eras', async () => {
    await crankClicks(page, 30);
    let prev = [];
    for (const [key, list] of STAGES) {
      const failed = await buyList(page, delta(prev, list));
      prev = list;
      await page.waitForTimeout(key === 's13' || key === 's15' ? 12000 : 2500);
      await dismissEraCard(page);
      const hud = await hudState(page);
      report.check(`06_${key}_buys`, failed.length === 0, failed);
      report.check(`06_${key}_title`, hud?.title === ERA_TITLES[key], hud?.title ?? null);
      report.check(`06_${key}_rows`, hud?.visibleRows === HUD_ROWS[key], hud?.visibleRows ?? null);
      const objects = await page.evaluate(() => window.__wedtmd.displayObjects());
      report.check(`06_${key}_displayObjects`, objects <= readBudget().displayObjects, objects);
      metrics[key] = {
        displayObjects: objects,
        machine: await page.evaluate(() => window.__wedtmd.machineStats()),
        heapMb: await heapMb(),
      };
      await shot(`e2e-06-${key}.png`);
    }
  });

  // 07 finale: buy primaryFunction, watch the sequence, Escape skips to the choice.
  await guard('07', 'finale', async () => {
    const failed = await buyList(page, ['primaryFunction']);
    report.check('07_buy', failed.length === 0, failed);
    const sequence = await poll(page, () => {
      const f = window.__wedtmd.finaleState();
      return !!f && f.phase === 'sequence';
    }, null, 5000);
    report.check('07_sequence', !!sequence);
    await page.waitForTimeout(3000);
    await shot('e2e-07-finale-mid.png');
    await press('Escape', 300);
    const choice = await poll(page, () => {
      const f = window.__wedtmd.finaleState();
      return !!f && f.phase === 'choice';
    }, null, 5000);
    report.check('07_choice', !!choice);
    report.check('07_keep_visible', await visibleId('finale-keep'));
  });

  // 08 keep: KEEP IT RUNNING enters postgame; the HUD title shows the restored name.
  await guard('08', 'keep', async () => {
    await focusId('finale-keep');
    await press('Enter', 0);
    const postgame = await poll(page, () => window.__wedtmd.session.state.ending.phase === 'postgame', null, 5000);
    report.check('08_postgame', !!postgame);
    await page.waitForTimeout(2500);
    const title = await textOf('hud-title');
    report.check('08_title', title === 'RESTORATION ENGINE', title);
  });

  // 09 view machine: VIEW MACHINE enters photo mode (HUD hidden); Escape leaves it again.
  await guard('09', 'view', async () => {
    await focusId('hud-view-machine');
    await press('Enter', 1500);
    const on = await page.evaluate(() => window.__wedtmd.photoState());
    report.check('09_photo_on', on?.active === true, on?.active ?? null);
    const hiddenWhileOn = await panelVisibility();
    report.check('09_hud_hidden', hiddenWhileOn === 'hidden', hiddenWhileOn);
    await shot('e2e-09-view-photo.png');
    await press('Escape', 800);
    const off = await page.evaluate(() => window.__wedtmd.photoState());
    report.check('09_photo_off', off?.active === false, off?.active ?? null);
    const back = await panelVisibility();
    report.check('09_hud_back', back === 'visible', back);
  });

  // 10 new cycle: SYSTEM > BEGIN A NEW CYCLE > confirm; the transition ends in cycle 2 with a fresh run.
  await guard('10', 'newcycle', async () => {
    await openMenu();
    report.check('10_menu_open', await page.evaluate(() => window.__wedtmd.systemMenuOpen()));
    const rowEnabled = await page.evaluate(() => {
      const el = document.getElementById('sys-new-cycle');
      return !!el && !el.hidden && el.getClientRects().length > 0 && el.getAttribute('aria-disabled') !== 'true';
    });
    report.check('10_row_enabled', rowEnabled);
    await focusId('sys-new-cycle');
    await press('Enter', 500);
    const confirmOpen = await page.evaluate(() => {
      const el = document.getElementById('cycle-confirm');
      return !!el && !el.hidden;
    });
    report.check('10_confirm_open', confirmOpen);
    await shot('e2e-10-newcycle-confirm.png');
    await focusId('cycle-confirm-begin');
    await press('Enter', 0);
    await poll(page, () => {
      const w = window.__wedtmd;
      return w.prestige().cycle === 2 && !w.cycleState().transition.active;
    }, null, 20000);
    report.check('10_cycle2', (await cycleNumber()) === 2, await cycleNumber());
    const label = await textOf('hud-cycle');
    report.check('10_cycle_label', (label ?? '').includes('CYCLE 0043'), label);
    await noModal();
    const fresh = await page.evaluate(() => {
      const s = window.__wedtmd.session.state;
      return { generator: s.techLevels.generator, ending: s.ending.phase };
    });
    report.check('10_fresh_run', fresh.generator === 0 && fresh.ending === 'none', fresh);
    const before = await totalClicks();
    await crankClicks(page, 5);
    const after = await totalClicks();
    report.check('10_crank_works', after === before + 5, { before, after });
  });

  // 11 reload: SAVE, reload, CONTINUE is focused, Enter; the new cycle survives the reload.
  await guard('11', 'reload', async () => {
    await openMenu();
    await focusId('sys-save');
    await press('Enter', 300);
    await press('Escape', 300);
    await page.goto(U, { waitUntil: 'networkidle' });
    await waitReady(page);
    await press('Enter', 500);
    report.check('11_cycle_kept', (await cycleNumber()) === 2, await cycleNumber());
    const label = await textOf('hud-cycle');
    report.check('11_label_kept', (label ?? '').includes('CYCLE 0043'), label);
  });

  // 12 footer: the SYSTEM tab footer carries the version line.
  await guard('12', 'footer', async () => {
    await noModal();
    await press('Escape', 300);
    const text = await textOf('sys-footer');
    report.check('12_footer', text !== null && text.startsWith('v0.9.0'), text);
    await press('Escape', 300);
  });
}

const chromium = loadChromium();
let browser = null;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watchPage(page, report.errors, () => cur);
  await runSteps(page);
} catch (e) {
  report.fail.push(`FAILED:${cur}:${firstLine(e)}`);
} finally {
  if (browser !== null) await browser.close().catch(() => {});
}

const wallMs = Date.now() - START;
report.check('wall_time', wallMs <= 300000, wallMs);
const out = { results: report.results, metrics, wallMs, fail: report.fail, errors: report.errors };
const json = JSON.stringify(out);
fs.writeFileSync(path.join(outdir, 'e2e-full.json'), json);
console.log(json);
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
