// WP15 profiling smoke + budgets (WP15R: era stages, GPU/headed launch, renderer probe, post windows, CPU profile).
// Usage: PW_PATH=<playwright dir> [PERF_STRICT=1] [PERF_GPU=1] [PERF_HEADED=1] [PERF_PROFILE=1] [ONLY=s0_crank,finale] node scripts/smoke/perf.mjs <url> [outdir]
// <url>: when it has no `debug` query param, debug=1 is added before every goto (the hook window.__wedtmd needs it).
// PERF_GPU=1: Chromium launched with the real GPU (ANGLE d3d11, blocklist ignored). Gates frameP95Ms and postFrameP95Ms
//   (GPU-only keys). A software renderer under PERF_GPU=1 is a fail. Without it the frame keys are report-only.
// PERF_HEADED=1: headed launch (fallback when headless reports SwiftShader).
// PERF_PROFILE=1: CDP CPU profiles of post repeat #1, the keystone window and idle window #3; `top` = 10 entries {fn, selfMs},
//   (idle), (program) and (root) excluded; (garbage collector) kept; .cpuprofile files written into outdir.
//   Profile results: stage.post.repeat.top, stage.post.keystone.top, stage.idleTop (paths: profileFile, idleProfileFile).
// PERF_STRICT=1: exit 1 when fail is non-empty (console/page errors count as a failure).
// PERF_<METRIC>: overrides a budget (camelCase -> SCREAMING_SNAKE, e.g. PERF_MACHINE_MEAN_MS).
// Stages (buy lists = scripts/smoke/stages.mjs WP17 lists, fresh context each): s0_crank, s7_era1_full, s9_era2_full,
//   s11_era3_full, s13_era4_full, s15_era5_full, s16_postgame, then finale.
// Per stage idle: 10 s warm-up, then 3 windows of 2 s (frame deltas -> frameP50Ms / frameP95Ms / frameMaxMs; each window
//   also reads the machine / ui / displayObjects / audio probes, medians gate, raw max is machineMaxMsRaw).
// Post-purchase windows (s7, s11, s15): POST_REPEATS (3) windows buying the repeat tech, then (after the prep buys) one keystone window; s15 has no keystone; each window = settle 1 s,
//   the purchase, then 3 s with frame and probe readings. Result in stage.post = { repeat, keystone } (gate postMachineMaxMs,
//   postFrameP95Ms).
// s15 also: tech tree probe (era V tab, median of 5 sync opens + forced layout) and heap probe (after gc, then 30 s idle).
// s16 also: new cycle after the postgame settle (WP14 button); displayObjects compared with the pre-cycle count (no leak).
// s0: audioWiring probe (MUSIC slider -> music bus); result in metrics.audioWiring, fail 'audioWiring' when ok === false.
// Finale: fresh context, buy list S15 + primaryFunction, finaleSeek to t 8 / 22 / 34 / 36 (2 s window each).
// Audio: expected era s7..s15 = 1..5 (fail audioEra <stage>); s16 theme = restored (fail audioTheme).
// metrics.renderer = the WebGL renderer / vendor strings and whether the renderer is software (SwiftShader / llvmpipe).
// Output: ONE JSON { metrics, budgets, fail, errors } on stdout; <outdir>/perf.json when outdir is given.
// Every probe is read null-safe: a missing hook field is reported as null and never throws.
// Budgets: scripts/smoke/perf-budget.json. Medians: stage means and stage maxes gate on the median of the 3 windows.
// Numbers are noisy on a CPU-loaded machine: report the median of 3 runs (scripts/perf/perf-median.mjs).
import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const [url, out] = process.argv.slice(2);
if (!url || !process.env.PW_PATH) {
  console.error('usage: PW_PATH=<playwright dir> node scripts/smoke/perf.mjs <url> [outdir]');
  process.exit(2);
}
const target = (() => { const u = new URL(url); if (!u.searchParams.has('debug')) u.searchParams.set('debug', '1'); return u.toString(); })();
const { chromium } = require(process.env.PW_PATH);

