// WP16a T8: reproducible Steam store screenshots (18 PNGs per size: 8 stems with hud + clean, the tech tree and the title).
// Usage: PW_PATH=<playwright dir> [SIZES=1080,2160] [VARIANTS=hud,clean] node scripts/smoke/store-shots.mjs <base-url-without-query> <outdir>
// SIZE 1080 = viewport 1920x1080 at deviceScaleFactor 1 (PNG 1920x1080). SIZE 2160 = same viewport at deviceScaleFactor 2 (PNG 3840x2160).
// One fresh context per size; the stems run in one continuous session per size (VARIANTS only drops shots, setup always runs).
// Writes <outdir>/<size>/<stem>-<variant>.png and <outdir>/store-shots.json; prints ONE JSON object to stdout:
// { shots, results, fail, errors }. Exit 0 clean, 1 when fail or errors is non-empty, 2 on a usage error.
// Reads only window.__wedtmd (needs ?debug=1) and the DOM ids of the HUD, title and finale overlays.
import fs from 'fs';
import path from 'path';
import {
  S7, S9, S11, S13, S15, delta, withQuery, loadChromium, makeReport, watchPage, waitReady, crankClicks, buyList,
  dismissEraCard, poll, waitPhotoChipHidden, pngSize,
} from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> [SIZES=1080,2160] [VARIANTS=hud,clean] node scripts/smoke/store-shots.mjs <base-url-without-query> <outdir>';
const ALL_SIZES = ['1080', '2160'];
const ALL_VARIANTS = ['hud', 'clean'];
// the viewport is 1920x1080 for both sizes; '2160' doubles the device pixels
const SIZE_CFG = { '1080': { dpr: 1, png: { width: 1920, height: 1080 } }, '2160': { dpr: 2, png: { width: 3840, height: 2160 } } };

/** Comma list -> the allowed names in canonical order. Unset or blank = all. null on an unknown or empty entry. */
function parseList(raw, allowed) {
  if (raw === undefined || raw.trim() === '') return [...allowed];
  const items = raw.split(',').map((s) => s.trim());
  if (items.some((s) => !allowed.includes(s))) return null;
  return allowed.filter((a) => items.includes(a));
}

