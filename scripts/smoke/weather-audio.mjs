// WP26 T4 weather audio smoke: the wind and rain levels follow the world (levels only, never timing).
// Full edition: the wind follows the day clock (gusts, a floor in still air, no gust LFO in eras IV-V), the rain follows the visible virga in era III only,
// the finale's windStop beat takes the wind to zero, and mute / the choice / the postgame read zero.
// Demo edition: the same stages up to era II (S7, S9) with the mute check at S9, plus DEMO_rain_always_zero.
// Usage: PW_PATH=<playwright dir> node scripts/smoke/weather-audio.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { edition, results, fail, errors, samples } and writes <outdir>/weather-audio.json.
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, S11, S13, S15, buyList, crankClicks, delta, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/weather-audio.mjs "<url with ?debug=1>" <outdir>';
const [url, out] = process.argv.slice(2);
if (!process.env.PW_PATH || !url || !out || !URL.canParse(url)) {
  console.error(USAGE);
  process.exit(2);
}
const chromium = loadChromium();
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });

// Mirrored by hand from src/data/audio.ts (AUDIO.wind.gain, AUDIO.wind.floor, AUDIO.rain.hzMin / hzMax); change them together.
const WIND_GAIN = 0.05; // AUDIO.wind.gain: the wind bed gain at full wind
const WIND_FLOOR = 0.3; // AUDIO.wind.floor: the share of the wind bed that still plays in still air
const FLOOR_GAIN = WIND_GAIN * WIND_FLOOR; // 0.015: the still-air wind gain (eras IV-V, after the windStop beat)
const TOL = 0.0005; // level tolerance for every gain check (a level, never a time)
const RAIN_HZ_MIN = 1800; // AUDIO.rain.hzMin: the rain pitch at no speed
const RAIN_HZ_MAX = 3200; // AUDIO.rain.hzMax: the rain pitch at full speed

const report = makeReport();
// per-stage snapshots for the JSON output (the EM reads these when a check fails)
const samples = {};
// the window results of MAIN, read by DEMO_rain_always_zero
const windows = {};
// the case key that page errors are tagged with (watchPage reads it when an event fires)
let tag = 'setup';
// 'full' or 'demo' once MAIN has read the edition; null before that
let edition = null;

// near(v, want): a finite level within TOL of want (NaN and null never match)
const near = (v, want) => Number.isFinite(v) && Math.abs(v - want) <= TOL;
const r5 = v => (Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : v);
const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];
// A thrown error becomes FAILED:<key>:<first line of the message> in fail; the run goes on.
const recordThrow = (key, e) => { report.fail.push(`FAILED:${key}:${firstLine(e)}`); };

// One check group: a throw is recorded under its key and the next group still runs.
const step = async (key, fn) => {
  tag = key;
  try {
    await fn();
  } catch (e) {
    recordThrow(key, e);
  }
};

// One fresh context per case (1280 x 720, deviceScaleFactor 1); the context closes even after a throw.
const runContext = async (browser, key, fn) => {
  tag = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await fn(ctx);
  } catch (e) {
    recordThrow(key, e);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
};

// Fresh page on the target URL with the hook and the hand crank ready.
const openPage = async ctx => {
  const page = await ctx.newPage();
  watchPage(page, report.errors, () => tag);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  return page;
};

// Real crank clicks unlock the audio and bank the ME that Worn Motor costs (45 clicks, as economy.mjs); up to 3 s for the unlock flag and the first ambient tick.
const unlock = async page => {
  await crankClicks(page, 45, 0);
  await poll(page, () => window.__wedtmd.audioUnlocked() === true && window.__wedtmd.audioStats()?.ambient != null, null, 3000, 100);
};

const isDemo = page => page.evaluate(() => window.__wedtmd.demoState() !== null);