// ---- budgets -------------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const budgetFile = JSON.parse(readFileSync(join(here, 'perf-budget.json'), 'utf8'));
const envName = (k) => 'PERF_' + k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const budgets = {};
for (const [k, v] of Object.entries(budgetFile)) {
  if (typeof v !== 'number') continue; // "bundle" block belongs to scripts/perf/bundle-budget.mjs
  const raw = process.env[envName(k)];
  const n = raw === undefined ? NaN : Number(raw);
  budgets[k] = Number.isFinite(n) ? n : v;
}
const STRICT = process.env.PERF_STRICT === '1';
const GPU = process.env.PERF_GPU === '1';
const HEADED = process.env.PERF_HEADED === '1';
const PROFILE = process.env.PERF_PROFILE === '1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const wanted = (name) => ONLY === null || ONLY.includes(name);

// ---- stats helpers -------------------------------------------------------------------------------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v) => (num(v) === null ? null : Math.round(v * 100) / 100);
const med = (xs) => {
  const a = xs.map(num).filter((v) => v !== null).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const m = a.length >> 1;
  return a.length % 2 === 1 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const max = (xs) => {
  let best = null;
  for (const x of xs) {
    const v = num(x);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
};
const pctile = (xs, p) => {
  const a = xs.map(num).filter((v) => v !== null).sort((x, y) => x - y);
  return a.length === 0 ? null : a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
};
const MB = 1e6;

// ---- stage buy lists (stages.mjs) ----------------------------------------------------------------
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', ...Array(3).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', ...Array(5).fill('gridExciter'), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', ...Array(5).fill('mainsBackfeed'), ...Array(5).fill('steamLance'), '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];

const STAGES = [
  { name: 's0_crank', buys: [] },
  { name: 's7_era1_full', buys: S7 },
  { name: 's9_era2_full', buys: S9 },
  { name: 's11_era3_full', buys: S11 },
  { name: 's13_era4_full', buys: S13 },
  { name: 's15_era5_full', buys: S15 },
  { name: 's16_postgame', buys: S16, postgame: true },
];
// Post-purchase windows: repeat = a repeatable tech bought POST_REPEATS times (one window each); keystone = one purchase
//   after the prep buys (keystone null = none). Window = settle, purchase, POST_WINDOW_MS with frame and probe readings.
const POST = {
  s7_era1_full: { repeat: 'gearRatio', prep: ['@blueprint'], keystone: 'generator' },
  s11_era3_full: { repeat: 'bellowsDrive', prep: [], keystone: 'resonatorSpire' },
  s15_era5_full: { repeat: 'steamLance', prep: [], keystone: null },
};
const POST_REPEATS = 3, POST_SETTLE_MS = 1000, POST_WINDOW_MS = 3000;
const EXPECT_ERA = { s7_era1_full: 1, s9_era2_full: 2, s11_era3_full: 3, s13_era4_full: 4, s15_era5_full: 5 };
const FINALE_T = [8, 22, 34, 36];

// Same buy helper as stages.mjs: '@<tech>:<n>' buys to level n, 8 h jumps for '@<tech>' markers and for rejected buys.
const buyFn = (buys) => {
  const s = window.__wedtmd.session; const o = []; let t = Math.max(Date.now(), s.state.lastSimTime);
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
};

// ---- page helpers --------------------------------------------------------------------------------
// WebGL renderer of a probe canvas (not the game canvas). software = SwiftShader / llvmpipe / basic render.
async function rendererProbe(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { renderer: null, vendor: null, software: null };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const software = /swiftshader|llvmpipe|software|basic render/i.test(String(renderer));
    return { renderer, vendor, software };
  });
}

