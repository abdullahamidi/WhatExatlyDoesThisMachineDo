// WP28a Splices smoke (C15, cases A-L and N): the dead objects, the hover tooltip, the buy by click and by keyboard, the refusals, the
// era II placements, the pulses, reduced motion, the new cycle (SYS LOG cut line), BUY MAX, the NEXT BUY readout and the camera drag.
// One browser, a fresh context per case, 1920 x 1080 unless a case says otherwise. Case I is the prestige case (era V, the finale and a new
// cycle) and case L the demo case: both skip on the other build with a reason (a skip in results, never in fail). Case G skips on the demo
// build (era III is not in the demo).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/splices.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { edition, results, fail, errors } and writes <outdir>/splices.json.
// A check whose value no hook exposes fails by name with its reason; a skip is { skip: reason } in results, never in fail.
// Setup checks `<KEY>_buys` (the buy lists of a case) sit in results and fail the run when a buy fails.
// Cases (names in results and fail; shots in <outdir>):
//   A dead          A_placed (bicycle, organ, clock placed and visible at e1; none woken; no line)
//   B hover         B_cursor (canvas cursor pointer), B_tip (SPLICE · BICYCLE, 900 ME, +5% automation, a state line; the crank is not covered)
//   C buy by click  C_woken (state woken, frame changed, line, pulses 1-4), C_order (after the click the frame is dead within 300 ms and woken at
//                   1.5 s: the pulse runs before the wake), C_toast, C_announce ('Spliced: Bicycle'), C_cue (splices +1)
//   D deny          D_deny (after the first tech is bought, the first-run silence has ended: level unchanged, denies +1 per click, the
//                   tooltip state line NEED ... MORE ME or LINE NOT IN REACH)
//   E keyboard      E_tab (SPLICES tab with an affordable count), E_bought (the tablist: Tab to the selected tab, End to SPLICES, Enter, Tab to
//                   the clock row, Enter, Tab to BUY, Enter; clock woken), E_esc (Escape closes the TECH INDEX)
//   F era II        F_s9 (every era I-II object placed or a documented exemption; splices-F-s9.png)
//   G pulses        G_scale (pulses at least 1, non-decreasing from S7 to S11, at most 4)
//   H reduced       H_static (woken frames constant over 2 s; pulses 0)
//   I prestige      I_dark (every Splice locked or available, no line), I_log (SYS LOG 'Lines cut: 2. Objects dark again.' within 20 s of the
//                   cycle transition; the cycle toast has no LINES CUT)
//   J BUY MAX       J_max (copperWinding rose by at least 2 in one Shift+click; resources >= 0), J_once (one purchase event and exactly one
//                   save write stamped within 100 ms before to 600 ms after it; the autosave is a no-op in this page and 20 s of idle writes are
//                   counted first, recorded as idle20sWrites), J_audio (live voices at
//                   most idle + 3 at 150 ms), J_frame (longest rAF frame in the click second at most max(50, idle + 60) ms; idle is the
//                   same probe over an idle second)
//   K NEXT BUY      K_text (after a spend-down of every affordable tech, nextBuyText() matches the readout pattern; nothing affordable)
//   L demo          L_demo (demo build only: the six era I-II Splices placed and not locked; the era III-V rows read FULL GAME)
//   N drag          N_drag (a 120 px drag from the affordable dead bicycle pans the camera by at least 40 px; the bicycle stays dead)
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, S11, S15, buyList, crankClicks, delta, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/splices.mjs "<url with ?debug=1>" <outdir>';
const [url, out] = process.argv.slice(2);
if (!process.env.PW_PATH || !url || !out || !URL.canParse(url)) {
  console.error(USAGE);
  process.exit(2);
}
const chromium = loadChromium();
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });

const VIEW = { width: 1920, height: 1080 };
// Mirrored by hand from src/data/splices.ts (the Splice table), src/data/ux.ts (SPLICE_TEXT) and src/data/systemLogs.ts (SYSTEM_LOG_CUT);
// change them together.
const BICYCLE_TITLE = 'SPLICE · BICYCLE';
const BICYCLE_COST = '900 ME';
const BICYCLE_EFFECT = '+5% automation';
const WAKE_TOAST = 'Line spliced. Wheel turning. Direction disputed.';
const WAKE_ANNOUNCE = 'Spliced: Bicycle';
const CUT_LINE = 'Lines cut: 2. Objects dark again.';
const STATE_RE = /^(CLICK TO SPLICE|NEED .+ MORE ME|LINE NOT IN REACH · .+|FULL GAME|SPLICED)$/;
const DENY_STATE_RE = /^(NEED .+ MORE ME|LINE NOT IN REACH · .+)$/;
const NEXT_BUY_RE = /^NEXT BUY: .+ · ~\d+[hms]( \d+[ms])?$/;
const ERA12 = ['spliceBicycle', 'spliceOrgan', 'spliceClock', 'spliceRadio', 'splicePayphone', 'spliceSign'];
const ERA345 = ['splicePump', 'spliceWhistle', 'spliceHydrant', 'spliceBell', 'spliceGramophone', 'spliceChimes', 'spliceVane', 'spliceKite',
  'spliceCairn', 'spliceCoinReturn'];
