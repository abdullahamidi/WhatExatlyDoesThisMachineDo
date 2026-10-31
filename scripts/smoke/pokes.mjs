// WP28a pokes smoke (C15, cases A-M): the poke targets and their hover brackets, the answers and their sound, the ladder and its leave, the
// crow's hop, the girl's stillness, Sensor 7's head, the economy, the silence gates, the crank, reduced motion, the drag and the facing.
// One browser, a fresh context per case, 1920 x 1080. Cases run at e1 (the S7 list) unless a case says otherwise; G and M also run at s9.
// Usage: PW_PATH=<playwright dir> node scripts/smoke/pokes.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { edition, results, fail, errors } and writes <outdir>/pokes.json.
// A check whose value no hook exposes fails by name with its reason; a skip is { skip: reason } in results, never in fail.
// Setup checks `<KEY>_buys` (the buy lists of a case) sit in results and fail the run when a buy fails.
// Cases (names in results and fail):
//   A hover         A_brackets (pokeStats().hover names each target in turn; cursor pointer)
//   B answer        B_fast (the reaction is set within 0.1 s; within 0.6 s the livingWorld variant changes or shows the reaction's first frame),
//                   B_sound (a real click on the Inspector: audio
//                   pokes +1 at 200 ms, the ack tick; the answer sound starts 300-500 ms later)
//   C variety       C_noRepeat (ten dog pokes 1.2 s apart, each after pokeReset(): no two consecutive identical reactions)
//   D ladder        D_leave (four dog pokes within 6 s: level 3; the dog's x moved >= 16 px; a 5th and a 6th poke give the two wordless
//                   answers, different from each other)
//   E crow hop      E_hop (four crow pokes: the crow's perch changed and its x stayed in the right wing; the machine bbox is not in the hook)
//   F girl          F_still (the girl's x and feet y unchanged over 3 s; her window frame changed: dark or the other flicker); window at e1
//   G Sensor 7      G_track (within 0.5 s the head follows: e1 headR and headC, s9 headL after a pan drag that pokes nothing; a headL target off the canvas is a skip with its reason)
//   H economy       H_none (20 pokes over 30 s: resources changed only by passive income, within 1 %)
//   I silence       I_off (photo mode, and then the finale, disable every poke target)
//   J crank         J_crank (20 crank clicks at the hub: each one a crank click; no poke fired)
//   K reduced       K_noHop (four crow pokes with reduced motion: the crow's x unchanged)
//   L drag          L_drag (a 120 px drag that starts on the dog moves the camera by at least 40 px; no poke fired)
//   M facing        M_away (four pokes each on the Inspector and the dog at e1 and s9; pokes 1 and 3 land on a forced ambient glance (forceGlance),
//                   the answer ends it; every profile frame inside its answer window (real delayMs to the clip end + 100 ms) has flip true
//                   on the left wing and false on the right; a sample outside the window is an ambient camera glance and is skipped;
//                   forced must be > 0 for both actors in both framings)
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, S15, buyList, crankClicks, delta, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/pokes.mjs "<url with ?debug=1>" <outdir>';
const [url, out] = process.argv.slice(2);
if (!process.env.PW_PATH || !url || !out || !URL.canParse(url)) {
  console.error(USAGE);
  process.exit(2);
}
const chromium = loadChromium();
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });

