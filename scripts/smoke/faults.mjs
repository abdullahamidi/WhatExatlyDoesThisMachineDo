// WP27 Machine Faults smoke (C13, cases A-O and J_e5in): the fault marker, the clear paths, the gates, the eras, Overdrive and the wind-up.
// One browser, a fresh context per case, 1920 x 1080 unless a case says otherwise. Case O is the demo case: it runs on the demo
// build only (a skip with its reason on the full build). On the demo build J, J_e5in and K skip the eras it does not open (a skip with its reason).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/faults.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { edition, results, fail, errors } and writes <outdir>/faults.json.
// A check whose value no hook exposes fails by name with its reason; a skip is { skip: reason } in results, never in fail.
// The skips left: the demo era cap (eras III-V) and case O on the full build.
// Cases (names in results and fail; shots in <outdir>):
//   A locked        A_locked: unlocked false, spawned 0, no marker (after the lazy marker loads, then 10 s)
//   B unlock        B_toast (install toast), B_tree (faultLamp node, tab I, slot (5,2))
//   C spawn         C_marker (centre within 120 px of the anchor point, the part's top centre), C_announce; faults-C-e1.png
//   D clear pointer D_caught, D_popup (first gain line CLEARED +<s>s), D_cue
//   E clear key     E_key
//   F miss          F_missed, F_input
//   G no stacking   G_single
//   H gates         H_photo, H_tree
//   I reduced       I_steady (marker tagFrame and fxFrame constant over 6 samples in 2 s)
//   J eras          J_anchor_e2 .. J_anchor_e5 (on an anchor of the era, on screen); faults-J-<key>.png
//   J_e5in          era V without the Gravitic Anchor (S14): marker on the generator (era V's second anchor, never the crank), eligible; faults-J-e5in.png
//   K overdrive     K_overdrive (overdriveLeft 5-6 s right after the clear; HUD WIND-UP row says OVERDRIVE)
//   L wind-up       L_release (first gain line RELEASE +n right after the click; the store is 0 at the 'click' event, released = the stored seconds)
//   M quiet         M_quiet
//   N cost          N_cost (marker meanMs at most 0.05)
//   O demo          O_demo (demo build only)
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, S11, S13, S15, buyList, crankClicks, delta, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/faults.mjs "<url with ?debug=1>" <outdir>';
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
// Mirrored by hand from src/data/faultMarker.ts (FAULT_MARKER.anchors: the two anchors of each era); change them together.
const ANCHORS = {
  1: ['pistonArray', 'flywheel'], 2: ['sparkGap', 'flywheel'], 3: ['boiler', 'steamHammer'],
  4: ['spireExciter', 'calliope'], 5: ['graviticAnchorR', 'generator'], // era V: R + the generator (AD2 round 2 F8, src/data/faultMarker.ts)
};
// Mirrored from src/ui/techTreeView.ts (TECH_TREE_LAYOUT): a node's left / top px is padding + index x (size + gap).
// Eras I and II start at column 0 and row 0, so no shift applies to the slots read here.
const TREE = { padding: 18, nodeWidth: 144, colGap: 14, nodeHeight: 68, rowGap: 28 };
const slotLeft = col => `${TREE.padding + col * (TREE.nodeWidth + TREE.colGap)}px`;
const slotTop = row => `${TREE.padding + row * (TREE.nodeHeight + TREE.rowGap)}px`;
const NEAR_PX = 120; // C_marker: the marker centre within this many client px of its anchor point (the part's top centre)
const RELEASE_MIN_S = 0.05; // mirrored from src/ui/hudView.ts RELEASE_MIN_SECONDS: a smaller release shows no line
const PAYOUT_SHARE = 0.95; // D_caught: each energy with a rate gains at least this share of payoutSeconds x perSecond
const PASSIVE_SLACK_S = 1; // F_missed: without a payout each energy gained at most perSecond x (elapsed + this) seconds
const OVERDRIVE_S = [5, 6]; // K_overdrive: Overdrive lasts 6 s (decision Q4); read 5-6 s right after the clear
const FAULT_LINE = 'Fault reporting enabled'; // B_toast: the install toast line (src/data/notifications.ts)
const ANNOUNCE = 'Fault:'; // C_announce: the spawn line in the world-voice live region (src/data/faultMarker.ts FAULT_TEXT.announceSpawn)
const FULL_GAME = 'FULL GAME'; // O_demo: the label of the era tabs the demo does not open
const NOT_NUMBERS = 'faultStats().marker.tagFrame and fxFrame must be numbers on the debug hook (the marker frames to compare)';
const DEMO_ERA_SKIP = 'demo build: eras III-V are not in the demo (era cap)';
const FULL_ONLY_SKIP = 'full build: case O is the demo case (demoState() is null here)';