async function openPage(browser, label, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${label}: pageerror: ${e.message}`));
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  if (res.renderer === null) res.renderer = await rendererProbe(page).catch(() => null);
  // rAF frame deltas, recorded for the whole page life; each window clears the array when it starts
  await page.evaluate(() => {
    window.__wedtmdFrames = [];
    let last = null;
    const tick = (t) => { if (last !== null) window.__wedtmdFrames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  return { ctx, page };
}

async function probes(page) {
  return page.evaluate(() => {
    const h = window.__wedtmd;
    return {
      machine: h?.machineStats?.() ?? null,
      ui: h?.uiStats?.() ?? null,
      displayObjects: h?.displayObjects?.() ?? null,
      finaleMeanMs: h?.finaleState?.()?.meanMs ?? null,
      audio: h?.audioStats?.() ?? null,
    };
  });
}

// One 2 s window: the probe rings hold ~120 frames, so each read covers the window that just passed.
async function sampleWindow(page) {
  await page.evaluate(() => { window.__wedtmdFrames = []; });
  await page.waitForTimeout(2000);
  const p = await probes(page);
  const frames = await page.evaluate(() => { const f = window.__wedtmdFrames ?? []; window.__wedtmdFrames = []; return f; });
  return { ...p, frames };
}

async function techTreeProbe(page) {
  try {
    await page.click('#hud-tech'); await page.waitForTimeout(300);
    await page.click('#tech-tab-5').catch(() => {});
    await page.waitForTimeout(150);
    const eraVSelected = await page.evaluate(() => document.getElementById('tech-tab-5')?.getAttribute('aria-selected') === 'true');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const dt = await page.evaluate(() => {
        const btn = document.getElementById('hud-tech');
        if (!btn) return null;
        const t0 = performance.now();
        btn.click();                                            // synchronous open
        document.getElementById('tech-tabs')?.getBoundingClientRect(); // forced layout
        document.getElementById('tech-edges')?.getBoundingClientRect();
        void document.body.offsetHeight;
        return performance.now() - t0;
      });
      samples.push(num(dt));
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    }
    return { medianMs: round(med(samples)), samplesMs: samples.map(round), eraVSelected };
  } catch (e) {
    return { medianMs: null, samplesMs: [], eraVSelected: null, error: String(e).split('\n')[0] };
  }
}

async function heapProbe(page) {
  const read = () => page.evaluate(() => { window.gc?.(); return performance.memory?.usedJSHeapSize ?? null; });
  const h0 = num(await read());
  await page.waitForTimeout(30000);
  const h1 = num(await read());
  return {
    usedMb: h1 === null ? null : round(h1 / MB),
    startMb: h0 === null ? null : round(h0 / MB),
    growthMb: h0 === null || h1 === null ? null : round((h1 - h0) / MB),
  };
}

async function cycleProbe(page, baseline) {
  try {
    const hook = await page.evaluate(() => typeof window.__wedtmd?.cycleState === 'function' && typeof window.__wedtmd?.prestige === 'function');
    if (!hook) return { skipped: 'hook missing' };
    const c0 = await page.evaluate(() => window.__wedtmd.prestige().cycle);
    // baseline = the display list just before the new cycle: parts are hidden, not destroyed, on a new cycle,
    // so the check is "no growth across a cycle" (no leak), not "shrinks back to s0".
    const pre = num(await page.evaluate(() => window.__wedtmd.displayObjects()));
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await page.click('#sys-tab-system'); await page.waitForTimeout(150);
    const enabled = await page.evaluate(() => { const b = document.getElementById('sys-new-cycle'); return !!b && b.getAttribute('aria-disabled') !== 'true'; });
    if (!enabled) return { skipped: 'new cycle row missing or disabled' };
    await page.click('#sys-new-cycle'); await page.waitForTimeout(250);
    const confirm = await page.evaluate(() => { const d = document.getElementById('cycle-confirm'); return !!d && !d.hidden; });
    if (confirm) await page.click('#cycle-confirm-begin');
    let done = false;
    for (let i = 0; i < 150 && !done; i++) {               // up to 15 s
      await page.waitForTimeout(100);
      done = await page.evaluate((c) => window.__wedtmd.prestige().cycle > c && window.__wedtmd.cycleState().transition.active === false, c0);
    }
    await page.waitForTimeout(3000);
    const after = num(await page.evaluate(() => window.__wedtmd.displayObjects()));
    const base = pre ?? num(baseline);
    return {
      cycleBefore: c0,
      cycleAfter: await page.evaluate(() => window.__wedtmd.prestige().cycle),
      done,
      displayObjects: after,
      baseline: base,
      s0Display: num(baseline),
      pct: after === null || base === null || base === 0 ? null : round((after / base - 1) * 100),
    };
  } catch (e) {
    return { skipped: 'probe threw: ' + String(e).split('\n')[0] };
  }
}

// CDP CPU profile (PERF_PROFILE only; null otherwise).
async function startProfile(page) {
  if (!PROFILE) return null;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  return cdp;
}

// Self time per function = hitCount x mean sample interval, (idle), (program) and (root) excluded; (garbage collector) kept. top = 10 largest, descending.
// The .cpuprofile is written into outdir when one is given.
async function stopProfile(cdp, stage, label) {
  if (cdp === null) return { top: null, file: null };
  let profile;
  try {
    ({ profile } = await cdp.send('Profiler.stop'));
  } finally {
    await cdp.detach().catch(() => {});
  }
  const samples = Math.max(1, profile.samples ? profile.samples.length : 1);
  const perHitMs = (profile.endTime - profile.startTime) / 1000 / samples;
  const selfByFn = new Map();
  for (const node of profile.nodes) {
    const cf = node.callFrame;
    if (cf.functionName === '(idle)' || cf.functionName === '(program)' || cf.functionName === '(root)') continue;
    const key = `${cf.functionName || '(anonymous)'} ${cf.url}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    selfByFn.set(key, (selfByFn.get(key) ?? 0) + (node.hitCount ?? 0) * perHitMs);
  }
  const top = [...selfByFn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fn, selfMs]) => ({ fn, selfMs: round(selfMs) }));
  let file = null;
  if (out) {
    mkdirSync(out, { recursive: true });
    file = join(out, `${stage}-${label}.cpuprofile`);
    writeFileSync(file, JSON.stringify(profile));
  }
  return { top, file };
}