const VIEW = { width: 1920, height: 1080 };
// Mirrored by hand from src/data/pokes.ts (the unavailable clips of era I: DOG_I, INS_I, CROW_I, GIRL_WINDOW) and src/data/worldBehaviour.ts
// (WORLD_STARE_SAFE) and src/data/livingWorld.ts (WORLD_ENV.sensor7.headRangeWorldPx); change them together.
const DOG_WORDLESS = ['dogIdleHead', 'dogIdleLookUp'];
const STARE_SAFE = { inspector: ['front', 'talk'], dog: ['head', 'talk'] };
const SENSOR_RANGE_WORLD = 200;
// The offset beyond the Sensor 7 head range (world px) for the headL and headR checks: past the range, so the head turns. The pointer offset
// on the screen is this times the camera zoom times the canvas scale (client px per game px; the game view is VIEW_GAME_WIDTH wide).
const SENSOR_OFFSET_WORLD = SENSOR_RANGE_WORLD + 60;
const VIEW_GAME_WIDTH = 1280; // src/data/world.ts VIEW.width
const WORD_POKES = ['inspector', 'dog', 'crow', 'sensor7', 'payphone'];
const FINALE_SKIP = 'demo build: the finale needs era V (not in the demo)';
// The Inspector's answer clips (mirrored by hand from src/data/pokes.ts: INS_I, INS_IV and INS_V with the shared DOG_IDLE_LOOK and
// STARE_IDLE_TALK): the frame each clip opens on and its whole length (ms). B_fast reads the first frame; M_away reads the length.
const INS_CLIPS = {
  insGlance: ['glance', 1200], insWrite: ['write0', 1040], insLookUp: ['lookUp', 1000], insWatch: ['watch', 1500], insFront: ['front', 1000],
  insNoted: ['glance', 1920], insLeave: ['glance', 800], insIdleGlance: ['glance', 700], dogIdleLookUp: ['lookUp', 700],
  insAccentWrite: ['write0', 600], insAccentTalk: ['talk', 600], dogAccentLook: ['lookUp', 600], insIvWrite: ['write0', 600],
  insVGlance: ['front', 1200], insVWrite: ['talk', 1000], insVNoted: ['front', 1920], insVLeave: ['front', 800], insVWatch: ['front', 1500],
  insVIdleFront: ['front', 700], dogVIdleTalk: ['talk', 700],
};
// The answer window of a poke (src/data/pokes.ts POKES): the answer starts answerDelayMs after the poke (read per poke from pokeStats) and
// lasts at most maxAnswerMs. A clip that is not in INS_CLIPS (the dog's) uses maxAnswerMs as its length.
const ANSWER_MAX_MS = 2000;

const report = makeReport();
// 'full' or 'demo' once case A has read the edition; null before that
let edition = null;
// the case key that page errors are tagged with (watchPage reads it when an event fires)
let tag = 'setup';

const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];
// A thrown error becomes FAILED:<key>:<first line of the message> in fail; the run goes on.
const recordThrow = (key, e) => { report.fail.push(`FAILED:${key}:${firstLine(e)}`); };
const round = v => (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v);
const wait = (page, ms) => page.waitForTimeout(ms);

// One check group: a throw is recorded under its key and the next group still runs.
const step = async (key, fn) => {
  tag = key;
  try {
    await fn();
  } catch (e) {
    recordThrow(key, e);
  }
};