// LIST(stage): the common stage list plus the fault techs of that stage (buyList jumps time as needed).
// S14 is stages.mjs S14 (common.mjs keeps it private): S13 plus nullChamber, the era V entry without the Gravitic Anchor.
const S14 = [...S13, 'nullChamber'];
const LIST = {
  s7: [...S7, 'faultLamp'],
  s9: [...S9, 'faultLamp', 'dischargeLever'],
  s14: [...S14, 'faultLamp', 'dischargeLever', 'leakWhistle', 'dampingFork'],
  s15: [...S15, 'faultLamp', 'dischargeLever', 'leakWhistle', 'dampingFork', 'overrunClutch'],
};
// Case J (one page, cumulative): era II is the full S9 list; each later era buys its stage delta and the fault tech of that stage.
const ERA_STEPS = [
  { era: 2, key: 'e2', buys: LIST.s9 },
  { era: 3, key: 'e3', buys: [...delta(S9, S11), 'leakWhistle'] },
  { era: 4, key: 'e4', buys: [...delta(S11, S13), 'dampingFork'] },
  { era: 5, key: 'e5', buys: [...delta(S13, S15), 'overrunClutch'] },
];

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

// Fresh page on the target URL with the hook and the hand crank ready.
const openPage = async ctx => {
  const page = await ctx.newPage();
  watchPage(page, report.errors, () => tag);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  return page;
};

// ---- page readers (each evaluate is self-contained: no outer variables) ----

const isDemo = page => page.evaluate(() => (window.__wedtmd.demoState?.() ?? null) !== null);
// The Machine Faults readout (faultStats); null without the hook or the World scene.
const faults = page => page.evaluate(() => window.__wedtmd.faultStats?.() ?? null);
// Resources, passive rates, payout seconds and the fault counters that the clear checks compare.
const ledger = page => page.evaluate(() => {
  const s = window.__wedtmd.session;
  return {
    res: { ...s.state.res }, perSecond: { ...s.rates.perSecond }, payoutSeconds: s.faults.payoutSeconds,
    caught: s.faults.caught, missed: s.faults.missed, spawned: s.faults.spawned,
  };
});
const cueCount = page => page.evaluate(() => window.__wedtmd.audioStats?.()?.faultClearCues ?? null);
const windupOf = page => page.evaluate(() => window.__wedtmd.windupStats?.() ?? null);
const spawnedOf = page => page.evaluate(() => window.__wedtmd.session.faults.spawned);
const caughtOf = page => page.evaluate(() => window.__wedtmd.session.faults.caught);
const forceFault = page => page.evaluate(() => window.__wedtmd.forceFault?.() ?? false);
const liveText = page => page.evaluate(() => document.getElementById('world-voice-live')?.textContent ?? null);
// The marker's sprite frames (the last set values, -1 before the first set); null without the marker.
const markerFramesOf = page => page.evaluate(() => {
  const m = window.__wedtmd.faultStats?.()?.marker;
  return m ? { tag: m.tagFrame, fx: m.fxFrame } : null;
});
// The text of each line of the newest gain block (crank block or clear popup); null without a World scene.
const gainLinesOf = page => page.evaluate(() => window.__wedtmd.gainLines?.() ?? null);

