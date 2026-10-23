// WP13 finale smoke. Usage: PW_PATH=... [PERF=1] node finale.mjs <url> <outdir>
// Records keys only (no asserts). Every result key starts with finale_ (plus errors / FAILED).
// Uses the WP13 debug hook (finaleState, skipFinale, finaleSeek, displayObjects, componentState().frame,
// session.updateSettings); missing hook fields resolve to null, never throw.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
const PERF = process.env.PERF === '1';
const errors = [], res = {};
const ok = (k, v) => { res[k] = v; };
const failedBuys = r => r.filter(x => !x.endsWith(':true'));

// buy list up to the era V stage before primaryFunction (mirrors stages.mjs S15)
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', ...Array(3).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', ...Array(5).fill('gridExciter'), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', ...Array(5).fill('mainsBackfeed'), ...Array(5).fill('steamLance'), '@finalAlignment'];
// storyboard keyframes (WP13 Validation §Smoke (2)); 'end' = just past finaleEndS (64.47)
const KEYS = [['1', 1], ['6', 6], ['12', 12], ['15_6', 15.6], ['24', 24], ['30_5', 30.5], ['34', 34], ['40', 40], ['56', 56], ['end', 64.5]];

const browser = await chromium.launch();
let ctx = null, page = null;
const ready = async () => { await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 }); await page.waitForTimeout(400); };
// fresh context = fresh localStorage
const open = async () => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await ready();
};
// same buy helper as stages.mjs: 8 h jumps for '@<tech>' and '@<tech>:<n>' markers and for rejected buys
const buyList = buys => page.evaluate((buys) => {
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
}, buys);
const fastForward = async () => {
  const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
  for (let i = 0; i < 45; i++) await page.mouse.click(pt.x, pt.y);
  return buyList(S15);
};
const crankClick = async () => { const p = await page.evaluate(() => window.__wedtmd.crankClientPoint()); await page.mouse.click(p.x, p.y); };
const fin = () => page.evaluate(() => window.__wedtmd?.finaleState?.() ?? null);
const phase = async () => (await fin())?.phase ?? null;
const seek = t => page.evaluate(t => window.__wedtmd?.finaleSeek?.(t), t);
const plateFrame = () => page.evaluate(() => window.__wedtmd?.componentState?.('namePlate')?.frame ?? null);
const dispObjs = () => page.evaluate(() => window.__wedtmd?.displayObjects?.() ?? null);
const machineMean = () => page.evaluate(() => window.__wedtmd?.machineStats?.()?.meanMs ?? null);
const totalClicks = () => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
const treeOpen = () => page.evaluate(() => window.__wedtmd.techTreeOpen());
const menuOpen = () => page.evaluate(() => window.__wedtmd.systemMenuOpen());
const modals = () => page.evaluate(() => window.__wedtmd.modalCount());
const hudHidden = () => page.evaluate(() => !!document.getElementById('ui-root')?.classList.contains('finale-active'));
// a KEEP IT RUNNING button that is rendered (overlay up)
const keepShown = () => page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('KEEP IT RUNNING') && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden'));
const storedPhase = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wedtmd.save')).state.ending.phase; } catch (e) { return null; } });
const cycleRow = () => page.evaluate(() => {
  const b = document.getElementById('sys-new-cycle'); const r = document.getElementById('sys-new-cycle-reason');
  if (!b) return null;
  const rect = b.getBoundingClientRect();
  return { visible: rect.width > 0 && rect.height > 0 && !b.hidden, disabled: b.getAttribute('aria-disabled') === 'true', label: (b.textContent || '').trim(), description: b.getAttribute('aria-description'), reason: r ? (r.textContent || '').trim() : null, reasonVisible: !!r && r.getClientRects().length > 0 };
});
const keepClick = () => page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 }).catch(e => errors.push('finale_keep_click: ' + String(e).split('\n')[0]));
const shotLog = async (label, t) => {
  await seek(t); await page.waitForTimeout(250);
  const s = await fin();
  ok(`finale_k${label}`, { t: s?.t ?? null, shot: s?.shot ?? null, plate: await plateFrame(), frame: s?.frame ?? null });
  await page.screenshot({ path: `${out}/finale-k${label}.png` });
};
// PERF=1 samples (report only): finaleState().meanMs, machineStats().meanMs, displayObjects()
const perfSample = async label => {
  const s = await fin();
  ok(`finale_perf_${label}`, { t: s?.t ?? null, phase: s?.phase ?? null, finaleMeanMs: s?.meanMs ?? null, machineMeanMs: await machineMean(), displayObjects: await dispObjs() });
};