// One fresh context per case (1920 x 1080, deviceScaleFactor 1); the context closes even after a throw.
const runContext = async (browser, key, fn) => {
  tag = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
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

// ---- page readers (each evaluate is self-contained: no outer variables) ----

const isDemo = page => page.evaluate(() => (window.__wedtmd.demoState?.() ?? null) !== null);
// The living figures and props (livingWorld): id, variant, x, y, alpha, visible, speaking, flip; [] without a World scene.
const livingRows = page => page.evaluate(() => window.__wedtmd.livingWorld?.() ?? []);
const rowOf = (rows, id) => rows.find(r => r.id === id) ?? null;
// The poke readings: { hover, last, unavailable }; null without a World scene.
const pokeStats = page => page.evaluate(() => window.__wedtmd.pokeStats?.() ?? null);
// One debug poke (the reaction id, or null when the director ignores the poke).
const poke = (page, id) => page.evaluate(want => window.__wedtmd.poke?.(want) ?? null, id);
const pokeReset = page => page.evaluate(() => { window.__wedtmd.pokeReset?.(); });
// The poke target of an id in client px: { x, y, w, h, cx, cy, enabled }; null when it is not on screen.
const targetOf = (page, id) => page.evaluate(want => {
  const t = (window.__wedtmd.pokeTargets?.() ?? []).find(item => item.id === want);
  if (!t) return null;
  return { x: t.x, y: t.y, w: t.w, h: t.h, cx: t.x + t.w / 2, cy: t.y + t.h / 2, enabled: t.enabled };
}, id);
const targetsEnabled = page => page.evaluate(() => {
  const list = window.__wedtmd.pokeTargets?.() ?? [];
  return { count: list.length, enabled: list.filter(t => t.enabled === true).length };
});
const canvasCursor = page => page.evaluate(() => document.querySelector('#game canvas')?.style.cursor ?? null);
const crankPoint = page => page.evaluate(() => window.__wedtmd.crankClientPoint());
const cameraInfo = page => page.evaluate(() => {
  const c = window.__wedtmd.cameraState?.();
  return c ? { centerX: c.centerX, zoom: c.zoom, anchorX: c.centerX - c.relX } : null;
});
const audioStat = (page, key) => page.evaluate(k => window.__wedtmd.audioStats?.()?.[k] ?? null, key);
const audioUnlocked = page => poll(page, () => window.__wedtmd.audioUnlocked?.() === true, null, 3000);
const resources = page => page.evaluate(() => ({ ...window.__wedtmd.session.state.res }));
const rates = page => page.evaluate(() => ({ ...window.__wedtmd.session.rates.perSecond }));
const sessionClicks = page => page.evaluate(() => window.__wedtmd.session.stats.clicks);

// Facing (M): a profile frame is any frame that is not camera-facing for its actor and not a walk frame (walks flip with the travel).
const isProfile = (actor, variant) => !(STARE_SAFE[actor] ?? []).includes(variant) && !/^walk\d$/.test(variant);

// Compact readout for the JSON detail.
const briefRow = r => (r === null ? null : { id: r.id, variant: r.variant, x: round(r.x), y: r.y, alpha: r.alpha, flip: r.flip });

// Moves the pointer onto a target's centre (a few steps, so hover and the zone's pointerover fire).
const hoverTarget = async (page, t) => {
  await page.mouse.move(t.cx, t.cy, { steps: 4 });
  await wait(page, 150);
};

// Each sample: one actor's variant, x, flip and the page clock (performance.now) of the read. Used by the facing check.
const sampleActor = (page, actor) => page.evaluate((want) => {
  const t = performance.now();
  const r = (window.__wedtmd.livingWorld?.() ?? []).find(x => x.id === want) ?? null;
  return r === null ? null : { t, variant: r.variant, x: r.x, flip: r.flip === true };
}, actor);
// One debug poke with the page clock of the call: { t, reaction } (reaction null when the director ignores it).
const pokeAt = (page, id) => page.evaluate((want) => {
  const t = performance.now();
  return { t, reaction: window.__wedtmd.poke?.(want) ?? null };
}, id);
// The canvas scale: client px per game px (the canvas shows the VIEW_GAME_WIDTH game view at its own width); null without a canvas.
const canvasScale = page => page.evaluate((viewWidth) => {
  const canvas = document.querySelector('#game canvas');
  return canvas ? canvas.getBoundingClientRect().width / viewWidth : null;
}, VIEW_GAME_WIDTH);

// ---- build and commit (the buy lists go through buyList; the commit step is the one of faults.mjs) ----

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and keep tinkering
// (as faults.mjs). On the full build demoState() is null and the helper returns at once.
const clearDemoCap = async page => {
  const phase = () => page.evaluate(() => window.__wedtmd.demoState?.()?.phase ?? null);
  if ((await phase()) === null) return;
  await poll(page, () => ['teaser', 'card', 'idle'].includes(window.__wedtmd.demoState?.()?.phase), null, 8000, 100);
  if ((await phase()) === 'teaser') {
    await page.click('#demo-skip', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState?.()?.phase === 'card', null, 5000, 100);
  }
  if ((await phase()) === 'card') {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await poll(page, () => window.__wedtmd.demoState?.()?.phase === 'idle', null, 5000, 100);
  }
  await wait(page, 500);
};

// One buy list: `<key>_buys` is the failed-buy list (empty = every buy worked); the demo cap is cleared after it.
const buildStage = async (page, key, buys) => {
  const failed = await buyList(page, buys);
  report.check(`${key}_buys`, failed.length === 0, failed);
  await clearDemoCap(page);
};

// The F6.4 commit step: the TECH INDEX opens and closes (1.2 s, Escape, 2.5 s), then the era card clears and the cursor leaves the canvas.
// The cast moves to a new framing only while the TECH INDEX is open (unseenChangeOk), so the s9 case relies on it.
const commit = async page => {
  await page.keyboard.press('t');
  await wait(page, 1200);
  await page.keyboard.press('Escape');
  await wait(page, 2500);
  await dismissEraCard(page);
  await page.mouse.move(5, 5);
  await wait(page, 400);
};

// The e1 page: the S7 list and the commit step (the era I framing).
const e1Page = async (ctx, key) => {
  const page = await openPage(ctx);
  await crankClicks(page, 45, 0);
  await buildStage(page, key, S7);
  await commit(page);
  return page;
};

// ---- cases ----

// A hover: the hover brackets name each target in turn, with the hand cursor.
const caseA = async ctx => {
  const page = await openPage(ctx);
  await step('A', async () => {
    edition = (await isDemo(page)) ? 'demo' : 'full';
    await crankClicks(page, 45, 0);
    await buildStage(page, 'A', S7);
    await commit(page);
    const seen = [];
    for (const id of WORD_POKES) {
      const t = await targetOf(page, id);
      if (t === null) {
        seen.push({ id, onScreen: false });
        continue;
      }
      await hoverTarget(page, t);
      const hover = await poll(page, (want) => window.__wedtmd.pokeStats?.()?.hover === want, id, 800, 50);
      seen.push({ id, hover: hover === true, cursor: await canvasCursor(page) });
    }
    report.check('A_brackets', seen.every(s => s.hover === true && s.cursor === 'pointer'), seen);
  });
};

// B answer: a debug poke on the Inspector starts its answer within 0.6 s; a real click on it plays the tick (audio pokes +1 at 200 ms).
// B_fast: the reaction is set within 100 ms, and within 600 ms the variant differs from before or already shows the reaction's first frame
// (the Inspector can show that frame before the poke, so a change alone would miss the answer).
const caseB = async ctx => {
  const page = await e1Page(ctx, 'B');
  await step('B', async () => {
    await audioUnlocked(page);
    const before = rowOf(await livingRows(page), 'inspector')?.variant ?? null;
    const reaction = await poke(page, 'inspector');
    const setInTime = reaction !== null && await poll(page, (want) => (window.__wedtmd.pokeStats?.()?.last?.inspector?.reaction ?? null) === want,
      reaction, 100, 10) === true;
    const first = reaction === null ? null : (INS_CLIPS[reaction]?.[0] ?? null);
    const started = await poll(page, ({ was, shown }) => {
      const r = (window.__wedtmd.livingWorld?.() ?? []).find(x => x.id === 'inspector');
      return !!r && (r.variant !== was || r.variant === shown);
    }, { was: before, shown: first }, 600, 30);
    report.check('B_fast', reaction !== null && setInTime && started === true, {
      reaction, setWithin100ms: setInTime, first, before, after: rowOf(await livingRows(page), 'inspector')?.variant ?? null,
    });
    // a real click (the zone path plays the ack tick; the debug poke plays no sound)
    await wait(page, 1500);
    const t = await targetOf(page, 'inspector');
    const p0 = await audioStat(page, 'pokes');
    if (t !== null) {
      await hoverTarget(page, t);
      await page.mouse.click(t.cx, t.cy);
    }
    await wait(page, 200);
    const p1 = await audioStat(page, 'pokes');
    report.check('B_sound', t !== null && p0 !== null && p1 === p0 + 1, { before: p0, after: p1 });
  });
};

// C variety: ten dog pokes, each after pokeReset(): the reactions never repeat twice in a row.
const caseC = async ctx => {
  const page = await e1Page(ctx, 'C');
  await step('C', async () => {
    const reactions = [];
    for (let i = 0; i < 10; i++) {
      await pokeReset(page);
      reactions.push(await poke(page, 'dog'));
      await wait(page, 1200);
    }
    const noRepeat = reactions.every(r => r !== null) && reactions.every((r, i) => i === 0 || r !== reactions[i - 1]);
    report.check('C_noRepeat', noRepeat, { reactions });
  });
};

// D ladder: four dog pokes within 6 s (level 3 and the leave walk); the dog's x moves; a 5th and a 6th poke within 20 s answer wordlessly.
const caseD = async ctx => {
  const page = await e1Page(ctx, 'D');
  await step('D', async () => {
    await pokeReset(page);
    const x0 = rowOf(await livingRows(page), 'dog')?.x ?? null;
    for (let i = 0; i < 3; i++) {
      await poke(page, 'dog');
      await wait(page, 1500);
    }
    const fourth = await poke(page, 'dog');
    const level = (await pokeStats(page))?.last?.dog?.level ?? null;
    let maxDelta = 0;
    for (let i = 0; i < 20; i++) {
      await wait(page, 200);
      const x = rowOf(await livingRows(page), 'dog')?.x ?? null;
      if (x !== null && x0 !== null) maxDelta = Math.max(maxDelta, Math.abs(x - x0));
    }
    const r5 = await poke(page, 'dog');
    await wait(page, 1500);
    const r6 = await poke(page, 'dog');
    const wordless = r5 !== null && r6 !== null && r5 !== r6 && DOG_WORDLESS.includes(r5) && DOG_WORDLESS.includes(r6);
    const ok = fourth !== null && level === 3 && maxDelta >= 16 && wordless;
    report.check('D_leave', ok, { fourth, level, moved: round(maxDelta), pokes: [r5, r6] });
  });
};

// E crow hop: four crow pokes; the crow leaves its perch (its position changes) and its x stays in the right wing (x beyond the machine).
// The machine bbox is not exposed by the hook: the perch arc is covered by the linePath and hop unit tests.
const caseE = async ctx => {
  const page = await e1Page(ctx, 'E');
  await step('E', async () => {
    await pokeReset(page);
    const crow0 = rowOf(await livingRows(page), 'crow');
    for (let i = 0; i < 4; i++) {
      await poke(page, 'crow');
      await wait(page, 1200);
    }
    const info = await cameraInfo(page);
    let maxDev = 0;
    let minX = Infinity;
    for (let i = 0; i < 25; i++) {
      await wait(page, 150);
      const c = rowOf(await livingRows(page), 'crow');
      if (c !== null && crow0 !== null) {
        maxDev = Math.max(maxDev, Math.abs(c.x - crow0.x), Math.abs(c.y - crow0.y));
        minX = Math.min(minX, c.x);
      }
    }
    const rightWing = info !== null && Number.isFinite(minX) && minX > info.anchorX;
    report.check('E_hop', crow0 !== null && maxDev >= 8 && rightWing, {
      start: briefRow(crow0), moved: round(maxDev), minX: round(minX), anchorX: info?.anchorX ?? null,
      bbox: 'not in the hook (linePath and hop unit tests)',
    });
  });
};

// F girl: the window girl answers with her window frame only (dark, or the other flicker frame); her x and feet y stay and her alpha does not move.
const girlRow = rows => rows.find(r => r.id === 'girl') ?? rows.find(r => /girl|window/i.test(r.id)) ?? null;
const caseF = async ctx => {
  const page = await e1Page(ctx, 'F');
  await step('F', async () => {
    const g0 = girlRow(await livingRows(page));
    const reaction = await poke(page, 'girl');
    const samples = [];
    for (let i = 0; i < 20; i++) {
      await wait(page, 150);
      const g = girlRow(await livingRows(page));
      if (g !== null) samples.push({ variant: g.variant, x: g.x, y: g.y, alpha: g.alpha });
    }
    const still = g0 !== null && samples.length > 0 && samples.every(s => s.x === g0.x && s.y === g0.y);
    // the window girl answers with her frame (window-dark, or window-flicker-alt on a flicker answer) and never her alpha (WP28a r2): `lit` needs a frame change, an alpha change alone does not pass
    const lit = g0 !== null && samples.some(s => s.variant !== g0.variant);
    const variants = [...new Set(samples.map(s => s.variant))];
    report.check('F_still', reaction !== null && still && lit, { reaction, start: briefRow(g0), lit, variants, samples: samples.length });
  });
};

// G Sensor 7: the head follows the pointer within 0.5 s. At e1 the pointer goes right of the tripod (headR) and to its centre (headC). The
// tripod is about 156 client px from the left edge at e1, so headL cannot show there: it is checked at s9 (buildStage delta(S7, S9)), where
// Sensor 7 stands at the left screen edge (client x about 4). At s9 a real drag to the right from empty ground pans the camera first (it pokes
// nothing: pokeStats().last is unchanged), so the tripod moves into the canvas. Where the left target still lies off the canvas, headL is a
// skip with its reason, as the e1 headL is.
const PAN_SPAN = 400; // client px of the s9 pan drag (the grab drag moves the view by the pointer's move: the tripod moves right)
const headAt = async (page, x, y, want) => {
  await page.mouse.move(x, y, { steps: 6 });
  const ok = await poll(page, (w) => (window.__wedtmd.livingWorld?.() ?? []).find(r => r.id === 'sensor7')?.variant === w, want, 500, 50);
  return { want, ok: ok === true, variant: rowOf(await livingRows(page), 'sensor7')?.variant ?? null, x: round(x) };
};
// The canvas box in client px (left, right, top, bottom); null without a canvas.
const canvasBox = page => page.evaluate(() => {
  const r = document.querySelector('#game canvas')?.getBoundingClientRect();
  return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
});
// A canvas point on empty ground with span px of room to its right: clear of every poke target and of the crank (the crank zone blocks a
// camera drag), and the canvas is the element under it. null when there is none.
const emptyGroundPoint = (page, span) => page.evaluate((s) => {
  const canvas = document.querySelector('#game canvas');
  if (!canvas) return null;
  const box = canvas.getBoundingClientRect();
  const targets = window.__wedtmd.pokeTargets?.() ?? [];
  const crank = window.__wedtmd.crankClientPoint();
  const clear = (x, y) => {
    if (Math.hypot(x - crank.x, y - crank.y) < 90) return false;
    if (targets.some(t => x >= t.x - 12 && x <= t.x + t.w + 12 && y >= t.y - 12 && y <= t.y + t.h + 12)) return false;
    return document.elementFromPoint(x, y) === canvas;
  };
  for (const fy of [0.5, 0.6, 0.7, 0.4, 0.8, 0.3]) {
    for (let fx = 0.2; fx <= 0.6; fx += 0.05) {
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      if (x + s + 8 > box.right) continue;
      if (clear(x, y) && clear(x + s, y)) return { x, y };
    }
  }
  return null;
}, span);
// The s9 pan: a real drag (down, steps, up) to the right from empty ground. pokeStats().last is read before and after: pokeFree is true when
// the drag fired no poke (true too when no empty ground was found: nothing was dragged).
const panRight = async page => {
  const start = await emptyGroundPoint(page, PAN_SPAN);
  if (start === null) return { started: false, pokeFree: true };
  const last0 = JSON.stringify((await pokeStats(page))?.last ?? null);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + PAN_SPAN, start.y, { steps: 12 });
  await page.mouse.up();
  await wait(page, 300);
  const last1 = JSON.stringify((await pokeStats(page))?.last ?? null);
  return { started: true, from: round(start.x), span: PAN_SPAN, pokeFree: last0 === last1 };
};
const caseG = async ctx => {
  const page = await e1Page(ctx, 'G');
  await step('G', async () => {
    const t = await targetOf(page, 'sensor7');
    const info = await cameraInfo(page);
    const scale = await canvasScale(page);
    if (t === null || info === null || scale === null) {
      report.check('G_track', false, 'sensor7 is not on screen (pokeTargets)');
      return;
    }
    // the offset: SENSOR_OFFSET_WORLD world px x zoom x canvas scale (client px)
    const offset = SENSOR_OFFSET_WORLD * info.zoom * scale;
    const headR = await headAt(page, t.cx + offset, t.cy, 'headR');
    const headC = await headAt(page, t.cx, t.cy, 'headC');
    const e1 = { headR, headC, headL: { skip: 'e1: the tripod is about 156 client px from the left edge, so the left offset is off screen (s9 checks headL)' } };
    await buildStage(page, 'G9', delta(S7, S9));
    await commit(page);
    // the pan comes before the left move: the tripod is read after it (the drag may shift the view)
    const pan = await panRight(page);
    const t9 = await targetOf(page, 'sensor7');
    const info9 = await cameraInfo(page);
    const scale9 = await canvasScale(page);
    const box9 = await canvasBox(page);
    if (t9 === null || info9 === null || scale9 === null || box9 === null) {
      report.check('G_track', false, { e1, s9: { pan, error: 'sensor7 is not on screen at s9 (pokeTargets)' } });
      return;
    }
    const px = t9.cx - SENSOR_OFFSET_WORLD * info9.zoom * scale9;
    // the pointer target must lie inside the canvas box (8 px in from its left and right edges) before the head is read
    const onCanvas = px >= box9.left + 8 && px <= box9.right - 8;
    const headL = onCanvas
      ? await headAt(page, px, t9.cy, 'headL')
      : { skip: `s9: the left target is off the canvas after the pan (x ${round(px)}, tripod x ${round(t9.cx)})` };
    const headLOk = headL.skip !== undefined || headL.ok === true;
    report.check('G_track', headR.ok && headC.ok && headLOk && pan.pokeFree === true, {
      e1, s9: { pan, headL }, range: SENSOR_RANGE_WORLD, offsetWorld: SENSOR_OFFSET_WORLD,
    });
  });
};