// Compact readout for the JSON detail.
const brief = s => (s === null ? null : { unlocked: s.unlocked, spawned: s.spawned, alive: s.alive, visible: s.marker.visible });
const inViewport = pt => !!pt && pt.x >= 0 && pt.x <= VIEW.width && pt.y >= 0 && pt.y <= VIEW.height;
// On screen: the marker shows and its centre lies inside the viewport.
const onScreen = s => s !== null && s.marker.visible === true && inViewport(s.client);
// The marker centre: on screen and within NEAR_PX of the anchor part's centre (client px).
const nearAnchor = s => {
  if (!s || !s.client || !s.anchorClient) return null;
  const dist = Math.hypot(s.client.x - s.anchorClient.x, s.client.y - s.anchorClient.y);
  return { visible: s.marker.visible === true, inside: inViewport(s.client), dist: round(dist), ok: onScreen(s) && dist <= NEAR_PX };
};

// Waits until the marker shows with a client point (1.5 s by default); returns faultStats (null without the hook).
const waitMarker = async (page, capMs = 1500) => {
  await poll(page, () => {
    const s = window.__wedtmd.faultStats?.();
    return !!s && s.marker.visible === true && s.client !== null;
  }, null, capMs, 50);
  return faults(page);
};

// Clears the live fault with the F key, then waits (1 s) until none is alive.
const clearByKey = async page => {
  await page.keyboard.press('f');
  return poll(page, () => {
    const s = window.__wedtmd.faultStats?.();
    return !!s && s.alive === null;
  }, null, 1000, 50);
};
// Clears a live fault (if any) with the F key; used between checks.
const clearLive = async page => {
  if ((await faults(page))?.alive) await clearByKey(page);
};

// Samples the marker and the clock every 250 ms for 3 s: true when no sample shows a marker or a live fault.
const staysHidden = async (page, ms = 3000) => {
  let quiet = true;
  const steps = Math.round(ms / 250);
  for (let i = 0; i <= steps; i++) {
    const s = await faults(page);
    if (s === null || s.alive !== null || s.marker.visible === true) quiet = false;
    if (i < steps) await page.waitForTimeout(250);
  }
  return quiet;
};

// The clear popup header, trimmed as the game trims it (FAULT_TEXT.popupHeader: two decimals, no trailing zeros).
const popupHeader = seconds => 'CLEARED +' + String(Number(seconds.toFixed(2))) + 's';

// Each energy with a passive rate gains at least PAYOUT_SHARE x payoutSeconds x perSecond (passive income only adds to it).
const payoutCheck = (before, after) => {
  const rows = {};
  let ok = before.perSecond.me > 0;
  for (const r of Object.keys(before.perSecond)) {
    const rate = before.perSecond[r];
    if (!(rate > 0)) continue;
    const gained = after.res[r] - before.res[r];
    const need = PAYOUT_SHARE * before.payoutSeconds * rate;
    rows[r] = { gained: round(gained), need: round(need) };
    if (!(gained >= need)) ok = false;
  }
  return { ok, rows };
};
// No payout: each energy gained at most its passive rate over the wait plus the slack (a 15 s payout would exceed that).
const passiveOnly = (before, after, elapsedS) => {
  const rows = {};
  let ok = true;
  for (const r of Object.keys(before.perSecond)) {
    const rate = before.perSecond[r];
    if (!(rate > 0)) continue;
    const gained = after.res[r] - before.res[r];
    const cap = rate * (elapsedS + PASSIVE_SLACK_S);
    rows[r] = { gained: round(gained), cap: round(cap) };
    if (!(gained <= cap + 1e-6)) ok = false;
  }
  return { ok, rows };
};