// Mix readout: the last 200 ms ambient tick (post-gate: zero when muted, in the choice and in the postgame) and the wind bed's level set.
const amb = page => page.evaluate(() => {
  const st = window.__wedtmd.audioStats();
  const a = st?.ambient ?? null;
  return {
    era: a?.era ?? null,
    windGain: a?.windGain ?? null,
    windLfo: a?.windLfo ?? null,
    rainGain: a?.rainGain ?? null,
    rainHz: a?.rainHz ?? null,
    live: a?.live ?? null,
    windOn: st?.levels?.wind ?? null,
  };
});

// One world step, then one tick period (the mix ticks every 200 ms of real time), then the mix.
const advance = async (page, ms) => {
  await page.evaluate(m => window.__wedtmd.worldAdvance(m), ms);
  await page.waitForTimeout(260);
  return amb(page);
};

// Stage landing: settle on snaps every target, a 700 ms hold, settle off again. Settle forces the gusts off,
// so every variation window starts after settle is off.
const land = async page => {
  await page.evaluate(() => window.__wedtmd.worldSettle(true));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__wedtmd.worldSettle(false));
  await page.waitForTimeout(260);
  return amb(page);
};

// worldMs of world time in 1 s steps: min / max wind gain, max rain gain, whether every sample was live, and the samples.
const windowOf = async (page, worldMs) => {
  const rows = [];
  for (let i = 0; i < worldMs / 1000; i++) rows.push(await advance(page, 1000));
  const wind = rows.map(r => r.windGain ?? NaN);
  const rain = rows.map(r => r.rainGain ?? NaN);
  return {
    min: Math.min(...wind),
    max: Math.max(...wind),
    maxRain: Math.max(...rain),
    allLive: rows.every(r => r.live === true),
    samples: rows,
  };
};

// Compact window record for the JSON output: per-second wind and rain gains (5 decimals).
const summarize = w => ({
  min: r5(w.min),
  max: r5(w.max),
  maxRain: r5(w.maxRain),
  allLive: w.allLive,
  windGain: w.samples.map(r => r5(r.windGain)),
  rainGain: w.samples.map(r => r5(r.rainGain)),
});

// Polls the mix every 250 ms (no world step) until the rain gain is above zero or capMs has passed; returns the last mix.
const pollRain = async (page, capMs) => {
  const deadline = Date.now() + capMs;
  let a = await amb(page);
  while (!(a.rainGain > 0) && Date.now() < deadline) {
    await page.waitForTimeout(250);
    a = await amb(page);
  }
  return a;
};

// The window checks of one stage (prefix S7 or S9): live, the wind varies, no rain, the range, no gust LFO in the last sample.
const windowChecks = (prefix, w) => {
  const last = w.samples[w.samples.length - 1];
  const notLive = w.samples.filter(r => r.live !== true).length;
  const inRange = w.samples.every(r => Number.isFinite(r.windGain) && r.windGain >= FLOOR_GAIN - TOL && r.windGain <= WIND_GAIN + TOL);
  report.check(`${prefix}_live`, w.allLive, { notLive });
  report.check(`${prefix}_wind_varies`, w.max - w.min >= 0.1 * WIND_GAIN, { min: r5(w.min), max: r5(w.max) });
  report.check(`${prefix}_rain_zero`, near(w.maxRain, 0), { maxRain: r5(w.maxRain) });
  report.check(`${prefix}_wind_range`, inRange, { min: r5(w.min), max: r5(w.max) });
  report.check(`${prefix}_no_lfo`, last?.windLfo === false, { windLfo: last?.windLfo ?? null });
};

// One cumulative stage buy: `<key>_buys` is the failed-buy list (empty = every buy worked); the era card is clicked away after it.
const buyStage = async (page, key, buys) => {
  const failed = await buyList(page, buys);
  report.check(`${key}_buys`, failed.length === 0, failed);
  await dismissEraCard(page);
};

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and KEEP TINKERING (as economy.mjs).
const clearDemoCap = async page => {
  const phase = () => page.evaluate(() => window.__wedtmd.demoState()?.phase ?? null);
  await poll(page, () => ['teaser', 'card', 'idle'].includes(window.__wedtmd.demoState()?.phase), null, 8000, 100);
  if ((await phase()) === 'teaser') {
    await page.click('#demo-skip', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState()?.phase === 'card', null, 5000, 100);
  }
  if ((await phase()) === 'card') {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState()?.phase === 'idle', null, 5000, 100);
  }
  await page.waitForTimeout(500);
};

