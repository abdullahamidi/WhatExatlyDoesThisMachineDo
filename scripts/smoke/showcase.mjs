// WP18 showcase smoke (WP18b: restored texture swap probes, photo chip focus, crown close-up): final machine (display levels, survey, portrait, VIEW MACHINE photo mode, teaser).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/showcase.mjs <url> <outdir>
// Runs: A, B, C, D, D2, C2, F, E (B-C-D-D2-C2-F share one context, E is a fresh one).
// Writes 14 PNGs into <outdir> (3840x2160: viewport 1280x720 at deviceScaleFactor 3) and prints ONE JSON:
// showcase_* result objects, shots (14 entries), errors (must be empty). Reads only window.__wedtmd.
// A missing hook field resolves to null and fails its assertion.
// WP22: RESTORED_TOTAL 34 (D5 option A). checkTiersTop at showcase_B_k41_5, showcase_B_k45_2, showcase_B_k56, showcase_C,
// showcase_D2 and showcase_C2: every TOP_TIERS track at its top tier in partTiers() (settled within 3 s). A mismatch goes to errors; the result is kept as tiersTop.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: PW_PATH=<playwright dir> node scripts/smoke/showcase.mjs <url> <outdir>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const errors = [], shots = [], res = {};
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const PORTRAIT = { x: 1920, y: 1080, z: 0.5 };
const cameraOk = (cam, x, y, z) => !!cam && near(cam.centerX, x, 2) && near(cam.centerY, y, 2) && near(cam.zoom, z, 0.01);
const atPortrait = cam => cameraOk(cam, PORTRAIT.x, PORTRAIT.y, PORTRAIT.z);
const RESTORED_TOTAL = 34;   // machine parts that have an A17 restored variant (WP22 D5 option A: + ring1Bead2)
// WP22 top tier per repeatable track (PART_TIERS.md); checkTiersTop compares partTiers() with it.
const TOP_TIERS = {
  gearRatio: 3, flywheel: 3, motorTuning: 5, improvedPistons: 5, copperWinding: 5, motorRetrofit: 5, transformer: 5,
  firebox: 5, inductionHeater: 5, condenser: 5, bellowsDrive: 3, harmonicCoil: 5, pressureResonator: 5, crankServo: 3,
  standingWave: 5, gridExciter: 3, containmentRing: 5, resonantSiphon: 3, graviticAnchor: 3, mainsBackfeed: 3, steamLance: 3,
};
// crown close-up by real keys from the portrait: `=` x4 (zoom .5 -> 1.5), ArrowRight x2 (+64 world px each), ArrowUp x6 (-64 each) -> camera (2048, 696, 1.5)
const CROWN = { zoomIn: 4, right: 2, up: 6, x: 2048, y: 696, z: 1.5 };
// every hidden part is the 3 s inversion ghost; a missing list (null) fails
const inv = hidden => Array.isArray(hidden) && hidden.every(id => id === 'inversionGhost');
const failedBuys = r => r.filter(x => !x.endsWith(':true'));

// buy lists: S7..S15 mirror stages.mjs; GREEDY is the same build with lower counts and no mainsBackfeed / steamLance
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', ...Array(3).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', ...Array(5).fill('gridExciter'), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', ...Array(5).fill('mainsBackfeed'), ...Array(5).fill('steamLance'), '@finalAlignment'];
const G9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(10).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const G10 = [...G9, '@substationBlueprint', 'boiler'];
const G11 = [...G10, ...Array(3).fill('inductionHeater'), ...Array(10).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', ...Array(3).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const G13 = [...G11, 'resonatorSpire', ...Array(3).fill('crankServo'), ...Array(16).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', ...Array(5).fill('gridExciter'), '@harmonicConvergence'];
const GREEDY = [...G13, 'nullChamber', ...Array(16).fill('containmentRing'), '@resonantSiphon:11', '@graviticAnchor:4', 'inversionCrank', 'lensArray', ...Array(10).fill('horizonField'), 'skyAperture', '@finalAlignment'];