// F_s9: documented placement exemptions at s9 (the placement table has none); a missing placement must be listed here.
const EXEMPT_S9 = {};
const LIST_B = [...S7];
const DEMO_SKIP = 'demo build: era III-V are not in the demo (era cap)';
const FULL_ONLY_SKIP = 'full build: case L is the demo case (demoState() is null here)';
const PRESTIGE_DEMO_SKIP = 'demo build: the finale and a new cycle need era V (not in the demo)';

const report = makeReport();
// 'full' or 'demo' once case A has read the edition; null before that
let edition = null;
// the case key that page errors are tagged with (watchPage reads it when an event fires)
let tag = 'setup';

const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];
// A thrown error becomes FAILED:<key>:<first line of the message> in fail; the run goes on.
const recordThrow = (key, e) => { report.fail.push(`FAILED:${key}:${firstLine(e)}`); };
// A skip: the reason goes into results; a skip is never in fail.
const skip = (name, reason) => { report.results[name] = { skip: reason }; };
const round = v => (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v);
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });

// One check group: a throw is recorded under its key and the next group still runs.
const step = async (key, fn) => {
  tag = key;
  try {
    await fn();
  } catch (e) {
    recordThrow(key, e);
  }
};

// One fresh context per case (1920 x 1080, deviceScaleFactor 1); the context closes even after a throw.
const runContext = async (browser, key, fn) => {
  tag = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
    await fn(ctx);
  } catch (e) {
    recordThrow(key, e);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
};

// Fresh page on the target URL with the hook and the hand crank ready; beforeLoad (optional) adds an init script before the navigation.
const openPage = async (ctx, beforeLoad = null) => {
  const page = await ctx.newPage();
  if (beforeLoad !== null) await beforeLoad(page);
  watchPage(page, report.errors, () => tag);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  return page;
};

// ---- page readers (each evaluate is self-contained: no outer variables) ----

const isDemo = page => page.evaluate(() => (window.__wedtmd.demoState?.() ?? null) !== null);
// The Splice rows of the director (spliceStats), in TECH_IDS order; [] without a World scene.
const spliceRows = page => page.evaluate(() => window.__wedtmd.spliceStats?.() ?? []);
const rowOf = (rows, id) => rows.find(r => r.id === id) ?? null;
// The poke target of an id in client px: { x, y, w, h, cx, cy, enabled }; null when it is not on screen.
const targetOf = (page, id) => page.evaluate(want => {
  const t = (window.__wedtmd.pokeTargets?.() ?? []).find(item => item.id === want);
  if (!t) return null;
  return { x: t.x, y: t.y, w: t.w, h: t.h, cx: t.x + t.w / 2, cy: t.y + t.h / 2, enabled: t.enabled };
}, id);
// The text of the four tooltip lines (the .wv-tip slab while it shows), or null.
const tipLines = page => page.evaluate(() => {
  const el = document.querySelector('.wv-tip.on');
  return el ? [...el.children].map(c => (c.textContent || '').trim()) : null;
});
// The client box of the shown tooltip, or null.
const tipBox = page => page.evaluate(() => {
  const el = document.querySelector('.wv-tip.on');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
});
const canvasCursor = page => page.evaluate(() => document.querySelector('#game canvas')?.style.cursor ?? null);
const crankPoint = page => page.evaluate(() => window.__wedtmd.crankClientPoint());
const audioStat = (page, key) => page.evaluate(k => window.__wedtmd.audioStats?.()?.[k] ?? null, key);
const audioUnlocked = page => poll(page, () => window.__wedtmd.audioUnlocked?.() === true, null, 3000);
const techLevel = (page, id) => page.evaluate(want => window.__wedtmd.session.state.techLevels[want] ?? 0, id);
const cameraCentreX = page => page.evaluate(() => window.__wedtmd.cameraState?.()?.centerX ?? null);
const toastTexts = page => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => (t.textContent || '').trim()));
const liveText = page => page.evaluate(() => document.getElementById('world-voice-live')?.textContent ?? null);
const hudTechAffordable = page => page.evaluate(() => document.getElementById('hud-tech')?.getAttribute('data-affordable') ?? '');
// The page clock (performance.now, ms) and one sample of the bicycle's row: its state and frame with the clock of the read (C_order).
const pageClock = page => page.evaluate(() => performance.now());
const bicycleSample = page => page.evaluate(() => {
  const r = (window.__wedtmd.spliceStats?.() ?? []).find(x => x.id === 'spliceBicycle') ?? null;
  return { t: performance.now(), state: r?.state ?? null, frame: r?.frame ?? null };
});