// ---- build and commit (the buy lists go through buyList; the commit step is the one of diag2 and economy) ----

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and keep tinkering
// (as economy.mjs). On the full build demoState() is null and the helper returns at once.
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

// One cumulative buy list: `<key>_buys` is the failed-buy list (empty = every buy worked); the demo cap is cleared after it.
const buildStage = async (page, key, buys) => {
  const failed = await buyList(page, buys);
  report.check(`${key}_buys`, failed.length === 0, failed);
  await clearDemoCap(page);
};

// The F6.4 commit step: hook buys do not commit cast placements, so the TECH INDEX opens and closes (1.2 s, Escape, 2.5 s),
// then the era card clears and the cursor leaves the canvas.
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
// Runs in the page: the node of `tech` (slot px, hidden flag, shown flag), tab `tabNo` selection, and every tab label.
const treeRead = (page, tech, tabNo) => page.evaluate(({ tech, tabNo }) => {
  const n = document.querySelector('.tech-node[data-tech="' + tech + '"]');
  const tab = document.getElementById('tech-tab-' + tabNo);
  return {
    left: n ? n.style.left : null,
    top: n ? n.style.top : null,
    hidden: n ? n.hidden : null,
    shown: n ? n.getClientRects().length > 0 : false,
    tabSelected: tab ? tab.getAttribute('aria-selected') === 'true' : null,
    tabs: [...document.querySelectorAll('.tech-tab')].map((t) => ({ text: (t.textContent || '').trim(), disabled: t.disabled === true })),
  };
}, { tech, tabNo });
// TECH INDEX check: open it, select tab `tabNo`, read the node's slot (col, row), close it. Returns the read.
const checkTree = async (page, rec, name, tech, tabNo, col, row) => {
  const opened = await openTree(page);
  await page.click(`#tech-tab-${tabNo}`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(200);
  const read = await treeRead(page, tech, tabNo);
  const closed = await closeTree(page);
  const slotOk = read.left === slotLeft(col) && read.top === slotTop(row);
  const ok = opened === true && closed === true && read.tabSelected === true && read.hidden === false && read.shown === true && slotOk;
  rec(name, ok, { opened, closed, left: read.left, top: read.top, slot: [col, row], tabSelected: read.tabSelected, hidden: read.hidden });
  return read;
};

// ---- sub-checks shared by B-E and O (rec = report.check, or the local recorder of O) ----

// B_toast: the install toast with the Fault Lamp line is on screen right after the buy (toasts live 3.2 s).
const checkToast = async (page, rec) => {
  const found = await poll(page, (text) => [...document.querySelectorAll('.toast')].some((t) => (t.textContent || '').includes(text)), FAULT_LINE, 1500);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => (t.textContent || '').trim()).slice(0, 4));
  rec('B_toast', found === true, { toasts });
};

// C_marker / C_announce: forceFault, the marker shows within 1.5 s near its anchor, and the world-voice line says 'Fault:'.
const checkSpawn = async (page, rec, shotName) => {
  await forceFault(page);
  const s = await waitMarker(page);
  const near = nearAnchor(s);
  rec('C_marker', near !== null && near.ok, near === null ? null : { ...near, anchor: s.marker.anchor });
  const live = await poll(page, (text) => (document.getElementById('world-voice-live')?.textContent ?? '').includes(text), ANNOUNCE, 1500);
  rec('C_announce', live === true, { live: await liveText(page) });
  if (shotName !== null && s !== null && s.marker.visible === true) await shot(page, shotName);
  return s;
};

