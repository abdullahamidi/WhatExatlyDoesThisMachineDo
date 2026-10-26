// WP14 prestige smoke (new cycle, MEMORY tab, postgame path, confirm OFF, reduced motion, hard reset).
// Usage: PW_PATH=... node prestige.mjs <url> <outdir>
// Records keys only via ok(...) (no asserts). Every result key starts with prestige_ (plus errors / prestige_FAILED).
// Uses the WP14 debug hook (prestige, cycleState, finaleState, skipFinale, componentState, modalCount, systemMenuOpen,
// session.updateSettings) and the WP18b fields restoredTextures and textureKey; missing hook fields resolve to null, never throw.
// WP18b: RUN B records restoredSwapped / coreKey and pushes a mismatch into errors.
// WP22: restoredSwapped want 34 (D5 option A). RUN B also checks partTiers(): every TOP_TIERS track at its top tier at the postgame,
// every value MK I after the new cycle (settled within 3 s); a mismatch goes into errors, the list into tiersMiss.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
const errors = [], res = {};
const ok = (k, v) => { res[k] = v; };
const failedBuys = r => r.filter(x => !x.endsWith(':true'));
// WP22 top tier per repeatable track (PART_TIERS.md), compared with partTiers() in RUN B.
const TOP_TIERS = {
  gearRatio: 3, flywheel: 3, motorTuning: 5, improvedPistons: 5, copperWinding: 5, motorRetrofit: 5, transformer: 5,
  firebox: 5, inductionHeater: 5, condenser: 5, bellowsDrive: 3, harmonicCoil: 5, pressureResonator: 5, crankServo: 3,
  standingWave: 5, gridExciter: 3, containmentRing: 5, resonantSiphon: 3, graviticAnchor: 3, mainsBackfeed: 3, steamLance: 3,
};

// buy list up to the era V stage before primaryFunction (mirrors finale.mjs / stages.mjs S15)
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), ...Array(20).fill('resonantSiphon'), ...Array(10).fill('graviticAnchor'), 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', '@finalAlignment'];

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
// same buy helper as finale.mjs: 8 h jumps for '@<tech>' markers and for rejected buys
const buyList = buys => page.evaluate((buys) => {
  const s = window.__wedtmd.session; const o = []; let t = Date.now();
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of buys) {
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      o.push(id + ':' + (s.state.techLevels[tech] === 1));
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 64 && !r.ok; k++) { jump(); r = s.purchase(id); }
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
const prestige = () => page.evaluate(() => window.__wedtmd?.prestige?.() ?? null);
const cycleSnap = () => page.evaluate(() => window.__wedtmd?.cycleState?.() ?? null);
const fin = () => page.evaluate(() => window.__wedtmd?.finaleState?.() ?? null);
const phase = async () => (await fin())?.phase ?? null;
const endingPhase = () => page.evaluate(() => window.__wedtmd.session.state.ending.phase);
const modals = () => page.evaluate(() => window.__wedtmd.modalCount());
const menuOpen = () => page.evaluate(() => window.__wedtmd.systemMenuOpen());
const totalClicks = () => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
const restoredSwapped = () => page.evaluate(() => window.__wedtmd?.restoredTextures?.()?.swapped?.length ?? null);
const coreKey = () => page.evaluate(() => window.__wedtmd?.textureKey?.('nullCore') ?? null);
const tiersNow = () => page.evaluate(() => window.__wedtmd?.partTiers?.() ?? null);
// partTiers() mismatches: topMiss = every TOP_TIERS track at its top (a missing track counts); oneMiss = every value at MK I (absent tracks accepted).
const topMiss = t => t === null ? ['partTiers null'] : Object.entries(TOP_TIERS).filter(([id, top]) => t[id] !== top).map(([id, top]) => `${id}:${t[id] ?? null}/${top}`);
const oneMiss = t => t === null ? ['partTiers null'] : Object.entries(t).filter(([, v]) => v !== 1).map(([id, v]) => `${id}:${v}/1`);
// polls partTiers() up to 3 s until miss is empty (a tier beat may still be in flight); returns the last list
const tiersSettled = async miss => { let m = miss(await tiersNow()); for (let i = 0; i < 30 && m.length > 0; i++) { await page.waitForTimeout(100); m = miss(await tiersNow()); } return m; };
const hudCycle = () => page.evaluate(() => {
  const el = document.getElementById('hud-cycle');
  return el ? { text: (el.textContent || '').trim(), visible: !el.hidden && el.getClientRects().length > 0 } : null;
});
const toastHas = text => page.evaluate(t => [...document.querySelectorAll('#toast-stack .toast')].some(n => (n.textContent || '').includes(t)), text);
const confirmOpen = () => page.evaluate(() => { const d = document.getElementById('cycle-confirm'); return !!d && !d.hidden; });
const storedSave = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wedtmd.save')); } catch (e) { return null; } });
const storedPrestige = async () => (await storedSave())?.prestige ?? null;
const finaleCycleEnabled = () => page.evaluate(() => { const b = document.getElementById('finale-cycle'); return !!b && b.getAttribute('aria-disabled') !== 'true'; });
const nonzeroTechs = () => page.evaluate(() => Object.entries(window.__wedtmd.session.state.techLevels).filter(([, v]) => v > 0).map(([k]) => k).sort());
const resAllZero = () => page.evaluate(() => Object.values(window.__wedtmd.session.state.res).every(v => v === 0));
const keepClick = () => page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 }).catch(e => errors.push('prestige_keep_click: ' + String(e).split('\n')[0]));
const shot = name => page.screenshot({ path: `${out}/prestige-${name}.png` });