try {
  if (PERF) {
    // perf run: S1 (t 8-10, max boost), S3 (t 22-36, wipe + masks + seeds), postgame
    await open();
    await fastForward();
    await buyList(['primaryFunction']);
    await page.waitForTimeout(300);
    await seek(8); await page.waitForTimeout(1800); await perfSample('s1_t8');
    await seek(22); await page.waitForTimeout(2500); await perfSample('s3_t22');
    await seek(36); await page.waitForTimeout(1500); await perfSample('s3_t36');
    await page.evaluate(() => window.__wedtmd?.skipFinale?.());
    await keepClick();
    await page.waitForTimeout(2500); await perfSample('postgame');
  }

  // RUN 1: main flow (buy, keyframes, reload to choice, KEEP, reload postgame, menu, reset)
  await open();
  ok('finale_0_fastforward_failed', failedBuys(await fastForward()));
  // Era V sky (skyViolet) fades for ~12 s after the instant buy list: wait it out so keyframes do not start on beige sky.
  await page.waitForTimeout(15000);
  const buy = await buyList(['primaryFunction']);
  await page.waitForTimeout(300);
  const s1 = await fin();
  const c0 = await totalClicks();
  await crankClick(); await page.waitForTimeout(150);
  ok('finale_1_buy', { buy, phase: s1?.phase ?? null, t: s1?.t ?? null, hudHidden: await hudHidden(), crankDelta: (await totalClicks()) - c0, modals: await modals() });
  await page.keyboard.press('t'); await page.waitForTimeout(200);
  ok('finale_1_t_sequence', { treeOpen: await treeOpen(), phase: await phase() });

  for (const [label, t] of KEYS) await shotLog(label, t);

  // natural playback 5 s from t 20, then reload: normalise sequence -> choice
  await seek(20); await page.waitForTimeout(5000);
  ok('finale_2_playback_t', (await fin())?.t ?? null);
  await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForTimeout(300);
  const s3 = await fin();
  ok('finale_3_reload_choice', { phase: s3?.phase ?? null, t: s3?.t ?? null, keepShown: await keepShown(), hudHidden: await hudHidden(), plate: await plateFrame(), restored: s3?.frame?.restored ?? null });
  await page.screenshot({ path: `${out}/finale-choice.png` });

  // Esc and t do nothing at choice (no menu, no tree, overlay stays)
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('t'); await page.waitForTimeout(200);
  ok('finale_4_esc_t_choice', { phase: await phase(), menuOpen: await menuOpen(), treeOpen: await treeOpen(), keepShown: await keepShown(), modals: await modals() });

  // KEEP IT RUNNING -> postgame
  await keepClick();
  await page.waitForTimeout(500);
  for (let i = 0; i < 20 && (await storedPhase()) !== 'postgame'; i++) await page.waitForTimeout(100);
  ok('finale_4_keep', { phase: await phase(), hudHidden: await hudHidden(), keepShown: await keepShown(), modals: await modals(), storedPhase: await storedPhase() });
  const cA = await totalClicks(); await crankClick(); await page.waitForTimeout(150);
  ok('finale_4_crank_postgame', { delta: (await totalClicks()) - cA });
  await page.screenshot({ path: `${out}/finale-postgame.png` });

  // reload -> postgame, no overlay, seeds on, eclipse hidden
  await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForTimeout(300);
  const s5 = await fin();
  ok('finale_5_reload_postgame', { phase: s5?.phase ?? null, restored: s5?.frame?.restored ?? null, seeds: s5?.frame?.seeds ?? null, eclipse: s5?.frame?.eclipse?.kind ?? null, hudHidden: await hudHidden(), keepShown: await keepShown(), plate: await plateFrame(), displayObjects: await dispObjs() });

  // system menu: BEGIN A NEW CYCLE row (WP14: enabled, reason line absent; expect disabled false, reasonVisible false)
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('#sys-tab-system'); await page.waitForTimeout(150);
  ok('finale_6_newcycle', { menuOpen: await menuOpen(), row: await cycleRow() });
  await page.screenshot({ path: `${out}/finale-menu-newcycle.png` });

  // reset from the menu in postgame -> wasteland (plate frame 4)
  await page.click('#sys-reset'); await page.click('#sys-reset'); await page.waitForTimeout(400);
  const s7 = await fin();
  ok('finale_7_reset', { phase: s7?.phase ?? null, restored: s7?.frame?.restored ?? null, plate: await plateFrame(), me: await page.evaluate(() => window.__wedtmd.session.state.res.me) });
  if (await menuOpen()) await page.keyboard.press('Escape');

  // RUN 2: skip. buy, wait 2 s, t does nothing, Esc -> choice with t at end
  await open();
  await fastForward();
  await buyList(['primaryFunction']);
  await page.waitForTimeout(2000);
  const pre = await fin();
  await page.keyboard.press('t'); await page.waitForTimeout(150);
  const treeAtSeq = await treeOpen();
  const escAt = Date.now();
  await page.keyboard.press('Escape');
  let msToChoice = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(50);
    if ((await phase()) === 'choice') { msToChoice = Date.now() - escAt; break; }
  }
  await page.waitForTimeout(200);
  const sk = await fin();
  ok('finale_skip', { tBeforeEsc: pre?.t ?? null, treeAtSeq, msToChoice, phase: sk?.phase ?? null, t: sk?.t ?? null, keepShown: await keepShown(), menuOpen: await menuOpen() });
  await page.screenshot({ path: `${out}/finale-skip-choice.png` });

  // RUN 3: reduced motion set BEFORE the buy
  await open();
  await page.evaluate(() => window.__wedtmd.session.updateSettings?.({ reducedMotion: true }));
  await page.waitForTimeout(100);
  await fastForward();
  await buyList(['primaryFunction']);
  await page.waitForTimeout(300);
  const r0 = await fin();
  ok('finale_r_start', { reduced: r0?.reduced ?? null, phase: r0?.phase ?? null, hudHidden: await hudHidden() });
  await seek(15.6); await page.waitForTimeout(250);
  const r1 = await fin();
  ok('finale_r_15_6', { t: r1?.t ?? null, overlayAlpha: r1?.frame?.overlay?.alpha ?? null, shot: r1?.shot ?? null, reduced: r1?.reduced ?? null });
  await seek(24); await page.waitForTimeout(250);
  const r2 = await fin();
  ok('finale_r_24', { t: r2?.t ?? null, wipe: r2?.frame?.wipe?.mode ?? null, beamAnimate: r2?.frame?.beam?.animate ?? null, birds: r2?.frame?.birds ?? null, displayObjects: await dispObjs() });
  await page.screenshot({ path: `${out}/finale-reduced-24.png` });
} catch (e) { res.finale_FAILED = String(e).split('\n')[0]; }
res.errors = errors; console.log(JSON.stringify(res, null, 1));
if (ctx) await ctx.close();
await browser.close();