let browser = null, ctx = null, page = null;
const ready = async () => { await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 }); await page.waitForTimeout(400); };
// fresh context = fresh localStorage
const open = async () => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
  page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
    else if (m.type() === 'warning' && /\[assets\] (failed to load|size mismatch)|has no frame/.test(m.text())) errors.push('console warning: ' + m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await ready();
};
// same buy helper as finale.mjs: 8 h jumps for '@<tech>' and '@<tech>:<n>' markers and for rejected buys
const buyList = list => page.evaluate((buys) => {
  const s = window.__wedtmd.session; const o = []; let t = Date.now();
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of buys) {
    if (id.startsWith('@') && id.includes(':')) {
      // '@<techId>:<n>' marker: buy that tech until its level is n (up to 512 rounds, 8 h jump after a round that ends below n)
      const [tech, nStr] = id.slice(1).split(':'); const n = +nStr;
      for (let k = 0; k < 512 && s.state.techLevels[tech] < n; k++) {
        let r = s.purchase(tech);
        while (r.ok && s.state.techLevels[tech] < n) r = s.purchase(tech);
        if (s.state.techLevels[tech] < n) jump();
      }
      o.push(id + ':' + (s.state.techLevels[tech] >= n));
      continue;
    }
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      o.push(id + ':' + (s.state.techLevels[tech] === 1));
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
    o.push(id + ':' + r.ok);
  }
  return o;
}, list);
// 45 crank clicks, then the buy list
const fastForward = async list => {
  const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  for (let i = 0; i < 45; i++) await page.mouse.click(pt.x, pt.y);
  return buyList(list);
};
const fin = () => page.evaluate(() => window.__wedtmd?.finaleState?.() ?? null);
const seek = t => page.evaluate(tt => window.__wedtmd?.finaleSeek?.(tt), t);
const parts = () => page.evaluate(() => window.__wedtmd?.partsVisible?.() ?? null);
const plateFrame = () => page.evaluate(() => window.__wedtmd?.componentState?.('namePlate')?.frame ?? null);
const cameraState = () => page.evaluate(() => window.__wedtmd?.cameraState?.() ?? null);
const modals = () => page.evaluate(() => window.__wedtmd?.modalCount?.() ?? null);
const photoState = () => page.evaluate(() => window.__wedtmd?.photoState?.() ?? null);
const photoMode = (on, opts) => page.evaluate(({ on, opts }) => window.__wedtmd?.photoMode?.(on, opts) ?? null, { on, opts });
const showcase = () => page.evaluate(() => window.__wedtmd?.showcaseState?.() ?? null);
const restored = () => page.evaluate(() => window.__wedtmd?.restoredTextures?.() ?? null);
const texKey = id => page.evaluate(id => window.__wedtmd?.textureKey?.(id) ?? null, id);
const frameOf = id => page.evaluate(id => window.__wedtmd?.componentState?.(id)?.frame ?? null, id);
// exit chip: computed opacity, focus, :focus-visible match; null when the chip is not in the DOM
const chipState = () => page.evaluate(() => {
  const el = document.getElementById('photo-exit');
  if (!el) return null;
  return { opacity: getComputedStyle(el).opacity, focused: document.activeElement === el, focusVisible: el.matches(':focus-visible') };
});
// store shots must not show a focus-visible chip: drop focus from it (no-op when it is not focused)
const blurChip = () => page.evaluate(() => { const el = document.getElementById('photo-exit'); if (el && document.activeElement === el) el.blur(); });
// the chip fades over 300 ms (slower under 4K WebGL frames): poll up to 3 s until its computed opacity is <= 0.001; returns the last chipState()
const waitChipHidden = async () => { for (let i = 0; i < 30; i++) { const c = await chipState(); if (c && parseFloat(c.opacity) <= 0.001) return c; await page.waitForTimeout(100); } return chipState(); };
// true when the chip state is read and invisible
const chipHidden = c => c !== null && parseFloat(c.opacity) <= 0.001;
// asserts the swapped-part count (want 0 or RESTORED_TOTAL) and total === RESTORED_TOTAL; returns the swapped count (null when the hook is missing)
const checkRestored = async (key, want) => {
  const r = await restored();
  const n = Array.isArray(r?.swapped) ? r.swapped.length : null;
  check(n === want && r?.total === RESTORED_TOTAL, `${key} restored swapped ${n} total ${r?.total ?? null} want ${want}/${RESTORED_TOTAL}`);
  return n;
};
const partTiers = () => page.evaluate(() => window.__wedtmd?.partTiers?.() ?? null);
// WP22: every TOP_TIERS track at its top tier in partTiers() (tracks with a visible host). Re-reads up to 3 s while a tier beat
// is still in flight; pushes one mismatch line per call (missing tracks count); returns { tiers, mismatches }.
const checkTiersTop = async (key) => {
  const miss = (t) => (t === null ? ['partTiers null'] : Object.entries(TOP_TIERS).filter(([id, top]) => t[id] !== top).map(([id, top]) => `${id}:${t[id] ?? null}/${top}`));
  let tiers = await partTiers();
  let mismatches = miss(tiers);
  for (let i = 0; i < 30 && mismatches.length > 0; i++) {
    await page.waitForTimeout(100);
    tiers = await partTiers();
    mismatches = miss(tiers);
  }
  check(mismatches.length === 0, `${key} tiers top mismatch: ${mismatches.join(', ')}`);
  return { tiers, mismatches };
};
const resonantSiphon = () => page.evaluate(() => window.__wedtmd?.session?.state?.techLevels?.resonantSiphon ?? null);
const totalClicks = () => page.evaluate(() => window.__wedtmd?.session?.state?.totalClicks ?? null);
const computed = (id, prop) => page.evaluate(({ id, prop }) => { const el = document.getElementById(id); return el ? getComputedStyle(el)[prop] : null; }, { id, prop });
const viewMachineBox = () => page.evaluate(() => {
  const b = document.getElementById('hud-view-machine');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { hidden: b.hidden, w: r.width, h: r.height };
});
const storedPhase = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wedtmd.save')).state.ending.phase; } catch (e) { return null; } });
// the save is written a moment after KEEP: poll up to 3 s
const waitStoredPostgame = async () => {
  for (let i = 0; i < 30 && (await storedPhase()) !== 'postgame'; i++) await page.waitForTimeout(100);
  return storedPhase();
};
const keepClick = () => page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 }).catch(e => errors.push('showcase_keep_click: ' + String(e).split('\n')[0]));
// pointer goes to (5, 5) before a shot so the HUD is not hovered; `still` keeps the pointer where the run left it
const shot = async (name, { still = false } = {}) => {
  if (!still) await page.mouse.move(5, 5);
  const buf = await page.screenshot({ path: `${out}/${name}.png` });
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== 3840 || h !== 2160) errors.push(`shot ${name} size ${w}x${h}`);
  shots.push({ name, w, h });
};
const run = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    const msg = String(e).split('\n')[0];
    errors.push(`showcase_${name} FAILED: ${msg}`);
    res[`showcase_FAILED_${name}`] = msg;
  }
};

