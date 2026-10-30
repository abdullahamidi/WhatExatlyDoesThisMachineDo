// WP28b roaming and reach smoke (C15, cases A-F): the action gap and the walk range of the roaming cast on four stages and the era IV
// conductor, the machine-event reactions (fault, big buy, Find, era card), the gathering at a woken Splice, the reach FX of each era
// with reduced motion, and the reach's cost. Real time on a quiet PC: nothing is paused or advanced (the scheduler runs on the frames),
// one browser, a fresh context per case. Every read goes through the debug hook (window.__wedtmd).
// Usage: PW_PATH=<playwright dir> node scripts/smoke/roam.mjs "<url with ?debug=1>" <outdir>
// ONLY=<comma list> (env, optional): the case keys to run alone: A_e1, A_s9, A_s11, A_s13, A_s15, C, D, E (all E cases), F; unset runs all.
// Prints ONE JSON object { edition, results, fail, errors } and writes <outdir>/roam.json.
// A check whose value no hook exposes fails by name with its reason; a skip is { skip: reason } in results, never in fail.
// Cases (names in results and fail; shots in <outdir>):
//   A gap        A_gap_e1, A_gap_s9, A_gap_s11, A_gap_s15: the Inspector, the dog and the crow act at least every 12 s over 90 s
//                (samples every 250 ms); A_gap_s13: the era IV conductor switches at least every 12 s; roam-<stage>.png per stage
//   B range      B_range_e1, B_range_s9, B_range_s11, B_range_s15: the Inspector and the dog cover >= 60 % of their spot x-range
//   C reactions  C_wave, C_fault, C_find, C_era: each reaction starts inside its own window (RULES); C_facing: no profile frame of the
//                Inspector or the dog faces the machine in any sample taken in the windows
//   D gather     D_visit: the walker on the woken bicycle's wing shows its visit activity (visitSniff, the dog; visitWrite, the Inspector)
//                at its visit stand within 15 s (the activity and the time seen are in the detail)
//   F budget     F_cost: worldStats meanMs <= 0.30 at S9 (one retry after 5 s); reachStats meanMs <= 0.12 at S9 and S15;
//                F_display: displayObjects <= 100 at S9 and S15
// Exit: 0 ok; 1 when fail or errors is non-empty; 2 usage error (bad args or PW_PATH unset).
import fs from 'fs';
import path from 'path';
import { S7, S9, S11, S13, S15, buyList, crankClicks, dismissEraCard, loadChromium, makeReport, poll, waitReady, watchPage, withQuery } from './lib/common.mjs';

const USAGE = 'usage: PW_PATH=<playwright dir> node scripts/smoke/roam.mjs "<url with ?debug=1>" <outdir>';
const [url, out] = process.argv.slice(2);
if (!process.env.PW_PATH || !url || !out || !URL.canParse(url)) {
  console.error(USAGE);
  process.exit(2);
}
// ONLY (WP28b r1): the case keys run alone; E stands for the five E cases and E_reduced. Unset runs every case.
const ONLY_KEYS = ['A_e1', 'A_s9', 'A_s11', 'A_s13', 'A_s15', 'C', 'D', 'E', 'F'];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(k => k.trim()).filter(k => k !== '') : null;
if (ONLY !== null && ONLY.some(k => !ONLY_KEYS.includes(k))) {
  console.error(`${USAGE}\nONLY: unknown key; use a comma list of ${ONLY_KEYS.join(', ')}`);
  process.exit(2);
}
const wanted = key => ONLY === null || ONLY.includes(key);
const chromium = loadChromium();
fs.mkdirSync(out, { recursive: true });
// the debug hook (window.__wedtmd) exists only with ?debug=1, which also skips the title screen
const target = withQuery(url, { debug: '1' });

