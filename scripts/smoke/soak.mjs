// WP16a T7 soak smoke: timed run (SOAK_MIN minutes) with cranks, legacy feed buys, tech tree and SYSTEM menu opens.
// Samples heap / display objects / DOM nodes / toasts / voices and enforces flatness limits (SOAK_LIMITS; caps from perf-budget.json).
// Usage: PW_PATH=<playwright dir> [SOAK_MIN=30] [SOAK_SAMPLE_S=30] [SOAK_GPU=1] node scripts/smoke/soak.mjs <base-url-without-query> <outdir>
//   SOAK_MIN >= 2 (minutes), SOAK_SAMPLE_S >= 5 (seconds between samples), SOAK_GPU=1: launch with the real GPU (ANGLE d3d11).
// Prints ONE JSON object { minutes, samples, baseline, last, limits, purchases, fail, errors } to stdout and writes <outdir>/soak.json.
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args, bad SOAK_* values, PW_PATH unset). Progress goes to stderr.
// heap_slope needs >= 2 samples with tSec >= 60 (fails otherwise). voices_* are skipped when every sample's liveVoices is null.
import fs from 'fs';
import path from 'path';
import { LEGACY_FEEDS, GPU_ARGS, S15, withQuery, loadChromium, readBudget, makeReport, watchPage, waitReady, crankClicks, buyList, dismissEraCard } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> [SOAK_MIN=30] [SOAK_SAMPLE_S=30] [SOAK_GPU=1] node scripts/smoke/soak.mjs <base-url-without-query> <outdir>';

// Flatness limits. Caps from perf-budget.json (heapMb, displayObjects, liveVoices) come from readBudget().
const SOAK_LIMITS = {
  baselineSec: 60,         // baseline = first sample with tSec >= baselineSec
  heapGrowthMb: 16,        // last.heapMb - baseline.heapMb
  heapSlopeMbPerMin: 1.0,  // least-squares slope of heapMb over samples with tSec >= baselineSec
  displayGrowthRatio: 1.10,
  toastsCap: 4,
  domGrowth: 200,          // last.domNodes - baseline.domNodes
  voicesGrowth: 8,         // last.liveVoices - baseline.liveVoices
};

const CRANK_EVERY_MS = 2000;
const BUY_FIRST_MS = 15000;
const BUY_EVERY_MS = 30000;
const TECH_FIRST_MS = 20000;
const TECH_EVERY_MS = 60000;
const MENU_FIRST_MS = 40000;
const MENU_EVERY_MS = 90000;
const POLL_MS = 250;
const LEGACY_RETRY_JUMP_MS = 8 * 3600 * 1000;

const SETUP_CRANKS = 45;
const SETUP_SETTLE_MS = 15000;

// Rounds to 2 decimals; null stays null.
const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);

// Parses the usage. Returns null for any usage error (missing args, bad SOAK_* values).
function parseArgs() {
  const [base, outdir] = process.argv.slice(2);
  if (!base || !outdir) return null;
  try {
    new URL(base);
  } catch {
    return null;
  }
  const minutes = process.env.SOAK_MIN === undefined ? 30 : Number(process.env.SOAK_MIN);
  const sampleS = process.env.SOAK_SAMPLE_S === undefined ? 30 : Number(process.env.SOAK_SAMPLE_S);
  if (!Number.isFinite(minutes) || minutes < 2) return null;
  if (!Number.isFinite(sampleS) || sampleS < 5) return null;
  return { base, outdir, minutes, sampleS, gpu: process.env.SOAK_GPU === '1' };
}

// Least-squares slope of heapMb over tSec, in MB per minute. null when fewer than 2 points or no tSec spread.
function heapSlopePerMin(pts) {
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.tSec, 0) / n;
  const my = pts.reduce((a, p) => a + p.heapMb, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.tSec - mx) * (p.heapMb - my);
    den += (p.tSec - mx) ** 2;
  }
  return den === 0 ? null : (num / den) * 60;
}