// Mute: the wind and rain gains read zero and the wind is off; unmuted again, the wind is back.
const checkMute = async page => {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ muted: true }));
  await page.waitForTimeout(600);
  const m = await amb(page);
  report.check('MUTE_zero', near(m.windGain, 0) && near(m.rainGain, 0) && m.windOn === false, m);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ muted: false }));
  await page.waitForTimeout(700);
  const u = await amb(page);
  report.check('MUTE_restore', Number.isFinite(u.windGain) && u.windGain > 0, { windGain: u.windGain });
};

const seek = (page, t) => page.evaluate(v => window.__wedtmd.finaleSeek(v), t);

// Finale (full only): the phase sequence from primaryFunction; the wind sits on the floor, then stops at the windStop beat.
const checkFinale = async page => {
  const failed = await buyList(page, ['primaryFunction']);
  report.check('FINALE_buys', failed.length === 0, failed);
  await page.waitForTimeout(300);
  await seek(page, 10);
  await page.waitForTimeout(600);
  const early = await amb(page);
  report.check('FINALE_floor_before_stop', near(early.windGain, FLOOR_GAIN), { windGain: early.windGain });
  await seek(page, 20);
  await page.waitForTimeout(800);
  let stop = await amb(page);
  let fallback = false;
  if (!(near(stop.windGain, 0) && stop.windOn === false)) {
    // the seek did not fire the windStop beat in this run: play on in real time to it
    fallback = true;
    await seek(page, 18.5);
    await page.waitForTimeout(2000);
    stop = await amb(page);
  }
  report.check('FINALE_wind_stop', near(stop.windGain, 0) && stop.windOn === false, { ...stop, fallback });
};

// KEEP IT RUNNING (the same locator as finale.mjs); a miss is an error of the run.
const keepClick = page => page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 })
  .catch(e => report.errors.push(`POSTGAME_keep_click: ${firstLine(e)}`));

// Postgame (full only): skip the finale, KEEP IT RUNNING, then the wind stays silent.
const checkPostgame = async page => {
  await page.evaluate(() => window.__wedtmd.skipFinale());
  await keepClick(page);
  await page.waitForTimeout(1500);
  const p = await amb(page);
  report.check('POSTGAME_wind_zero', near(p.windGain, 0) && p.windOn === false, p);
};