// Compact readout for the JSON detail.
const briefRow = r => (r === null ? null : { id: r.id, state: r.state, placed: r.placed, visible: r.visible, line: r.line, pulses: r.pulses });

// Moves the pointer onto a target's centre (a few steps, so hover and the zone's pointerover fire).
const hoverTarget = async (page, t) => {
  await page.mouse.move(t.cx, t.cy, { steps: 4 });
  await page.waitForTimeout(150);
};

// One 8 h jump on the session clock (the buyInPage pattern), forward from the later of now and the last simulated point.
const jump8 = page => page.evaluate(() => {
  const s = window.__wedtmd.session;
  const last = Number.isFinite(s.state.lastSimTime) ? s.state.lastSimTime : Date.now();
  s.update(Math.max(Date.now(), last) + 8 * 3600 * 1000);
});

// Focus walk for the keyboard path: presses Tab until the focused element matches (by id, or by data-tech); true when it does.
const focusIs = (page, kind, value) => page.evaluate(({ kind: k, value: v }) => {
  const el = document.activeElement;
  if (!el) return false;
  return k === 'id' ? el.id === v : el.getAttribute('data-tech') === v;
}, { kind, value });
const tabUntil = async (page, kind, value, max) => {
  for (let i = 0; i < max; i++) {
    if (await focusIs(page, kind, value)) return true;
    await page.keyboard.press('Tab');
  }
  return focusIs(page, kind, value);
};
// The TECH INDEX tablist has a roving tabindex: the focused tab that Tab reaches is the selected one (role tab, tabindex 0).
const focusOnSelectedTab = page => page.evaluate(() => {
  const el = document.activeElement;
  return !!el && el.getAttribute('role') === 'tab' && el.getAttribute('tabindex') === '0';
});
const tabUntilSelectedTab = async (page, max) => {
  for (let i = 0; i < max; i++) {
    if (await focusOnSelectedTab(page)) return true;
    await page.keyboard.press('Tab');
  }
  return focusOnSelectedTab(page);
};

// The longest rAF frame gap (ms) over one second, measured in the page (the J frame probe; the idle second uses the same code).
const frameLongest = page => page.evaluate(() => new Promise(resolve => {
  let last = performance.now();
  let max = 0;
  const t0 = last;
  const tick = now => {
    max = Math.max(max, now - last);
    last = now;
    if (now - t0 < 1000) requestAnimationFrame(tick);
    else resolve(max);
  };
  requestAnimationFrame(tick);
}));
// The save writes counted by the J probe so far (the probe wraps Storage.setItem for the save key).
const writesNow = page => page.evaluate(() => window.__wedtmd.__jWrites ?? 0);

// Spends every affordable tech down (the NEXT BUY readout is null while anything is affordable): each affordable repeatable gets
// purchaseMax, each affordable unlock a purchase, round after round (cap 200) until getAllTechViews() has none affordable.
const spendDown = page => page.evaluate(() => {
  const s = window.__wedtmd.session;
  const affordable = () => s.getAllTechViews().filter(v => v.affordable);
  let rounds = 0;
  let bought = 0;
  while (rounds < 200 && affordable().length > 0) {
    for (const v of affordable()) {
      if (v.def.kind === 'repeatable') s.purchaseMax(v.id);
      else s.purchase(v.id);
      bought += 1;
    }
    rounds += 1;
  }
  return { rounds, bought, left: affordable().length };
});

// ---- build and commit (the buy lists go through buyList; the commit step is the one of faults.mjs) ----

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and keep tinkering
// (as faults.mjs). On the full build demoState() is null and the helper returns at once.
const clearDemoCap = async page => {
  const phase = () => page.evaluate(() => window.__wedtmd.demoState?.()?.phase ?? null);
  if ((await phase()) === null) return;
  await poll(page, () => ['teaser', 'card', 'idle'].includes(window.__wedtmd.demoState?.()?.phase), null, 8000, 100);
  if ((await phase()) === 'teaser') {
    await page.click('#demo-skip', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState?.()?.phase === 'card', null, 5000, 100);
  }
  if ((await phase()) === 'card') {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState?.()?.phase === 'idle', null, 5000, 100);
  }
  await page.waitForTimeout(500);
};

