// WP15 profiling smoke + budgets.
// Usage: PW_PATH=<global playwright dir> [PERF_STRICT=1] [PERF_GPU=1] [ONLY=s0_crank,finale] node scripts/smoke/perf.mjs <url> [outdir]
// Stages (stages.mjs buy lists, fresh context each): s0_crank, s9_era2_full, s13_era4_full, s15_era5_full, s16_postgame.
// Per stage: 10 s warm-up, then 3 samples 2 s apart (each reads the 120-frame probe rings). s15 also runs the tech tree
// probe (era V tab, median of 5 sync opens + forced layout) and the heap probe (after gc, then 30 s idle). s16 runs a
// new cycle after the postgame settle (WP14 button) and compares displayObjects with the pre-cycle count (no leak).
// Finale: fresh context, buy list S15 + primaryFunction, finaleSeek to t 8 / 22 / 34 / 36 (2 s window each).
// Prints ONE JSON { metrics, budgets, fail, errors } on stdout; writes <outdir>/perf.json when outdir is given.
// Every probe is read null-safe: a missing hook field is reported as null and never throws.
// Budgets: scripts/smoke/perf-budget.json, env override PERF_<METRIC> (camelCase -> SCREAMING_SNAKE, e.g. PERF_MACHINE_MEAN_MS).
// Medians: stage means and stage maxes gate on the median of the 3 windows (raw max per window is reported as machineMaxMsRaw).
// PERF_STRICT=1 exits 1 when fail is non-empty (console/page errors count as a failure). Frame p95 gates only with PERF_GPU=1.
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
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), ...Array(20).fill('resonantSiphon'), ...Array(10).fill('graviticAnchor'), 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];

const STAGES = [
  { name: 's0_crank', buys: [] },
  { name: 's9_era2_full', buys: S9 },
  { name: 's13_era4_full', buys: S13 },
  { name: 's15_era5_full', buys: S15 },
  { name: 's16_postgame', buys: S16, postgame: true },
];
const FINALE_T = [8, 22, 34, 36];

// Same buy helper as stages.mjs: 8 h jumps for '@<tech>' markers and for rejected buys.
const buyFn = (buys) => {
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
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
    o.push(id + ':' + r.ok);
  }
  return o;
};

// ---- page helpers --------------------------------------------------------------------------------
async function openPage(browser, label, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${label}: pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
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
    for (let k = 0; k < 3; k++) samples.push(await sampleWindow(page));
    for (const s of samples) frames.push(...s.frames);

    const running = samples.filter((s) => s.audio?.running === true);
    Object.assign(rec, {
      samples: samples.length,
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
      },
    });
    if (st.name === 's15_era5_full') {
      rec.techTree = await techTreeProbe(page);
      rec.heap = await heapProbe(page);
    }
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
const res = { boot: null, stages: {}, finale: null, s0Display: null };
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required'] });
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
  cycleDisplayPct: res.stages.s16_postgame?.cycle?.pct ?? null,
};
const fail = [];
for (const [key, value] of Object.entries(gateVals)) {
  const limit = budgets[key];
  if (limit === undefined || num(value) === null) continue;
  if (key === 'frameP95Ms' && !GPU) continue; // report-only without a GPU
  if (value > limit) fail.push(`${key} ${round(value)} > ${limit}`);
}
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