// H economy: twenty pokes over 30 s change nothing but the passive income: each energy gained what its rate gives, within 1 %.
const caseH = async ctx => {
  const page = await e1Page(ctx, 'H');
  await step('H', async () => {
    const res0 = await resources(page);
    const rate0 = await rates(page);
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      await poke(page, WORD_POKES[i % WORD_POKES.length]);
      await wait(page, 1500);
    }
    const elapsed = (Date.now() - t0) / 1000;
    const res1 = await resources(page);
    const rate1 = await rates(page);
    const rows = {};
    let ok = true;
    for (const r of Object.keys(rate0)) {
      const rate = (rate0[r] + (rate1[r] ?? rate0[r])) / 2;
      if (!(rate > 0)) continue;
      const gained = (res1[r] ?? 0) - (res0[r] ?? 0);
      const expected = rate * elapsed;
      rows[r] = { gained: round(gained), expected: round(expected) };
      if (!(Math.abs(gained - expected) <= 0.01 * expected)) ok = false;
    }
    report.check('H_none', ok && Object.keys(rows).length > 0, { elapsed: round(elapsed), rows });
  });
};

// I silence: photo mode disables every poke target; the finale does too (the ending phase). Demo: the finale part is skipped.
const caseI = async ctx => {
  const page = await e1Page(ctx, 'I');
  await step('I', async () => {
    const demo = await isDemo(page);
    await page.evaluate(() => window.__wedtmd.photoMode?.(true));
    await wait(page, 600);
    const photo = await targetsEnabled(page);
    const photoOk = photo.count > 0 && photo.enabled === 0;
    await page.evaluate(() => window.__wedtmd.photoMode?.(false));
    await wait(page, 300);
    let finale = null;
    let finaleOk = true;
    if (demo) {
      // the finale part needs era V: on the demo build I_off covers photo mode only (the detail says so)
      finale = FINALE_SKIP;
    } else {
      await buildStage(page, 'I15', delta(S7, S15));
      await buildStage(page, 'Ifin', ['primaryFunction']);
      await page.evaluate(() => window.__wedtmd?.skipFinale?.());
      await wait(page, 600);
      finale = await targetsEnabled(page);
      finaleOk = finale.count > 0 && finale.enabled === 0;
    }
    report.check('I_off', photoOk && finaleOk, { photo, finale });
  });
};