const VIEW = { width: 1920, height: 1080 };
// Mirrored by hand from src/data/worldBehaviour.ts (WORLD_BEHAVIOUR, WORLD_SPOTS, WORLD_STARE_SAFE, WORLD_REACT) and src/data/world.ts
// (MACHINE_ANCHOR); change them together.
const ANCHOR_X = 1920;            // MACHINE_ANCHOR.x: the Inspector stands on the left wing, the dog on the right
const ACTION_GAP_MS = 12000;      // A: an action at least every 12 s (WORLD_BEHAVIOUR.actionGapMs)
const ACTION_PX = 8;              // A: a walk of this many px since the last action is an action (WORLD_BEHAVIOUR.actionMinTravelPx)
const RUN_MS = 90000;             // A: the sampling time of one stage run
const SAMPLE_MS = 250;            // A: the sampling cadence of a stage run
const SPOT_COVER = 0.6;           // B: the share of a walker's spot range it covers
const ACTORS_A = ['inspector', 'dog', 'crow'];
const WALKERS_B = ['inspector', 'dog'];
// The feet x range (min, max) of each walker's non-visit spots per framing (WORLD_SPOTS, src/data/worldBehaviour.ts; the v<n> visit
// stands are not in a range). The Inspector's inner-most spot is the max of his range (he stands left of the machine).
const SPOT_RANGE = {
  e1: { inspector: [1390, 1520], dog: [2340, 2520] },
  s8: { inspector: [1536, 1552], dog: [2604, 2656] },
  s8w: { inspector: [1548, 1552], dog: [2694, 2720] },
  s9: { inspector: [1424, 1512], dog: [2856, 2900] },
  s10: { inspector: [1248, 1276], dog: [2858, 2882] },
  s11: { inspector: [740, 846], dog: [2856, 3140] },
  s15: { inspector: [752, 820], dog: [2832, 2880] },
};
const REACT_MS = 100;             // C and D: the sampling cadence of a reaction window
// C: each reaction's window from its trigger, the plan's "Machine-event reactions" latencies (a rule takes its own window, see RULES)
const FAULT_WIN_MS = 1000 + REACT_MS;   // C_fault: every actor starts within 1 s of the fault, plus one sample
const WAVE_SPEED_PX_PER_S = 300;  // C_wave: the ground wave's speed (GROUND_WAVE_SHARED.speedPxPerS, src/data/worldShared.ts)
const WAVE_SLACK_MS = 1000;       // C_wave: the Inspector starts within the wave's travel time to his spot plus 1 s
// C_find: the Inspector points 2-4 s after the spawn (findDelayMs max 4 s, WORLD_REACT) plus the producer's lead (max 0.5 s,
// findProducer.ts) plus 1 s; the dog sniffs within 1 s of the lead
const FIND_WIN_MS = { inspector: 4000 + 500 + 1000, dog: 1000 + 500 };
const ERA_WIN_MS = 8000;          // C_era: the Inspector walks to his inner-most spot within 8 s of the card closing (the walk)
const BIGBUY_COOLDOWN_MS = 30000; // WORLD_REACT.pairCooldownMs: a cue starts once per 30 s per actor (the wave waits after the build's big buys)
const INNER_TOL_PX = 2;           // C_era: the rest spot is reached within this many px
const WAVE_TECH = 'faultLamp';    // C_wave: a cheap unlock (a big buy: the ground wave passes the Inspector)
// D: the walker of the woken object's wing shows its visit activity at the stand. The stand sits VISIT_OFFSET_PX on the machine side of
// the object: the bicycle at e1 has the AD3 C-c dx override (stand 2440@96 for the feet 2488@96); the other objects use 32.
const VISIT_OFFSET_PX = 48;
const VISIT_ACT = { inspector: 'visitWrite', dog: 'visitSniff' };
const VISIT_TOL_PX = 12;          // D: the walker is at the visit stand within this many px
const VISIT_MS = 15000;           // D: the window for the visit
// Camera-facing frames never flip (WORLD_STARE_SAFE); the profile frames face away from the machine (restFlip: true on the left wing,
// false on the right).
const CAMERA_FACING = { inspector: ['front', 'talk'], dog: ['head', 'talk'] };
const AWAY_FLIP = { inspector: true, dog: false };
const BARK_FRAMES = ['bark0', 'bark1'];
const ARC_MS = 20000;             // E: the arcs grow within this time
const DRIFT_MS = 30000;           // E: the steam drift shows within this time
const DEBRIS_MS = 20000;          // E: the debris lifts within this time
const HUM_MS = 3000;              // E: the lamp glow and the booth hood sway over this time
const COST_WORLD_MAX = 0.3;       // F: worldStats meanMs (G_cost)
const COST_REACH_MAX = 0.12;      // F: reachStats meanMs (WP28b B4)
const COST_RETRY_MS = 5000;       // F: the world reading is taken again after this wait when it is over the limit (first read under load)
const DISPLAY_MAX = 100;          // F: displayObjects (G_display)
const SILENT = ['asleep', 'layer-hidden', 'tab-hidden'];   // a world that is not animating gives no cost reading (world.mjs G_cost)
const ERA3 = ['s11', 's13', 's15'];
const DEMO_ERA3 = 'demo edition: era III is refused, so this stage cannot be built';

const report = makeReport();
// 'full' or 'demo' once the first case has read the edition; null before that
let edition = null;
// the case key that page errors are tagged with (watchPage reads it when an event fires)
let tag = 'setup';
// E_reduced rows, one per stage, filled by the reduced-motion cases and read once at the end
const reducedRows = {};