// D_caught / D_cue / D_popup: a real click on the marker centre clears the fault; every energy with a rate gains its payout,
// the cue counts, and the clear popup (the newest gain block) starts with its CLEARED +<payout seconds>s header within 1 s.
const checkPointerClear = async (page, rec) => {
  await poll(page, () => window.__wedtmd.audioUnlocked?.() === true, null, 3000);
  await forceFault(page);
  const s = await waitMarker(page);
  const before = await ledger(page);
  const cuesBefore = await cueCount(page);
  if (s !== null && s.client !== null) await page.mouse.click(s.client.x, s.client.y);
  await page.waitForTimeout(300);
  const after = await ledger(page);
  const cuesAfter = await cueCount(page);
  const pay = payoutCheck(before, after);
  rec('D_caught', s !== null && after.caught === before.caught + 1 && pay.ok, { caught: [before.caught, after.caught], payout: pay.rows });
  rec('D_cue', cuesBefore !== null && cuesAfter === cuesBefore + 1, { before: cuesBefore, after: cuesAfter });
  const want = popupHeader(after.payoutSeconds);
  const shown = await poll(page, (w) => window.__wedtmd.gainLines?.()?.[0] === w, want, 1000, 50);
  const first = (await gainLinesOf(page))?.[0] ?? null;
  rec('D_popup', s !== null && shown === true, { want, first });
};

// E_key: forceFault, then the F key clears the live fault.
const checkKeyClear = async (page, rec) => {
  await forceFault(page);
  const s = await waitMarker(page);
  const before = await caughtOf(page);
  await page.keyboard.press('f');
  const ok = await poll(page, (n) => window.__wedtmd.session.faults.caught === n + 1, before, 1500);
  rec('E_key', s !== null && ok === true, { before, after: await caughtOf(page) });
};

// ---- cases ----

// A locked: a fresh run for 10 s stays locked, with no spawn and no marker.
const caseA = async ctx => {
  const page = await openPage(ctx);
  await step('A', async () => {
    edition = (await isDemo(page)) ? 'demo' : 'full';
    // The marker is a lazy chunk (loaded after WorldScene.create): faultStats is null until it is in, so wait for it first.
    await poll(page, () => window.__wedtmd.faultStats?.() != null, null, 8000, 100);
    await page.waitForTimeout(10000);
    const s = await faults(page);
    report.check('A_locked', s !== null && s.unlocked === false && s.spawned === 0 && s.marker.visible === false, brief(s));
  });
};

// B unlock: the S7 list and the Fault Lamp: the install toast, then the tech tree node on tab I at slot (5,2).
const caseB = async ctx => {
  const page = await openPage(ctx);
  await step('B', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'B', LIST.s7);
    await checkToast(page, report.check);
    await commit(page);
    await checkTree(page, report.check, 'B_tree', 'faultLamp', 1, 5, 2);
  });
};

// C spawn: forceFault, the marker near its anchor and the world-voice announce line.
const caseC = async ctx => {
  const page = await openPage(ctx);
  await step('C', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'C', LIST.s7);
    await commit(page);
    await checkSpawn(page, report.check, 'faults-C-e1.png');
  });
};

// D clear by pointer: a click on the marker centre pays out; the clear cue counts; the clear popup shows its header.
const caseD = async ctx => {
  const page = await openPage(ctx);
  await step('D', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'D', LIST.s7);
    await commit(page);
    await checkPointerClear(page, report.check);
  });
};

// E clear by key: forceFault, then the F key.
const caseE = async ctx => {
  const page = await openPage(ctx);
  await step('E', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E', LIST.s7);
    await commit(page);
    await checkKeyClear(page, report.check);
  });
};

// F miss: the fault expires after its window; no payout (passive income only), the marker hides and takes no input.
const caseF = async ctx => {
  const page = await openPage(ctx);
  await step('F', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'F', LIST.s7);
    await commit(page);
    await forceFault(page);
    const s0 = await waitMarker(page);
    const before = await ledger(page);
    const t0 = Date.now();
    await page.waitForTimeout((s0?.alive?.window ?? 0) * 1000 + 1500);
    const elapsedS = (Date.now() - t0) / 1000;
    const after = await ledger(page);
    const s1 = await faults(page);
    const passive = passiveOnly(before, after, elapsedS);
    const missedOk = after.missed === before.missed + 1 && after.caught === before.caught && passive.ok && s1 !== null && s1.marker.visible === false;
    report.check('F_missed', missedOk, { missed: [before.missed, after.missed], caught: [before.caught, after.caught], elapsedS: round(elapsedS), passive: passive.rows, visible: s1?.marker.visible ?? null });
    report.check('F_input', s1 !== null && s1.marker.interactive === false, { interactive: s1?.marker.interactive ?? null });
  });
};