// J crank: twenty clicks at the hub are twenty crank clicks, and none of them pokes.
const caseJ = async ctx => {
  const page = await e1Page(ctx, 'J');
  await step('J', async () => {
    await audioUnlocked(page);
    const pt = await crankPoint(page);
    const clicks0 = await sessionClicks(page);
    const pokes0 = await audioStat(page, 'pokes');
    const last0 = Object.keys((await pokeStats(page))?.last ?? {}).length;
    for (let i = 0; i < 20; i++) {
      await page.mouse.click(pt.x, pt.y);
      await wait(page, 60);
    }
    const clicks1 = await sessionClicks(page);
    const pokes1 = await audioStat(page, 'pokes');
    const last1 = Object.keys((await pokeStats(page))?.last ?? {}).length;
    report.check('J_crank', clicks1 === clicks0 + 20 && pokes1 === pokes0 && last1 === last0, {
      clicks: [clicks0, clicks1], pokes: [pokes0, pokes1], answered: [last0, last1],
    });
  });
};

// K reduced motion: four crow pokes with reduced motion on: the crow never hops (its x stays).
const caseK = async ctx => {
  const page = await e1Page(ctx, 'K');
  await step('K', async () => {
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await wait(page, 300);
    const x0 = rowOf(await livingRows(page), 'crow')?.x ?? null;
    for (let i = 0; i < 4; i++) {
      await poke(page, 'crow');
      await wait(page, 1200);
    }
    const xs = [];
    for (let i = 0; i < 12; i++) {
      await wait(page, 250);
      xs.push(rowOf(await livingRows(page), 'crow')?.x ?? null);
    }
    report.check('K_noHop', x0 !== null && xs.every(x => x === x0), { x0, xs: xs.slice(0, 6) });
  });
};

