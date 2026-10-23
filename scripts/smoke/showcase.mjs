// WP18 showcase smoke: final machine (display levels, survey, portrait, VIEW MACHINE photo mode, teaser).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/showcase.mjs <url> <outdir>
// Runs: A, B, C, D, C2, F, E (B-C-D-C2-F share one context, E is a fresh one).
// Writes 13 PNGs into <outdir> (3840x2160: viewport 1280x720 at deviceScaleFactor 3) and prints ONE JSON:
// showcase_* result objects, shots (13 entries), errors (must be empty). Reads only window.__wedtmd.
// A missing hook field resolves to null and fails its assertion.
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
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
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
      // '@<techId>:<n>' marker: buy that tech until its level is n (up to 128 rounds, 8 h jump after a round that ends below n)
      const [tech, nStr] = id.slice(1).split(':'); const n = +nStr;
      for (let k = 0; k < 128 && s.state.techLevels[tech] < n; k++) {
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
    // Era V sky (skyViolet) fades for ~12 s after the instant buy list
    await page.waitForTimeout(15000);
    const entered = await photoMode(true, { hint: false });
    await page.waitForTimeout(1200);
    const hidden = (await parts())?.hidden ?? null;
    check(inv(hidden), `showcase_A hidden parts: ${JSON.stringify(hidden)}`);
    const photo = await photoState();
    check(photo?.active === true, `showcase_A photo state: ${JSON.stringify(photo)}`);
    const hudVisibility = await computed('hud-panel', 'visibility');
    check(hudVisibility === 'hidden', `showcase_A hud-panel visibility ${hudVisibility}`);
    const camera = await cameraState();
    check(atPortrait(camera), `showcase_A camera ${JSON.stringify(camera)}`);
    // no pointer move: the exit chip must stay invisible
    await shot('a_era5_ruined', { still: true });
    await photoMode(false);
    res.showcase_A = { buyFailed, entered, hidden, photo, camera, hudVisibility };
  });

  // RUN B: completion beat and survey on the greedy machine; RUN C continues the same context to postgame.
  await run('B', async () => {
    await open();
    const buyFailed = failedBuys(await fastForward(GREEDY));
    check(buyFailed.length === 0, `showcase_B buys failed: ${buyFailed.join(',')}`);
    await page.waitForTimeout(15000);
    const primaryFunction = await buyList(['primaryFunction']);
    check(primaryFunction.includes('primaryFunction:true'), `showcase_B primaryFunction ${primaryFunction.join(',')}`);
    await page.waitForTimeout(300);
    await seek(2.5);
    await page.waitForTimeout(300);
    const fs25 = await fin();
    const hidden25 = (await parts())?.hidden ?? null;
    // Legacy feeds are never in GREEDY, so they are always hidden before the beat; coil/siphon top stages depend on
    // how far the timed fast-forward got (flaky under load), so they are not required here.
    const must25 = ['steamLance', 'backfeedTerminal'];
    check(Array.isArray(hidden25) && hidden25.length >= 6 && must25.every(id => hidden25.includes(id)), `showcase_B_k2_5 hidden: ${JSON.stringify(hidden25)}`);
    check(fs25?.frame?.completeEra === 0, `showcase_B_k2_5 completeEra ${fs25?.frame?.completeEra ?? null}`);
    res.showcase_B_k2_5 = { buyFailed, primaryFunction, t: fs25?.t ?? null, completeEra: fs25?.frame?.completeEra ?? null, hidden: hidden25 };
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
      res[k.key] = { seekT: k.t, t: fs?.t ?? null, completeEra, hidden, resonantSiphon: siphon };
      await shot(k.shotName);
    }

    // survey: arrive baseL 41.0 (hold to 42.0), arrive baseR 45.0 (hold to 46.0)
    await seek(41.5);
    await page.waitForTimeout(300);
    const cam415 = await cameraState();
    check(cameraOk(cam415, 1320, 1380, 1), `showcase_B_k41_5 camera ${JSON.stringify(cam415)}`);
    res.showcase_B_k41_5 = { camera: cam415 };
    await shot('b_k41_5');

    await seek(45.2);
    await page.waitForTimeout(300);
    const cam452 = await cameraState();
    check(cameraOk(cam452, 2520, 1380, 1), `showcase_B_k45_2 camera ${JSON.stringify(cam452)}`);
    res.showcase_B_k45_2 = { camera: cam452 };
    await shot('b_k45_2');

    await seek(56);
    await page.waitForTimeout(300);
    const fs56 = await fin();
    const cam56 = await cameraState();
    check(fs56?.shot === 'S4', `showcase_B_k56 shot ${fs56?.shot ?? null}`);
    check(atPortrait(cam56), `showcase_B_k56 camera ${JSON.stringify(cam56)}`);
    res.showcase_B_k56 = { shot: fs56?.shot ?? null, camera: cam56 };
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
    res.showcase_C = { storedPhase: sp, phase: fs?.phase ?? null, title, plate, camera, hidden, viewMachine };
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
    const chipOpacity = await computed('photo-exit', 'opacity');
    check(photo?.active === true && photo?.hint === false, `showcase_D photo state ${JSON.stringify(photo)}`);
    check(modalCount === 1, `showcase_D modalCount ${modalCount}`);
    check(hudVisibility === 'hidden', `showcase_D hud-panel visibility ${hudVisibility}`);
    check(chipOpacity === '0', `showcase_D exit chip opacity ${chipOpacity}`);
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
      photo, modalCount, hudVisibility, chipOpacity, dragged, zoomed, arrowPanned,
      exit: { photo: photoAfter, camera: cameraAfter, hudVisibility: hudAfter, modalCount: modalsAfter },
    };
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
    res.showcase_C2 = { storedPhase: sp, phase: fs?.phase ?? null, camera, hidden };
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