// One buy list: `<key>_buys` is the failed-buy list (empty = every buy worked); the demo cap is cleared after it.
const buildStage = async (page, key, buys) => {
  const failed = await buyList(page, buys);
  report.check(`${key}_buys`, failed.length === 0, failed);
  await clearDemoCap(page);
};

// The F6.4 commit step: the TECH INDEX opens and closes (1.2 s, Escape, 2.5 s), then the era card clears and the cursor leaves the canvas.
const commit = async page => {
  await page.keyboard.press('t');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  await dismissEraCard(page);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
};

// TECH INDEX: opens with t and reports whether it is open; closes with Escape and reports whether it is closed.
const openTree = async page => {
  await page.keyboard.press('t');
  return poll(page, () => window.__wedtmd.techTreeOpen() === true, null, 3000);
};
const closeTree = async page => {
  await page.keyboard.press('Escape');
  return poll(page, () => window.__wedtmd.techTreeOpen() === false, null, 3000);
};

// ---- cases ----

// A dead: the S7 list (era I): the bicycle, the organ and the clock stand placed and visible at e1, dead, with no line.
const caseA = async ctx => {
  const page = await openPage(ctx);
  await step('A', async () => {
    edition = (await isDemo(page)) ? 'demo' : 'full';
    await crankClicks(page, 45, 0);
    await buildStage(page, 'A', LIST_B);
    await commit(page);
    const rows = await spliceRows(page);
    const got = ['spliceBicycle', 'spliceOrgan', 'spliceClock'].map(id => rowOf(rows, id));
    const placed = got.every(r => r !== null && r.placed === true && r.visible === true && r.state !== 'woken');
    const noLine = rows.length > 0 && rows.every(r => r.line === false);
    report.check('A_placed', placed && noLine, { objects: got.map(briefRow), noLine });
  });
};

// B hover: the pointer on the bicycle gives the hand cursor and the four-line tooltip; the tooltip never covers the crank hub.
const caseB = async ctx => {
  const page = await openPage(ctx);
  await step('B', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'B', LIST_B);
    await commit(page);
    const t = await targetOf(page, 'spliceBicycle');
    if (t === null) {
      report.check('B_cursor', false, 'spliceBicycle is not on screen (pokeTargets)');
      report.check('B_tip', false, 'spliceBicycle is not on screen (pokeTargets)');
      return;
    }
    await hoverTarget(page, t);
    const cursorOk = await poll(page, () => document.querySelector('#game canvas')?.style.cursor === 'pointer', null, 1500, 50);
    report.check('B_cursor', cursorOk === true, { cursor: await canvasCursor(page) });
    await poll(page, () => document.querySelector('.wv-tip.on') !== null, null, 1500, 50);
    const lines = await tipLines(page);
    const box = await tipBox(page);
    const crank = await crankPoint(page);
    const covers = box !== null && crank.x >= box.left && crank.x <= box.right && crank.y >= box.top && crank.y <= box.bottom;
    const ok = lines !== null && lines[0] === BICYCLE_TITLE && lines[1] === BICYCLE_COST && (lines[2] ?? '').includes(BICYCLE_EFFECT)
      && STATE_RE.test(lines[3] ?? '') && !covers;
    report.check('B_tip', ok, { lines, covers });
  });
};