// L drag: a 120 px drag from the dog pans the camera and pokes nothing.
const caseL = async ctx => {
  const page = await e1Page(ctx, 'L');
  await step('L', async () => {
    const t = await targetOf(page, 'dog');
    const c0 = (await cameraInfo(page))?.centerX ?? null;
    const before = JSON.stringify((await pokeStats(page))?.last?.dog ?? null);
    if (t !== null) {
      await page.mouse.move(t.cx, t.cy);
      await page.mouse.down();
      await page.mouse.move(t.cx + 120, t.cy, { steps: 12 });
      await page.mouse.up();
    }
    await wait(page, 300);
    const c1 = (await cameraInfo(page))?.centerX ?? null;
    const after = JSON.stringify((await pokeStats(page))?.last?.dog ?? null);
    const moved = c0 !== null && c1 !== null ? Math.abs(c1 - c0) : null;
    report.check('L_drag', t !== null && moved !== null && moved >= 40 && before === after, {
      centreX: [c0, c1], moved: round(moved), lastDogBefore: before, lastDogAfter: after,
    });
  });
};

// forceGlance is refused while the actor's last poke answer span runs (glanceFree), so the call polls every 100 ms for up to FORCE_WAIT_MS.
// True when a glance started.
const FORCE_WAIT_MS = 4500;
const forceGlance = async (page, actor) => {
  for (let waited = 0; waited <= FORCE_WAIT_MS; waited += 100) {
    if (await page.evaluate(want => window.__wedtmd.forceGlance?.(want) ?? false, actor)) return true;
    await wait(page, 100);
  }
  return false;
};

