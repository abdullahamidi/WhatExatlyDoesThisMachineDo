// Shared helpers for the release smokes (WP16a). Node built-ins only; importing reads package.json once; no other side effects and needs no PW_PATH.
// Self-test (pure, no browser): node scripts/smoke/lib/common.mjs --selftest   -> one JSON line, exit 0 / 1.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Item lists: byte-identical copies of scripts/smoke/stages.mjs lines 6-13 (S10, S12, S14 stay private).
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(10).fill('motorRetrofit'), ...Array(40).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(6).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(9).fill('inductionHeater'), ...Array(40).fill('firebox'), 'steamHammer', 'superheater', ...Array(15).fill('condenser'), 'turbine', 'reliefValves', ...Array(9).fill('bellowsDrive'), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(50).fill('harmonicCoil'), ...Array(6).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(6).fill('standingWave'), 'crystalLattice', ...Array(15).fill('gridExciter'), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(50).fill('containmentRing'), '@resonantSiphon:60', '@graviticAnchor:20', 'inversionCrank', 'lensArray', ...Array(40).fill('horizonField'), 'skyAperture', ...Array(15).fill('mainsBackfeed'), ...Array(15).fill('steamLance'), '@finalAlignment'];
export { S7, S9, S11, S13, S15 };

/** Stage keys with their buy lists, in play order. */
export const STAGES = [['s7', S7], ['s9', S9], ['s11', S11], ['s13', S13], ['s15', S15]];

/** Era card titles per stage (ERA title separator is U+00B7 with a space each side). */
export const ERA_TITLES = { s7: 'ERA I · MECHANICAL', s9: 'ERA II · ELECTRICAL', s11: 'ERA III · PRESSURE', s13: 'ERA IV · RESONANCE', s15: 'ERA V · ???' };

/** Visible HUD resource rows per stage. */
export const HUD_ROWS = { s7: 1, s9: 2, s11: 3, s13: 4, s15: 5 };

/** Legacy energy feed parts (WP17 continuity). */
export const LEGACY_FEEDS = ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'];

/** Console warnings from the asset loader that count as errors. */
export const ASSET_WARNING_RE = /\[assets\] (failed to load|size mismatch)|has no frame/;

/** Chromium flags for the GPU smokes (D3D11 on Windows). */
export const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

/** Preview server that serves dist (never start another one). */
export const PREVIEW_HINT = 'http://localhost:4174/';

/** Version from the repo package.json, read once (title, footer and aria checks compare against it). */
export const APP_VERSION = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version;

/** Items of `next` after the `prev` prefix. Throws when prev is not a prefix of next. */
export function delta(prev, next) {
  if (prev.length > next.length) throw new Error('delta: prev is not a prefix of next');
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) throw new Error('delta: prev is not a prefix of next');
  }
  return next.slice(prev.length);
}

/** URL with the given query parameters set (existing ones kept unless overwritten). */
export function withQuery(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** Playwright chromium from the PW_PATH module. Exits 2 when PW_PATH is unset. */
export function loadChromium() {
  if (!process.env.PW_PATH) {
    console.error('PW_PATH is required');
    process.exit(2);
  }
  return createRequire(import.meta.url)(process.env.PW_PATH).chromium;
}

/** Parsed scripts/smoke/perf-budget.json. */
export function readBudget() {
  return JSON.parse(fs.readFileSync(new URL('../perf-budget.json', import.meta.url), 'utf8'));
}

/** Check recorder: results per name, fail list (each name once), errors list. */
export function makeReport() {
  const report = {
    results: {},
    fail: [],
    errors: [],
    check(name, cond, detail) {
      report.results[name] = detail === undefined ? !!cond : { ok: !!cond, value: detail };
      if (!cond && !report.fail.includes(name)) report.fail.push(name);
    },
  };
  return report;
}

/** Tags page errors, asset warnings, failed requests and HTTP >= 400 responses with tag() (current step / case). */
export function watchPage(page, errors, tag) {
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') errors.push(`${tag()}: console: ${text}`);
    else if (m.type() === 'warning' && ASSET_WARNING_RE.test(text)) errors.push(`${tag()}: asset: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`${tag()}: pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`${tag()}: requestfailed: ${r.url()} ${r.failure() ? r.failure().errorText : ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${tag()}: http ${r.status()}: ${r.url()}`);
  });
}

/** Waits for the debug hook and the hand crank, then a short settle. */
export async function waitReady(page, timeoutMs = 20000) {
  await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: timeoutMs });
  await page.waitForTimeout(400);
}

/** n real mouse clicks on the hand crank, gapMs apart. */
export async function crankClicks(page, n, gapMs = 40) {
  for (let i = 0; i < n; i++) {
    const pt = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(gapMs);
  }
}

/**
 * Runs in the page (page.evaluate). Self-contained: no outer variables.
 * Buys each id; '@<tech>:<n>' buys until level n, '@<tech>' jumps until owned, '@blueprint' = generatorBlueprint.
 * Returns '<id>:<bool>' per entry.
 */
