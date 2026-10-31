// WP28a Finds smoke (C15, cases A-L): the Find marker, the clock's gates, the pick-up paths, the FIELD NOTES relics and the reach's cost.
// One browser, a fresh context per case, 1920 x 1080. Case L is the demo case: it runs on the demo build only (a skip with its reason on
// the full build). Cases A-K run on both builds.
// Usage: PW_PATH=<playwright dir> node scripts/smoke/finds.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { edition, results, fail, errors } and writes <outdir>/finds.json.
// A check whose value no hook exposes fails by name with its reason; a skip is { skip: reason } in results, never in fail.
// Setup checks `<KEY>_buys` (the buy lists of a case, the faults.mjs pattern) sit in results and fail the run when a buy fails.
// Cases (names in results and fail; shots in <outdir>):
//   A locked        A_locked: unlocked false, spawned 0, no marker (after the lazy marker loads, then 10 s)
//   B spawn         B_marker (within 1.5 s: visible, centre in the viewport, on a Find spot of the framing), B_announce ('glints'); finds-B-e1.png
//   C pointer       C_caught (three picks, each clicked once the marker's client point holds still: two reads 150 ms apart are equal;
//                   caught +1, every energy with perSecond > 0 gained >= 0.95 x s x perSecond, s read from the popup),
//                   C_popup (at least one popup seen; every popup is FOUND +4s, +6s or +8s), C_cue (audio finds +1 per pick)
//   D key           D_key (press g: caught +1)
//   E expire        E_gone (marker hidden, missed +1), E_input (marker.interactive false), E_quiet (no 'miss' text in the DOM)
//   F single        F_single (spawned +1 only)
//   G gates         G_photo, G_clear (the Find G_photo spawned is taken before G_tree: see clearLive), G_tree (no marker for 3 s; a spawn
//                   within 1.5 s after the gate closes)
//   H reduced       H_steady (marker.glintFrame constant over 6 samples in 2 s)
//   I relic         I_toast (FIELD NOTE 1/15, 1/6 on the demo), I_records (FIELD NOTES n/N and note 1), I_save (world.relics 1 after a reload)
//   J coexist       J_both (both markers visible, f clears the fault, g takes the Find)
//   K cost          K_cost (30 s with a Find alive at S9: marker.meanMs at most 0.05; a first read above it waits 5 s and reads again, the
//                   second read passes; both reads are in the detail)
//   L demo          L_demo (demo build only: B, C, D pass and FIELD NOTES 1/6 after a relic)
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, buyList, crankClicks, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/finds.mjs "<url with ?debug=1>" <outdir>';
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
// Mirrored by hand from src/data/finds.ts (FINDS, RELIC_NOTES, FIND_TEXT) and src/data/findWorld.ts (FIND_WORLD_TEXT); change them together.
const PAY_S = [4, 6, 8]; // C_popup: FINDS.payoutS (6) + payoutSpreadS ([-2, 0, 2]), equal weight (Q6)
const PAYOUT_SHARE = 0.95; // C_caught: each energy with a rate gains at least this share of s x perSecond
const COST_LIMIT_MS = 0.05; // K_cost: the marker's mean update cost (ms) at most this
const COST_RETRY_MS = 5000; // K_cost: a first read above the limit is read again after this wait
const ANNOUNCE = 'glints'; // B_announce: FIND_WORLD_TEXT.announceSpawn ('Something glints near the ...')
const FIRST_NOTE = 'Bread, lamp oil, string. Ask about the dog.'; // I_records: RELIC_NOTES[0] (era I)
const NOTE_TOTAL = { full: 15, demo: 6 }; // relicTotal(null) and relicTotal(maxEra 2): the FIELD NOTE n/total of the edition
const WINDOW_WAIT_MS = 26500; // E_gone: a Find expires after FINDS.windowS (25) eligible seconds; the wait adds 1.5 s
const NOT_NUMBERS = 'findStats().marker.glintFrame must be a number on the debug hook (the glint frame to compare)';
const FULL_ONLY_SKIP = 'full build: case L is the demo case (demoState() is null here)';