const firstLine = e => String(e && e.message ? e.message : e).split('\n')[0];
// A thrown error becomes FAILED:<key>:<first line of the message> in fail; the run goes on.
const recordThrow = (key, e) => { report.fail.push(`FAILED:${key}:${firstLine(e)}`); };
// A skip: the reason goes into results; a skip is never in fail.
const skip = (name, reason) => { report.results[name] = { skip: reason }; };
const round = v => (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v);
const secs = ms => (Number.isFinite(ms) ? round(ms / 1000) : null);
const within = (v, max) => typeof v === 'number' && v <= max;
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });

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

// Fresh page on the target URL with the hook and the hand crank ready. The first page read sets the edition (a case run alone needs it too).
const openPage = async ctx => {
  const page = await ctx.newPage();
  watchPage(page, report.errors, () => tag);
  await page.goto(target, { waitUntil: 'load' });
  await waitReady(page);
  if (edition === null) edition = (await isDemo(page)) ? 'demo' : 'full';
  return page;
};

// ---- page readers (each evaluate is self-contained: no outer variables) ----

const isDemo = page => page.evaluate(() => (window.__wedtmd.demoState?.() ?? null) !== null);
const framingOf = page => page.evaluate(() => window.__wedtmd.worldState?.()?.framing ?? null);
// One part of reachStats (null without the hook or the World scene).
const partOf = (page, key) => page.evaluate(k => window.__wedtmd.reachStats?.()?.parts?.[k] ?? null, key);
const reachParts = page => page.evaluate(() => window.__wedtmd.reachStats?.()?.parts ?? null);
const walkerRows = page => page.evaluate(() => (window.__wedtmd.worldBehaviour?.() ?? []).map(e => ({ id: e.id, x: e.x, activity: e.activity })));
// The forced spawns (false when refused: no Fault Lamp, no Worn Motor, or one already alive).
const forceFault = page => page.evaluate(() => window.__wedtmd.forceFault?.() ?? false);
const forceFind = page => page.evaluate(() => window.__wedtmd.forceFind?.() ?? false);
const bicycleRow = page => page.evaluate(() => {
  const r = (window.__wedtmd.spliceStats?.() ?? []).find(item => item.id === 'spliceBicycle') ?? null;
  return r === null ? null : { x: r.x, state: r.state, placed: r.placed, visible: r.visible };
});
// The cost readings of F: the world's mean update, the reach's mean update, the display list and the silence.
const costRead = page => page.evaluate(() => {
  const w = window.__wedtmd;
  return {
    world: w.worldStats?.()?.meanMs ?? null,
    reach: w.reachStats?.()?.meanMs ?? null,
    display: w.displayObjects?.() ?? null,
    silence: w.worldState?.()?.silence ?? null,
  };
});
// One read of the cast: the runner rows (activity, feet x, clock since the activity began, walking) and the drawn rows (variant, feet x,
// visibility, flip). t is the page clock of the read, so every gap below is page time.
const sample = page => page.evaluate(() => {
  const w = window.__wedtmd;
  return {
    t: performance.now(),
    b: (w.worldBehaviour?.() ?? []).map(e => ({ id: e.id, activity: e.activity, x: e.x, sinceMs: e.sinceMs, walking: e.walking === true })),
    l: (w.livingWorld?.() ?? []).map(e => ({ id: e.id, variant: e.variant, x: e.x, visible: e.visible === true, flip: e.flip === true })),
  };
});
const rowOf = (s, id) => s.b.find(e => e.id === id) ?? null;
const drawnOf = (s, id) => s.l.find(e => e.id === id && e.visible) ?? null;
const actOf = (s, id) => rowOf(s, id)?.activity ?? null;
const variantOf = (s, id) => drawnOf(s, id)?.variant ?? null;

// ---- build and commit (the buy lists go through buyList; the commit step is the one of finds.mjs) ----

// Demo build: the era-II buy list reaches the cap, so the teaser would put the World to sleep. Skip it and keep tinkering
// (as finds.mjs). On the full build demoState() is null and the helper returns at once.
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
  await page.waitForTimeout(500);
};

// One buy list: `<key>_buys` is the failed-buy list (empty = every buy worked); the demo cap is cleared after it.
const buildStage = async (page, key, buys) => {
  const failed = await buyList(page, buys);
  report.check(`${key}_buys`, failed.length === 0, failed);
  await clearDemoCap(page);
};

// The F6.4 commit step: the TECH INDEX opens and closes (1.2 s, Escape, 2.5 s), then the era card clears and the cursor leaves the canvas.
const commit = async page => {
  await page.keyboard.press('t');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  await dismissEraCard(page);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
};