// MAIN (full and demo): one page, unlock, then the cumulative stages up to era V (full) or era II (demo).
const runMain = async ctx => {
  const page = await openPage(ctx);
  await unlock(page);
  const u = await page.evaluate(() => ({ unlocked: window.__wedtmd.audioUnlocked(), ambient: window.__wedtmd.audioStats()?.ambient != null }));
  report.check('W_unlock', u.unlocked === true);
  report.check('W_ambient_present', u.ambient === true);
  const demo = await isDemo(page);
  edition = demo ? 'demo' : 'full';

  await step('S7', async () => {
    await buyStage(page, 'S7', S7);
    await land(page);
    const w = await windowOf(page, 20000);
    windows.S7 = w;
    samples.S7 = summarize(w);
    windowChecks('S7', w);
  });

  await step('S9', async () => {
    await buyStage(page, 'S9', delta(S7, S9));
    if (demo) await clearDemoCap(page);
    await land(page);
    const w = await windowOf(page, 20000);
    windows.S9 = w;
    samples.S9 = summarize(w);
    windowChecks('S9', w);
  });

  if (demo) {
    await step('MUTE', () => checkMute(page));
    const rain = { S7: windows.S7?.maxRain ?? null, S9: windows.S9?.maxRain ?? null };
    report.check('DEMO_rain_always_zero', near(rain.S7, 0) && near(rain.S9, 0), { S7: r5(rain.S7), S9: r5(rain.S9) });
    return;
  }

  await step('S11', async () => {
    await buyStage(page, 'S11', delta(S9, S11));
    await land(page);
    const a = await pollRain(page, 5000);
    samples.S11 = a;
    report.check('S11_rain_positive', a.rainGain > 0, { rainGain: a.rainGain });
    const visible = await page.evaluate(() => window.__wedtmd.livingWorld().some(e => e.id === 'virga' && e.visible === true));
    // diagnostic only: reported in results, never in fail
    report.results.S11_virga_visible = visible;
    report.check('S11_rain_hz', Number.isFinite(a.rainHz) && a.rainHz >= RAIN_HZ_MIN && a.rainHz <= RAIN_HZ_MAX, { rainHz: a.rainHz });
  });

  await step('S13', async () => {
    await buyStage(page, 'S13', delta(S11, S13));
    // no settle here: the base wind eases to zero over about 60 s, so this window runs on the live world
    const w = await windowOf(page, 70000);
    samples.S13 = summarize(w);
    const rain15 = Math.max(...w.samples.slice(0, 15).map(r => r.rainGain ?? NaN));
    report.check('S13_rain_zero', near(rain15, 0), { maxRain15: r5(rain15) });
    const last = w.samples[w.samples.length - 1];
    report.check('S13_wind_floor', near(last.windGain, FLOOR_GAIN) && last.windLfo === false, { windGain: r5(last.windGain), windLfo: last.windLfo });
  });

  await step('S15', async () => {
    await buyStage(page, 'S15', delta(S13, S15));
    const a = await land(page);
    samples.S15 = a;
    report.check('S15_rain_zero', near(a.rainGain, 0), { rainGain: a.rainGain });
    report.check('S15_wind_floor', near(a.windGain, FLOOR_GAIN), { windGain: a.windGain });
  });

  await step('MUTE', () => checkMute(page));
  await step('FINALE', () => checkFinale(page));
  await step('POSTGAME', () => checkPostgame(page));
};

// REDUCED (fresh page, both editions): the wind still varies with reduced motion on.
const runReduced = async ctx => {
  const page = await openPage(ctx);
  await unlock(page);
  await step('REDUCED', async () => {
    await buyStage(page, 'REDUCED', S9);
    if (await isDemo(page)) await clearDemoCap(page);
    await land(page);
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    const w = await windowOf(page, 20000);
    samples.REDUCED = summarize(w);
    report.check('S9_reduced_wind_varies', w.max - w.min >= 0.1 * WIND_GAIN, { min: r5(w.min), max: r5(w.max) });
  });
};

// TEASER (fresh page, both editions): the final-machine teaser reads the mix as not live; it returns to live after it stops.
const runTeaser = async ctx => {
  const page = await openPage(ctx);
  await unlock(page);
  await step('TEASER', async () => {
    await page.evaluate(() => window.__wedtmd.showcasePlay());
    const off = await poll(page, () => window.__wedtmd.audioStats()?.ambient?.live === false, null, 3000, 100);
    const a = await amb(page);
    report.check('TEASER_live_false', off === true, { live: a.live });
    await page.evaluate(() => window.__wedtmd.showcaseStop());
    // report only: recorded as a boolean in results, never in fail
    const back = await poll(page, () => window.__wedtmd.audioStats()?.ambient?.live === true, null, 4000, 100);
    report.results.TEASER_back = back === true;
  });
};

let browser = null;
try {
  browser = await chromium.launch();
  await runContext(browser, 'MAIN', runMain);
  await runContext(browser, 'REDUCED', runReduced);
  await runContext(browser, 'TEASER', runTeaser);
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors, samples };
fs.writeFileSync(path.join(out, 'weather-audio.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