// One post-purchase window. Outside the window: 8 h jumps (max 6) until the tech is affordable, then settle.
// Window: purchase, probes at 2 s and POST_WINDOW_MS, frames of the whole window. label 'repeat' | 'keystone' | null (no profile).
async function postWindow(page, id, stage, label) {
  await page.evaluate((id) => {
    const s = window.__wedtmd.session;
    let t = Math.max(Date.now(), s.state.lastSimTime);
    for (let k = 0; k < 6 && !s.getTechView(id).affordable; k++) { t += 8 * 3600 * 1000; s.update(t); }
  }, id);
  await page.waitForTimeout(POST_SETTLE_MS);
  await page.evaluate(() => { window.__wedtmdFrames = []; });
  const cdp = label === null ? null : await startProfile(page);
  const ok = await page.evaluate((id) => window.__wedtmd.session.purchase(id).ok, id);
  await page.waitForTimeout(2000);
  const A = await probes(page);
  await page.waitForTimeout(POST_WINDOW_MS - 2000);
  const B = await probes(page);
  const prof = await stopProfile(cdp, stage, label);
  const frames = await page.evaluate(() => { const f = window.__wedtmdFrames ?? []; window.__wedtmdFrames = []; return f; });
  return {
    id,
    ok,
    frames: frames.length,
    frameP95Ms: round(pctile(frames, 0.95)),
    frameMaxMs: round(max(frames)),
    machineMeanMs: round(max([A.machine?.meanMs, B.machine?.meanMs])),
    machineMaxMs: round(max([A.machine?.maxMs, B.machine?.maxMs])),
    uiMaxMs: round(max([A.ui?.maxMs, B.ui?.maxMs])),
    displayObjects: num(B.displayObjects),
    top: prof.top,
    profileFile: prof.file,
  };
}

// Post windows of a POST stage: POST_REPEATS repeat windows (profile on #1), then the keystone window.
// An error is pushed to errors; the windows collected so far are kept.
async function runPost(page, stage, errors) {
  const cfg = POST[stage];
  if (!cfg) return null;
  const wins = [];
  let keystone = null;
  try {
    for (let i = 0; i < POST_REPEATS; i++) wins.push(await postWindow(page, cfg.repeat, stage, i === 0 ? 'repeat' : null));
    if (cfg.keystone !== null) {
      if (cfg.prep.length > 0) await page.evaluate(buyFn, cfg.prep);
      keystone = await postWindow(page, cfg.keystone, stage, 'keystone');
    }
  } catch (e) {
    errors.push(`${stage}: post ${String(e).split('\n')[0]}`);
  }
  const repeat = wins.length === 0 ? null : {
    id: cfg.repeat,
    ok: wins.map((w) => w.ok),
    frameP95Ms: round(med(wins.map((w) => w.frameP95Ms))),
    frameMaxMs: round(max(wins.map((w) => w.frameMaxMs))),
    machineMeanMs: round(med(wins.map((w) => w.machineMeanMs))),
    machineMaxMs: round(med(wins.map((w) => w.machineMaxMs))),
    machineMaxMsRaw: round(max(wins.map((w) => w.machineMaxMs))),
    uiMaxMs: round(med(wins.map((w) => w.uiMaxMs))),
    displayObjects: max(wins.map((w) => w.displayObjects)),
    top: wins[0].top,
    profileFile: wins[0].profileFile,
  };
  return repeat === null && keystone === null ? null : { repeat, keystone };
}