// The era III keystone as world.mjs NE buys it: the TECH INDEX open, the buys, then a 5 s settle after the last jump the buys may make
// (WP28b r1: the era cue fires when the card closes, so the card waits for the settle), then Escape. The caller closes the era card
// and watches. Returns the failed buys.
const buyEraKeystone = async page => {
  await page.keyboard.press('t');
  await page.waitForTimeout(400);
  const failed = await buyList(page, ['@substationBlueprint', 'boiler']);
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  return failed;
};

// ---- samples and rules (pure, on the sample rows) ----

// Real-time samples of one stage run: a sample every SAMPLE_MS for ms of wall time.
const sampleRun = async (page, ms) => {
  const rows = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    rows.push(await sample(page));
    await page.waitForTimeout(SAMPLE_MS);
  }
  return rows;
};

// The longest gap between two actions of one walker. An action: its activity id changes, its clock restarts (a new activity with the same
// id), or it has walked ACTION_PX since the last action. A same-clip loop (an idle pair of frames) is not an action.
const actionGapMs = (rows, id) => {
  let lastAt = null;
  let lastX = 0;
  let prev = null;
  let maxGap = 0;
  let endAt = 0;
  for (const r of rows) {
    const e = rowOf(r, id);
    if (e === null) continue;
    endAt = r.t;
    if (prev === null) {
      lastAt = r.t;
      lastX = e.x;
      prev = e;
      continue;
    }
    const acted = e.activity !== prev.activity || e.sinceMs < prev.sinceMs || Math.abs(e.x - lastX) >= ACTION_PX;
    if (acted) {
      maxGap = Math.max(maxGap, r.t - lastAt);
      lastAt = r.t;
      lastX = e.x;
    }
    prev = e;
  }
  return lastAt === null ? Infinity : Math.max(maxGap, endAt - lastAt);
};

// Era IV: the longest stretch with no conductor switch. Every walker starts a unison action on the same downbeat, so a switch shows as
// a new activity id or a restarted clock on the Inspector or the dog.
const switchGapMs = rows => {
  if (rows.length === 0) return Infinity;
  let lastAt = rows[0].t;
  let maxGap = 0;
  const prev = new Map();
  for (const r of rows) {
    let switched = false;
    for (const id of WALKERS_B) {
      const e = rowOf(r, id);
      const p = prev.get(id);
      if (e !== null && p !== undefined && (e.activity !== p.activity || e.sinceMs < p.sinceMs)) switched = true;
      if (e !== null) prev.set(id, e);
    }
    if (switched) {
      maxGap = Math.max(maxGap, r.t - lastAt);
      lastAt = r.t;
    }
  }
  return Math.max(maxGap, rows[rows.length - 1].t - lastAt);
};

// The share of a walker's spot range [lo, hi] that its drawn x covered during the run (its min and max, clipped to the range).
const coverOf = (rows, id, [lo, hi]) => {
  const xs = rows.map(r => rowOf(r, id)?.x).filter(Number.isFinite);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const share = Math.max(0, Math.min(max, hi) - Math.max(min, lo)) / (hi - lo);
  return { min: round(min), max: round(max), share: round(share) };
};

// A reaction rule: the test of one sample (elapsed: ms since the watch opened) and the window it counts in (capMs after the trigger).
const rule = (capMs, test) => ({ capMs, test });
// C reactions: samples the cast every REACT_MS until the last window closes and records, per rule, the elapsed time of the first sample
// that meets it inside the rule's own window (undefined: never inside it). Every sample goes to `facing`, which C_facing reads.
const watchReaction = async (page, rules, facing) => {
  const seen = {};
  const t0 = Date.now();
  const lastCap = Math.max(...Object.values(rules).map(r => r.capMs));
  for (;;) {
    const at = Date.now() - t0;
    if (at > lastCap) return seen;
    const s = await sample(page);
    facing.push(s);
    for (const [name, r] of Object.entries(rules)) {
      if (seen[name] === undefined && at <= r.capMs && r.test(s, at)) seen[name] = at;
    }
    await page.waitForTimeout(REACT_MS);
  }
};
const allSeen = (seen, names) => names.every(n => seen[n] !== undefined);
const startled = (s, id) => actOf(s, id) === 'startle' || variantOf(s, id) === 'startle';

// The wave's window: the wave runs from the machine's anchor outward at WAVE_SPEED_PX_PER_S, so the Inspector (at the far end of his
// range, ANCHOR_X - his range's left end at most away) starts within its travel time plus WAVE_SLACK_MS. null without a framing.
const waveWindowMs = framing => {
  const left = SPOT_RANGE[framing]?.inspector[0] ?? null;
  return left === null ? null : Math.ceil(((ANCHOR_X - left) / WAVE_SPEED_PX_PER_S) * 1000) + WAVE_SLACK_MS;
};

