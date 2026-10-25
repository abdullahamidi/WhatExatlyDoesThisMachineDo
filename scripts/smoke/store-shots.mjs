// WP16a T8 + WP16b-1: reproducible Steam store screenshots. 19 PNGs per size with both variants: stems 01-04, 06, 07, 08, 09 with hud + clean (16),
// plus hud-only 05 (tech tree), 10 (title) and 08b (finale, all 5 lines typed).
// Usage: PW_PATH=<playwright dir> [SIZES=1080,2160] [VARIANTS=hud,clean] node scripts/smoke/store-shots.mjs <base-url-without-query> <outdir>
// SIZE 1080 = viewport 1920x1080 at deviceScaleFactor 1 (PNG 1920x1080). SIZE 2160 = same viewport at deviceScaleFactor 2 (PNG 3840x2160).
// One fresh context per size; the stems run in one continuous session per size (VARIANTS only drops shots, setup always runs).
// Writes <outdir>/<size>/<stem>-<variant>.png, <outdir>/store-shots.json and <outdir>/store-top5.json; prints ONE JSON object to stdout:
// { shots, results, fail, errors }. Exit 0 clean, 1 when fail or errors is non-empty, 2 on a usage error.
// Reads only window.__wedtmd (needs ?debug=1) and the DOM ids of the HUD, title and finale overlays.
//
// Run order per size, shots in this order (uiRoot = #ui-root hidden, live camera framing, no gain text; photo = photo mode):
//   01 start        12 cranks, 2.5 s                clean(uiRoot) -> hud(crank)
//   02 era1-full    33 cranks + S7 buys, 2.5 s      clean(uiRoot) -> hud(crank)
//   03 era2         S7->S9 buys, 2.5 s              clean(uiRoot) -> hud(crank, keepToasts: the milestone toast stays)
//   04 era3         S9->S11 buys, 2.5 s             clean(uiRoot) -> hud(crank)
//   05 tree era3   key t + tab 3, 0.6 s            hud (HUD panel + buttons hidden for the shot), Escape afterwards
//   06 era4 spire   S11->S13 buys, 12 s             clean(uiRoot) -> hud(crank)
//   07 era5 ruined  S13->S15 buys, 15 s             hud(crank) -> clean(photo)
//   10 title        saveNow, reload with title=1    hud (version line hidden for the shot), then CONTINUE
//   08 finale       primaryFunction buy, seek 56 s  hud -> clean(uiRoot)
//   08b typed       seek FINALE_TYPED_T, 1 rAF, polls up to 1 s for the 5th line   hud (SKIP and the choice buttons hidden for the shot); only when VARIANTS has hud
//   09 postgame     skip, KEEP IT RUNNING, 2.5 s    hud(crank) -> clean(photo)
// hudShot(page, size, id, name, crank, opts): era card dismissed; crank = 3 real clicks + 150 ms (gain text); pointer parked at (5, 5);
//   '#toast-stack' is hidden for the shot unless opts.keepToasts (F1); opts.hide = extra selectors hidden for the shot (title version F3,
//   tree HUD F4, finale SKIP + buttons F7). withHidden sets inline visibility:hidden and restores the previous value in finally; it is not re-entrant.
// Checks (results keys; <size> = 1080|2160): <size>_<id>_<variant>_png (PNG pixel size), <size>_<id>_buys, <size>_<id>_clean_hud_hidden (computed #hud-panel
//   visibility is 'hidden' in every clean shot: photo mode for 07 and 09, #ui-root hidden for the rest), <size>_10_title_open, <size>_10_hud_hidden (#hud-panel,
//   #hud-buttons and #toast-stack computed visibility are all 'hidden' behind the title, read before the shot), <size>_10_hud_back (#hud-panel visible again
//   800 ms after CONTINUE), <size>_08_sequence, <size>_08b_typed ({ count, empty, last, phase, t }: 5 complete lines, the last one is FINALE_LAST_LINE; phase
//   sequence or choice both pass), <size>_09_postgame, store_top5_complete (only when both variants run: no store or alt file missing).
// FINALE_TYPED_T = 64.0 s into the film: the last line is fully typed at 63.967 s and the buttons (phase choice) come at 64.467 s (finaleEndS in
//   src/game/math/finale.ts), so 0.467 s of margin remain; the film clock keeps running during the shot, which is why SKIP and the buttons row are hidden by style.
// <outdir>/store-top5.json = { sizes, plateCap, store, alt, pressKitOnly, missing }: store = the five Art Director store picks in order (rank 1-5, files per size),
//   alt = 04-era3-boiler-hud (no-reveal replacement for rank 5), pressKitOnly = shots that are never store screenshots (spoilers, title) with the reason,
//   missing = '<size>/<name>' for every store or alt file not captured for a requested size. Picks: docs/plan/WP16b-preaudit.md section C.
// WP16b-3: plate cap (setPlateCap 'substationBlueprint' = RES?OR?) at stems 01, 10, 09; cleared at 08 (08 / 08b uncapped press kit).
//   checks <size>_<id>_plate_cap and <size>_<id>_<variant>_no_spoiler (stems 01-07, 09, not press kit); store-top5.json gets plateCap. The check also asserts the HUD plaque text (read from #hud-plaque even when the HUD is hidden) has no RESTOR.
// WP23a: the living world is quiet for every stem (worldQuiet(true) before each stem, again after each navigation): no bubble,
//   blip or glance reaches a shot. No check changed or added.
// Documented in scripts/smoke/README.md (### store-shots.mjs; ### Existing smokes touched by WP23a).
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