// Buy lists: the S7 list for the Find cases (no fault lamp, so no fault marker can cover a Find), S9 for case K, and the S7 list
// plus the fault lamp for J (a fault and a Find alive together).
const LIST = { s7: S7, s9: S9 };
const LIST_J = [...S7, 'faultLamp'];

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
// The Find readout (findStats); null without the hook or the World scene (the marker is a lazy chunk).
const findStats = page => page.evaluate(() => window.__wedtmd.findStats?.() ?? null);
const forceFind = page => page.evaluate(() => window.__wedtmd.forceFind?.() ?? false);
const forceFault = page => page.evaluate(() => window.__wedtmd.forceFault?.() ?? false);
const faultStats = page => page.evaluate(() => window.__wedtmd.faultStats?.() ?? null);
// Resources, passive rates and the Find counters that the pick-up checks compare.
const ledger = page => page.evaluate(() => {
  const s = window.__wedtmd.session;
  return {
    res: { ...s.state.res }, perSecond: { ...s.rates.perSecond }, caught: s.finds.caught, missed: s.finds.missed,
    spawned: s.finds.spawned, relics: s.finds.relics,
  };
});
const cueCount = page => page.evaluate(() => window.__wedtmd.audioStats?.()?.finds ?? null);
const liveText = page => page.evaluate(() => document.getElementById('world-voice-live')?.textContent ?? null);
// The text of every visible or hidden toast in the stack, trimmed.
const toastTexts = page => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => (t.textContent || '').trim()));
const caughtOf = page => page.evaluate(() => window.__wedtmd.findStats?.()?.caught ?? null);

// Compact readout for the JSON detail.
const brief = s => (s === null ? null : { unlocked: s.unlocked, spawned: s.spawned, alive: s.alive, visible: s.marker.visible });
const inViewport = pt => !!pt && pt.x >= 0 && pt.x <= VIEW.width && pt.y >= 0 && pt.y <= VIEW.height;

// Waits until the marker shows with a client point (1.5 s by default); returns findStats (null without the hook).
const waitMarker = async (page, capMs = 1500) => {
  await poll(page, () => {
    const s = window.__wedtmd.findStats?.();
    return !!s && s.marker.visible === true && s.client !== null;
  }, null, capMs, 50);
  return findStats(page);
};

// The marker's client point once it holds still: two reads 150 ms apart are equal (the crow drop moves it for about 300 ms; cap 1.5 s).
// Returns { client, settled, reads }: the last read, whether two reads matched, and how many reads it took.
const settledClient = async (page, gapMs = 150, capMs = 1500) => {
  const t0 = Date.now();
  let prev = (await findStats(page))?.client ?? null;
  let reads = 1;
  while (Date.now() - t0 < capMs) {
    await page.waitForTimeout(gapMs);
    const now = (await findStats(page))?.client ?? null;
    reads += 1;
    if (prev !== null && now !== null && now.x === prev.x && now.y === prev.y) return { client: now, settled: true, reads };
    prev = now;
  }
  return { client: prev, settled: false, reads };
};

// Collects the live Find with the G key, then waits (1 s) until the caught count rises. Returns true when it did.
const collectByKey = async page => {
  const before = await caughtOf(page);
  await page.keyboard.press('g');
  return poll(page, n => window.__wedtmd.findStats?.()?.caught === n + 1, before, 1500);
};
// Clears a live Find (if any) with the G key; used between checks. A Find is taken only once its marker shows: the producer's lead (WP28b,
// up to 0.5 s after the spawn) holds the marker back, and G pressed before then does nothing (the marker's collect gate). So each try
// waits for the marker, presses G and polls for caught +1; up to CLEAR_TRIES tries, CLEAR_GAP_MS apart. Returns { ok, visibleAtPress }:
// ok when no Find is alive at the end, and whether the marker showed at each press.
const CLEAR_TRIES = 5;
const CLEAR_GAP_MS = 500;
const clearLive = async page => {
  const visibleAtPress = [];
  for (let i = 0; i < CLEAR_TRIES; i++) {
    if (!(await findStats(page))?.alive) return { ok: true, visibleAtPress };
    await waitMarker(page);
    visibleAtPress.push((await findStats(page))?.marker.visible === true);
    await collectByKey(page);
    if (!(await findStats(page))?.alive) return { ok: true, visibleAtPress };
    await page.waitForTimeout(CLEAR_GAP_MS);
  }
  return { ok: !(await findStats(page))?.alive, visibleAtPress };
};