// s0 audioWiring: MUSIC slider 0 -> music bus 0 and no music voices; 70 -> bus back at its pre-probe level.
// Never throws. ok null = levels missing (build without the music bus readout).
async function audioWiringProbe(page) {
  try {
    const read = () => page.evaluate(() => {
      const a = window.__wedtmd?.audioStats?.() ?? null;
      return a === null ? null : { unlocked: a.unlocked === true, musicBus: typeof a.levels?.musicBus === 'number' ? a.levels.musicBus : null, musicVoices: typeof a.musicVoices === 'number' ? a.musicVoices : null };
    });
    const setSlider = (v) => page.$eval('#sys-set-musicVolume', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    for (let i = 0; i < 3; i++) await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(1000);
    const before = await read();
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.__wedtmd?.systemMenuOpen?.() === true))) return { ok: null, error: 'menu did not open' };
    await page.click('#sys-tab-settings'); await page.waitForTimeout(150);
    await setSlider('0'); await page.waitForTimeout(600);
    const at0 = await read();
    await page.waitForTimeout(2000);
    const voices0 = await read();
    await setSlider('70'); await page.waitForTimeout(600);
    const at70 = await read();
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const unlocked = before?.unlocked ?? null;
    const musicBusBefore = before?.musicBus ?? null;
    const musicBusAt0 = at0?.musicBus ?? null;
    const musicVoicesAt0 = voices0?.musicVoices ?? null;
    const musicBusAt70 = at70?.musicBus ?? null;
    const ok = musicBusBefore === null || musicBusAt0 === null || musicBusAt70 === null ? null
      : unlocked === true && musicBusAt0 === 0 && musicVoicesAt0 === 0 && Math.abs(musicBusAt70 - musicBusBefore) < 1e-9;
    return { ok, unlocked, musicBusBefore, musicBusAt0, musicVoicesAt0, musicBusAt70 };
  } catch (e) {
    return { ok: null, error: String(e).split('\n')[0] };
  }
}