// AD store picks (docs/plan/WP16b-preaudit.md section C), in order. Names are `<stem>-<variant>`.
const STORE_TOP5 = ['07-era5-ruined-clean', '06-era4-spire-hud', '03-era2-generator-hud', '05-tree-era3-hud', '09-postgame-portrait-clean'];
const STORE_ALT = [{ name: '04-era3-boiler-hud', replaces: '09-postgame-portrait-clean', why: 'no-reveal alternative (09 shows the restored world)' }];
const PRESS_KIT_ONLY = [
  { name: '08-finale-reveal-hud', why: 'spoiler: PRIMARY FUNCTION: RESTORE' },
  { name: '08-finale-reveal-clean', why: 'spoiler: finale reveal (restored sky, plate RESTORE)' },
  { name: '08b-finale-typed-hud', why: 'spoiler: full reveal text' },
  { name: '09-postgame-portrait-hud', why: 'spoiler: RESTORATION ENGINE HUD title' },
  { name: '10-title-hud', why: 'title screen, not gameplay (capsule / logo reference)' },
];
// FINALE_REVEAL: last line fully typed at 63.967 s, buttons (and phase choice) at 64.467 s (src/game/math/finale.ts finaleEndS).
const FINALE_TYPED_T = 64.0;
const FINALE_LAST_LINE = 'Restoration holds while the machine runs.';
// WP16b-3: store shots cap the World name plate and the HUD plaque at the demo cap (EDITIONS.demo.capTech, src/data/edition.ts),
// so they read RES?OR? like the demo teaser (window.__wedtmd.setPlateCap, rendering only). The finale (08, 08b) stays uncapped press kit.
const PLATE_CAP = 'substationBlueprint';
const PLATE_CAP_FRAME = 2;                                  // namePlate frame of RES?OR? (src/game/math/plateCap.ts plateFrameCap)
const SPOILER_RE = /RESTOR/i;                               // RESTORE, RESTORATION ENGINE, Restoration Flux, ...
const SPOILER_STEMS = ['01', '02', '03', '04', '05', '06', '07', '09'];

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