// C buy by click: an 8 h jump makes the bicycle affordable; a click on it wakes it (the line, the pulses, the toast, the announce, the cue).
const caseC = async ctx => {
  const page = await openPage(ctx);
  await step('C', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'C', LIST_B);
    await commit(page);
    await audioUnlocked(page);
    await jump8(page);
    await page.waitForTimeout(300);
    const before = rowOf(await spliceRows(page), 'spliceBicycle');
    const cues0 = await audioStat(page, 'splices');
    const reduced = await page.evaluate(() => window.__wedtmd.session.settings?.reducedMotion === true);
    const t = await targetOf(page, 'spliceBicycle');
    const clickAt = await pageClock(page);
    if (t !== null) await page.mouse.click(t.cx, t.cy);
    const woken = await poll(page, () => (window.__wedtmd.spliceStats?.() ?? []).find(r => r.id === 'spliceBicycle')?.state === 'woken', null, 1500, 50);
    // C_order: the wake beat holds the dead frame and the pulse runs first. Samples every 30 ms up to 300 ms after the click (all while the
    // state is woken), then one sample at 1.5 s. Both are read before the frame poll below, which waits for the beat to end.
    const early = [];
    for (let i = 0; i < 30; i++) {
      const s = await bicycleSample(page);
      early.push({ dtMs: round(s.t - clickAt), state: s.state, frame: s.frame });
      if (s.t - clickAt >= 300) break;
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(Math.max(0, clickAt + 1500 - (await pageClock(page))));
    const late = await bicycleSample(page);
    // the frame changes when the wake beat ends (at most about 1 s after the click): poll for the change, then read the row
    await poll(page, (f) => (window.__wedtmd.spliceStats?.() ?? []).find(r => r.id === 'spliceBicycle')?.frame !== f, before?.frame ?? null, 2000, 50);
    const after = rowOf(await spliceRows(page), 'spliceBicycle');
    const frameChanged = before !== null && after !== null && before.frame !== after.frame;
    const pulsesOk = after !== null && after.pulses >= 1 && after.pulses <= 4;
    report.check('C_woken', woken === true && frameChanged && after !== null && after.line === true && pulsesOk, {
      before: briefRow(before), after: briefRow(after), frameChanged,
    });
    const earlyDead = early.some(s => s.state === 'woken' && s.frame === 'dead' && s.dtMs <= 300);
    const lateWoken = late.state === 'woken' && late.frame === 'woken';
    report.check('C_order', reduced || (earlyDead && lateWoken), {
      reduced, early, late: { dtMs: round(late.t - clickAt), state: late.state, frame: late.frame },
      note: reduced ? 'reduced motion on: no wake beat, so the order passes on the frame alone' : null,
    });
    const toast = await poll(page, (wanted) => [...document.querySelectorAll('.toast')].some((el) => (el.textContent || '').includes(wanted)), WAKE_TOAST, 1500);
    report.check('C_toast', toast === true, { toasts: await toastTexts(page) });
    const live = await poll(page, (wanted) => (document.getElementById('world-voice-live')?.textContent ?? '').includes(wanted), WAKE_ANNOUNCE, 1500);
    report.check('C_announce', live === true, { live: await liveText(page) });
    const cues1 = await audioStat(page, 'splices');
    report.check('C_cue', cues0 !== null && cues1 === cues0 + 1, { before: cues0, after: cues1 });
  });
};

// D deny: a fresh run (no jump): the organ and the bicycle are locked; each click is refused (denies +1), no level moves, and the
// tooltip says why. The first-run onboarding silence keeps every poke target disabled until the first tech is bought (or it ends), so the
// first tech is bought and an enabled target is polled for (20 s cap) before the deny clicks.
const caseD = async ctx => {
  const page = await openPage(ctx);
  await step('D', async () => {
    await crankClicks(page, 45, 0);
    await audioUnlocked(page);
    const firstBuy = await buyList(page, ['wornMotor']);
    const enabled = await poll(page, () => (window.__wedtmd.pokeTargets?.() ?? []).some(t => t.enabled === true), null, 20000, 250);
    const results = { silence: { firstBuy, enabled: enabled === true } };
    for (const id of ['spliceOrgan', 'spliceBicycle']) {
      const t = await targetOf(page, id);
      if (t === null) {
        results[id] = { onScreen: false };
        continue;
      }
      await hoverTarget(page, t);
      const d0 = await audioStat(page, 'denies');
      await page.mouse.click(t.cx, t.cy);
      await page.waitForTimeout(300);
      const d1 = await audioStat(page, 'denies');
      const lines = await tipLines(page);
      results[id] = { denied: d0 === null || d1 === null ? null : d1 - d0, level: await techLevel(page, id), state: lines?.[3] ?? null };
    }
    const ok = ['spliceOrgan', 'spliceBicycle'].every(id => results[id] !== undefined && results[id].denied === 1 && results[id].level === 0
      && DENY_STATE_RE.test(results[id].state ?? ''));
    report.check('D_deny', ok, results);
  });
};

// E keyboard: the clock is made affordable by 8 h jumps; the TECH INDEX opens, the SPLICES tab is reached with Tab and Enter, the clock row
// is reached and selected, BUY buys it, and Escape closes the index.
const caseE = async ctx => {
  const page = await openPage(ctx);
  await step('E', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E', LIST_B);
    await commit(page);
    for (let k = 0; k < 8; k++) {
      const r = rowOf(await spliceRows(page), 'spliceClock');
      if (r !== null && r.state === 'affordable') break;
      await jump8(page);
      await page.waitForTimeout(150);
    }
    await openTree(page);
    const tab = await page.evaluate(() => {
      const el = document.getElementById('tech-tab-splices');
      return el ? { hidden: el.hidden, affordable: el.getAttribute('data-affordable') } : null;
    });
    report.check('E_tab', tab !== null && tab.hidden === false && Number(tab.affordable) >= 1, tab);
    // the tablist: Tab reaches the selected tab, End moves to the last tab (SPLICES), Enter selects it
    const reachedSelected = await tabUntilSelectedTab(page, 14);
    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    const reachedTab = reachedSelected === true && (await focusIs(page, 'id', 'tech-tab-splices'));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const reachedRow = await tabUntil(page, 'data', 'spliceClock', 40);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const reachedBuy = await tabUntil(page, 'id', 'tech-buy', 14);
    await page.keyboard.press('Enter');
    const bought = await poll(page, () => (window.__wedtmd.spliceStats?.() ?? []).find(r => r.id === 'spliceClock')?.state === 'woken', null, 1500, 50);
    report.check('E_bought', reachedTab && reachedRow && reachedBuy && bought === true, {
      reachedSelected, reachedTab, reachedRow, reachedBuy, bought,
    });
    await page.keyboard.press('Escape');
    const closed = await poll(page, () => window.__wedtmd.techTreeOpen() === false, null, 2000, 50);
    report.check('E_esc', closed === true, { closed });
  });
};