// The reaction rules per cue. Each actor's test counts inside its own window (rule capMs).
const RULES = {
  wave: capMs => ({ inspector: rule(capMs, s => startled(s, 'inspector')) }),
  fault: {
    inspector: rule(FAULT_WIN_MS, s => startled(s, 'inspector')),
    dog: rule(FAULT_WIN_MS, s => actOf(s, 'dog') === 'bark' || BARK_FRAMES.includes(variantOf(s, 'dog'))),
    crow: rule(FAULT_WIN_MS, s => actOf(s, 'crow') === 'ruffleReact'),
  },
  find: {
    inspector: rule(FIND_WIN_MS.inspector, s => ['point', 'lookFind'].includes(actOf(s, 'inspector'))),
    dog: rule(FIND_WIN_MS.dog, s => ['sniffFind', 'sniffHere'].includes(actOf(s, 'dog'))),
  },
  // The era card: the Inspector walks to his inner-most spot (the max of his range) and rests there, front on. His eraFront must have
  // started inside the window: its age (sinceMs) is at most the elapsed time plus one sample (an activity from before the card closed
  // would already be running at the first sample and passed at 0 ms).
  era: innerX => ({
    inspector: rule(ERA_WIN_MS, (s, elapsed) => {
      const r = rowOf(s, 'inspector');
      return r !== null && r.activity === 'eraFront' && r.sinceMs <= elapsed + REACT_MS && !r.walking
        && Math.abs(r.x - innerX) <= INNER_TOL_PX && variantOf(s, 'inspector') === 'front';
    }),
  }),
};

// C_facing: a profile frame (not camera-facing, not a walk) of the Inspector or the dog must flip away from the machine. Returns the
// violating frames (the first five are reported).
const facingViolations = samples => {
  const bad = [];
  for (const s of samples) {
    for (const id of WALKERS_B) {
      const d = drawnOf(s, id);
      const r = rowOf(s, id);
      if (d === null || r === null || r.walking || CAMERA_FACING[id].includes(d.variant)) continue;
      if (d.flip !== AWAY_FLIP[id]) bad.push({ id, variant: d.variant, flip: d.flip, x: round(d.x) });
    }
  }
  return bad;
};

// The x span (px) of the lamp glow and the booth hood over ms, sampled every 100 ms. Each span is 0 without rows.
const propsRange = async (page, ms) => {
  const xs = { lampGlow: [], boothHood: [] };
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const row = await page.evaluate(() => {
      const rows = window.__wedtmd.worldProps?.() ?? [];
      const x = id => rows.find(r => r.id === id)?.x ?? null;
      return { lampGlow: x('lampGlow'), boothHood: x('boothHood') };
    });
    for (const k of ['lampGlow', 'boothHood']) if (Number.isFinite(row[k])) xs[k].push(row[k]);
    await page.waitForTimeout(100);
  }
  const span = a => (a.length === 0 ? 0 : Math.max(...a) - Math.min(...a));
  return { lampGlow: round(span(xs.lampGlow)), boothHood: round(span(xs.boothHood)), samples: xs.lampGlow.length };
};

// ---- cases ----

// A gap and B range: one stage run in real time (the buys, the commit step, then RUN_MS of samples). The era IV stage checks the conductor.
// The first run reads the edition (the demo build refuses era III and later: those stages record a skip).
const caseStage = (stage, list, conductor) => async ctx => {
  const page = await openPage(ctx);
  await step(`A_${stage}`, async () => {
    if (stage === 'e1') edition = (await isDemo(page)) ? 'demo' : 'full';
    if (ERA3.includes(stage) && edition === 'demo') {
      skip(`A_gap_${stage}`, DEMO_ERA3);
      if (!conductor) skip(`B_range_${stage}`, DEMO_ERA3);
      return;
    }
    await crankClicks(page, 45, 0);
    await buildStage(page, `A_${stage}`, list);
    await commit(page);
    const framing = await framingOf(page);
    const rows = await sampleRun(page, RUN_MS);
    if (conductor) {
      const gap = switchGapMs(rows);
      report.check(`A_gap_${stage}`, gap <= ACTION_GAP_MS, { conductorGapS: secs(gap), samples: rows.length });
    } else {
      const gap = {};
      for (const id of ACTORS_A) gap[id] = actionGapMs(rows, id);
      report.check(`A_gap_${stage}`, ACTORS_A.every(id => gap[id] <= ACTION_GAP_MS), {
        gapS: Object.fromEntries(ACTORS_A.map(id => [id, secs(gap[id])])), samples: rows.length,
      });
      const spots = SPOT_RANGE[framing] ?? null;
      const cover = {};
      for (const id of WALKERS_B) cover[id] = spots === null ? null : coverOf(rows, id, spots[id]);
      report.check(`B_range_${stage}`, spots !== null && WALKERS_B.every(id => cover[id].share >= SPOT_COVER), { framing, cover });
    }
    await shot(page, `roam-${stage}.png`);
  });
};

