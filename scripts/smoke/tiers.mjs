// WP22 T11a part-tier smoke: runtime texture keys, tier-up beat timing and input, cap and machine cost, reduced motion.
// Cases: A keys (deviceScaleFactor 2: motor tiers 1-5 and the pulse frame, gear tiers 2-3 and rotation), B hold (the open
// TECH INDEX holds the beat, Esc plays it, a crank click during the beat counts), C burst (six tier changes in one release),
// D reduced (short beat). E reload (keys kept, silent load), F finale (top tiers at postgame, MK I after a new cycle),
// G perk (muscleMemory fly-ins, no beat), H detail (the MOTOR TUNING level line fits at UI 100 and 150, at MK III and MK IV).
// F and G share one page (F keeps it open, G closes it).
// Usage: PW_PATH=... node scripts/smoke/tiers.mjs "<url with ?debug=1>" <outdir>   (no arguments: usage on stderr, exit 2)
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty. Env ONLY=A,B limits the cases.
// Fresh 1280x720 context per case. An exception adds FAILED:<case>:<message> to fail and the run goes on.
// Checks: A_motor_tiers, A_pulse, A_gear_t2, A_gear_t3, A_rot_turns; B_held, B_played, B_input, B_done;
//   C_setup, C_cap, C_all_applied, C_machine_ms; D_played, D_short, D_applied;
//   E_silent, E_keys; H19_text_100, H19_fit_100, H19_text_150, H19_fit_150, H_text_100, H_text_150, H_fit_100, H_fit_150;
//   F_setup, F_top, F_restored, F_cycle_mk1; G_perk_buy, G_perk_lands, G_perk_silent;
//   FG_skipped_demo (demo build, demoState() not null: F and G are skipped, A-E and H run).
// Shots (outdir): tiers-A-motor-t1.png ... tiers-A-motor-t5.png (motor crop); tiers-B-0.png, tiers-B-120.png,
//   tiers-B-450.png, tiers-B-700.png (taken after the B click, so the names are the requested offsets after Esc and the
//   achieved offsets are later: they are in the B_played value); tiers-H19-ui150.png (level 19) and tiers-H-ui150.png (level 24):
//   TECH INDEX, MOTOR TUNING detail at UI 150.
// Hook fields: partTiers(), tierBeatsActive(), textureKey(id), componentState(id), techTreeOpen(), crankClientPoint(),
//   cameraState(), machineStats(), cycleState(), restoredTextures(), saveNow(), skipFinale(), session (purchase, update,
//   updateSettings, buyPerk, state.techLevels, state.totalClicks, state.ending.phase).
// Texture keys: every comparison strips a trailing pulse frame ('#t5b' -> '#t5') except A_pulse, which reads the raw keys.
import fs from 'fs';
import path from 'path';
import { S15, buyList, crankClicks, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: PW_PATH=<playwright dir> node scripts/smoke/tiers.mjs "<url with ?debug=1>" <outdir>');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });
const chromium = loadChromium();

// Motor crop: the motor centre sits MOTOR_OFFSET art px from the hand crank; art px scale by PIXEL_SCALE and the camera zoom.
const PIXEL_SCALE = 2;
const MOTOR_OFFSET = { x: -140, y: 29 };
const MOTOR_CLIP = { width: 120, height: 90 };
// [motorTuning level, tier] steps in case A; [gearRatio level, tier] steps.
const MOTOR_STEPS = [[5, 2], [10, 3], [20, 4], [25, 5]];
const GEAR_IDS = ['gearLarge', 'mainShaft', 'gearSmall'];
// Case C: the 15-entry prefix (every step is a tech the tree allows, see src/data/technologies.ts),
// then six tier steps in one release (gearRatio, flywheel, motorTuning, improvedPistons, motorRetrofit, transformer).
const PRE = ['wornMotor', '@gearRatio:5', 'reinforcedCrank', '@motorTuning:9', '@flywheel:3', 'pistonArray', '@improvedPistons:4', '@blueprint', 'generator', '@motorRetrofit:6', '@copperWinding:10', 'dynamoCrank', 'capacitorBank', 'sparkGap', '@transformer:6'];
const BURST = ['@gearRatio:6', '@flywheel:4', '@motorTuning:10', '@improvedPistons:5', '@motorRetrofit:8', '@transformer:8'];
const BURST_TECHS = ['gearRatio', 'flywheel', 'motorTuning', 'improvedPistons', 'motorRetrofit', 'transformer'];
// Tier of each BURST_TECHS track after the burst (C_all_applied waits for every one of them, within 1500 ms).
const BURST_TIERS = { gearRatio: 2, flywheel: 2, motorTuning: 3, improvedPistons: 2, motorRetrofit: 2, transformer: 2 };

// Strips a trailing pulse frame ('#t5b' -> '#t5'). Every key comparison except A_pulse uses it.
const base = (k) => (k === null ? null : k.replace(/(#t[0-9])b$/, '$1'));
// Displayed tier of a track in a readState result (null when the track has no visible host).
const tierOf = (st, tech) => st.tiers?.[tech] ?? null;
const motorOk = (tier) => (st) => tierOf(st, 'motorTuning') === tier && base(st.keys.wornMotor) === `machine.motor#t${tier}`;
const motorRecord = (st) => ({ tier: tierOf(st, 'motorTuning'), motor: base(st.keys.wornMotor), plinth: base(st.keys.motorPlinth) });
// Expected keys of the rotating gear set at a tier (#rot stays last).
const gearKeys = (tier) => ({
  gearLarge: `machine.gearLarge#t${tier}#rot`,
  mainShaft: `machine.pulleyMain#t${tier}#rot`,
  gearSmall: `machine.gearSmall#t${tier}#rot`,
});
const gearOk = (tier) => {
  const want = gearKeys(tier);
  return (st) => Object.entries(want).every(([id, key]) => base(st.keys[id]) === key);
};
const keysBase = (st, ids) => Object.fromEntries(ids.map((id) => [id, base(st.keys[id])]));
// True when two samples at most 500 ms apart show different rotation frames.
const turned = (samples) => samples.some((a, i) => samples.slice(i + 1).some((b) => b.t - a.t <= 500 && a.frame !== null && b.frame !== a.frame));

// One page read: displayed tier per track, tier-up beats in flight, TECH INDEX open, texture keys of ids.
const readState = (page, ids = []) => page.evaluate((list) => {
  const w = window.__wedtmd;
  const keys = {};
  for (const id of list) keys[id] = w.textureKey(id) ?? null;
  return { tiers: w.partTiers(), beats: w.tierBeatsActive(), open: w.techTreeOpen(), keys };
}, ids);
// Re-reads every 100 ms until ok(state) or capMs passed; returns the last state.
const waitState = async (page, ids, ok, capMs = 3000) => {
  const deadline = Date.now() + capMs;
  let st = await readState(page, ids);
  while (!ok(st) && Date.now() < deadline) {
    await page.waitForTimeout(100);
    st = await readState(page, ids);
  }
  return st;
};
const totalClicks = (page) => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
// Presses t and waits for the TECH INDEX to open.
const openTree = async (page) => {
  await page.keyboard.press('t');
  await poll(page, () => window.__wedtmd.techTreeOpen(), null, 3000, 100);
};
// Waits until t ms (a Date.now() value) has passed; returns at once when it has.
const sleepTo = async (page, t) => {
  const d = t - Date.now();
  if (d > 0) await page.waitForTimeout(d);
};
// Waits for a component fly-in to finish (visible, not assembling, opaque), then a short settle.
const assembled = async (page, id) => {
  await poll(page, (name) => {
    const s = window.__wedtmd.componentState(name);
    return !!s && s.visible && !s.assembling && s.alpha >= 0.99;
  }, id, 4000, 100);
  await page.waitForTimeout(300);
};
// Waits (cap 4 s) until every id has finished its fly-in (visible, not assembling, opaque), then a 300 ms settle once.
const assembledAll = async (page, ids) => {
  await poll(page, (list) => list.every((id) => {
    const s = window.__wedtmd.componentState(id);
    return !!s && s.visible && !s.assembling && s.alpha >= 0.99;
  }), ids, 4000, 100);
  await page.waitForTimeout(300);
};
// Motor crop shot at the motor centre (crank point + MOTOR_OFFSET art px * PIXEL_SCALE * zoom), kept inside the viewport.
const motorCrop = async (page, file) => {
  const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  const cam = await page.evaluate(() => window.__wedtmd.cameraState());
  const k = PIXEL_SCALE * cam.zoom;
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = pt.x + MOTOR_OFFSET.x * k - MOTOR_CLIP.width / 2;
  const y = pt.y + MOTOR_OFFSET.y * k - MOTOR_CLIP.height / 2;
  const clip = {
    x: Math.min(Math.max(0, Math.round(x)), vp.width - MOTOR_CLIP.width),
    y: Math.min(Math.max(0, Math.round(y)), vp.height - MOTOR_CLIP.height),
    width: MOTOR_CLIP.width,
    height: MOTOR_CLIP.height,
  };
  await page.screenshot({ path: path.join(out, file), clip });
};

// A keys (deviceScaleFactor 2): motor tiers 1-5 with the pulse frame at tier 5, gear tiers 2-3, rotation after crank clicks.
const caseA = async (browser, c) => {
  const page = await c.fresh(browser, 2);
  await buyList(page, ['wornMotor']);
  await assembled(page, 'wornMotor');
  const ids = ['wornMotor', 'motorPlinth'];
  const obs = {};
  let st = await readState(page, ids);
  obs[1] = motorRecord(st);
  await motorCrop(page, 'tiers-A-motor-t1.png');
  let pulse = [];
  for (const [n, tier] of MOTOR_STEPS) {
    await buyList(page, [`@motorTuning:${n}`]);
    await waitState(page, ids, motorOk(tier), 3000);
    st = await waitState(page, ids, (s) => s.beats === 0, 2000);
    obs[tier] = motorRecord(st);
    await motorCrop(page, `tiers-A-motor-t${tier}.png`);
    if (tier === 5) {
      // sampled 100 ms apart for up to 3.2 s: both the lit and the dimmer heartbeat frame must show
      const seen = new Set();
      const until = Date.now() + 3200;
      while (Date.now() < until && !(seen.has('machine.motor#t5') && seen.has('machine.motor#t5b'))) {
        const key = await page.evaluate(() => window.__wedtmd.textureKey('wornMotor'));
        if (key !== null) seen.add(key);
        await page.waitForTimeout(100);
      }
      pulse = [...seen];
    }
  }
  c.check('A_motor_tiers', [1, 2, 3, 4, 5].every((t) => obs[t].tier === t)
    && [2, 3, 4, 5].every((t) => obs[t].motor === `machine.motor#t${t}` && obs[t].plinth === `machine.motorPlinth#t${t}`), obs);
  c.check('A_pulse', pulse.includes('machine.motor#t5') && pulse.includes('machine.motor#t5b'), pulse);

  await buyList(page, ['@gearRatio:6']);
  const gear2 = await waitState(page, GEAR_IDS, gearOk(2), 3000);
  c.check('A_gear_t2', gearOk(2)(gear2), keysBase(gear2, GEAR_IDS));
  await buyList(page, ['@gearRatio:15']);
  const gear3 = await waitState(page, GEAR_IDS, gearOk(3), 3000);
  c.check('A_gear_t3', gearOk(3)(gear3), keysBase(gear3, GEAR_IDS));

  await crankClicks(page, 3);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const s = await page.evaluate(() => window.__wedtmd.componentState('gearLarge'));
    samples.push({ t: Date.now(), frame: s ? s.frame : null });
    if (turned(samples)) break;
    await page.waitForTimeout(80);
  }
  c.check('A_rot_turns', turned(samples), samples.map((s) => s.frame));
};

// B hold: the open TECH INDEX holds a tier-up beat; Esc plays it; a crank click during the beat counts.
const caseB = async (browser, c) => {
  const page = await c.fresh(browser);
  await buyList(page, ['wornMotor', '@motorTuning:4']);
  await assembled(page, 'wornMotor');  // a tier change on a host still flying in applies at once (no beat)
  await openTree(page);
  await buyList(page, ['@motorTuning:5']);
  const heldEnd = Date.now() + 600;
  const held = [];
  while (Date.now() < heldEnd) {
    held.push(await readState(page));
    await page.waitForTimeout(100);
  }
  const lastHeld = held[held.length - 1];
  c.check('B_held', held.every((s) => s.beats === 0 && s.open) && tierOf(lastHeld, 'motorTuning') === 1, {
    beats: Math.max(...held.map((s) => s.beats)),
    tier: tierOf(lastHeld, 'motorTuning'),
  });

  await page.keyboard.press('Escape');
  const tEsc = Date.now();
  const at = () => Date.now() - tEsc;
  let active = 0;
  while (at() < 300 && active === 0) {
    active = await page.evaluate(() => window.__wedtmd.tierBeatsActive());
    if (active === 0) await page.waitForTimeout(25);
  }
  const detectMs = at();
  const shots = {};
  const snap = async (ms) => {
    await sleepTo(page, tEsc + ms);
    shots[ms] = at();
    await page.screenshot({ path: path.join(out, `tiers-B-${ms}.png`) });
  };
  // one real crank click while the beat plays (about 120 ms after Esc)
  await sleepTo(page, tEsc + 120);
  const activeAtClick = await page.evaluate(() => window.__wedtmd.tierBeatsActive());
  const clicksBefore = await totalClicks(page);
  const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(80);
  const clicksAfter = await totalClicks(page);
  c.check('B_input', clicksAfter - clicksBefore === 1 && activeAtClick > 0, { clicksBefore, clicksAfter, activeAtClick });
  // the shots follow the click (an early snap raced the beat, F5): file names are the requested offsets,
  // the achieved offsets (later than the names) are in the B_played value
  await snap(0);
  await snap(120);
  await snap(450);
  await snap(700);
  c.check('B_played', active > 0, { detectMs, shots });

  await sleepTo(page, tEsc + 1500);
  const done = await readState(page);
  c.check('B_done', done.beats === 0 && tierOf(done, 'motorTuning') === 2, { beats: done.beats, tier: tierOf(done, 'motorTuning') });
};

// C burst: six tier changes in one release (six swap changes, cap 4: gearRatio, flywheel, motorTuning, improvedPistons play beats
// in track order; motorRetrofit and transformer swap instantly). Cap of four beats, all tiers applied in time, machine cost within budget.
const caseC = async (browser, c) => {
  const page = await c.fresh(browser);
  const setup = await buyList(page, PRE);
  c.check('C_setup', setup.length === 0, setup);
  await assembledAll(page, ['gearLarge', 'flywheelPedestal', 'wornMotor', 'pistonArray', 'motorRetrofitKit', 'transformer']);
  await openTree(page);
  await buyList(page, BURST);
  await page.keyboard.press('Escape');
  const tEsc = Date.now();
  let peak = 0;
  let allAt = null;
  let last = null;
  const atBurstTiers = (st) => BURST_TECHS.every((t) => tierOf(st, t) === BURST_TIERS[t]);
  while (Date.now() < tEsc + 2000) {
    const st = await readState(page);
    peak = Math.max(peak, st.beats);
    last = st;
    if (allAt === null && atBurstTiers(st)) allAt = Date.now() - tEsc;
    await page.waitForTimeout(50);
  }
  const meanMs = (await page.evaluate(() => window.__wedtmd.machineStats())).meanMs;
  // six swap changes in one release, cap maxBeatsPerRelease 4, so exactly four beats are active at once (staggered beats count while waiting);
  // the two over the cap (motorRetrofit, transformer) swap instantly
  c.check('C_cap', peak === 4, peak);
  c.check('C_all_applied', allAt !== null && allAt <= 1500, { allAt, tiers: last === null ? null : Object.fromEntries(BURST_TECHS.map((t) => [t, tierOf(last, t)])) });
  c.check('C_machine_ms', meanMs <= 4, meanMs);
};

// D reduced: reduced motion gives a short beat (inactive 450 ms after Esc) and the tier still lands.
const caseD = async (browser, c) => {
  const page = await c.fresh(browser);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await buyList(page, ['wornMotor', '@motorTuning:4']);
  await assembled(page, 'wornMotor');  // a tier change on a host still flying in applies at once (no beat)
  await openTree(page);
  await buyList(page, ['@motorTuning:5']);
  await page.keyboard.press('Escape');
  const tEsc = Date.now();
  let active = 0;
  while (Date.now() < tEsc + 300 && active === 0) {
    active = await page.evaluate(() => window.__wedtmd.tierBeatsActive());
    if (active === 0) await page.waitForTimeout(25);
  }
  c.check('D_played', active > 0);
  await sleepTo(page, tEsc + 450);
  const measured = Date.now() - tEsc;
  const st = await readState(page);
  c.check('D_short', st.beats === 0, measured);
  c.check('D_applied', tierOf(st, 'motorTuning') === 2);
};

// CASES E-G (T11b): reload, finale and perk. TOP_TIERS: the top tier of each repeatable track (PART_TIERS.md).
const TOP_TIERS = {
  gearRatio: 3, flywheel: 3, motorTuning: 5, improvedPistons: 5, copperWinding: 5, motorRetrofit: 5, transformer: 5,
  firebox: 5, inductionHeater: 5, condenser: 5, bellowsDrive: 3, harmonicCoil: 5, pressureResonator: 5, crankServo: 3,
  standingWave: 5, gridExciter: 3, containmentRing: 5, resonantSiphon: 3, graviticAnchor: 3, mainsBackfeed: 3, steamLance: 3,
};
// partTiers() of the page (null without a World scene).
const tiersOf = (page) => page.evaluate(() => window.__wedtmd?.partTiers?.() ?? null);
// Mismatch lists. topMiss: every TOP_TIERS track at its top tier (a missing track counts). oneMiss: every value at MK I (absent tracks accepted).
const topMiss = (t) => (t === null ? ['partTiers null'] : Object.entries(TOP_TIERS).filter(([id, top]) => t[id] !== top).map(([id, top]) => `${id}:${t[id] ?? null}/${top}`));
const oneMiss = (t) => (t === null ? ['partTiers null'] : Object.entries(t).filter(([, v]) => v !== 1).map(([id, v]) => `${id}:${v}/1`));
// Polls partTiers() up to 3 s until miss is empty (a tier beat may still be in flight); returns the last list.
const settleMiss = async (page, miss) => {
  let m = miss(await tiersOf(page));
  for (let i = 0; i < 30 && m.length > 0; i++) {
    await page.waitForTimeout(100);
    m = miss(await tiersOf(page));
  }
  return m;
};
// Waits up to 15 s for a cycle transition to start and then end.
const waitTransitionEnd = async (page) => {
  const t0 = Date.now();
  let started = false;
  while (Date.now() - t0 < 15000) {
    const active = await page.evaluate(() => window.__wedtmd.cycleState().transition.active);
    if (active) started = true;
    else if (started) return;
    await page.waitForTimeout(50);
  }
};
const isOne = (x) => Math.abs(x - 1) <= 0.01;

// E reload: a save and a reload keep the keys, and the tiers come back with no beat (silent load and sync).
const EIDS = ['wornMotor', 'motorPlinth', 'gearLarge', 'mainShaft', 'gearSmall'];
const hasKeys = (st) => EIDS.every((id) => st.keys[id] !== null);
const caseE = async (browser, c) => {
  const page = await c.fresh(browser);
  await buyList(page, ['wornMotor', '@motorTuning:10', '@gearRatio:6']);
  await page.waitForTimeout(1200);  // the tier beat (900 ms) and the fly-ins settle before the keys are read
  const pre = await waitState(page, EIDS, (s) => s.beats === 0 && hasKeys(s), 4000);
  const before = keysBase(pre, EIDS);
  const saved = await page.evaluate(() => window.__wedtmd.saveNow());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__wedtmd && !!window.__wedtmd.componentState && !!window.__wedtmd.componentState('handCrank'), null, { timeout: 20000 });
  // tierBeatsActive sampled every 50 ms for 500 ms from the moment the hook is ready
  let silentMax = 0;
  const until = Date.now() + 500;
  while (Date.now() < until) {
    silentMax = Math.max(silentMax, await page.evaluate(() => window.__wedtmd.tierBeatsActive()));
    await page.waitForTimeout(50);
  }
  c.check('E_silent', silentMax === 0, silentMax);
  const post = await waitState(page, EIDS, hasKeys, 4000);
  const after = keysBase(post, EIDS);
  c.check('E_keys', JSON.stringify(before) === JSON.stringify(after), { before, after, saved });
};

// H detail fit: the MOTOR TUNING detail (LV n/max with the tier line) stays on one line inside #tech-detail at UI 100 and 150.
// The UI root is CSS-zoomed, so the one-line test compares the line boxes of the level text (same space as the rects), not the computed line-height.
const LEVEL_LINE_19 = 'LV 19/25 · MK III — MK IV AT 20';
const LEVEL_LINE_24 = 'LV 24/25 · MK IV — MK V AT 25';
// Level line measures: text, widths (layout px), rects (client px), line boxes of the text range (span = top to bottom of the lines).
const measureLevel = () => {
  const el = document.getElementById('tech-level');
  const detail = document.getElementById('tech-detail');
  if (!el || !detail) return null;
  const r = el.getBoundingClientRect();
  const d = detail.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const boxes = Array.from(range.getClientRects()).filter((b) => b.width > 0 && b.height > 0);
  const lineBox = boxes.length > 0 ? Math.max(...boxes.map((b) => b.height)) : 0;
  const span = boxes.length > 0 ? Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top)) : 0;
  return {
    text: el.textContent,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    rectRight: r.right,
    rectHeight: r.height,
    detailRight: d.right,
    lineHeight: getComputedStyle(el).lineHeight,
    lineBox,
    span,
  };
};
// One level-line block for UI 100 and 150 (checks `${tag}_text_${sc}`, `${tag}_fit_${sc}`): TECH INDEX, click the MOTOR TUNING
// node, 300 ms, measure; the shot is taken at UI 150; Esc closes the tree.
const levelDetail = async (page, c, tag, expected, shotName) => {
  for (const sc of [100, 150]) {
    await page.evaluate((s) => window.__wedtmd.session.updateSettings({ uiScale: s }), sc);
    await openTree(page);
    await page.locator('.tech-node', { hasText: 'MOTOR TUNING' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(measureLevel);
    const oneLine = m !== null && m.lineBox > 0 && m.span <= 1.5 * m.lineBox;
    const fit = m !== null && m.scrollWidth <= m.clientWidth && m.rectRight <= m.detailRight + 1 && oneLine;
    c.check(`${tag}_text_${sc}`, m !== null && m.text === expected, m);
    c.check(`${tag}_fit_${sc}`, fit, m === null ? null : { ...m, oneLine });
    if (sc === 150) await page.screenshot({ path: path.join(out, shotName) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
};
// buys MOTOR TUNING to 19 (MK III) and checks UI 100 and 150, then buys to 24 (MK IV) on the same page and checks again.
const caseH = async (browser, c) => {
  const page = await c.fresh(browser);
  await buyList(page, ['wornMotor', '@motorTuning:19']);
  await levelDetail(page, c, 'H19', LEVEL_LINE_19, 'tiers-H19-ui150.png');
  await buyList(page, ['@motorTuning:24']);
  await levelDetail(page, c, 'H', LEVEL_LINE_24, 'tiers-H-ui150.png');
};

// F finale: S15 and primaryFunction, skip the film, KEEP IT RUNNING; every track at its top tier and 34 restored parts;
// a new cycle starts every track at MK I. F and G share one page: F opens it in its own context (not in `contexts`, so the
// per-case close leaves it open) and G closes it.
let fgCtx = null, fgPage = null;
const caseF = async (browser, c) => {
  fgCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  fgPage = await fgCtx.newPage();
  watchPage(fgPage, errors, () => cur);
  await fgPage.goto(target, { waitUntil: 'load' });
  await waitReady(fgPage);
  const page = fgPage;
  // pre-run as prestige.mjs does it: 45 crank clicks, the S15 list, primaryFunction, skip the film, KEEP IT RUNNING
  await crankClicks(page, 45, 0);
  const setup = [...(await buyList(page, S15)), ...(await buyList(page, ['primaryFunction']))];
  c.check('F_setup', setup.length === 0, setup);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__wedtmd.skipFinale());
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 });
  await poll(page, () => window.__wedtmd.session.state.ending.phase === 'postgame', null, 5000, 100);

  const top = await settleMiss(page, topMiss);
  c.check('F_top', top.length === 0, top);
  const swapped = await page.evaluate(() => window.__wedtmd.restoredTextures()?.swapped?.length ?? null);
  c.check('F_restored', swapped === 34, swapped);

  // new cycle from postgame: #finale-cycle exists only in the choice overlay, so the SYSTEM row starts it (as prestige.mjs RUN B)
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('#sys-tab-system'); await page.waitForTimeout(150);
  await page.click('#sys-new-cycle'); await page.waitForTimeout(250);
  await page.click('#cycle-confirm-begin');
  await waitTransitionEnd(page);
  await page.waitForTimeout(300);
  const mk1 = await settleMiss(page, oneMiss);
  c.check('F_cycle_mk1', mk1.length === 0, mk1);
};

// G perk (after F, same page): muscleMemory (start levels wornMotor 1, gearRatio 3) lands both parts with a fly-in and no beat.
const caseG = async (_browser, c) => {
  if (fgPage === null || fgCtx === null) throw new Error('no context');
  const page = fgPage;
  try {
    const bought = await page.evaluate(() => {
      const r = window.__wedtmd.session.buyPerk('muscleMemory');
      return { ok: r.ok, reason: r.ok ? null : r.reason };
    });
    c.check('G_perk_buy', bought.ok === true, bought);
    // componentState and tierBeatsActive sampled every 50 ms for 1500 ms
    const comps = ['wornMotor', 'gearLarge'];
    const seen = Object.fromEntries(comps.map((id) => [id, { assembling: false, landed: false }]));
    let beatMax = 0;
    const until = Date.now() + 1500;
    while (Date.now() < until) {
      const s = await page.evaluate((ids) => ({
        comps: Object.fromEntries(ids.map((id) => [id, window.__wedtmd.componentState(id)])),
        beats: window.__wedtmd.tierBeatsActive(),
      }), comps);
      beatMax = Math.max(beatMax, s.beats);
      for (const id of comps) {
        const st = s.comps[id];
        if (!st) continue;
        if (st.assembling) seen[id].assembling = true;
        else if (seen[id].assembling && st.visible && isOne(st.alpha) && isOne(st.scale)) seen[id].landed = true;
      }
      await page.waitForTimeout(50);
    }
    c.check('G_perk_lands', comps.every((id) => seen[id].assembling && seen[id].landed), seen);
    c.check('G_perk_silent', beatMax === 0, beatMax);
  } finally {
    await fgCtx.close().catch(() => {});
    fgCtx = null;
    fgPage = null;
  }
};

// Order A B C D E H F G: H sits before F because F and G share one page (G closes it), so F and G stay adjacent and last.
const CASES = [['A', caseA], ['B', caseB], ['C', caseC], ['D', caseD], ['E', caseE], ['H', caseH], ['F', caseF], ['G', caseG]];

const report = makeReport();
const { results, fail, errors } = report;
let cur = 'setup';
const only = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;
const contexts = [];
// Fresh 1280x720 context and page per call; watchPage tags errors with the running case key.
const fresh = async (browser, dsf = 1) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dsf });
  contexts.push(ctx);
  const page = await ctx.newPage();
  watchPage(page, errors, () => cur);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  // a fresh page has no ME and wornMotor costs 40: 45 real crank clicks give the first 40 ME (cases F and G keep their own 45)
  await crankClicks(page, 45, 0);
  return page;
};
const c = { check: report.check, url: target, out, fresh };
const msgOf = (e) => String(e && e.message ? e.message : e).split('\n')[0];

let browser = null;
try {
  browser = await chromium.launch();
  // demo build (demoState() not null): the era cap blocks S15 and primaryFunction, so cases F and G are skipped (FG_skipped_demo)
  const probe = await browser.newPage();
  watchPage(probe, errors, () => cur);
  await probe.goto(target, { waitUntil: 'load' });
  await waitReady(probe);
  const demo = await probe.evaluate(() => window.__wedtmd.demoState() !== null);
  await probe.close();
  for (const [key, fn] of CASES) {
    if (demo && (key === 'F' || key === 'G')) {
      report.check('FG_skipped_demo', true, 'demo build: S15 and primaryFunction are above the era cap');
      continue;
    }
    if (only && !only.includes(key)) continue;
    cur = key;
    try {
      await fn(browser, c);
    } catch (e) {
      fail.push(`FAILED:${key}:${msgOf(e)}`);
    } finally {
      for (const ctx of contexts.splice(0)) await ctx.close().catch(() => {});
    }
  }
} catch (e) {
  fail.push(`FAILED:${cur}:${msgOf(e)}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