// ---- stages --------------------------------------------------------------------------------------
async function runStage(browser, st, ctxRes, errors, frames) {
  const { ctx, page } = await openPage(browser, st.name, errors);
  const rec = { buyFailed: null };
  try {
    if (st.name === 's0_crank') {
      // marks are absolute performance.now() values; navigation start is 0 on that clock (subtracted anyway)
      const marks = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const m = window.__wedtmd?.perfMarks?.() ?? null;
        return m === null ? null : { navStartMs: nav ? nav.startTime : 0, bootStartMs: m.bootStartMs, firstFrameMs: m.firstFrameMs };
      });
      if (marks !== null) {
        const firstFrame = marks.firstFrameMs > 0 ? marks.firstFrameMs : null;
        const boot = marks.bootStartMs > 0 ? marks.bootStartMs : null;
        ctxRes.boot = {
          navToBootMs: round(boot === null ? null : boot - marks.navStartMs),
          bootMs: round(firstFrame === null ? null : firstFrame - marks.navStartMs),
          bootToFirstFrameMs: round(firstFrame === null || boot === null ? null : firstFrame - boot),
        };
      }
    }
    if (st.buys.length > 0) {
      const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
      for (let i = 0; i < 45; i++) await page.mouse.click(pt.x, pt.y);
      const buy = await page.evaluate(buyFn, st.buys);
      rec.buyFailed = buy.filter((x) => !x.endsWith(':true'));
    }
    if (st.postgame) {
      await page.evaluate(() => window.__wedtmd?.skipFinale?.());
      await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 })
        .catch((e) => errors.push(`${st.name}: keep ${String(e).split('\n')[0]}`));
    }
    await page.waitForTimeout(10000); // warm-up
    const samples = [];
    for (let k = 0; k < 3; k++) {
      if (k === 2 && PROFILE) {                             // idle window #3 = CPU profile
        const cdp = await startProfile(page);
        samples.push(await sampleWindow(page));
        const prof = await stopProfile(cdp, st.name, 'idle');
        rec.idleTop = prof.top;
        rec.idleProfileFile = prof.file;
      } else {
        samples.push(await sampleWindow(page));
      }
    }
    for (const s of samples) frames.push(...s.frames);

    const running = samples.filter((s) => s.audio?.running === true);
    const stageFrames = samples.flatMap((s) => s.frames);
    const lastAudio = samples[samples.length - 1]?.audio ?? null;
    Object.assign(rec, {
      samples: samples.length,
      frameP50Ms: round(pctile(stageFrames, 0.5)),
      frameP95Ms: round(pctile(stageFrames, 0.95)),
      frameMaxMs: round(max(stageFrames)),
      machineMeanMs: round(med(samples.map((s) => s.machine?.meanMs))),
      machineMaxMs: round(med(samples.map((s) => s.machine?.maxMs))),
      machineMaxMsRaw: round(max(samples.map((s) => s.machine?.maxMs))),
      components: samples[samples.length - 1]?.machine?.components ?? null,
      uiMeanMs: round(med(samples.map((s) => s.ui?.meanMs))),
      uiMaxMs: round(med(samples.map((s) => s.ui?.maxMs))),
      uiMaxMsRaw: round(max(samples.map((s) => s.ui?.maxMs))),
      displayObjects: max(samples.map((s) => s.displayObjects)),
      audio: {
        present: samples.some((s) => s.audio !== null && s.audio !== undefined),
        running: running.length > 0,
        liveVoices: running.length ? max(running.map((s) => s.audio.liveVoices)) : null,
        musicVoices: running.length ? max(running.map((s) => s.audio.musicVoices)) : null,
        peakDb: running.length ? max(running.map((s) => s.audio.peakDb)) : null,
        era: num(lastAudio?.ambient?.era),
        theme: typeof lastAudio?.theme === 'string' ? lastAudio.theme : null,
        musicBus: num(lastAudio?.levels?.musicBus),
      },
    });
    if (st.name === 's0_crank') ctxRes.audioWiring = await audioWiringProbe(page);
    if (st.name === 's15_era5_full') {
      rec.techTree = await techTreeProbe(page);
      rec.heap = await heapProbe(page);
    }
    if (POST[st.name]) rec.post = await runPost(page, st.name, errors);
    if (st.name === 's16_postgame') {
      rec.cycle = await cycleProbe(page, ctxRes.s0Display);
    }
  } finally {
    ctxRes.stages[st.name] = rec;
    await ctx.close();
  }
  return rec;
}

async function runFinale(browser, errors, frames) {
  const { ctx, page } = await openPage(browser, 'finale', errors);
  const out = {};
  try {
    const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    for (let i = 0; i < 45; i++) await page.mouse.click(pt.x, pt.y);
    await page.evaluate(buyFn, S15);
    const buy = await page.evaluate(buyFn, ['primaryFunction']);
    out.buyFailed = buy.filter((x) => !x.endsWith(':true'));
    await page.waitForTimeout(300);
    for (const t of FINALE_T) {
      await page.evaluate((t) => window.__wedtmd?.finaleSeek?.(t), t);
      const s = await sampleWindow(page);
      frames.push(...s.frames);
      out[`t${t}`] = {
        finaleMeanMs: round(s.finaleMeanMs),
        machineMeanMs: round(s.machine?.meanMs),
        machineMaxMs: round(s.machine?.maxMs),
        uiMeanMs: round(s.ui?.meanMs),
        uiMaxMs: round(s.ui?.maxMs),
        displayObjects: num(s.displayObjects),
      };
    }
  } catch (e) {
    out.error = String(e).split('\n')[0];
  } finally {
    await ctx.close();
  }
  return out;
}