// C reactions on S9 (the big buy, the fault, the Find and the era card) and the facing of every sample taken in their windows.
// The wave comes first: the big-buy cue of an actor is held for 30 s after the build's last big buy. The wave's unlock is bought after
// one 8 h jump and a 5 s settle, with no jump on the buy itself (a jump on the buy eats the cue: the EM diag of N19).
const caseC = async ctx => {
  const page = await openPage(ctx);
  const facing = [];
  await step('C', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'C', S9);
    const built = Date.now();
    await commit(page);
    const framing = await framingOf(page);
    await page.waitForTimeout(Math.max(0, built + BIGBUY_COOLDOWN_MS + 2000 - Date.now()));
    // C_wave: the unlock (the Fault Lamp) is a big buy: the Inspector startles as the ground wave passes him, within its window
    await page.evaluate(() => window.__wedtmd.session.update(Date.now() + 8 * 3600 * 1000));
    await page.waitForTimeout(5000);
    const waveBought = await page.evaluate(id => window.__wedtmd.session.purchase(id).ok === true, WAVE_TECH);
    const waveWin = waveWindowMs(framing);
    const wave = waveWin === null ? {} : await watchReaction(page, RULES.wave(waveWin), facing);
    report.check('C_wave', waveBought && allSeen(wave, ['inspector']), { bought: waveBought, framing, windowMs: waveWin, ms: wave });
    await page.waitForTimeout(4000);
    // C_fault: the Fault Lamp is owned: a forced fault makes the Inspector startle, the dog bark and the crow ruffle within 1 s
    await forceFault(page);
    const fault = await watchReaction(page, RULES.fault, facing);
    report.check('C_fault', allSeen(fault, ['inspector', 'dog', 'crow']), { ms: fault });
    await page.keyboard.press('f');
    await page.waitForTimeout(2500);
    // C_find: a forced Find: the Inspector points (or looks up) within 5.5 s and the dog sniffs at it within 1.5 s
    await forceFind(page);
    const findSeen = await watchReaction(page, RULES.find, facing);
    report.check('C_find', allSeen(findSeen, ['inspector', 'dog']), { ms: findSeen });
    await page.keyboard.press('g');
    await page.waitForTimeout(4000);
    // C_era: the era III keystone and the card dismissed: within 8 s the Inspector walks to and rests front at his inner-most spot.
    // The watch opens before the card closes (the era cue fires on the close), so its eraFront must start inside the window.
    if (edition === 'demo') {
      skip('C_era', DEMO_ERA3);
    } else {
      const keystoneFail = await buyEraKeystone(page);
      const eraFraming = await framingOf(page);
      const inner = SPOT_RANGE[eraFraming]?.inspector[1] ?? null;
      const [eraSeen] = await Promise.all([
        inner === null ? {} : watchReaction(page, RULES.era(inner), facing),
        dismissEraCard(page),
      ]);
      report.check('C_era', keystoneFail.length === 0 && inner !== null && allSeen(eraSeen, ['inspector']), {
        framing: eraFraming, innerX: inner, buyFail: keystoneFail, ms: eraSeen,
      });
    }
    const bad = facingViolations(facing);
    report.check('C_facing', facing.length > 0 && bad.length === 0, { samples: facing.length, violations: bad.length, first: bad.slice(0, 5) });
  });
};

// D gather: the bicycle is woken by a purchase after an 8 h jump (buyList jumps first on this save). The walker on the object's wing
// (the Inspector left, the dog right) must show its visit activity (visitWrite / visitSniff) while it stands at the visit stand, within
// 15 s: a normal spot near the stand does not pass. The activity and the time it was first seen are in the detail.
const caseD = async ctx => {
  const page = await openPage(ctx);
  await step('D', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'D', S7);
    await commit(page);
    const wakeFail = await buyList(page, ['spliceBicycle']);
    const obj = await bicycleRow(page);
    const wing = obj !== null && obj.x > ANCHOR_X ? 'dog' : 'inspector';
    const standX = obj === null ? null : obj.x + (wing === 'dog' ? -VISIT_OFFSET_PX : VISIT_OFFSET_PX);
    const act = VISIT_ACT[wing];
    const t0 = Date.now();
    let actAt = null;
    let hitAt = null;
    let lastX = null;
    let lastAct = null;
    while (Date.now() - t0 < VISIT_MS && hitAt === null) {
      const at = Date.now() - t0;
      const w = (await walkerRows(page)).find(e => e.id === wing) ?? null;
      lastX = w === null ? null : round(w.x);
      lastAct = w === null ? null : w.activity;
      if (w !== null && w.activity === act && actAt === null) actAt = at;
      if (w !== null && w.activity === act && standX !== null && Math.abs(w.x - standX) <= VISIT_TOL_PX) hitAt = at;
      if (hitAt === null) await page.waitForTimeout(REACT_MS);
    }
    const woken = obj !== null && obj.state === 'woken';
    report.check('D_visit', wakeFail.length === 0 && woken && hitAt !== null, {
      buyFail: wakeFail, state: obj?.state ?? null, wing, objectX: obj?.x ?? null, standX, activity: act,
      activitySeenMs: actAt, hitAtMs: hitAt, lastWalkerX: lastX, lastActivity: lastAct,
    });
  });
};