async function main() {
  const opts = parseArgs();
  if (!opts || !process.env.PW_PATH) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  fs.mkdirSync(opts.outdir, { recursive: true });
  const chromium = loadChromium();
  const budget = readBudget();
  const report = makeReport();
  const endMs = opts.minutes * 60000;
  const sampleMs = opts.sampleS * 1000;
  const purchases = { ok: 0, tried: 0 };
  const samples = [];
  let baseline = null;
  let finalSample = null;
  let browser = null;

  const args = ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
  if (opts.gpu) args.push(...GPU_ARGS);

  try {
    browser = await chromium.launch({ args });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watchPage(page, report.errors, () => 'soak');
    await page.goto(withQuery(opts.base, { debug: '1' }), { waitUntil: 'load' });

    // Setup: cranks into the first machine parts, the full S15 buy list, then the era card away.
    await waitReady(page);
    await crankClicks(page, SETUP_CRANKS);
    const setupBuys = await buyList(page, S15);
    report.check('setup_buys', setupBuys.length === 0, setupBuys);
    await page.waitForTimeout(SETUP_SETTLE_MS);
    await dismissEraCard(page);

    const press = (key) => page.keyboard.press(key);
    const sleep = (ms) => page.waitForTimeout(ms);
    const modalCount = () => page.evaluate(() => window.__wedtmd.modalCount());

    // Escape while a modal is open (max 3 presses).
    const closeModals = async () => {
      for (let i = 0; i < 3 && (await modalCount()) > 0; i++) {
        await press('Escape');
        await sleep(150);
      }
    };

    // One sample: modals closed, gc (when exposed), then the probes. tSec is the loop time at sample start.
    const sample = async (tSec) => {
      await closeModals();
      const raw = await page.evaluate(() => {
        if (typeof gc === 'function') gc();
        const mem = performance.memory;
        if (!mem) throw new Error('performance.memory unavailable (chromium only)');
        return {
          heapMb: mem.usedJSHeapSize / 1e6,
          displayObjects: window.__wedtmd.displayObjects(),
          toasts: document.querySelectorAll('#toast-stack .toast').length,
          domNodes: document.getElementsByTagName('*').length,
          liveVoices: window.__wedtmd.audioStats()?.liveVoices ?? null,
          machineMeanMs: window.__wedtmd.machineStats().meanMs,
        };
      });
      const s = {
        tSec: r2(tSec),
        heapMb: r2(raw.heapMb),
        displayObjects: raw.displayObjects,
        toasts: raw.toasts,
        domNodes: raw.domNodes,
        liveVoices: r2(raw.liveVoices),
        machineMeanMs: r2(raw.machineMeanMs),
      };
      samples.push(s);
      console.error(`[soak] t=${s.tSec}s heap=${s.heapMb}MB display=${s.displayObjects} dom=${s.domNodes} toasts=${s.toasts} voices=${s.liveVoices}`);
      return s;
    };

    let attempts = 0;
    const t0 = Date.now();
    const elapsedMs = () => Date.now() - t0;
    const elapsedS = () => elapsedMs() / 1000;

    // Periodic tasks. due = next loop time (ms) to run; advanced by every. Run one at a time, never overlapping.
    const tasks = [
      { name: 'sample', due: 0, every: sampleMs, run: () => sample(elapsedS()) },
      {
        name: 'crank', due: CRANK_EVERY_MS, every: CRANK_EVERY_MS,
        run: async () => {
          const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
          await page.mouse.click(pt.x, pt.y);
        },
      },
      {
        name: 'buy', due: BUY_FIRST_MS, every: BUY_EVERY_MS,
        run: async () => {
          const id = LEGACY_FEEDS[attempts % LEGACY_FEEDS.length];
          attempts += 1;
          purchases.tried += 1;
          const ok = await page.evaluate(({ techId, jumpMs }) => {
            const s = window.__wedtmd.session;
            let r = s.purchase(techId);
            if (!r.ok) {
              s.update(Date.now() + jumpMs);
              r = s.purchase(techId);
            }
            return !!r.ok;
          }, { techId: id, jumpMs: LEGACY_RETRY_JUMP_MS });
          if (ok) purchases.ok += 1;
        },
      },
      {
        name: 'tech', due: TECH_FIRST_MS, every: TECH_EVERY_MS,
        run: async () => {
          await press('t');
          await sleep(1500);
          await press('Escape');
        },
      },
      {
        name: 'menu', due: MENU_FIRST_MS, every: MENU_EVERY_MS,
        run: async () => {
          await closeModals();
          await press('Escape');
          await sleep(1000);
          await page.click('#sys-tab-stats', { timeout: 5000 });
          await sleep(1000);
          await press('Escape');
        },
      },
    ];

    while (elapsedMs() < endMs) {
      for (const task of tasks) {
        if (elapsedMs() >= endMs) break;
        if (elapsedMs() < task.due) continue;
        task.due += task.every;
        await task.run();
      }
      await sleep(POLL_MS);
    }

    // FINAL sample (modals closed, gc, probes), then the end screenshot.
    finalSample = await sample(elapsedS());
    await page.screenshot({ path: path.join(opts.outdir, 'soak-end.png') });

    // Limits. Baseline = first sample at or after baselineSec; last = FINAL sample.
    const L = SOAK_LIMITS;
    baseline = samples.find((s) => s.tSec >= L.baselineSec) ?? null;
    if (!baseline) {
      report.check('no_baseline', false);
    } else {
      const fin = finalSample;
      const base = baseline;

      const maxHeap = Math.max(...samples.map((s) => s.heapMb));
      report.check('heap_cap', maxHeap <= budget.heapMb, { value: r2(maxHeap), limit: budget.heapMb });

      const heapGrowth = r2(fin.heapMb - base.heapMb);
      report.check('heap_growth', heapGrowth <= L.heapGrowthMb, { value: heapGrowth, limit: L.heapGrowthMb });

      const slope = heapSlopePerMin(samples.filter((s) => s.tSec >= L.baselineSec));
      report.check('heap_slope', slope !== null && slope <= L.heapSlopeMbPerMin, { value: r2(slope), limit: L.heapSlopeMbPerMin });

      const maxDisplay = Math.max(...samples.map((s) => s.displayObjects));
      report.check('display_cap', maxDisplay <= budget.displayObjects, { value: maxDisplay, limit: budget.displayObjects });

      const displayLimit = r2(base.displayObjects * L.displayGrowthRatio);
      report.check('display_growth', fin.displayObjects <= base.displayObjects * L.displayGrowthRatio, { value: fin.displayObjects, limit: displayLimit });

      const maxToasts = Math.max(...samples.map((s) => s.toasts));
      report.check('toasts_cap', maxToasts <= L.toastsCap, { value: maxToasts, limit: L.toastsCap });

      const domGrowth = fin.domNodes - base.domNodes;
      report.check('dom_growth', domGrowth <= L.domGrowth, { value: domGrowth, limit: L.domGrowth });

      const voiceVals = samples.map((s) => s.liveVoices).filter((v) => v !== null);
      if (voiceVals.length === 0) {
        report.check('voices_cap', true, { value: null, limit: null });
        report.check('voices_growth', true, { value: null, limit: null });
      } else {
        const maxVoices = Math.max(...voiceVals);
        report.check('voices_cap', maxVoices <= budget.liveVoices, { value: maxVoices, limit: budget.liveVoices });
        const voicesGrowth = base.liveVoices === null || fin.liveVoices === null ? null : fin.liveVoices - base.liveVoices;
        report.check('voices_growth', voicesGrowth !== null && voicesGrowth <= L.voicesGrowth, { value: voicesGrowth, limit: L.voicesGrowth });
      }
    }
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).split('\n')[0];
    report.fail.push(`FAILED:soak:${msg}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const out = {
    minutes: opts.minutes,
    samples,
    baseline,
    last: finalSample,
    limits: report.results,
    purchases,
    fail: report.fail,
    errors: report.errors,
  };
  fs.writeFileSync(path.join(opts.outdir, 'soak.json'), JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(`FAILED:soak:${String(e && e.message ? e.message : e).split('\n')[0]}`);
  process.exitCode = 1;
});