// F era II: the S9 list and the three era II Splices (radio, payphone, sign); every era I-II object placed or exempt. The line-crossing
// claim (lines never cross the machine bbox) needs the line path, which the hook does not expose: the linePath unit tests carry it.
const caseF = async ctx => {
  const page = await openPage(ctx);
  await step('F', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'F', [...S9, 'spliceRadio', 'splicePayphone', 'spliceSign']);
    await commit(page);
    const rows = await spliceRows(page);
    const missing = ERA12.filter(id => {
      const r = rowOf(rows, id);
      return !(r !== null && r.placed === true) && !(id in EXEMPT_S9);
    });
    report.check('F_s9', missing.length === 0, {
      missing, rows: rows.filter(r => ERA12.includes(r.id)).map(briefRow),
      lines: 'not in the hook: the line path is covered by the linePath unit test',
    });
    await shot(page, 'splices-F-s9.png');
  });
};

// G pulses: the bicycle's pulses after S7 (its wake) and after S11 (more ME per second): non-decreasing, between 1 and 4.
const caseG = async ctx => {
  const page = await openPage(ctx);
  await step('G', async () => {
    if (await isDemo(page)) {
      skip('G_scale', DEMO_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'G1', [...S7, 'spliceBicycle']);
    await commit(page);
    const p1 = rowOf(await spliceRows(page), 'spliceBicycle')?.pulses ?? null;
    await buildStage(page, 'G2', delta(S7, S11));
    await commit(page);
    const p2 = rowOf(await spliceRows(page), 'spliceBicycle')?.pulses ?? null;
    report.check('G_scale', p1 !== null && p2 !== null && p1 >= 1 && p2 >= p1 && p2 <= 4, { p1, p2 });
  });
};

// H reduced motion: the woken bicycle holds one frame over 2 s (six samples) and shows no pulses.
const caseH = async ctx => {
  const page = await openPage(ctx);
  await step('H', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'H', [...S7, 'spliceBicycle']);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await page.waitForTimeout(400);
    const frames = [];
    const pulses = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) await page.waitForTimeout(400);
      const r = rowOf(await spliceRows(page), 'spliceBicycle');
      frames.push(r?.frame ?? null);
      pulses.push(r?.pulses ?? null);
    }
    const steady = frames.every(f => f !== null && f === frames[0]) && pulses.every(p => p === 0);
    report.check('H_static', steady, { frames, pulses });
  });
};