// E pulse: 10 crank clicks give one to ten ground pulses, at most four a second (the counter is read before and after the clicks).
const caseEPulse = async ctx => {
  const page = await openPage(ctx);
  await step('E_pulse', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E_pulse', S7);
    await commit(page);
    const p0 = (await reachParts(page))?.groundPulse ?? null;
    const t0 = Date.now();
    await crankClicks(page, 10, 40);
    await page.waitForTimeout(600);
    const p1 = (await reachParts(page))?.groundPulse ?? null;
    const span = (Date.now() - t0) / 1000;
    const delta = p0 === null || p1 === null ? null : p1 - p0;
    report.check('E_pulse', delta !== null && delta >= 1 && delta <= 10 && delta <= 4 * span, {
      delta, spanS: round(span), groundPulse: [p0, p1],
    });
  });
};

// E arc (era II): the arcs on the wires grow within 20 s.
const caseEArc = async ctx => {
  const page = await openPage(ctx);
  await step('E_arc', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E_arc', S9);
    await commit(page);
    const a0 = await partOf(page, 'arc');
    const grew = await poll(page, n => (window.__wedtmd.reachStats?.()?.parts?.arc ?? -1) > n, a0 ?? 0, ARC_MS, 250);
    report.check('E_arc', a0 !== null && grew === true, { arc: [a0, await partOf(page, 'arc')] });
  });
};

// E drift (era III): the steam puffs drift in the scene within 30 s.
const caseEDrift = async ctx => {
  if (edition === 'demo') {
    skip('E_drift', DEMO_ERA3);
    return;
  }
  const page = await openPage(ctx);
  await step('E_drift', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E_drift', S11);
    await commit(page);
    const ok = await poll(page, () => (window.__wedtmd.reachStats?.()?.parts?.drift ?? 0) > 0, null, DRIFT_MS, 250);
    report.check('E_drift', ok === true, { drift: await partOf(page, 'drift') });
  });
};

// E hum (era IV): the lamp glow or the booth hood moves at least 1 px in x over 3 s.
const caseEHum = async ctx => {
  if (edition === 'demo') {
    skip('E_hum', DEMO_ERA3);
    return;
  }
  const page = await openPage(ctx);
  await step('E_hum', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E_hum', S13);
    await commit(page);
    const range = await propsRange(page, HUM_MS);
    report.check('E_hum', Math.max(range.lampGlow, range.boothHood) >= 1, range);
  });
};

// E lift (era V): the debris specks lift off the ground within 20 s.
const caseELift = async ctx => {
  if (edition === 'demo') {
    skip('E_lift', DEMO_ERA3);
    return;
  }
  const page = await openPage(ctx);
  await step('E_lift', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'E_lift', S15);
    await commit(page);
    const ok = await poll(page, () => (window.__wedtmd.reachStats?.()?.parts?.debris ?? 0) > 0, null, DEBRIS_MS, 250);
    report.check('E_lift', ok === true, { debris: await partOf(page, 'debris') });
  });
};