function isUrl(s) {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [base, outArg] = process.argv.slice(2);
  const sizes = parseList(process.env.SIZES, ALL_SIZES);
  const variants = parseList(process.env.VARIANTS, ALL_VARIANTS);
  if (!base || !outArg || !isUrl(base) || sizes === null || variants === null) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const chromium = loadChromium();
  const outRoot = path.resolve(outArg).split(path.sep).join('/');
  fs.mkdirSync(outRoot, { recursive: true });

  const report = makeReport();
  const shots = [];
  const want = (variant) => variants.includes(variant);
  let tagNow = 'setup';
  const tag = () => tagNow;

  /** Runs one stem. An exception adds FAILED:<size>/<id>:<msg> to fail; the run goes on with the next stem. */
  const runStem = async (size, id, body) => {
    tagNow = `${size}/${id}`;
    try {
      await body();
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).split('\n')[0];
      report.fail.push(`FAILED:${size}/${id}:${msg}`);
    }
  };

  /** Screenshot to <outdir>/<size>/<name>-<variant>.png; checks the PNG size (IHDR) against the size's expected pixels. */
  const writeShot = async (page, size, id, name, variant) => {
    const file = `${outRoot}/${size}/${name}-${variant}.png`;
    await page.screenshot({ path: file });
    const { width, height } = pngSize(file);
    const px = SIZE_CFG[size].png;
    report.check(`${size}_${id}_${variant}_png`, width === px.width && height === px.height, `${width}x${height}`);
    shots.push({ file, size, stem: name, variant, width, height });
  };

  /** HUD shot: era card away first; crank = 3 real crank clicks then 150 ms (gain text on screen); pointer parked at (5, 5). */
  const hudShot = async (page, size, id, name, crank) => {
    await dismissEraCard(page);
    if (crank) {
      await crankClicks(page, 3);
      await page.waitForTimeout(150);
    }
    await page.mouse.move(5, 5);
    await writeShot(page, size, id, name, 'hud');
  };

  /** Clean shot: photo mode without the hint, HUD hidden. The HUD check reads the state at shot time. */
  const cleanShot = async (page, size, id, name) => {
    await dismissEraCard(page);
    await page.mouse.move(5, 5);
    await page.evaluate(() => window.__wedtmd?.photoMode?.(true, { hint: false }));
    await page.waitForTimeout(1200);
    await waitPhotoChipHidden(page);
    const state = await page.evaluate(() => {
      const panel = document.getElementById('hud-panel');
      return { active: window.__wedtmd?.photoState?.()?.active === true, hud: panel ? getComputedStyle(panel).visibility : null };
    });
    try {
      await writeShot(page, size, id, name, 'clean');
      report.check(`${size}_${id}_clean_hud_hidden`, state.active && state.hud === 'hidden', state);
    } finally {
      await page.evaluate(() => window.__wedtmd?.photoMode?.(false));
    }
    await page.waitForTimeout(600);
  };

  /** Clean shot for the finale (photo mode is not used mid-sequence): #ui-root hidden for the shot, then restored. */
  const uiRootHiddenShot = async (page, size, id, name) => {
    await dismissEraCard(page);
    await page.mouse.move(5, 5);
    const before = await page.evaluate(() => {
      const root = document.getElementById('ui-root');
      if (!root) return null;
      const prev = root.style.visibility;
      root.style.visibility = 'hidden';
      return prev;
    });
    if (before === null) throw new Error('ui-root missing');
    try {
      await writeShot(page, size, id, name, 'clean');
    } finally {
      await page.evaluate((prev) => {
        const root = document.getElementById('ui-root');
        if (root) root.style.visibility = prev;
      }, before);
    }
  };

  /** Every stem of one size, in the spec order (01..07, 05 tree, 10 title, 08 finale, 09 postgame). */
  const runStems = async (page, size) => {
    await runStem(size, '01', async () => {
      await page.goto(withQuery(base, { debug: '1' }), { waitUntil: 'networkidle' });
      await waitReady(page);
      await crankClicks(page, 12, 120);
      await page.waitForTimeout(1500);
      if (want('hud')) await hudShot(page, size, '01', '01-era1-start', true);
      if (want('clean')) await cleanShot(page, size, '01', '01-era1-start');
    });

    await runStem(size, '02', async () => {
      await crankClicks(page, 33);
      const failed = await buyList(page, S7);
      report.check(`${size}_02_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('hud')) await hudShot(page, size, '02', '02-era1-full', true);
      if (want('clean')) await cleanShot(page, size, '02', '02-era1-full');
    });

    await runStem(size, '03', async () => {
      const failed = await buyList(page, delta(S7, S9));
      report.check(`${size}_03_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('hud')) await hudShot(page, size, '03', '03-era2-generator', true);
      if (want('clean')) await cleanShot(page, size, '03', '03-era2-generator');
    });

    await runStem(size, '04', async () => {
      const failed = await buyList(page, delta(S9, S11));
      report.check(`${size}_04_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('hud')) await hudShot(page, size, '04', '04-era3-boiler', true);
      if (want('clean')) await cleanShot(page, size, '04', '04-era3-boiler');
    });

    await runStem(size, '05', async () => {
      await page.keyboard.press('t');
      try {
        await page.click('#tech-tab-3', { timeout: 5000 });
        await page.waitForTimeout(600);
        if (want('hud')) await hudShot(page, size, '05', '05-tree-era3', false);
      } finally {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });

    await runStem(size, '06', async () => {
      const failed = await buyList(page, delta(S11, S13));
      report.check(`${size}_06_buys`, failed.length === 0, failed);
      await page.waitForTimeout(12000);
      if (want('hud')) await hudShot(page, size, '06', '06-era4-spire', true);
      if (want('clean')) await cleanShot(page, size, '06', '06-era4-spire');
    });

    await runStem(size, '07', async () => {
      const failed = await buyList(page, delta(S13, S15));
      report.check(`${size}_07_buys`, failed.length === 0, failed);
      await page.waitForTimeout(15000);
      if (want('hud')) await hudShot(page, size, '07', '07-era5-ruined', true);
      if (want('clean')) await cleanShot(page, size, '07', '07-era5-ruined');
    });

    await runStem(size, '10', async () => {
      await page.evaluate(() => window.__wedtmd?.saveNow?.());
      await page.goto(withQuery(base, { debug: '1', title: '1' }), { waitUntil: 'networkidle' });
      await waitReady(page);
      await page.waitForTimeout(1500);
      const open = await page.evaluate(() => document.querySelector('#title-screen.is-open') !== null);
      report.check(`${size}_10_title_open`, open, open);
      if (want('hud')) await hudShot(page, size, '10', '10-title', false);
      await page.evaluate(() => document.getElementById('title-continue')?.focus());
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    });

    await runStem(size, '08', async () => {
      const failed = await buyList(page, ['primaryFunction']);
      report.check(`${size}_08_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__wedtmd?.finaleSeek?.(56));
      await page.waitForTimeout(400);
      const phase = await page.evaluate(() => window.__wedtmd?.finaleState?.()?.phase ?? null);
      report.check(`${size}_08_sequence`, phase === 'sequence', phase);
      if (want('hud')) await hudShot(page, size, '08', '08-finale-reveal', false);
      if (want('clean')) await uiRootHiddenShot(page, size, '08', '08-finale-reveal');
    });

    await runStem(size, '09', async () => {
      await page.evaluate(() => window.__wedtmd?.skipFinale?.());
      await page.click('#finale-keep', { timeout: 5000 });
      await poll(page, () => window.__wedtmd?.session?.state?.ending?.phase === 'postgame', null, 5000, 100);
      const phase = await page.evaluate(() => window.__wedtmd?.session?.state?.ending?.phase ?? null);
      report.check(`${size}_09_postgame`, phase === 'postgame', phase);
      await page.waitForTimeout(2500);
      if (want('hud')) await hudShot(page, size, '09', '09-postgame-portrait', true);
      if (want('clean')) await cleanShot(page, size, '09', '09-postgame-portrait');
    });
  };

  let browser = null;
  try {
    browser = await chromium.launch();
    for (const size of sizes) {
      fs.mkdirSync(`${outRoot}/${size}`, { recursive: true });
      try {
        const ctx = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          deviceScaleFactor: SIZE_CFG[size].dpr,
        });
        try {
          const page = await ctx.newPage();
          watchPage(page, report.errors, tag);
          await runStems(page, size);
        } finally {
          await ctx.close();
        }
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e).split('\n')[0];
        report.fail.push(`FAILED:${size}/setup:${msg}`);
      }
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).split('\n')[0];
    report.fail.push(`FAILED:launch:${msg}`);
  } finally {
    if (browser !== null) await browser.close();
  }

  const out = { shots, results: report.results, fail: report.fail, errors: report.errors };
  fs.writeFileSync(`${outRoot}/store-shots.json`, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out));
  process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
}

await main();