// Samples the Find marker and the clock every 250 ms for ms: true when no sample shows a marker or a live Find.
const staysHidden = async (page, ms = 3000) => {
  let quiet = true;
  const steps = Math.round(ms / 250);
  for (let i = 0; i <= steps; i++) {
    const s = await findStats(page);
    if (s === null || s.alive !== null || s.marker.visible === true) quiet = false;
    if (i < steps) await page.waitForTimeout(250);
  }
  return quiet;
};

// Each energy with a passive rate gains at least PAYOUT_SHARE x s x perSecond (s from the popup; passive income only adds to it).
// ok needs a number of seconds and at least one energy with a rate.
const payoutCheck = (before, after, secs) => {
  const rows = {};
  let ok = secs !== null;
  let rated = 0;
  for (const r of Object.keys(before.perSecond)) {
    const rate = before.perSecond[r];
    if (!(rate > 0)) continue;
    rated += 1;
    const gained = after.res[r] - before.res[r];
    const need = PAYOUT_SHARE * (secs ?? 0) * rate;
    rows[r] = { gained: round(gained), need: round(need) };
    if (!(gained >= need)) ok = false;
  }
  return { ok: ok && rated > 0, rows };
};

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

// ---- the pick-up paths ----

// One Find picked up with a real click on the marker centre: the ledger before and after, and the popup's seconds (null when no popup).
const pickByPointer = async page => {
  const s = await waitMarker(page);
  // the first Find's crow drop moves the marker for about 300 ms after it shows: the click waits for a settled point
  const settle = await settledClient(page);
  const before = await ledger(page);
  if (settle.client !== null) await page.mouse.click(settle.client.x, settle.client.y);
  await page.waitForTimeout(300);
  const after = await ledger(page);
  const line = await poll(page, () => {
    const first = window.__wedtmd.gainLines?.()?.[0] ?? '';
    return /^FOUND \+\d+s$/.test(first) ? first : null;
  }, null, 1000, 50);
  const secs = typeof line === 'string' ? Number(/\d+/.exec(line)[0]) : null;
  return {
    visible: s !== null && s.marker.visible === true, caught: after.caught === before.caught + 1,
    payout: payoutCheck(before, after, secs), line: typeof line === 'string' ? line : null, secs,
    settled: settle.settled, reads: settle.reads,
    clickAt: settle.client === null ? null : [round(settle.client.x), round(settle.client.y)],
  };
};

// Collects one Find through the key path (forceFind, wait for the marker, press g). True when the caught count rose.
const pickByKey = async page => {
  await forceFind(page);
  const s = await waitMarker(page);
  if (s === null || s.marker.visible !== true) return false;
  return collectByKey(page);
};

// ---- cases ----

// A locked: a fresh run for 10 s stays locked, with no spawn and no marker.
const caseA = async ctx => {
  const page = await openPage(ctx);
  await step('A', async () => {
    edition = (await isDemo(page)) ? 'demo' : 'full';
    // The marker is a lazy chunk (loaded after WorldScene.create): findStats is null until it is in, so wait for it first.
    await poll(page, () => window.__wedtmd.findStats?.() != null, null, 8000, 100);
    await page.waitForTimeout(10000);
    const s = await findStats(page);
    report.check('A_locked', s !== null && s.unlocked === false && s.spawned === 0 && s.marker.visible === false, brief(s));
  });
};