// Runs to the finale choice: fast-forward, buy primaryFunction, skip the film (KEEP / BEGIN buttons up).
const toChoice = async () => {
  const buyFail = failedBuys(await fastForward());
  await buyList(['primaryFunction']);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__wedtmd?.skipFinale?.());
  await page.waitForTimeout(300);
  return { buyFail, phase: await phase() };
};
// Runs to postgame: choice, then KEEP IT RUNNING.
const toPostgame = async () => {
  await keepClick();
  for (let i = 0; i < 20 && (await endingPhase()) !== 'postgame'; i++) await page.waitForTimeout(100);
  return endingPhase();
};
// Waits for the transition: samples alpha and game clock until it ends (or 15 s wall).
const runTransition = async () => {
  const t0 = Date.now(); let started = false, maxAlpha = 0, lastT = 0, done = false;
  while (Date.now() - t0 < 15000) {
    const s = await cycleSnap();
    if (s && s.transition.active) {
      started = true;
      maxAlpha = Math.max(maxAlpha, s.transition.alpha);
      lastT = s.transition.tMs;
    } else if (started) { done = true; break; }
    await page.waitForTimeout(50);
  }
  return { started, done, maxAlpha, lastTMs: lastT, wallMs: Date.now() - t0, busy: (await cycleSnap())?.busy ?? null };
};
const openMenuTab = async tab => {
  if (!(await menuOpen())) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await page.click(`#sys-tab-${tab}`); await page.waitForTimeout(150);
};