/** Store-set manifest: which captured file serves each pick, per requested size. Press-kit names never count as missing. */
function storeManifest(shots, sizes) {
  const filesFor = (name) => {
    const files = {};
    for (const size of sizes) {
      const hit = shots.find((s) => `${s.stem}-${s.variant}` === name && s.size === size);
      if (hit !== undefined) files[size] = hit.file;
    }
    return files;
  };
  const missing = [];
  for (const name of [...STORE_TOP5, ...STORE_ALT.map((a) => a.name)]) {
    const files = filesFor(name);
    for (const size of sizes) {
      if (files[size] === undefined) missing.push(`${size}/${name}`);
    }
  }
  return {
    sizes,
    plateCap: PLATE_CAP,
    store: STORE_TOP5.map((name, i) => ({ rank: i + 1, name, files: filesFor(name) })),
    alt: STORE_ALT.map((a) => ({ ...a, files: filesFor(a.name) })),
    pressKitOnly: PRESS_KIT_ONLY.map((p) => ({ ...p, files: filesFor(p.name) })),
    missing,
  };
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

  /** Sets the plate cap (null clears) and records <size>_<id>_plate_cap: the cap in force equals the request. */
  const setCap = async (page, size, id, cap) => {
    const got = await page.evaluate((c) => (typeof window.__wedtmd?.setPlateCap === 'function' ? window.__wedtmd.setPlateCap(c) : 'missing'), cap);
    report.check(`${size}_${id}_plate_cap`, got === cap, got);
  };
  /** WP23a: the living world stays quiet for the store set (no bubble, blip or glance). Optional calls: a build without the hook skips it. */
  const quietWorld = (page) => page.evaluate(() => { window.__wedtmd?.worldQuiet?.(true); });
  /** Spoiler state at shot time: plate frame, HUD plaque text (evidence), visible text lines matching SPOILER_RE. */
  const spoilerState = (page) => page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const hits = (document.body.innerText || '').split('\n').map((s) => s.trim()).filter((s) => re.test(s));
    const plate = window.__wedtmd?.componentState?.('namePlate') ?? null;
    const plaque = document.getElementById('hud-plaque');
    return { frame: plate === null ? null : plate.frame, plaque: plaque ? (plaque.textContent ?? '').trim() : null, hits };
  }, SPOILER_RE.source);

  /** Screenshot to <outdir>/<size>/<name>-<variant>.png; checks the PNG size (IHDR) against the size's expected pixels. */
  const writeShot = async (page, size, id, name, variant) => {
    const file = `${outRoot}/${size}/${name}-${variant}.png`;
    const full = `${name}-${variant}`;
    const spoil = SPOILER_STEMS.includes(id) && !PRESS_KIT_ONLY.some((p) => p.name === full) ? await spoilerState(page) : null;
    await page.screenshot({ path: file });
    const { width, height } = pngSize(file);
    const px = SIZE_CFG[size].png;
    report.check(`${size}_${id}_${variant}_png`, width === px.width && height === px.height, `${width}x${height}`);
    if (spoil !== null) report.check(`${size}_${id}_${variant}_no_spoiler`, spoil.frame !== null && spoil.frame <= PLATE_CAP_FRAME && spoil.hits.length === 0 && (spoil.plaque === null || !SPOILER_RE.test(spoil.plaque)), spoil);
    shots.push({ file, size, stem: name, variant, width, height });
  };

  /** Sets inline style.visibility='hidden' on every element matching any selector, awaits fn(), then restores each element's
   *  previous inline visibility in finally (window.__storeShotsHidden holds [el, prev] pairs). Not re-entrant: never nest. */
  const withHidden = async (page, selectors, fn) => {
    await page.evaluate((sels) => {
      const held = [];
      for (const sel of sels) {
        for (const node of document.querySelectorAll(sel)) {
          if (node instanceof HTMLElement) {
            held.push([node, node.style.visibility]);
            node.style.visibility = 'hidden';
          }
        }
      }
      window.__storeShotsHidden = held;
    }, selectors);
    try {
      return await fn();
    } finally {
      await page.evaluate(() => {
        const held = window.__storeShotsHidden ?? [];
        // reverse order: an element matched by two selectors is held twice, the first entry has the real previous value
        for (let i = held.length - 1; i >= 0; i--) held[i][0].style.visibility = held[i][1];
        window.__storeShotsHidden = [];
      });
    }
  };

  /** HUD shot. opts.keepToasts (default false): when false '#toast-stack' is hidden for the shot (F1).
   *  opts.hide: extra selectors hidden for the shot (F3 title version, F4 tree edges, F7 finale buttons).
   *  Era card away first; crank = 3 real crank clicks then 150 ms (gain text on screen); pointer parked at (5, 5). */
  const hudShot = async (page, size, id, name, crank, opts = {}) => {
    await dismissEraCard(page);
    if (crank) {
      await crankClicks(page, 3);
      await page.waitForTimeout(150);
    }
    await page.mouse.move(5, 5);
    const hide = [...(opts.keepToasts ? [] : ['#toast-stack']), ...(opts.hide ?? [])];
    await withHidden(page, hide, () => writeShot(page, size, id, name, 'hud'));
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

  /** Clean shot without photo mode (keeps the live camera framing, used for 01-04, 06 and the finale): #ui-root hidden for the shot, then restored.
   *  Records <size>_<id>_clean_hud_hidden: #hud-panel computed visibility read while #ui-root is hidden, just before the shot. */
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
      const hud = await page.evaluate(() => {
        const panel = document.getElementById('hud-panel');
        return panel ? getComputedStyle(panel).visibility : null;
      });
      report.check(`${size}_${id}_clean_hud_hidden`, hud === 'hidden', { root: 'hidden', hud });
      await writeShot(page, size, id, name, 'clean');
    } finally {
      await page.evaluate((prev) => {
        const root = document.getElementById('ui-root');
        if (root) root.style.visibility = prev;
      }, before);
    }
  };

  /** Every stem of one size, in run order (01-04, 05 tree, 06, 07, 10 title, 08 finale, 08b finale typed, 09 postgame). */
  const runStems = async (page, size) => {
    await runStem(size, '01', async () => {
      await page.goto(withQuery(base, { debug: '1' }), { waitUntil: 'networkidle' });
      await waitReady(page);
      await quietWorld(page);
      await setCap(page, size, '01', PLATE_CAP);
      await crankClicks(page, 12, 120);
      await page.waitForTimeout(2500);
      if (want('clean')) await uiRootHiddenShot(page, size, '01', '01-era1-start');
      if (want('hud')) await hudShot(page, size, '01', '01-era1-start', true);
    });

    await runStem(size, '02', async () => {
      await quietWorld(page);
      await crankClicks(page, 33);
      const failed = await buyList(page, S7);
      report.check(`${size}_02_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('clean')) await uiRootHiddenShot(page, size, '02', '02-era1-full');
      if (want('hud')) await hudShot(page, size, '02', '02-era1-full', true);
    });

    await runStem(size, '03', async () => {
      await quietWorld(page);
      const failed = await buyList(page, delta(S7, S9));
      report.check(`${size}_03_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('clean')) await uiRootHiddenShot(page, size, '03', '03-era2-generator');
      if (want('hud')) await hudShot(page, size, '03', '03-era2-generator', true, { keepToasts: true });
    });

    await runStem(size, '04', async () => {
      await quietWorld(page);
      const failed = await buyList(page, delta(S9, S11));
      report.check(`${size}_04_buys`, failed.length === 0, failed);
      await page.waitForTimeout(2500);
      if (want('clean')) await uiRootHiddenShot(page, size, '04', '04-era3-boiler');
      if (want('hud')) await hudShot(page, size, '04', '04-era3-boiler', true);
    });

    await runStem(size, '05', async () => {
      await quietWorld(page);
      await page.keyboard.press('t');
      try {
        await page.click('#tech-tab-3', { timeout: 5000 });
        await page.waitForTimeout(600);
        if (want('hud')) await hudShot(page, size, '05', '05-tree-era3', false, { hide: ['#hud-panel', '#hud-buttons'] });
      } finally {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });

    await runStem(size, '06', async () => {
      await quietWorld(page);
      const failed = await buyList(page, delta(S11, S13));
      report.check(`${size}_06_buys`, failed.length === 0, failed);
      await page.waitForTimeout(12000);
      if (want('clean')) await uiRootHiddenShot(page, size, '06', '06-era4-spire');
      if (want('hud')) await hudShot(page, size, '06', '06-era4-spire', true);
    });

    await runStem(size, '07', async () => {
      await quietWorld(page);
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
      await quietWorld(page);
      await setCap(page, size, '10', PLATE_CAP);
      await page.waitForTimeout(1500);
      const open = await page.evaluate(() => document.querySelector('#title-screen.is-open') !== null);
      report.check(`${size}_10_title_open`, open, open);
      const hudVis = await page.evaluate(() => ['hud-panel', 'hud-buttons', 'toast-stack'].map((id) => {
        const node = document.getElementById(id);
        return node ? getComputedStyle(node).visibility : 'missing';
      }));
      report.check(`${size}_10_hud_hidden`, hudVis.every((v) => v === 'hidden'), hudVis);
      if (want('hud')) await hudShot(page, size, '10', '10-title', false, { hide: ['#title-version'] });
      await page.evaluate(() => document.getElementById('title-continue')?.focus());
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      const back = await page.evaluate(() => {
        const panel = document.getElementById('hud-panel');
        return panel ? getComputedStyle(panel).visibility : null;
      });
      report.check(`${size}_10_hud_back`, back === 'visible', back);
    });

    await runStem(size, '08', async () => {
      await quietWorld(page);
      await setCap(page, size, '08', null);
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

    if (want('hud')) {
      await runStem(size, '08b', async () => {
        await page.evaluate((t) => window.__wedtmd?.finaleSeek?.(t), FINALE_TYPED_T);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
        const readTyped = () => page.evaluate(() => {
          const lines = [...document.querySelectorAll('#finale-overlay .finale-line')].map((n) => (n.textContent ?? '').trim());
          const st = window.__wedtmd?.finaleState?.() ?? null;
          return {
            count: lines.length,
            empty: lines.filter((s) => s === '').length,
            last: lines.length > 0 ? lines[lines.length - 1] : null,
            phase: st === null ? null : st.phase,
            t: st === null ? null : st.t,
          };
        });
        const isTyped = (v) => v.count === 5 && v.empty === 0 && v.last === FINALE_LAST_LINE;
        let typed = await readTyped();
        // the DOM follows the film clock a frame later: poll up to 1 s (20 x 50 ms) for the 5th line before judging
        for (let i = 0; i < 20 && !isTyped(typed); i++) {
          await page.waitForTimeout(50);
          typed = await readTyped();
        }
        report.check(`${size}_08b_typed`, isTyped(typed), typed);
        await hudShot(page, size, '08b', '08b-finale-typed', false, { hide: ['#finale-skip', '#finale-overlay .finale-buttons'] });
      });
    }

    await runStem(size, '09', async () => {
      await quietWorld(page);
      await setCap(page, size, '09', PLATE_CAP);
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

  const manifest = storeManifest(shots, sizes);
  if (variants.length === 2) report.check('store_top5_complete', manifest.missing.length === 0, manifest.missing);
  fs.writeFileSync(`${outRoot}/store-top5.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  const out = { shots, results: report.results, fail: report.fail, errors: report.errors };
  fs.writeFileSync(`${outRoot}/store-shots.json`, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out));
  process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
}

await main();