// The same actions per stage with reduced motion on from the first frame. Each returns { ok, ...the parts it read }.
const REDUCED = {
  e1: async page => {
    await crankClicks(page, 10, 40);
    await page.waitForTimeout(600);
    const groundPulse = await partOf(page, 'groundPulse');
    return { ok: groundPulse === 0, groundPulse };
  },
  s9: async page => {
    await page.waitForTimeout(ARC_MS);
    const arc = await partOf(page, 'arc');
    return { ok: arc === 0, arc };
  },
  s11: async page => {
    await page.waitForTimeout(DRIFT_MS);
    const drift = await partOf(page, 'drift');
    return { ok: drift === 0, drift };
  },
  s13: async page => {
    const range = await propsRange(page, HUM_MS);
    return { ok: range.lampGlow <= 0.001 && range.boothHood <= 0.001, range };
  },
  s15: async page => {
    await page.waitForTimeout(DEBRIS_MS);
    const debrisMoving = await partOf(page, 'debrisMoving');
    const debris = await partOf(page, 'debris');
    return { ok: debrisMoving === 0, debrisMoving, debris };
  },
};
const caseReduced = (stage, list) => async ctx => {
  if (ERA3.includes(stage) && edition === 'demo') return;
  const page = await openPage(ctx);
  await step(`E_reduced_${stage}`, async () => {
    await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await crankClicks(page, 45, 0);
    await buildStage(page, `E_reduced_${stage}`, list);
    await commit(page);
    reducedRows[stage] = await REDUCED[stage](page);
  });
};
// E_reduced: one check over the five stages (a missing row fails it).
const finishReduced = () => {
  if (edition === 'demo') {
    skip('E_reduced', DEMO_ERA3);
    return;
  }
  const stages = ['e1', 's9', 's11', 's13', 's15'];
  report.check('E_reduced', stages.every(s => reducedRows[s]?.ok === true), reducedRows);
};

// F budget on S9, then on S15: the world's mean (one retry after 5 s), the reach's mean, the display list. Demo: S9 only.
const caseF = async ctx => {
  const page = await openPage(ctx);
  await step('F', async () => {
    await crankClicks(page, 45, 0);
    await buildStage(page, 'F_s9', S9);
    await commit(page);
    const reads = [await costRead(page)];
    if (!within(reads[0].world, COST_WORLD_MAX)) {
      await page.waitForTimeout(COST_RETRY_MS);
      reads.push(await costRead(page));
    }
    const at9 = reads[reads.length - 1];
    if (SILENT.includes(at9.silence)) {
      skip('F_cost', `world silent (${at9.silence}): not a cost reading`);
      skip('F_display', `world silent (${at9.silence}): not a display reading`);
      return;
    }
    let at15 = null;
    if (edition !== 'demo') {
      await buildStage(page, 'F_s15', S15.slice(S9.length));
      await commit(page);
      at15 = await costRead(page);
    }
    const worldOk = reads.some(r => within(r.world, COST_WORLD_MAX));
    const reachOk = within(at9.reach, COST_REACH_MAX) && (at15 === null || within(at15.reach, COST_REACH_MAX));
    report.check('F_cost', worldOk && reachOk, {
      world: reads.map(r => round(r.world)), reach9: round(at9.reach), reach15: at15 === null ? 'demo: skipped' : round(at15.reach),
      world15: at15 === null ? null : round(at15.world), silence: at9.silence,
    });
    const displayOk = within(at9.display, DISPLAY_MAX) && (at15 === null || within(at15.display, DISPLAY_MAX));
    report.check('F_display', displayOk, { display9: at9.display, display15: at15 === null ? 'demo: skipped' : at15.display });
  });
};

let browser = null;
try {
  browser = await chromium.launch();
  if (wanted('A_e1')) await runContext(browser, 'A_e1', caseStage('e1', S7, false));
  if (wanted('A_s9')) await runContext(browser, 'A_s9', caseStage('s9', S9, false));
  if (wanted('A_s11')) await runContext(browser, 'A_s11', caseStage('s11', S11, false));
  if (wanted('A_s13')) await runContext(browser, 'A_s13', caseStage('s13', S13, true));
  if (wanted('A_s15')) await runContext(browser, 'A_s15', caseStage('s15', S15, false));
  if (wanted('C')) await runContext(browser, 'C', caseC);
  if (wanted('D')) await runContext(browser, 'D', caseD);
  if (wanted('E')) {
    await runContext(browser, 'E_pulse', caseEPulse);
    await runContext(browser, 'E_arc', caseEArc);
    await runContext(browser, 'E_drift', caseEDrift);
    await runContext(browser, 'E_hum', caseEHum);
    await runContext(browser, 'E_lift', caseELift);
    await runContext(browser, 'E_reduced_e1', caseReduced('e1', S7));
    await runContext(browser, 'E_reduced_s9', caseReduced('s9', S9));
    await runContext(browser, 'E_reduced_s11', caseReduced('s11', S11));
    await runContext(browser, 'E_reduced_s13', caseReduced('s13', S13));
    await runContext(browser, 'E_reduced_s15', caseReduced('s15', S15));
    finishReduced();
  }
  if (wanted('F')) await runContext(browser, 'F', caseF);
} catch (e) {
  recordThrow('run', e);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const result = { edition, results: report.results, fail: report.fail, errors: report.errors };
fs.writeFileSync(path.join(out, 'roam.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
process.exitCode = report.fail.length > 0 || report.errors.length > 0 ? 1 : 0;