// ---- run -----------------------------------------------------------------------------------------
const errors = [];
const frames = [];
const res = { boot: null, stages: {}, finale: null, s0Display: null, renderer: null, audioWiring: null };
const args = ['--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required'];
if (GPU) args.push('--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist');
const browser = await chromium.launch({ headless: !HEADED, args });
try {
  for (const st of STAGES) {
    if (!wanted(st.name)) continue;
    try {
      const rec = await runStage(browser, st, res, errors, frames);
      if (st.name === 's0_crank') res.s0Display = rec.displayObjects ?? null;
    } catch (e) {
      errors.push(`${st.name}: ${String(e).split('\n')[0]}`);
    }
  }
  if (wanted('finale')) {
    try {
      res.finale = await runFinale(browser, errors, frames);
    } catch (e) {
      errors.push(`finale: ${String(e).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
}

// ---- gate ----------------------------------------------------------------------------------------
const stageRecs = Object.values(res.stages);
const finaleRecs = res.finale ? FINALE_T.map((t) => res.finale[`t${t}`]).filter(Boolean) : [];
const postRecs = stageRecs.flatMap((s) => [s.post?.repeat, s.post?.keystone]).filter(Boolean);
const gateVals = {
  machineMeanMs: max(stageRecs.map((s) => s.machineMeanMs)),
  machineMaxMs: max(stageRecs.map((s) => s.machineMaxMs)),
  uiMeanMs: max(stageRecs.map((s) => s.uiMeanMs)),
  uiMaxMs: max(stageRecs.map((s) => s.uiMaxMs)),
  finaleMeanMs: max(finaleRecs.map((f) => f.finaleMeanMs)),
  displayObjects: max([res.stages.s15_era5_full?.displayObjects, res.stages.s16_postgame?.displayObjects, res.finale?.t34?.displayObjects]),
  techTreeOpenMs: res.stages.s15_era5_full?.techTree?.medianMs ?? null,
  heapMb: res.stages.s15_era5_full?.heap?.usedMb ?? null,
  heapGrowthMb: res.stages.s15_era5_full?.heap?.growthMb ?? null,
  bootMs: res.boot?.bootMs ?? null,
  liveVoices: max(stageRecs.map((s) => s.audio?.liveVoices)),
  musicVoices: max(stageRecs.map((s) => s.audio?.musicVoices)),
  peakDbfs: max(stageRecs.map((s) => s.audio?.peakDb)),
  frameP95Ms: pctile(frames, 0.95),
  postMachineMaxMs: max(postRecs.map((p) => p.machineMaxMs)),
  postFrameP95Ms: max(postRecs.map((p) => p.frameP95Ms)),
  cycleDisplayPct: res.stages.s16_postgame?.cycle?.pct ?? null,
};
const GPU_ONLY = ['frameP95Ms', 'postFrameP95Ms'];
const fail = [];
for (const [key, value] of Object.entries(gateVals)) {
  const limit = budgets[key];
  if (limit === undefined || num(value) === null) continue;
  if (GPU_ONLY.includes(key) && !GPU) continue; // report-only without a GPU
  if (value > limit) fail.push(`${key} ${round(value)} > ${limit}`);
}
for (const [name, want] of Object.entries(EXPECT_ERA)) {
  const got = res.stages[name]?.audio?.era;
  if (typeof got === 'number' && got !== want) fail.push(`audioEra ${name} ${got} != ${want}`);
}
const theme = res.stages.s16_postgame?.audio?.theme;
if (typeof theme === 'string' && theme !== 'restored') fail.push(`audioTheme s16_postgame ${theme} != restored`);
if (GPU && (res.renderer?.software ?? null) !== false) fail.push(`gpu requested but renderer is software: ${res.renderer?.renderer ?? 'unknown'}`);
if (res.audioWiring && res.audioWiring.ok === false) fail.push('audioWiring');
if (errors.length > 0) fail.push(`errors ${errors.length} > 0`);

const result = {
  metrics: {
    gate: Object.fromEntries(Object.entries(gateVals).map(([k, v]) => [k, round(v)])),
    frames: { n: frames.length, p50Ms: round(pctile(frames, 0.5)), p95Ms: round(pctile(frames, 0.95)), gated: GPU },
    boot: res.boot,
    stages: res.stages,
    finale: res.finale,
    techTree: res.stages.s15_era5_full?.techTree ?? null,
    heap: res.stages.s15_era5_full?.heap ?? null,
    cycle: res.stages.s16_postgame?.cycle ?? null,
    renderer: res.renderer,
    audioWiring: res.audioWiring,
  },
  budgets: { ...budgets, frameP95MsGated: GPU },
  fail,
  errors,
};
const text = JSON.stringify(result, null, 1);
console.log(text);
if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'perf.json'), text + '\n');
}
if (STRICT && fail.length > 0) process.exitCode = 1;