// B spawn: the S7 list (wornMotor unlocks the Finds), forceFind: the marker on a spot within 1.5 s and the spawn line in the live region.
const caseB = async ctx => {
  const page = await openPage(ctx);
  await step('B', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'B', LIST.s7);
    await commit(page);
    await forceFind(page);
    const s = await waitMarker(page);
    const onSpot = s !== null && s.marker.visible === true && inViewport(s.client) && s.marker.spot >= 0;
    report.check('B_marker', onSpot, { ...brief(s), spot: s?.marker.spot ?? null, client: s?.client ?? null });
    const live = await poll(page, (text) => (document.getElementById('world-voice-live')?.textContent ?? '').includes(text), ANNOUNCE, 1500);
    report.check('B_announce', live === true, { live: await liveText(page) });
    if (s !== null && s.marker.visible === true) await shot(page, 'finds-B-e1.png');
  });
};

// C pointer: three Finds, each forced and clicked at the marker centre. Each pick: caught +1, the payout rule, the popup, the audio cue.
const caseC = async ctx => {
  const page = await openPage(ctx);
  await step('C', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'C', LIST.s7);
    await commit(page);
    await poll(page, () => window.__wedtmd.audioUnlocked?.() === true, null, 3000);
    const picks = [];
    for (let i = 0; i < 3; i++) {
      await forceFind(page);
      const cues0 = await cueCount(page);
      const p = await pickByPointer(page);
      const cues1 = await cueCount(page);
      picks.push({ ...p, cue: cues0 !== null && cues1 === cues0 + 1 });
      await page.waitForTimeout(400);
    }
    report.check('C_caught', picks.every(p => p.visible && p.caught && p.payout.ok), picks.map(p => ({
      visible: p.visible, caught: p.caught, secs: p.secs, payout: p.payout.rows, settled: p.settled, reads: p.reads, clickAt: p.clickAt,
    })));
    const seen = picks.filter(p => p.secs !== null);
    report.check('C_popup', seen.length > 0 && seen.every(p => PAY_S.includes(p.secs)), { lines: picks.map(p => p.line) });
    report.check('C_cue', picks.every(p => p.cue), picks.map(p => p.cue));
  });
};

// D key: forceFind, then the G key takes the Find.
const caseD = async ctx => {
  const page = await openPage(ctx);
  await step('D', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'D', LIST.s7);
    await commit(page);
    await forceFind(page);
    await waitMarker(page);
    const ok = await pickByKey(page);
    report.check('D_key', ok === true, { caught: await caughtOf(page) });
  });
};

// E expire: a Find left alone goes after its window; the marker hides, the miss counts once, nothing takes input, and no text says 'miss'.
const caseE = async ctx => {
  const page = await openPage(ctx);
  await step('E', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E', LIST.s7);
    await commit(page);
    await forceFind(page);
    const s0 = await waitMarker(page);
    const missedBefore = s0?.missed ?? null;
    await page.waitForTimeout(WINDOW_WAIT_MS);
    const s1 = await findStats(page);
    const gone = s1 !== null && s1.marker.visible === false && s1.alive === null && s1.missed === missedBefore + 1;
    report.check('E_gone', gone, { missed: [missedBefore, s1?.missed ?? null], visible: s1?.marker.visible ?? null });
    report.check('E_input', s1 !== null && s1.marker.interactive === false, { interactive: s1?.marker.interactive ?? null });
    const hit = await page.evaluate(() => {
      const m = /.{0,40}miss.{0,40}/i.exec(document.body.textContent || '');
      return m === null ? null : m[0];
    });
    report.check('E_quiet', hit === null, { hit });
  });
};

// F single: a second forceFind while a Find is alive adds nothing: one spawn in total.
const caseF = async ctx => {
  const page = await openPage(ctx);
  await step('F', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'F', LIST.s7);
    await commit(page);
    const start = (await findStats(page))?.spawned ?? 0;
    await forceFind(page);
    await waitMarker(page);
    await forceFind(page);
    await page.waitForTimeout(1500);
    const added = ((await findStats(page))?.spawned ?? start) - start;
    report.check('F_single', added === 1, { spawned: added });
  });
};