// G no stacking: a second forceFault while a fault is alive adds nothing: one spawn in total.
const caseG = async ctx => {
  const page = await openPage(ctx);
  await step('G', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'G', LIST.s7);
    await commit(page);
    const start = await spawnedOf(page);
    await forceFault(page);
    await waitMarker(page);
    await forceFault(page);
    await page.waitForTimeout(1500);
    const added = (await spawnedOf(page)) - start;
    report.check('G_single', added === 1, { spawned: added });
  });
};

// H gates: photo mode and the open TECH INDEX hold the clock; a spawn follows within 1.5 s after each gate closes.
const caseH = async ctx => {
  const page = await openPage(ctx);
  await step('H', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'H', LIST.s7);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.photoMode?.(true));
    await forceFault(page);
    const quietPhoto = await staysHidden(page, 3000);
    const startPhoto = await spawnedOf(page);
    await page.evaluate(() => window.__wedtmd.photoMode?.(false));
    const spawnedAfterPhoto = await poll(page, (n) => window.__wedtmd.session.faults.spawned > n, startPhoto, 1500);
    report.check('H_photo', quietPhoto && spawnedAfterPhoto === true, { quietPhoto, spawnedAfterPhoto });
    await clearLive(page);
    const opened = await openTree(page);
    await forceFault(page);
    const quietTree = await staysHidden(page, 3000);
    const startTree = await spawnedOf(page);
    const closed = await closeTree(page);
    const spawnedAfterTree = await poll(page, (n) => window.__wedtmd.session.faults.spawned > n, startTree, 1500);
    report.check('H_tree', opened === true && quietTree && closed === true && spawnedAfterTree === true, { opened, quietTree, closed, spawnedAfterTree });
  });
};

// I reduced motion: the marker sprite frames (tagFrame and fxFrame) stay constant over 2 s (six samples, 400 ms apart).
// A steady -1 is 'never set', so it does not pass; frames that are not numbers fail with NOT_NUMBERS.
const caseI = async ctx => {
  const page = await openPage(ctx);
  await step('I', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'I', LIST.s7);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await forceFault(page);
    const s = await waitMarker(page);
    const frames = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) await page.waitForTimeout(400);
      frames.push(await markerFramesOf(page));
    }
    const numeric = frames.every((f) => f !== null && Number.isFinite(f.tag) && Number.isFinite(f.fx));
    const steady = numeric && frames.every((f) => f.tag >= 0 && f.fx >= 0 && f.tag === frames[0].tag && f.fx === frames[0].fx);
    report.check('I_steady', steady, { frames, visible: s?.marker.visible ?? null, reason: numeric ? null : NOT_NUMBERS });
  });
};

// J eras: one page, cumulative. In each era the marker sits on an anchor of that era, on screen. Demo: era II only.
const caseJ = async ctx => {
  const page = await openPage(ctx);
  await step('J', async () => {
    const demo = await isDemo(page);
    await crankClicks(page, 45, 0);
    for (const st of ERA_STEPS) {
      const name = `J_anchor_${st.key}`;
      if (demo && st.era > 2) {
        skip(name, DEMO_ERA_SKIP);
        continue;
      }
      await buildStage(page, `J_${st.key}`, st.buys);
      await commit(page);
      await forceFault(page);
      const s = await waitMarker(page);
      const onAnchor = s !== null && ANCHORS[st.era].includes(s.marker.anchor);
      report.check(name, onAnchor && onScreen(s), { anchor: s?.marker.anchor ?? null, client: s?.client ?? null, era: st.era });
      if (s !== null && s.marker.visible === true) await shot(page, `faults-J-${st.key}.png`);
      await clearLive(page);
    }
  });
};