export function buyInPage(buys) {
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
      // '@<techId>' marker: jump forward until that tech is owned (up to 8 jumps); '@blueprint' = '@generatorBlueprint'
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      o.push(id + ':' + (s.state.techLevels[tech] === 1));
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    // a rejected buy (not enough resources yet) retries after another 8 h jump, up to 6 times
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
    o.push(id + ':' + r.ok);
  }
  return o;
}

/** Runs buyInPage; returns the failed entries only ([] = every buy worked). */
export async function buyList(page, buys) {
  return (await page.evaluate(buyInPage, buys)).filter((x) => !x.endsWith(':true'));
}

/** Clicks the era card away when it is open. */
export async function dismissEraCard(page) {
  await page.evaluate(() => { const c = document.getElementById('era-card'); if (c && !c.hidden) c.click(); });
}

/** HUD readout: era title, visible rows, frontier, click / auto lines, panel edge px. null on error. */
export async function hudState(page) {
  return page.evaluate(() => {
    const text = id => { const e = document.getElementById(id); return e ? (e.textContent || '').trim() : null; };
    const shown = e => !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    const panel = document.getElementById('hud-panel');
    const rect = panel ? panel.getBoundingClientRect() : null;
    const front = document.querySelector('.hud-row--frontier');
    return {
      title: text('hud-title'),
      visibleRows: [...document.querySelectorAll('.hud-res-row')].filter(shown).length,
      frontier: front ? front.getAttribute('data-res') : null,
      click: text('hud-per-click'),
      clickSub: shown(document.getElementById('hud-per-click-me')) ? text('hud-per-click-me') : null,
      auto: shown(document.getElementById('hud-auto')) ? text('hud-auto') : null,
      right: rect ? Math.round(rect.right) : null,
      bottom: rect ? Math.round(rect.bottom) : null,
    };
  }).catch(() => null);
}

/** Re-evaluates fn(arg) in the page until truthy or capMs passed; returns the last value. */
export async function poll(page, fn, arg, capMs = 5000, stepMs = 100) {
  const deadline = Date.now() + capMs;
  let value = await page.evaluate(fn, arg);
  while (!value && Date.now() < deadline) {
    await page.waitForTimeout(stepMs);
    value = await page.evaluate(fn, arg);
  }
  return value;
}

/** Blurs #photo-exit, then polls its computed opacity until <= 0.001 (missing element = 0). Returns the final opacity. */
export async function waitPhotoChipHidden(page, capMs = 3000) {
  await page.evaluate(() => {
    const el = document.getElementById('photo-exit');
    if (el instanceof HTMLElement) el.blur();
  });
  const opacityOf = () => page.evaluate(() => {
    const el = document.getElementById('photo-exit');
    return el ? parseFloat(getComputedStyle(el).opacity) : 0;
  });
  const deadline = Date.now() + capMs;
  let opacity = await opacityOf();
  while (opacity > 0.001 && Date.now() < deadline) {
    await page.waitForTimeout(100);
    opacity = await opacityOf();
  }
  return opacity;
}

/** { width, height } from the IHDR chunk of a PNG file (first 24 bytes). Throws when the file is not a PNG. */
export function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  let bytesRead = 0;
  try {
    bytesRead = fs.readSync(fd, head, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytesRead < 24 || !sig.every((b, i) => head[i] === b)) throw new Error(`pngSize: not a PNG: ${file}`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// Pure self-test: runs only as the entry script with --selftest.
function selfTest() {
  const checks = {};
  const check = (name, fn) => {
    try { checks[name] = fn() === true; } catch { checks[name] = false; }
  };
  const prefixOk = (a, b) => { try { delta(a, b); return true; } catch { return false; } };
  check('prefix_s7_s9', () => prefixOk(S7, S9));
  check('prefix_s9_s11', () => prefixOk(S9, S11));
  check('prefix_s11_s13', () => prefixOk(S11, S13));
  check('prefix_s13_s15', () => prefixOk(S13, S15));
  check('delta_length', () => delta(S7, S9).length === S9.length - S7.length);
  check('delta_reverse_throws', () => { try { delta(S9, S7); return false; } catch { return true; } });
  check('with_query', () => withQuery('http://x/?a=1', { debug: '1' }) === 'http://x/?a=1&debug=1');
  check('png_gear_small_40', () => {
    const size = pngSize(fileURLToPath(new URL('../../../public/assets/machine/gear-small.png', import.meta.url)));
    return size.width === 40 && size.height === 40;
  });
  check('budget_heap_150', () => readBudget().heapMb === 150);
  check('app_version_semver', () => /^\d+\.\d+\.\d+$/.test(APP_VERSION));
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, checks }));
  process.exitCode = ok ? 0 : 1;
}

const isEntry = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntry && process.argv.includes('--selftest')) selfTest();