// M facing: four pokes each on the Inspector and the dog at e1 and s9. Every profile frame of either actor, in every sample of the
// answers, faces away from the machine (flip true left of the machine anchor, false right of it); walk frames are not profile frames.
// WP28a r3: pokes 1 and 3 of each actor start on a forced ambient glance (forceGlance, the debug hook); the answer must end that glance
// (LivingWorldDirector.playAnswer cuts its turn), so the answer's frames face away from the machine. forced counts the glances that started.
// Only a sample inside its poke's answer window counts: from the real answer delay (pokeStats().last[actor].delayMs, the director's reading)
// after the poke to the clip length (INS_CLIPS, or ANSWER_MAX_MS for a dog clip) plus 100 ms. A profile sample outside it is the WP23 ambient
// camera glance (worldTurn glancePose draws the glance frame unflipped while the head turns to the camera); it is skipped and counted in skipped.
const facingCheck = async (page, framing) => {
  const info = await cameraInfo(page);
  const anchorX = info?.anchorX ?? null;
  const counts = { inspector: 0, dog: 0 };
  const skipped = { inspector: 0, dog: 0 };
  const forced = { inspector: 0, dog: 0 };
  const violations = [];
  for (const actor of ['inspector', 'dog']) {
    await pokeReset(page);
    for (let i = 0; i < 4; i++) {
      // Pokes 1 and 3 (i 0 and 2) land 120 ms after a forced glance on the actor; pokes 2 and 4 are plain.
      if (i % 2 === 0) {
        if (await forceGlance(page, actor)) forced[actor] += 1;
        await wait(page, 120);
      }
      const shot = await pokeAt(page, actor);
      // The real answer delay of this poke (null when the poke was ignored or has no reading: no window, every sample is skipped).
      const delayMs = shot.reaction === null ? null : ((await pokeStats(page))?.last?.[actor]?.delayMs ?? null);
      const clipMs = INS_CLIPS[shot.reaction]?.[1] ?? ANSWER_MAX_MS;
      const from = delayMs === null ? Number.POSITIVE_INFINITY : shot.t + delayMs;
      const to = from + clipMs + 100;
      for (let k = 0; k < 6; k++) {
        await wait(page, 170);
        const s = await sampleActor(page, actor);
        if (s === null || anchorX === null) continue;
        if (!isProfile(actor, s.variant)) continue;
        if (shot.reaction === null || s.t < from || s.t > to) {
          skipped[actor] += 1;
          continue;
        }
        counts[actor] += 1;
        const expected = s.x < anchorX;
        if (s.flip !== expected) {
          violations.push({ framing, actor, variant: s.variant, x: round(s.x), flip: s.flip, reaction: shot.reaction, msAfterPoke: round(s.t - shot.t) });
        }
      }
    }
    await wait(page, 2000);
  }
  return { framing, anchorX, forced, counts, skipped, violations };
};
const caseM = async ctx => {
  const page = await e1Page(ctx, 'M');
  await step('M', async () => {
    const e1 = await facingCheck(page, 'e1');
    await buildStage(page, 'M9', delta(S7, S9));
    await commit(page);
    const s9 = await facingCheck(page, 's9');
    const sets = [e1, s9];
    const sampled = sets.every(s => s.counts.inspector > 0 && s.counts.dog > 0);
    // Both actors need a forced glance that started in both framings, or the answer-over-glance case never ran (WP28a r3).
    const forcedOk = sets.every(s => s.forced.inspector > 0 && s.forced.dog > 0);
    const violations = sets.flatMap(s => s.violations);
    const reason = !forcedOk ? 'no forced glance started on an actor (forceGlance refused)' : !sampled ? 'no profile sample inside an answer window'
      : violations.length > 0 ? 'profile frame unflipped inside an answer window' : null;
    report.check('M_away', reason === null, { reason, forced: sets.map(s => s.forced), sets, violations: violations.slice(0, 10) });
  });
};

let browser = null;
try {
  browser = await chromium.launch();
  await runContext(browser, 'A', caseA);
  await runContext(browser, 'B', caseB);
  await runContext(browser, 'C', caseC);
  await runContext(browser, 'D', caseD);
  await runContext(browser, 'E', caseE);
  await runContext(browser, 'F', caseF);
  await runContext(browser, 'G', caseG);
  await runContext(browser, 'H', caseH);
  await runContext(browser, 'I', caseI);
  await runContext(browser, 'J', caseJ);
  await runContext(browser, 'K', caseK);
  await runContext(browser, 'L', caseL);
  await runContext(browser, 'M', caseM);
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors };
fs.writeFileSync(path.join(out, 'pokes.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