// J_e5in: era V entered WITHOUT the Gravitic Anchor (the S14 list). The generator, era V's second anchor, carries the fault
// (AD2 round 2 F8): the marker shows there, away from the crank, and the clock ticks.
// Its own run: case J's page already holds the anchor.
// Demo: skip (era cap).
const caseJe5in = async ctx => {
  const page = await openPage(ctx);
  await step('J_e5in', async () => {
    if (await isDemo(page)) {
      skip('J_e5in', DEMO_ERA_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'J_e5in', LIST.s14);
    await commit(page);
    await forceFault(page);
    const s = await waitMarker(page);
    const anchor = s?.marker.anchor ?? null;
    const ok = s !== null && s.marker.visible === true && anchor === 'generator' && s.marker.eligible === true;
    report.check('J_e5in', ok, { anchor, visible: s?.marker.visible ?? null, eligible: s?.marker.eligible ?? null, client: s?.client ?? null });
    if (s !== null && s.marker.visible === true) await shot(page, 'faults-J-e5in.png');
  });
};

// K Overdrive: clearing the fault of era V starts Overdrive (5-6 s left) and the HUD wind-up row says so. Demo: skip.
const caseK = async ctx => {
  const page = await openPage(ctx);
  await step('K', async () => {
    if (await isDemo(page)) {
      skip('K_overdrive', DEMO_ERA_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'K', LIST.s15);
    await commit(page);
    await forceFault(page);
    const s = await waitMarker(page);
    if (s !== null && s.client !== null) await page.mouse.click(s.client.x, s.client.y);
    await page.waitForTimeout(100);
    const left = await page.evaluate(() => window.__wedtmd.faultStats?.()?.overdriveLeft ?? null);
    const hudOk = await poll(page, () => (document.getElementById('hud-windup')?.textContent ?? '').includes('OVERDRIVE'), null, 1000);
    const hud = await page.evaluate(() => document.getElementById('hud-windup')?.textContent ?? null);
    report.check('K_overdrive', left !== null && left >= OVERDRIVE_S[0] && left <= OVERDRIVE_S[1] && hudOk === true, { overdriveLeft: round(left), hud });
  });
};

// L wind-up: after Reinforced Crank the store fills in 12 s; one crank click releases it (the store empties at once).
// L_release: the store is read AT the 'click' event (session.on): session.click() empties the store before it emits, so the
// probe holds the store at the event (0) and the seconds paid (released). The RELEASE line is the first line of the newest
// gain block (gainLines, read right after the click). The paid seconds must match the store read just before the click.
const caseL = async ctx => {
  const page = await openPage(ctx);
  await step('L', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'L', S7);
    await commit(page);
    await page.waitForTimeout(12000);
    const before = await windupOf(page);
    const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    // One-shot probe: the next 'click' (the crank click below) records the seconds paid and the store at the event.
    await page.evaluate(() => {
      const w = window.__wedtmd;
      w.__lProbe = null;
      const off = w.session.on('click', (e) => {
        w.__lProbe = { released: e.released ?? 0, storedAtEmit: w.windupStats?.()?.stored ?? null };
        off();
      });
    });
    await page.mouse.click(pt.x, pt.y);
    const probe = await poll(page, () => window.__wedtmd.__lProbe ?? null, null, 1000, 20);
    // The click builds the gain block at once: the release line is its first line (a frame at most; 500 ms cap).
    const released = await poll(page, () => /^RELEASE \+\d/.test(window.__wedtmd.gainLines?.()?.[0] ?? ''), null, 500, 20);
    const line = (await gainLinesOf(page))?.[0] ?? null;
    const storedBefore = before?.stored ?? 0;
    const paid = probe?.released ?? null;
    // The store refills between the read and the click. The tolerance is one second of refill (refill is per second) plus
    // 0.01 s: far more than the few ms between the two reads.
    const tol = (before?.refill ?? 0) * 1.0 + 0.01;
    const releaseOk = storedBefore >= RELEASE_MIN_S && released === true && paid !== null && paid >= RELEASE_MIN_S
      && Math.abs(paid - storedBefore) <= tol && probe?.storedAtEmit === 0;
    report.check('L_release', releaseOk, {
      line, storedBefore: round(before?.stored ?? null), released: round(paid), storedAtEmit: round(probe?.storedAtEmit ?? null),
    });
  });
};