// G gates: photo mode and the open TECH INDEX hold the clock; a spawn follows within 1.5 s after each gate closes.
const caseG = async ctx => {
  const page = await openPage(ctx);
  await step('G', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'G', LIST.s7);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.photoMode?.(true));
    await forceFind(page);
    const quietPhoto = await staysHidden(page, 3000);
    const startPhoto = (await findStats(page))?.spawned ?? 0;
    await page.evaluate(() => window.__wedtmd.photoMode?.(false));
    const spawnedAfterPhoto = await poll(page, (n) => (window.__wedtmd.findStats?.()?.spawned ?? -1) > n, startPhoto, 1500);
    report.check('G_photo', quietPhoto && spawnedAfterPhoto === true, { quietPhoto, spawnedAfterPhoto });
    const cleared = await clearLive(page);
    report.check('G_clear', cleared.ok, { visibleAtPress: cleared.visibleAtPress });
    const opened = await openTree(page);
    await forceFind(page);
    const quietTree = await staysHidden(page, 3000);
    const startTree = (await findStats(page))?.spawned ?? 0;
    const closed = await closeTree(page);
    const spawnedAfterTree = await poll(page, (n) => (window.__wedtmd.findStats?.()?.spawned ?? -1) > n, startTree, 1500);
    report.check('G_tree', opened === true && quietTree && closed === true && spawnedAfterTree === true, {
      opened, quietTree, closed, spawnedAfterTree,
    });
  });
};

// H reduced motion: the glint frame stays constant over six samples in 2 s. The frame is read as marker.glintFrame; a missing number fails by name.
const caseH = async ctx => {
  const page = await openPage(ctx);
  await step('H', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'H', LIST.s7);
    await commit(page);
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await forceFind(page);
    const s = await waitMarker(page);
    const frames = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) await page.waitForTimeout(400);
      const now = await findStats(page);
      frames.push(now?.marker?.glintFrame ?? null);
    }
    const numeric = frames.every((f) => Number.isFinite(f));
    const steady = numeric && frames.every((f) => f === frames[0]);
    report.check('H_steady', steady, { frames, visible: s?.marker.visible ?? null, reason: numeric ? null : NOT_NUMBERS });
  });
};

// I relic: four Finds (serials 0-3) by the key path, then the fifth (serial 4, a relic) by the key path: the toast, the RECORDS panel
// and the save.
const caseI = async ctx => {
  const page = await openPage(ctx);
  await step('I', async () => {
    const demo = await isDemo(page);
    const total = demo ? NOTE_TOTAL.demo : NOTE_TOTAL.full;
    await crankClicks(page, 45, 0);
    await buildStage(page, 'I', LIST.s7);
    await commit(page);
    for (let i = 0; i < 4; i++) await pickByKey(page);
    await forceFind(page);
    const s = await waitMarker(page);
    const relicAlive = s?.alive?.relic === true && s?.alive?.serial === 4;
    const title = `FIELD NOTE 1/${total}`;
    const taken = await collectByKey(page);
    const toastFound = await poll(page, (wanted) => [...document.querySelectorAll('.toast')]
      .some((el) => (el.textContent || '').includes(wanted)), title, 2000);
    report.check('I_toast', relicAlive && taken === true && toastFound === true, { relicAlive, taken, title, toasts: await toastTexts(page) });
    // the SYSTEM menu (Escape with no TECH INDEX open), then the RECORDS tab
    await page.keyboard.press('Escape');
    await poll(page, () => window.__wedtmd.systemMenuOpen?.() === true, null, 2000);
    await page.click('#sys-tab-records', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const rec = await page.evaluate(() => ({
      head: (document.querySelector('.ach-notes-head')?.textContent ?? '').replace(/\s+/g, ' ').trim() || null,
      first: document.querySelector('.ach-notes-list li')?.textContent?.trim() ?? null,
    }));
    report.check('I_records', rec.head === `FIELD NOTES 1/${total}` && rec.first === FIRST_NOTE, rec);
    await page.keyboard.press('Escape');
    // the save: a save now, a reload, then world.relics reads 1
    const saved = await page.evaluate(() => window.__wedtmd.saveNow?.() ?? false);
    await page.reload({ waitUntil: 'load' });
    await waitReady(page);
    const relics = await page.evaluate(() => window.__wedtmd.session.world?.relics ?? null);
    report.check('I_save', relics === 1, { saved, relics });
  });
};

// J coexist: a fault and a Find alive together; f clears the fault, g takes the Find.
const caseJ = async ctx => {
  const page = await openPage(ctx);
  await step('J', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'J', LIST_J);
    await commit(page);
    await forceFault(page);
    await forceFind(page);
    const bothVisible = await poll(page, () => {
      const f = window.__wedtmd.faultStats?.();
      const g = window.__wedtmd.findStats?.();
      return !!f && !!g && f.marker.visible === true && g.marker.visible === true;
    }, null, 2500, 100);
    const faultBefore = (await faultStats(page))?.caught ?? null;
    await page.keyboard.press('f');
    const fClear = await poll(page, (n) => (window.__wedtmd.faultStats?.()?.caught ?? -1) === n + 1, faultBefore, 1500);
    const findBefore = await caughtOf(page);
    await page.keyboard.press('g');
    const gTake = await poll(page, (n) => window.__wedtmd.findStats?.()?.caught === n + 1, findBefore, 1500);
    report.check('J_both', bothVisible === true && fClear === true && gTake === true, { bothVisible, fClear, gTake });
  });
};