try {
  // ---------- RUN A: (1) cycle 2 via the finale, (2) MEMORY tab, (6) hard reset in cycle 2 ----------
  await open();
  const choiceA = await toChoice();
  ok('prestige_0_choice', choiceA);
  // (1) the BEGIN A NEW CYCLE button opens the confirm dialog with the gain line
  await page.click('#finale-cycle'); await page.waitForTimeout(250);
  const gain1 = await page.evaluate(() => document.getElementById('cycle-confirm-gain')?.textContent ?? null);
  ok('prestige_1_dialog', { open: await confirmOpen(), gain: gain1, modals: await modals(), enabled: await finaleCycleEnabled() });
  await shot('1a-dialog');
  // CANCEL: nothing changes
  await page.click('#cycle-confirm-cancel'); await page.waitForTimeout(250);
  ok('prestige_1_cancel', { open: await confirmOpen(), prestige: await prestige(), phase: await phase(), modals: await modals(), transition: (await cycleSnap())?.transition ?? null });
  // BEGIN: transition starts; sample it to the end
  await page.click('#finale-cycle'); await page.waitForTimeout(250);
  await page.click('#cycle-confirm-begin');
  const tr1 = await runTransition();
  ok('prestige_1_transition', tr1);
  await page.waitForTimeout(300);
  const pAfter = await prestige();
  const hud1 = await hudCycle();
  const st1 = await page.evaluate(() => {
    const s = window.__wedtmd.session;
    return { lifetimeXf: s.state.lifetime.xf, cycles: s.stats.cycles, bestCycleSeconds: s.stats.bestCycleSeconds, ending: s.state.ending.phase };
  });
  ok('prestige_1_after', {
    prestige: pAfter, modals: await modals(), hud: hud1, toastCycle: await toastHas('CYCLE 0043'), toastEchoes: await toastHas('+3 ECHOES'),
    resAllZero: await resAllZero(), techs: await nonzeroTechs(), ending: st1.ending, stats: { cycles: st1.cycles, bestCycleSeconds: st1.bestCycleSeconds },
    genVisible: (await page.evaluate(() => window.__wedtmd.componentState('generator')))?.visible ?? null,
    finale: (await fin())?.phase ?? null, finaleT: (await fin())?.t ?? null,
  });
  // record newCycle: the cycle event reached the toast layer and the debug state agrees
  ok('prestige_1_record', { cycle: pAfter?.cycle ?? null, toast: await toastHas('CYCLE 0043'), busy: (await cycleSnap())?.busy ?? null });
  await shot('1b-after');
  const storedBefore = await storedPrestige();
  ok('prestige_1_saved', { present: storedBefore !== null, value: storedBefore });
  // reload: same prestige, HUD cycle line, crank works
  await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForTimeout(300);
  ok('prestige_1_reload', { prestige: await prestige(), hud: await hudCycle(), modals: await modals() });
  const c1 = await totalClicks(); await crankClick(); await page.waitForTimeout(150);
  ok('prestige_1_crank', { delta: (await totalClicks()) - c1 });

  // (2) MEMORY tab
  await openMenuTab('memory');
  const mem0 = await page.evaluate(() => ({
    echoes: document.querySelector('.mem-echoes')?.textContent ?? null,
    unspent: document.querySelector('.mem-unspent')?.textContent ?? null,
  }));
  ok('prestige_2_memory_head', mem0);
  await shot('2a-memory');
  await page.click('[data-perk-id="residualCharge"] .mem-buy'); await page.waitForTimeout(200);
  const rc = await page.evaluate(() => ({
    status: document.querySelector('[data-perk-id="residualCharge"] .mem-status')?.textContent ?? null,
    unspent: document.querySelector('.mem-unspent')?.textContent ?? null,
  }));
  ok('prestige_2_residual', rc);
  await page.click('[data-perk-id="muscleMemory"] .mem-buy'); await page.waitForTimeout(200);
  const mm = await page.evaluate(() => ({
    status: document.querySelector('[data-perk-id="muscleMemory"] .mem-status')?.textContent ?? null,
    unspent: document.querySelector('.mem-unspent')?.textContent ?? null,
    wornMotor: window.__wedtmd.session.state.techLevels.wornMotor,
    gearRatio: window.__wedtmd.session.state.techLevels.gearRatio,
  }));
  ok('prestige_2_muscle', mm);
  const locked = await page.evaluate(() => ['servoRecall', 'ledger', 'longSilence'].map(id => {
    const b = document.querySelector(`[data-perk-id="${id}"] .mem-buy`);
    const st = document.querySelector(`[data-perk-id="${id}"] .mem-status`);
    return { id, disabled: b ? b.disabled : null, status: st?.textContent ?? null };
  }));
  ok('prestige_2_locked', locked);
  await shot('2b-memory-bought');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);

  // (6) hard reset in cycle 2 (SYSTEM -> RESET PROGRESS, two presses)
  await openMenuTab('system');
  await page.click('#sys-reset'); await page.click('#sys-reset'); await page.waitForTimeout(500);
  if (await menuOpen()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  ok('prestige_6_reset', { prestige: await prestige(), hud: await hudCycle(), storedPrestige: await storedPrestige(), modals: await modals() });
  await shot('6-reset');

  // ---------- RUN B: (3) postgame path: KEEP IT RUNNING -> SYSTEM row -> confirm -> cycle 2 ----------
  await open();
  await toChoice();
  const pg = await toPostgame();
  await page.waitForTimeout(300);
  const pgSwapped = await restoredSwapped(), pgCore = await coreKey();
  const pgTiers = await tiersSettled(topMiss);
  ok('prestige_3_postgame', { phase: pg, modals: await modals(), restoredSwapped: pgSwapped, coreKey: pgCore, tiersMiss: pgTiers });
  if (pgSwapped !== 34) errors.push(`prestige_3_postgame restoredSwapped ${pgSwapped} want 34`);
  if (pgTiers.length > 0) errors.push(`prestige_3_postgame tiers top mismatch: ${pgTiers.join(', ')}`);
  if (pgCore !== 'machine.nullCore#restored#rot') errors.push(`prestige_3_postgame coreKey ${pgCore} want machine.nullCore#restored#rot`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('#sys-tab-system'); await page.waitForTimeout(150);
  const row = await page.evaluate(() => {
    const b = document.getElementById('sys-new-cycle'); const r = document.getElementById('sys-new-cycle-reason');
    return { visible: !!b && !b.hidden, disabled: b?.getAttribute('aria-disabled') === 'true', reasonVisible: !!r && !r.hidden };
  });
  ok('prestige_3_row', row);
  await page.click('#sys-new-cycle'); await page.waitForTimeout(250);
  ok('prestige_3_confirm', { open: await confirmOpen(), gain: await page.evaluate(() => document.getElementById('cycle-confirm-gain')?.textContent ?? null) });
  await page.click('#cycle-confirm-begin');
  const tr3 = await runTransition();
  await page.waitForTimeout(300);
  const afterSwapped = await restoredSwapped(), afterCore = await coreKey();
  const afterTiers = await tiersSettled(oneMiss);
  ok('prestige_3_after', { transition: tr3, prestige: await prestige(), hud: await hudCycle(), modals: await modals(), menuOpen: await menuOpen(), restoredSwapped: afterSwapped, coreKey: afterCore, tiersMiss: afterTiers });
  if (afterSwapped !== 0) errors.push(`prestige_3_after restoredSwapped ${afterSwapped} want 0 (new cycle swaps back)`);
  if (afterCore !== 'machine.nullCore#rot') errors.push(`prestige_3_after coreKey ${afterCore} want machine.nullCore#rot`);
  if (afterTiers.length > 0) errors.push(`prestige_3_after tiers not MK I: ${afterTiers.join(', ')}`);
  await shot('3-postgame-cycle2');

  // ---------- RUN C: (4) SETTINGS confirm OFF -> begin starts the transition directly ----------
  await open();
  await toChoice();
  await toPostgame();
  // Escape opens the menu in postgame (no modal open); the menu stays open for the whole step.
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('#sys-tab-settings'); await page.waitForTimeout(150);
  await page.locator('button', { hasText: 'CONFIRM NEW CYCLE' }).first().click({ timeout: 5000 }).catch(e => errors.push('prestige_settings_click: ' + String(e).split('\n')[0]));
  await page.waitForTimeout(200);
  const setting = await page.evaluate(() => window.__wedtmd.session.settings.confirmNewCycle);
  await shot('4a-settings-off');
  await page.click('#sys-tab-system'); await page.waitForTimeout(150);
  await page.click('#sys-new-cycle'); await page.waitForTimeout(120);
  const directOpen = await confirmOpen();
  const direct = await runTransition();
  await page.waitForTimeout(300);
  ok('prestige_4_confirm_off', { confirmNewCycle: setting, dialogOpened: directOpen, transition: direct, prestige: await prestige(), hud: await hudCycle() });

  // ---------- RUN D: (5) reduced motion ON -> transition ends <= 1.2 s game time ----------
  await open();
  await toChoice();
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await page.waitForTimeout(100);
  await page.click('#finale-cycle'); await page.waitForTimeout(250);
  await page.click('#cycle-confirm-begin');
  const red = await runTransition();
  await page.waitForTimeout(300);
  ok('prestige_5_reduced', { transition: red, gameMsOk: red.lastTMs <= 1200, prestige: await prestige(), modals: await modals() });
  await shot('5-reduced-after');
} catch (e) { res.prestige_FAILED = String(e).split('\n')[0]; }
res.errors = errors; console.log(JSON.stringify(res, null, 1));
if (ctx) await ctx.close();
await browser.close();