try {
  browser = await chromium.launch();
  // RUN A: era V machine (no finale), photo mode forced with the hint off: every part shown, HUD hidden, portrait camera.
  await run('A', async () => {
    await open();
    const buyFailed = (await fastForward(S15)).filter(x => x.endsWith(':false'));
    check(buyFailed.length === 0, `showcase_A buys failed: ${buyFailed.join(',')}`);
    // Era V sky: WorldScene fades each rising stage over ERA5_SKY_FADE_IN_MS (WP26, ~6 s a stage). worldSettle(true) snaps it (settleFades), so the 15 s wait below is only a margin.
    await page.evaluate(() => window.__wedtmd?.worldSettle?.(true));
    await page.waitForTimeout(15000);
    const entered = await photoMode(true, { hint: false });
    await page.waitForTimeout(1200);
    await blurChip();
    const chipA = await waitChipHidden();
    const hidden = (await parts())?.hidden ?? null;
    check(inv(hidden), `showcase_A hidden parts: ${JSON.stringify(hidden)}`);
    const photo = await photoState();
    check(photo?.active === true, `showcase_A photo state: ${JSON.stringify(photo)}`);
    const hudVisibility = await computed('hud-panel', 'visibility');
    check(hudVisibility === 'hidden', `showcase_A hud-panel visibility ${hudVisibility}`);
    const camera = await cameraState();
    check(atPortrait(camera), `showcase_A camera ${JSON.stringify(camera)}`);
    check(chipHidden(chipA), `showcase_A exit chip ${JSON.stringify(chipA)}`);
    const restoredA = await checkRestored('showcase_A', 0);
    // no pointer move: the exit chip must stay invisible
    await shot('a_era5_ruined', { still: true });
    await photoMode(false);
    res.showcase_A = { buyFailed, entered, hidden, photo, camera, hudVisibility, chip: chipA, restoredSwapped: restoredA };
  });

  // RUN B: completion beat and survey on the greedy machine; RUN C continues the same context to postgame.
  await run('B', async () => {
    await open();
    const buyFailed = failedBuys(await fastForward(GREEDY));
    check(buyFailed.length === 0, `showcase_B buys failed: ${buyFailed.join(',')}`);
    await page.evaluate(() => window.__wedtmd?.worldSettle?.(true));
    await page.waitForTimeout(15000);
    const primaryFunction = await buyList(['primaryFunction']);
    check(primaryFunction.includes('primaryFunction:true'), `showcase_B primaryFunction ${primaryFunction.join(',')}`);
    await page.waitForTimeout(300);
    // the film clock keeps running in 'sequence': seek early and read parts() before fin() so both probes stay before the completion step at t 3
    await seek(2.0);
    await page.waitForTimeout(150);
    const hidden25 = (await parts())?.hidden ?? null;
    const fs25 = await fin();
    check(fs25 !== null && fs25.t < 3, `showcase_B_k2_5 film clock passed the completion step: t ${fs25?.t ?? null}`);
    // WP22 D5: siphonTube3L shows from resonantSiphon 10 and the greedy end holds 11, so it is no longer hidden here
    const must25 = ['coilStage3', 'steamLance', 'fireboxGlow3'];
    check(Array.isArray(hidden25) && hidden25.length >= 6 && must25.every(id => hidden25.includes(id)), `showcase_B_k2_5 hidden: ${JSON.stringify(hidden25)}`);
    check(fs25?.frame?.completeEra === 0, `showcase_B_k2_5 completeEra ${fs25?.frame?.completeEra ?? null}`);
    res.showcase_B_k2_5 = { buyFailed, primaryFunction, seekT: 2.0, t: fs25?.t ?? null, completeEra: fs25?.frame?.completeEra ?? null, hidden: hidden25, restoredSwapped: await checkRestored('showcase_B_k2_5', 0) };
    await shot('b_k2_5');

    // Completion steps (FINALE_COMPLETE 3 / 4.5 / 6): the film clock keeps running in 'sequence', so each
    // keyframe is read 250 ms after the seek (a 900 ms settle would cross the next era step).
    const eraKeys = [
      { t: 3.9, era: 3, key: 'showcase_B_k3_9', shotName: 'b_k3_9', mustShow: 'coilStage3' },
      { t: 5.4, era: 4, key: 'showcase_B_k5_4', shotName: 'b_k5_4', mustShow: 'coilRing4' },
      { t: 6.9, era: 5, key: 'showcase_B_k6_9', shotName: 'b_k6_9', mustShow: null },
    ];
    for (const k of eraKeys) {
      await seek(k.t);
      await page.waitForTimeout(250);
      const fs = await fin();
      const hidden = (await parts())?.hidden ?? null;
      const completeEra = fs?.frame?.completeEra ?? null;
      const siphon = await resonantSiphon();
      check(completeEra === k.era, `${k.key} completeEra ${completeEra} want ${k.era}`);
      if (k.mustShow === null) check(inv(hidden), `${k.key} hidden: ${JSON.stringify(hidden)}`);
      else check(Array.isArray(hidden) && !hidden.includes(k.mustShow), `${k.key} ${k.mustShow} hidden`);
      // the real session keeps its greedy levels: the completion beat is display-only
      check(siphon === 11, `${k.key} real resonantSiphon ${siphon} want 11`);
      res[k.key] = { seekT: k.t, t: fs?.t ?? null, completeEra, hidden, resonantSiphon: siphon, restoredSwapped: await checkRestored(k.key, 0) };
      await shot(k.shotName);
    }

    // survey: arrive baseL 41.0 (hold to 42.0), arrive baseR 45.0 (hold to 46.0)
    await seek(41.5);
    await page.waitForTimeout(300);
    const cam415 = await cameraState();
    check(cameraOk(cam415, 1320, 1380, 1), `showcase_B_k41_5 camera ${JSON.stringify(cam415)}`);
    res.showcase_B_k41_5 = { camera: cam415, restoredSwapped: await checkRestored('showcase_B_k41_5', RESTORED_TOTAL), tiersTop: await checkTiersTop('showcase_B_k41_5') };
    await shot('b_k41_5');

    await seek(45.2);
    await page.waitForTimeout(300);
    const cam452 = await cameraState();
    check(cameraOk(cam452, 2520, 1380, 1), `showcase_B_k45_2 camera ${JSON.stringify(cam452)}`);
    res.showcase_B_k45_2 = { camera: cam452, restoredSwapped: await checkRestored('showcase_B_k45_2', RESTORED_TOTAL), tiersTop: await checkTiersTop('showcase_B_k45_2') };
    await shot('b_k45_2');

    await seek(56);
    await page.waitForTimeout(300);
    const fs56 = await fin();
    const cam56 = await cameraState();
    check(fs56?.shot === 'S4', `showcase_B_k56 shot ${fs56?.shot ?? null}`);
    check(atPortrait(cam56), `showcase_B_k56 camera ${JSON.stringify(cam56)}`);
    res.showcase_B_k56 = { shot: fs56?.shot ?? null, camera: cam56, restoredSwapped: await checkRestored('showcase_B_k56', RESTORED_TOTAL), tiersTop: await checkTiersTop('showcase_B_k56') };
    await shot('b_k56');
  });

  // RUN C (same context as B): skip to the choice, KEEP IT RUNNING -> postgame, portrait, every part shown.
  await run('C', async () => {
    await page.evaluate(() => window.__wedtmd?.skipFinale?.());
    await page.waitForTimeout(500);
    await keepClick();
    const sp = await waitStoredPostgame();
    await page.waitForTimeout(2500);
    const fs = await fin();
    const title = await page.evaluate(() => document.getElementById('hud-title')?.textContent?.trim() ?? null);
    const plate = await plateFrame();
    const camera = await cameraState();
    const hidden = (await parts())?.hidden ?? null;
    const viewMachine = await viewMachineBox();
    check(fs?.phase === 'postgame', `showcase_C phase ${fs?.phase ?? null}`);
    check(title === 'RESTORATION ENGINE', `showcase_C title ${title}`);
    check(plate === 5, `showcase_C name plate frame ${plate}`);
    check(atPortrait(camera), `showcase_C camera ${JSON.stringify(camera)}`);
    check(inv(hidden), `showcase_C hidden parts: ${JSON.stringify(hidden)}`);
    check(viewMachine !== null && viewMachine.hidden === false && viewMachine.w > 0 && viewMachine.h > 0, `showcase_C view button ${JSON.stringify(viewMachine)}`);
    const restoredC = await checkRestored('showcase_C', RESTORED_TOTAL);
    const tiersC = await checkTiersTop('showcase_C');
    const keys = { nullCore: await texKey('nullCore'), ring1Bead: await texKey('ring1Bead'), aperture: await texKey('aperture') };
    check(keys.nullCore === 'machine.nullCore#restored#rot', `showcase_C nullCore key ${keys.nullCore}`);
    check(keys.ring1Bead === 'machine.ringBead#restored', `showcase_C ring1Bead key ${keys.ring1Bead}`);
    check(keys.aperture === 'machine.aperture#restored', `showcase_C aperture key ${keys.aperture}`);
    const lit = { generatorGlow: await frameOf('generatorGlow'), crystal: await frameOf('crystal'), lensLight: await frameOf('lensLight'), anchorGlow1L: await frameOf('anchorGlow1L') };
    check(lit.generatorGlow === 3 && lit.crystal === 2 && lit.lensLight === 3 && lit.anchorGlow1L === 2, `showcase_C lamp frames ${JSON.stringify(lit)} want 3/2/3/2`);
    res.showcase_C = { storedPhase: sp, phase: fs?.phase ?? null, title, plate, camera, hidden, viewMachine, restoredSwapped: restoredC, tiersTop: tiersC, keys, lit };
    await shot('c_postgame_portrait');
  });

  // RUN D (same context, postgame): VIEW MACHINE opens photo mode; drag, wheel, arrow, Esc restores the portrait.
  await run('D', async () => {
    await page.focus('#hud-view-machine');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3200);
    const photo = await photoState();
    const modalCount = await modals();
    const hudVisibility = await computed('hud-panel', 'visibility');
    const chip = await chipState();
    check(photo?.active === true && photo?.hint === false, `showcase_D photo state ${JSON.stringify(photo)}`);
    check(modalCount === 1, `showcase_D modalCount ${modalCount}`);
    check(hudVisibility === 'hidden', `showcase_D hud-panel visibility ${hudVisibility}`);
    check(chip?.focused === true, `showcase_D exit chip focused ${JSON.stringify(chip)}`);
    check(chip !== null && (!chip.focusVisible || chip.opacity === '1'), `showcase_D focus-visible chip must be shown ${JSON.stringify(chip)}`);
    await blurChip();
    const chipBlurred = await waitChipHidden();
    check(chipHidden(chipBlurred), `showcase_D exit chip after blur ${JSON.stringify(chipBlurred)}`);
    await shot('d_photo_postgame', { still: true });

    const c0 = await cameraState();
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(840, 360, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const c1 = await cameraState();
    const dragged = !!c0 && !!c1 && Math.abs(c1.centerX - c0.centerX) > 1;
    check(dragged, `showcase_D drag pan ${JSON.stringify(c0)} -> ${JSON.stringify(c1)}`);

    const z0 = (await cameraState())?.zoom ?? null;
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(700);
    const z1 = (await cameraState())?.zoom ?? null;
    const zoomed = Number.isFinite(z0) && Number.isFinite(z1) && z1 > z0;
    check(zoomed, `showcase_D wheel zoom ${z0} -> ${z1}`);

    const cx0 = (await cameraState())?.centerX ?? null;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const cx1 = (await cameraState())?.centerX ?? null;
    const arrowPanned = Number.isFinite(cx0) && Number.isFinite(cx1) && Math.abs(cx1 - cx0) > 1;
    check(arrowPanned, `showcase_D arrow pan ${cx0} -> ${cx1}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const photoAfter = await photoState();
    const cameraAfter = await cameraState();
    const hudAfter = await computed('hud-panel', 'visibility');
    const modalsAfter = await modals();
    check(photoAfter?.active === false, `showcase_D photo after Esc ${JSON.stringify(photoAfter)}`);
    check(atPortrait(cameraAfter), `showcase_D camera after Esc ${JSON.stringify(cameraAfter)}`);
    check(hudAfter === 'visible', `showcase_D hud-panel after Esc ${hudAfter}`);
    check(modalsAfter === 0, `showcase_D modalCount after Esc ${modalsAfter}`);
    res.showcase_D = {
      photo, modalCount, hudVisibility, chip, chipBlurred, dragged, zoomed, arrowPanned,
      exit: { photo: photoAfter, camera: cameraAfter, hudVisibility: hudAfter, modalCount: modalsAfter },
    };
  });

  // RUN D2 (same context, postgame): crown close-up by real keys from the portrait. `=` x4 (zoom .5 -> 1.5), ArrowRight x2 (+64 world px each at zoom 1.5),
  // ArrowUp x6 (-64 each): camera (2048, 696, 1.5) = 3 screen px per art px on the crown (aperture top, lens, null chamber, core, siphons, crystal, gallery).
  await run('D2', async () => {
    await page.focus('#hud-view-machine');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await blurChip();
    await waitChipHidden();
    const press =async (key, n) => { for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(80); } };
    await press('=', CROWN.zoomIn);
    await press('ArrowRight', CROWN.right);
    await press('ArrowUp', CROWN.up);
    await page.waitForTimeout(3200);   // the key hint (2.5 s) fades and the camera settles; the pointer does not move
    const photo = await photoState();
    const camera = await cameraState();
    const chip = await waitChipHidden();
    const crystal = await frameOf('crystal');
    check(photo?.active === true && photo?.hint === false, `showcase_D2 photo state ${JSON.stringify(photo)}`);
    check(cameraOk(camera, CROWN.x, CROWN.y, CROWN.z), `showcase_D2 camera ${JSON.stringify(camera)} want ${CROWN.x},${CROWN.y},${CROWN.z}`);
    check(chipHidden(chip), `showcase_D2 exit chip ${JSON.stringify(chip)}`);
    const swapped = await checkRestored('showcase_D2', RESTORED_TOTAL);
    const tiersD2 = await checkTiersTop('showcase_D2');
    check(crystal === 2, `showcase_D2 crystal frame ${crystal} want 2`);
    await shot('d_photo_crown', { still: true });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const photoAfter = await photoState();
    const cameraAfter = await cameraState();
    check(photoAfter?.active === false, `showcase_D2 photo after Esc ${JSON.stringify(photoAfter)}`);
    check(atPortrait(cameraAfter), `showcase_D2 camera after Esc ${JSON.stringify(cameraAfter)}`);
    res.showcase_D2 = { photo, camera, chip, crystal, restoredSwapped: swapped, tiersTop: tiersD2, exit: { photo: photoAfter, camera: cameraAfter } };
  });

  // RUN C2 (same context): reload keeps postgame and lands on the canonical portrait with every part shown.
  await run('C2', async () => {
    const sp = await waitStoredPostgame();
    await page.reload({ waitUntil: 'networkidle' });
    await ready();
    await page.waitForTimeout(1500);
    const fs = await fin();
    const camera = await cameraState();
    const hidden = (await parts())?.hidden ?? null;
    check(fs?.phase === 'postgame', `showcase_C2 phase ${fs?.phase ?? null}`);
    check(atPortrait(camera), `showcase_C2 camera ${JSON.stringify(camera)}`);
    check(inv(hidden), `showcase_C2 hidden parts: ${JSON.stringify(hidden)}`);
    const restoredC2 = await checkRestored('showcase_C2', RESTORED_TOTAL);
    const tiersC2 = await checkTiersTop('showcase_C2');
    res.showcase_C2 = { storedPhase: sp, phase: fs?.phase ?? null, camera, hidden, restoredSwapped: restoredC2, tiersTop: tiersC2 };
  });

  // RUN F (same context, postgame): VIEW MACHINE with Enter (hint off), ArrowRight re-arms the hint, T opens the
  // tech tree: photo mode ends and focus stays on the tree (not back on the HUD button). Esc closes the tree.
  await run('F', async () => {
    await page.focus('#hud-view-machine');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3200);
    const enter = await photoState();
    check(enter?.active === true && enter?.hint === false, `showcase_F photo state ${JSON.stringify(enter)}`);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const afterKey = await photoState();
    check(afterKey?.active === true && afterKey?.hint === true, `showcase_F hint after key ${JSON.stringify(afterKey)}`);

    await page.keyboard.press('t');
    await page.waitForTimeout(600);
    const afterT = await page.evaluate(() => ({
      photo: window.__wedtmd?.photoState?.() ?? null,
      treeOpen: window.__wedtmd?.techTreeOpen?.() ?? null,
      modals: window.__wedtmd?.modalCount?.() ?? null,
      focusId: document.activeElement?.id ?? null,
      focusInTree: document.activeElement?.closest?.('#tech-overlay') != null,
    }));
    check(afterT.photo?.active === false, `showcase_F photo after T ${JSON.stringify(afterT.photo)}`);
    check(afterT.treeOpen === true, `showcase_F tech tree open ${afterT.treeOpen}`);
    check(afterT.modals === 1, `showcase_F modalCount after T ${afterT.modals}`);
    // WP20: opening the tree focuses the selected node (fallback CLOSE); either way focus is inside the tree.
    check(afterT.focusInTree === true, `showcase_F focus after T ${afterT.focusId}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const closed = await page.evaluate(() => ({
      treeOpen: window.__wedtmd?.techTreeOpen?.() ?? null,
      modals: window.__wedtmd?.modalCount?.() ?? null,
      focusId: document.activeElement?.id ?? null,
      focusTag: document.activeElement?.tagName ?? null,
    }));
    check(closed.treeOpen === false && closed.modals === 0, `showcase_F after Esc ${JSON.stringify(closed)}`);
    check(closed.focusTag !== 'BODY' && closed.focusTag !== null && (closed.focusId === 'hud-view-machine' || closed.focusId === 'hud-tech'), `showcase_F focus after Esc ${closed.focusId} ${closed.focusTag}`);
    res.showcase_F = { enter, afterKey, afterT, closed };
  });

  // RUN E (fresh game): teaser from era 2 to the aperture; the World wakes again after stop and takes a crank click.
  // Never wait on wall time for teaser time: the teaser clock runs on Phaser's frame delta, and headless Chrome
  // at a low frame rate can run it at 0.1-0.25x real time. Seek, then poll the state with a long cap.
  await run('E', async () => {
    await open();
    // visibility hides the HUD DOM; hidden elements take no pointer events, so the later crank click reaches the canvas
    await page.evaluate(() => {
      const root = document.getElementById('ui-root');
      if (root) root.style.visibility = 'hidden';
    });
    await page.evaluate(() => window.__wedtmd?.showcasePlay?.({}));
    await page.waitForTimeout(300);
    const e2 = await showcase();
    check(e2 !== null && e2.active === true && e2.era === 2, `showcase_E era 2 state ${JSON.stringify(e2)}`);
    await shot('e_teaser_era2');
    res.showcase_E_era2 = e2;

    const pollShowcase = async (pred, capMs) => {
      let s = null;
      const until = Date.now() + capMs;
      while (Date.now() < until) {
        s = await showcase();
        if (s !== null && pred(s)) break;
        await page.waitForTimeout(100);
      }
      return s;
    };
    // era III shown at once by the seek; the natural era IV step at t 2.5 assembles its parts; shoot once t >= 3
    await page.evaluate(() => window.__wedtmd?.showcaseSeek?.(2.2));
    const eA = await pollShowcase(s => s.t >= 3, 60000);
    check(eA !== null && eA.t >= 3, `showcase_E assembling t ${eA?.t ?? null}`);
    await shot('e_teaser_assembling');
    res.showcase_E_assembling = eA;

    // era V shown at once, aperture still closed; the aperture opens naturally at t 7.0 and the end is t 9.5 by the teaser clock
    await page.evaluate(() => window.__wedtmd?.showcaseSeek?.(6.5));
    let eE = await pollShowcase(s => s.done, 60000);
    await page.waitForTimeout(600);
    eE = await showcase();
    const generator = await page.evaluate(() => window.__wedtmd?.session?.state?.techLevels?.generator ?? null);
    check(eE?.done === true, `showcase_E done ${eE?.done ?? null}`);
    check(eE?.era === 5, `showcase_E era ${eE?.era ?? null}`);
    check(eE?.apertureOpen === true, `showcase_E aperture ${eE?.apertureOpen ?? null}`);
    check(inv(eE?.hidden), `showcase_E hidden parts: ${JSON.stringify(eE?.hidden ?? null)}`);
    check(atPortrait(eE?.camera), `showcase_E camera ${JSON.stringify(eE?.camera ?? null)}`);
    check(generator === 0, `showcase_E real generator ${generator} want 0`);
    await shot('e_teaser_end');
    res.showcase_E_end = { ...eE, generator };

    await page.evaluate(() => window.__wedtmd?.showcaseStop?.());
    await page.waitForTimeout(600);
    const tc0 = await totalClicks();
    const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(200);
    const tc1 = await totalClicks();
    const delta = Number.isFinite(tc0) && Number.isFinite(tc1) ? tc1 - tc0 : null;
    const stopped = await showcase();
    check(delta === 1, `showcase_E crank after stop: clicks delta ${delta}`);
    check(stopped === null, `showcase_E state after stop ${JSON.stringify(stopped)}`);
    res.showcase_E_stop = { totalClicksDelta: delta, stateAfter: stopped };
  });
} finally {
  res.shots = shots;
  res.errors = errors;
  console.log(JSON.stringify(res, null, 1));
  if (ctx) await ctx.close().catch(() => {});
  if (browser) await browser.close();
}