// K cost: a Find kept alive for 30 s at S9 (re-forced after each expiry); the marker's update costs at most 0.05 ms on average.
const caseK = async ctx => {
  const page = await openPage(ctx);
  await step('K', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'K', LIST.s9);
    await commit(page);
    let alive = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const s = await findStats(page);
      if (s !== null && s.alive !== null) alive += 1;
      else await forceFind(page);
      await page.waitForTimeout(500);
    }
    const first = (await findStats(page))?.marker?.meanMs ?? null;
    // a first read above the limit (CPU contention moved it between 0.03 and 0.08 on one build) waits 5 s and reads again; the second passes
    let second = null;
    if (first !== null && first > COST_LIMIT_MS) {
      await page.waitForTimeout(COST_RETRY_MS);
      second = (await findStats(page))?.marker?.meanMs ?? null;
    }
    const passed = first !== null && (first <= COST_LIMIT_MS || (second !== null && second <= COST_LIMIT_MS));
    report.check('K_cost', passed && alive > 0, { meanMs: [round(first), round(second)], limitMs: COST_LIMIT_MS, samplesAlive: alive });
  });
};

// L demo: B, C and D on the demo build (era I), then serials 2 and 3 by the key path and the relic (serial 4): FIELD NOTES 1/6.
// The B, C and D results are recorded locally; L_demo is their AND with the records check. Full build: skip.
const caseL = async ctx => {
  const page = await openPage(ctx);
  await step('L', async () => {
    if (!(await isDemo(page))) {
      skip('L_demo', FULL_ONLY_SKIP);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, 'L', LIST.s7);
    await commit(page);
    await poll(page, () => window.__wedtmd.audioUnlocked?.() === true, null, 3000);
    await forceFind(page);
    const sB = await waitMarker(page);
    const localB = sB !== null && sB.marker.visible === true && sB.marker.spot >= 0;
    const pick = await pickByPointer(page);
    const localC = pick.caught && pick.payout.ok && pick.secs !== null && PAY_S.includes(pick.secs);
    const localD = await pickByKey(page);
    // serials 2 and 3 take the key path; serial 4 is the relic
    for (let i = 0; i < 2; i++) await pickByKey(page);
    await forceFind(page);
    await waitMarker(page);
    const relicTaken = await collectByKey(page);
    await page.keyboard.press('Escape');
    await poll(page, () => window.__wedtmd.systemMenuOpen?.() === true, null, 2000);
    await page.click('#sys-tab-records', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const head = await page.evaluate(() => (document.querySelector('.ach-notes-head')?.textContent ?? '').replace(/\s+/g, ' ').trim());
    await page.keyboard.press('Escape');
    const ok = localB && localC && localD && relicTaken === true && head === `FIELD NOTES 1/${NOTE_TOTAL.demo}`;
    report.check('L_demo', ok, { B: localB, C: localC, D: localD, relicTaken, head, picks: pick.line });
    await shot(page, 'finds-L-demo.png');
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
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors };
fs.writeFileSync(path.join(out, 'finds.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