// I prestige: two Splices woken (bicycle, organ), the finale and a new cycle through the hook and the finale buttons (the prestige.mjs path).
// Every Splice goes dark; the SYS LOG line `Lines cut: 2. Objects dark again.` follows within 20 s of the transition; the cycle toast has no LINES CUT.
const caseI = async ctx => {
  const page = await openPage(ctx);
  await step('I', async () => {
    if (await isDemo(page)) {
      skip('I_dark', PRESTIGE_DEMO_SKIP);
      skip('I_log', PRESTIGE_DEMO_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'I', [...S7, 'spliceBicycle', 'spliceOrgan', ...delta(S7, S15)]);
    await buildStage(page, 'Ifin', ['primaryFunction']);
    await page.evaluate(() => window.__wedtmd?.skipFinale?.());
    await page.waitForTimeout(300);
    const c0 = await page.evaluate(() => window.__wedtmd.prestige?.()?.cycle ?? null);
    await page.click('#finale-cycle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
    await page.click('#cycle-confirm-begin', { timeout: 5000 }).catch(() => {});
    await poll(page, (n) => (window.__wedtmd.prestige?.()?.cycle ?? -1) > n, c0, 20000, 100);
    // the transition runs (active) and then ends; the dark state is read after it (the prestige.mjs runTransition order)
    await poll(page, () => window.__wedtmd.cycleState?.()?.transition?.active === true, null, 5000, 50);
    await poll(page, () => window.__wedtmd.cycleState?.()?.transition?.active !== true, null, 15000, 100);
    const endedAt = Date.now();
    const rows = await spliceRows(page);
    const dark = rows.length > 0 && rows.every(r => (r.state === 'locked' || r.state === 'available') && r.line === false);
    report.check('I_dark', dark, { states: rows.filter(r => ERA12.includes(r.id)).map(briefRow) });
    const logged = await poll(page, (wanted) => [...document.querySelectorAll('.toast')].some((el) => (el.textContent || '').includes(wanted)), CUT_LINE, 20000, 200);
    const texts = await toastTexts(page);
    const cycleToasts = texts.filter(t => t.includes('CYCLE'));
    const noCut = cycleToasts.every(t => !t.includes('LINES CUT'));
    report.check('I_log', logged === true && noCut, { logged, withinS: round((Date.now() - endedAt) / 1000), cycleToasts, toasts: texts });
  });
};

// J BUY MAX: an 8 h jump, the TECH INDEX on era II, one Shift+click on copperWinding: one purchase event and one save write stamped at the
// click (the window is set by the purchase's own stamp, so the autosave phase does not matter); the audio voices and the frame time stay
// within bounds.
// J: the autosave interval (AUTOSAVE_INTERVAL_MS, mirrored) registers a no-op callback in this page, so no autosave write can land in the
// click window (the timing is then the same whatever the autosave phase). Every other interval is the real one.
const AUTOSAVE_MS = 15000;
const noAutosave = page => page.addInitScript(({ ms }) => {
  const real = window.setInterval.bind(window);
  window.setInterval = (fn, delay, ...rest) => (delay === ms ? real(() => {}, delay) : real(fn, delay, ...rest));
}, { ms: AUTOSAVE_MS });
const caseJ = async ctx => {
  const page = await openPage(ctx, noAutosave);
  await step('J', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'J', S9);
    await commit(page);
    await audioUnlocked(page);
    await jump8(page);
    await page.waitForTimeout(300);
    await openTree(page);
    await page.click('#tech-tab-2', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    const lvl0 = await techLevel(page, 'copperWinding');
    // probes: a purchase listener (session.on) and a wrapper of Storage.setItem for the save key (restored by the probe read below); both
    // stamp their events with performance.now() (the page clock)
    await page.evaluate(() => {
      const w = window.__wedtmd;
      w.__jPurchases = 0;
      w.__jPurchaseAt = [];
      w.__jOff = w.session.on('purchase', () => { w.__jPurchases += 1; w.__jPurchaseAt.push(performance.now()); });
      w.__jWrites = 0;
      w.__jWriteAt = [];
      w.__jSetItem = Storage.prototype.setItem;
      const orig = w.__jSetItem;
      Storage.prototype.setItem = function setItemProbe(key, value) {
        if (key === 'wedtmd.save') {
          w.__jWrites += 1;
          w.__jWriteAt.push(performance.now());
        }
        return orig.call(this, key, value);
      };
    });
    // the idle proof: 20 s with no click in this page, the probe installed; the autosave is a no-op (noAutosave), so no save write lands
    const idle20W0 = await writesNow(page);
    await page.waitForTimeout(20000);
    const idle20 = (await writesNow(page)) - idle20W0;
    const idle = await audioStat(page, 'liveVoices');
    // the idle second's frame probe (no click): this headless browser runs at about 10 fps at 1080p
    const idleLongest = await frameLongest(page);
    // the click second starts with empty stamps: only the purchase and the writes stamped after this point are read
    await page.evaluate(() => {
      const w = window.__wedtmd;
      w.__jPurchases = 0;
      w.__jPurchaseAt = [];
      w.__jWriteAt = [];
    });
    const frameP = frameLongest(page);
    await page.click('.tech-node[data-tech="copperWinding"]', { modifiers: ['Shift'], timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
    const voices = await audioStat(page, 'liveVoices');
    await page.waitForTimeout(850);
    const longest = await frameP;
    const probe = await page.evaluate(() => {
      const w = window.__wedtmd;
      const r = { purchases: w.__jPurchases, purchaseAt: w.__jPurchaseAt.slice(), writeAt: w.__jWriteAt.slice() };
      Storage.prototype.setItem = w.__jSetItem;
      w.__jOff?.();
      return r;
    });
    // the click's save write: a save write stamped within [purchase - 100 ms, purchase + 600 ms] of the purchase event
    const purchaseAt = probe.purchaseAt[0] ?? null;
    const clickWrites = purchaseAt === null ? 0 : probe.writeAt.filter(at => at >= purchaseAt - 100 && at <= purchaseAt + 600).length;
    const lvl1 = await techLevel(page, 'copperWinding');
    const nonNegative = await page.evaluate(() => Object.values(window.__wedtmd.session.state.res).every(v => v >= 0));
    report.check('J_max', lvl1 - lvl0 >= 2 && nonNegative, { level: [lvl0, lvl1], nonNegative });
    report.check('J_once', probe.purchases === 1 && clickWrites === 1, {
      purchases: probe.purchases, clickWrites, writesInClickSecond: probe.writeAt.length, idle20sWrites: idle20,
    });
    report.check('J_audio', voices !== null && idle !== null && voices <= idle + 3, { idle, voices });
    const frameBound = Math.max(50, idleLongest + 60);
    report.check('J_frame', round(longest) <= frameBound, { longestMs: round(longest), idleLongestMs: round(idleLongest), boundMs: round(frameBound) });
  });
};

// K NEXT BUY: the S7 list with nothing affordable: the readout matches the pattern and the affordable badge is empty.
const caseK = async ctx => {
  const page = await openPage(ctx);
  await step('K', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'K', LIST_B);
    await commit(page);
    // the readout is null while anything is affordable: spend down first, then wait for the HUD badge to clear (it refreshes every 250 ms)
    const spent = await spendDown(page);
    const cleared = await poll(page, () => (document.getElementById('hud-tech')?.getAttribute('data-affordable') ?? '') === '', null, 2000, 100);
    const text = await poll(page, (re) => {
      const t = window.__wedtmd.nextBuyText?.() ?? null;
      return t !== null && new RegExp(re).test(t) ? t : null;
    }, NEXT_BUY_RE.source, 3000, 100);
    const affordable = await hudTechAffordable(page);
    report.check('K_text', typeof text === 'string' && affordable === '', { spent, cleared: cleared === true, text, affordable });
  });
};

// L demo: the six era I-II Splices are placed and not locked; the SPLICES tab shows the era III-V rows as FULL GAME. Full build: skip.
const caseL = async ctx => {
  const page = await openPage(ctx);
  await step('L', async () => {
    if (!(await isDemo(page))) {
      skip('L_demo', FULL_ONLY_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'L', S9);
    await commit(page);
    const rows = await spliceRows(page);
    const ok12 = ERA12.every(id => {
      const r = rowOf(rows, id);
      return r !== null && r.placed === true && r.state !== 'locked';
    });
    await openTree(page);
    await page.click('#tech-tab-splices', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    const states = await page.evaluate((ids) => ids.map(id => ({
      id, state: document.querySelector(`.tech-splice-row[data-tech="${id}"]`)?.children[1]?.textContent?.trim() ?? null,
    })), ERA345);
    await closeTree(page);
    const fullGame = states.every(r => r.state === 'FULL GAME');
    report.check('L_demo', ok12 && fullGame, { ok12, states });
    await shot(page, 'splices-L-demo.png');
  });
};

// N drag: an 8 h jump makes the bicycle affordable; a 120 px drag that starts on it pans the camera and buys nothing.
const caseN = async ctx => {
  const page = await openPage(ctx);
  await step('N', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'N', LIST_B);
    await commit(page);
    await jump8(page);
    await page.waitForTimeout(300);
    const t = await targetOf(page, 'spliceBicycle');
    const c0 = await cameraCentreX(page);
    if (t !== null) {
      await page.mouse.move(t.cx, t.cy);
      await page.mouse.down();
      await page.mouse.move(t.cx + 120, t.cy, { steps: 12 });
      await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const c1 = await cameraCentreX(page);
    const level = await techLevel(page, 'spliceBicycle');
    const moved = c0 !== null && c1 !== null ? Math.abs(c1 - c0) : null;
    report.check('N_drag', t !== null && moved !== null && moved >= 40 && level === 0, { centreX: [c0, c1], moved: round(moved), level });
  });
};

let browser = null;
try {
  browser = await chromium.launch();
  await runContext(browser, 'A', caseA);
  await runContext(browser, 'B', caseB);
  await runContext(browser, 'C', caseC);
  await runContext(browser, 'D', caseD);
  await runContext(browser, 'E', caseE);
  await runContext(browser, 'F', caseF);
  await runContext(browser, 'G', caseG);
  await runContext(browser, 'H', caseH);
  await runContext(browser, 'I', caseI);
  await runContext(browser, 'J', caseJ);
  await runContext(browser, 'K', caseK);
  await runContext(browser, 'L', caseL);
  await runContext(browser, 'N', caseN);
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors };
fs.writeFileSync(path.join(out, 'splices.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