// M quiet: with faults off nothing spawns and no marker shows, however long the forced fault waits.
const caseM = async ctx => {
  const page = await openPage(ctx);
  await step('M', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'M', LIST.s7);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.setFaults?.(false));
    await forceFault(page);
    const quiet = await staysHidden(page, 3000);
    report.check('M_quiet', quiet, brief(await faults(page)));
  });
};

// N cost: 30 s with a fault alive (S9): the marker's update() costs at most 0.05 ms on average.
const caseN = async ctx => {
  const page = await openPage(ctx);
  await step('N', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'N', LIST.s9);
    await commit(page);
    const start = await spawnedOf(page);
    let alive = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const s = await faults(page);
      if (s !== null && s.alive !== null) alive += 1;
      else await forceFault(page);
      await page.waitForTimeout(500);
    }
    const s = await faults(page);
    const meanMs = s?.marker.meanMs ?? null;
    report.check('N_cost', meanMs !== null && meanMs <= 0.05 && alive > 0, { meanMs, samplesAlive: alive, spawned: (await spawnedOf(page)) - start });
  });
};

// O demo: B to E on the demo build (era I), then S9 and dischargeLever: the slot on tab II and the FULL GAME tab.
// The B to E results are recorded locally; O_demo is their AND with the two tree facts. Full build: skip.
const caseO = async ctx => {
  const page = await openPage(ctx);
  await step('O', async () => {
    if (!(await isDemo(page))) {
      skip('O_demo', FULL_ONLY_SKIP);
      return;
    }
    const local = {};
    const rec = (name, cond, detail) => { local[name] = { ok: cond === true, detail }; };
    await crankClicks(page, 45, 0);
    await buildStage(page, 'O', LIST.s7);
    await checkToast(page, rec);
    await commit(page);
    await checkTree(page, rec, 'B_tree', 'faultLamp', 1, 5, 2);
    await checkSpawn(page, rec, null);
    await checkPointerClear(page, rec);
    await checkKeyClear(page, rec);
    await buildStage(page, 'O2', [...delta(S7, S9), 'dischargeLever']);
    await commit(page);
    const read = await checkTree(page, rec, 'dischargeLever_slot', 'dischargeLever', 2, 5, 0);
    const tab3 = read.tabs[2] ?? null;
    const fullGame = tab3 !== null && tab3.text === FULL_GAME && tab3.disabled === true;
    const subs = ['B_toast', 'B_tree', 'C_marker', 'C_announce', 'D_caught', 'D_popup', 'D_cue', 'E_key'];
    const pass = subs.every((n) => local[n]?.ok === true) && local.dischargeLever_slot?.ok === true && fullGame;
    report.check('O_demo', pass, { local, tab3 });
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
  await runContext(browser, 'J_e5in', caseJe5in);
  await runContext(browser, 'K', caseK);
  await runContext(browser, 'L', caseL);
  await runContext(browser, 'M', caseM);
  await runContext(browser, 'N', caseN);
  await runContext(browser, 'O', caseO);
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors };
fs.writeFileSync(path.join(out, 'faults.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
