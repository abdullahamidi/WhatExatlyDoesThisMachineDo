// Living-world smoke. WP23a T12: denizens freeze and step, the first line's bubble and its layout at UI 100 and 150, hard silence per
// state, the placements per framing, the WORLD VOICES setting, the save, the frame budget and the tier port (cases A to H).
// WP23b T18: eras III-V placements and states (I, M), the finale film (J, JR), the postgame (K), cycles 2+ (L) and the bubble box
// flip guard (F23, 1280x800). One fresh context per case. Why: the living world is a layer, so every check reads the debug hook
// (window.__wedtmd) and the DOM only.
// WP24 (T9a): the living-world v2 cases NV (variety), NC (changes), NT (teleport), NU (umbrella), NK (crank, reduced motion).
// WP24 (T9b): ND (defer), NE (era), NY (day), NS (settle), and the existing-check rules (A_crank_step, I_chladni, I_virga_frozen, I_puddle_sprout, I_stare_dog, I_accent_still).
// WP24 r3: NH (demo hold guard): DOG-12 suspends only the dog runner; the Inspector and the crow keep stepping (demo only).
// WP27 T14: crowTalk_e1 and crowTalk_s8 (the era I-II crow speaks with folded wings: perchHead / perchTalk only). Each is a fresh run at UI 150.
// Usage: PW_PATH=<playwright> node scripts/smoke/world.mjs "<url with ?debug=1>" <outdir>
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty. Runs on :4174 and :4177.
// ONLY=H,I,M (env, optional): a comma list of case keys to run alone (A B C D E F G H I M J JR K L NV NC NT NU NK ND NE NY NS NH F23 crowTalk_e1 crowTalk_s8); unset runs every case.
// Timing is deterministic: worldAdvance moves the scheduler clock and the play time, worldLogShown feeds the SYS LOG port,
// worldSay forces a line past gaps and caps (not past hard silence). The demo edition refuses era III and everything after it, so
// every check that needs era III or later records value.skipped there (I, M, J, JR, K, L, NV, NC, NU, NK, NE, NS, the NY tint and held checks, G_era3_visible, G_display_peak).
// The demo cap (A10) also records value.skipped for the motion checks once the world is silent after the S9 buys (demoSilence): N_no_teleport,
// the ND motion checks (not N_defer_hold) and the S9 rows of NV and NC. The full build keeps them strict.
import fs from 'fs';
import path from 'path';
import {
  S7, S9, S11, S13, S15, makeReport, watchPage, waitReady, crankClicks, buyInPage, buyList, dismissEraCard, loadChromium, withQuery,
} from './lib/common.mjs';

const [rawUrl, outArg] = process.argv.slice(2);
if (!rawUrl || !outArg) {
  console.error('usage: PW_PATH=<playwright> node scripts/smoke/world.mjs "<url with ?debug=1>" <outdir>');
  process.exit(2);
}
// The debug hook exists only with ?debug=1 (which also skips the title screen).
const target = withQuery(rawUrl, { debug: '1' });
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const chromium = loadChromium();

const report = makeReport();
const { results, fail, errors } = report;
let currentKey = 'setup';
const tag = () => currentKey;
const firstLine = (e) => String(e && e.message ? e.message : e).split('\n')[0];
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Stage lists. S8 = S7 + generator blueprint and generator (era II entry). S10 = S9 + substation blueprint and boiler (era III).
const S8 = [...S7, '@blueprint', 'generator'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
// S12, S14 and S16 are not exported by lib/common.mjs (S11, S13, S15 are). S16 = S15 + primaryFunction (the ending starts).
const S12 = [...S11, 'resonatorSpire'];
const S14 = [...S13, 'nullChamber'];
const S16 = [...S15, 'primaryFunction'];

// Canon line (STORY_BIBLE §5.2, verbatim). The first moment is INS-01; the live region reads "Inspector: <text>".
const INS01_TEXT = "Unchanged. I'm not on the count either.";
const INS01_LIVE = `Inspector: ${INS01_TEXT}`;

// Placement rules (worldPlacement.ts): feet x clear of the machine box by 24 world px and of the crank hub by 96 (hit circle 72 + 24).
const HUB_X = 1920;
const HUB_CLEAR = 96;
const WING_CLEAR = 24;
// Visible machine x-range per framing, world px (DENIZEN_ART §3: S7 1576-2316, S8 1576-2552, S9 1576-2808).
const MACHINE = {
  e1: { left: 1576, right: 2316 }, s8: { left: 1576, right: 2552 }, s8w: { left: 1576, right: 2648 }, s9: { left: 1576, right: 2808 },
};
// Feet x per id (DENIZEN_ART §3, WORLD_PLACEMENTS); null = off-stage. Scraps are not in the table: the overlap rule covers them.
// WP27 F6.1: s8 has Sensor 7 and the clock; s8w (capacitorBank or sparkGap before the transformer) has no clock (documented exemption).
const PLACED = {
  e1: { sensor7: 1384, inspector: 1472, dog: 2364, payphone: 2420, lamp: 2476, crow: 2476, clock: 2516, stakeChain: 2348, hole: 2394 },
  s8: { sensor7: 1470, inspector: 1536, clock: 2680, dog: 2604, payphone: 2604, lamp: 2656, crow: 2656, stakeChain: 2588, hole: 2634 },
  s8w: { sensor7: 1500, inspector: 1552, dog: 2694, payphone: 2678, lamp: 2720, crow: 2720, stakeChain: 2676, hole: 2716, clock: null },
  s9: { sensor7: 1384, inspector: 1472, dog: 2856, clock: 2900, payphone: 2944, lamp: 2996, crow: 2996, stakeChain: 2840, hole: 2886 },
};

// Records one check. A failing check carries worldState().silence in its detail; `keep` records the detail on a pass too.
async function check(page, name, cond, extra, keep = false) {
  if (cond && !keep) {
    report.check(name, true);
    return;
  }
  const silence = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null).catch(() => null);
  report.check(name, cond, { silence, ...(extra ?? {}) });
}

const bubbleVisible = (page) => page.evaluate(() => window.__wedtmd.worldBubble()?.visible === true).catch(() => false);
const worldSay = (page, id) => page.evaluate((lineId) => window.__wedtmd.worldSay(lineId), id);
const seenOf = (page) => page.evaluate(() => window.__wedtmd.worldState()?.seen ?? []);
// Queue state of one line: waiting (pending), playing (activeLines) or seen (ids as worldState reports them). null without a director.
const lineState = (page, id) => page.evaluate((lineId) => {
  const s = window.__wedtmd.worldState();
  if (!s) return null;
  return { pending: s.pending.includes(lineId), playing: s.activeLines.includes(lineId), seen: s.seen.includes(lineId) };
}, id);
// True when a lineState result says the line is queued, playing or seen.
const lineHeld = (st) => st !== null && (st.pending || st.playing || st.seen);

// Polls the bubble until it shows `want` (true or false) or capMs passed. Returns whether it does.
async function waitBubble(page, want, capMs) {
  const deadline = Date.now() + capMs;
  let v = await bubbleVisible(page);
  while (v !== want && Date.now() < deadline) {
    await sleep(100);
    v = await bubbleVisible(page);
  }
  return v === want;
}

// Waits (cap 8 s) until no bubble is up and no toast is shown, so the next line gets a clean screen.
async function settle(page, capMs = 8000) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const quiet = await page.evaluate(() => {
      const stack = document.getElementById('toast-stack');
      const toasts = stack ? [...stack.querySelectorAll('.toast')].filter((t) => t.getClientRects().length > 0) : [];
      return toasts.length === 0 && window.__wedtmd.worldBubble()?.visible !== true;
    });
    if (quiet || Date.now() >= deadline) return quiet;
    await sleep(100);
  }
}

// Waits until the placements match the table (the framing settles a few frames after the buys). Returns the last result.
async function waitPlaced(page, framing, want) {
  const spec = { framing, want, machine: MACHINE[framing], hub: HUB_X, clear: HUB_CLEAR, wing: WING_CLEAR };
  const deadline = Date.now() + 3000;
  let r = await page.evaluate(placedInPage, spec);
  while (!r.ok && Date.now() < deadline) {
    await sleep(150);
    r = await page.evaluate(placedInPage, spec);
  }
  return r;
}

// Variant of the Inspector and the Dog; null until both entries exist and are drawn (visible), so the constructor's placeholder frames never count.
async function livingOf(page) {
  return page.evaluate(() => {
    const list = window.__wedtmd.livingWorld() ?? [];
    const variant = (id) => list.find((e) => e.id === id && e.visible === true)?.variant ?? null;
    const inspector = variant('inspector');
    const dog = variant('dog');
    return inspector !== null && dog !== null ? { inspector, dog } : null;
  });
}

// Buys a list with the TECH INDEX open, as real play does. The relocation gate moves the placements only while the tree is open
// or when no denizen is on screen, and it checks on the 250 ms visual cadence, so the tree stays open 600 ms after the buys.
// Returns the failed entries, like buyList.
async function buyInTree(page, list) {
  await page.keyboard.press('t');
  await sleep(400);
  const failed = await buyList(page, list);
  await sleep(600);
  await page.keyboard.press('Escape');
  await sleep(600);
  return failed;
}

// The first moment (bible §7.1 and §7.3). One click clears the crank prompt; 16 clicks pay for Gear Ratio (15 ME); one purchase.
// Then the play time passes 90 s and the observer-count log is shown. The advances run in ONE evaluate, so no frame runs
// between them: the core log reply (priority 1) takes the slot before the 45 s idle line (priority 4) can.
async function firstMoment(page) {
  await crankClicks(page, 1, 0);
  await crankClicks(page, 15, 0);
  const bought = await page.evaluate(buyInPage, ['gearRatio']);
  await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(120000);
    w.worldLogShown('observer-count');
    w.worldAdvance(6000);
  });
  return bought;
}

// Runs in the page. The placements against the table, the framing, and the wing and hub rules for every placed id.
function placedInPage(spec) {
  const s = window.__wedtmd.worldState();
  if (!s) return { ok: false, problems: ['no world state'], silence: null };
  const problems = [];
  if (s.framing !== spec.framing) problems.push(`framing ${s.framing}`);
  const pl = s.placements || {};
  for (const [id, x] of Object.entries(spec.want)) {
    const p = pl[id] ?? null;
    if (x === null) {
      if (p !== null) problems.push(`${id} placed at ${p.x}`);
    } else if (p === null || p.x !== x) {
      problems.push(`${id} ${p === null ? 'null' : p.x} != ${x}`);
    }
  }
  for (const [id, p] of Object.entries(pl)) {
    if (p === null || p === undefined) continue;
    if (!(p.x <= spec.machine.left - spec.wing || p.x >= spec.machine.right + spec.wing)) problems.push(`${id} at ${p.x} over the machine box`);
    if (Math.abs(p.x - spec.hub) < spec.clear) problems.push(`${id} at ${p.x} inside the crank circle + 24`);
  }
  return { ok: problems.length === 0, problems, silence: s.silence ?? null };
}

// Runs in the page. The visible bubble box (client px), the HUD boxes it must clear, the ARIA state of every .wv node and the live text.
function measureInPage() {
  const rectOf = (el) => {
    if (!el || el.getClientRects().length === 0) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
  };
  const stack = document.getElementById('toast-stack');
  const toastUp = stack !== null && [...stack.querySelectorAll('.toast')].some((t) => t.getClientRects().length > 0);
  return {
    bubble: window.__wedtmd.worldBubble(),
    dom: rectOf(document.querySelector('.wv.on')),
    named: {
      'hud-panel': rectOf(document.getElementById('hud-panel')),
      'hud-buttons': rectOf(document.getElementById('hud-buttons')),
      'hud-hint': rectOf(document.getElementById('hud-hint')),
      'toast-stack': toastUp ? rectOf(stack) : null,
    },
    wv: [...document.querySelectorAll('.wv')].map((el) => ({
      aria: el.getAttribute('aria-hidden'),
      tabindex: el.hasAttribute('tabindex'),
      focusable: el.tabIndex >= 0,
    })),
    live: document.getElementById('world-voice-live')?.textContent ?? null,
  };
}

const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
// Names of the HUD boxes the bubble overlaps. A missing bubble box counts as a clash.
const clashes = (m) => (m.dom === null
  ? ['no-bubble-box']
  : Object.entries(m.named).filter(([, r]) => r !== null && hit(m.dom, r)).map(([k]) => k));

// A frozen: no input, the Inspector and the Dog hold their frames for 2 s; one real crank click steps them.
async function caseA(page) {
  // Waits for the first drawn frame (livingOf is null until both cast members are visible), then 300 ms more.
  const deadline = Date.now() + 5000;
  while ((await livingOf(page)) === null && Date.now() < deadline) await sleep(100);
  await sleep(300);
  const v0 = await livingOf(page);
  let frozen = v0 !== null;
  for (let i = 0; i < 5; i++) {
    await sleep(400);
    frozen = frozen && JSON.stringify(await livingOf(page)) === JSON.stringify(v0);
  }
  await check(page, 'A_frozen', frozen, { before: v0 });
  await shot(page, 'world-A-s0.png');
  // A_crank_step (WP24): one click steps every visible walker by one, read from the runners (worldBehaviour), not the variants.
  // A parked walker (the girl in the window stage) keeps step 0 and is not counted.
  const beforeB = await page.evaluate(() => ({
    b: window.__wedtmd.worldBehaviour() ?? [],
    vis: (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => e.id),
  }));
  await crankClicks(page, 1, 0);
  await sleep(400);
  const afterB = await page.evaluate(() => window.__wedtmd.worldBehaviour() ?? []);
  const walkers = steppable(beforeB.vis, beforeB.b);
  const stepOf = (list, id) => list.find((e) => e.id === id)?.step ?? null;
  const stepped = walkers.length > 0 && walkers.every((id) => {
    const a = stepOf(beforeB.b, id);
    return a !== null && stepOf(afterB, id) === a + 1;
  });
  await check(page, 'A_crank_step', stepped, { walkers, before: beforeB.b, after: afterB });
}

// B first line: INS-01 through its observer-count log reply. Bubble, its rects at UI 100 and 150, the live region, the ARIA state.
async function caseB(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 100 }));
  const bought = await firstMoment(page);
  const shown = await waitBubble(page, true, 8000);
  await check(page, 'B_bubble', shown, { bought });
  const at100 = await page.evaluate(measureInPage);
  await shot(page, 'world-B-100.png');
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await sleep(300);
  // INS-01 lasts 4.8 s at most. At UI 150 a forced INS-02 (non-core, worldSay) shows the bubble layout again.
  await waitBubble(page, false, 8000);
  const forced = await worldSay(page, 'INS-02');
  await waitBubble(page, true, 3000);
  const at150 = await page.evaluate(measureInPage);
  await shot(page, 'world-B-150.png');
  const c100 = clashes(at100);
  const c150 = clashes(at150);
  await check(page, 'B_rects', c100.length === 0 && c150.length === 0, { ui100: c100, ui150: c150, forced });
  await check(page, 'B_live', at100.live === INS01_LIVE, { live: at100.live });
  const aria = at100.wv.length > 0 && at100.wv.every((x) => x.aria === 'true' && !x.tabindex && !x.focusable);
  await check(page, 'B_aria', aria, { wv: at100.wv });
}

// C silence: worldSay is refused in each hard-silence state (tree, era card, photo mode, SYSTEM menu). Each state first proves
// the line plays in the plain state (control), so a refusal is never a vacuous pass.
async function caseC(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  const control = await worldSay(page, 'INS-02');
  await sleep(300);
  await page.keyboard.press('t');
  await sleep(500);
  const treeOpen = await page.evaluate(() => window.__wedtmd.techTreeOpen());
  const say1 = await worldSay(page, 'INS-02');
  const vis1 = await bubbleVisible(page);
  await check(page, 'C_tree', control === true && treeOpen && !say1 && !vis1, { control, treeOpen, say1, vis1 });
  await page.keyboard.press('Escape');
  await sleep(400);

  // Era II: 45 clicks pay for the Worn Motor, then the S8 list (generator) opens the era card.
  await crankClicks(page, 45, 0);
  const buyFail = await buyList(page, S8);
  let cardUp = false;
  for (let i = 0; i < 30 && !cardUp; i++) {
    await sleep(100);
    cardUp = await page.locator('#era-card').first().isVisible().catch(() => false);
  }
  await sleep(300);
  const say2 = await worldSay(page, 'INS-02');
  const vis2 = await bubbleVisible(page);
  await check(page, 'C_card', cardUp && !say2 && !vis2, { buyFail, cardUp, say2, vis2 });
  await dismissEraCard(page);
  await sleep(300);

  await page.evaluate(() => window.__wedtmd.photoMode(true, { hint: false }));
  await sleep(800);
  const photo = await page.evaluate(() => window.__wedtmd.photoState()?.active === true);
  const say3 = await worldSay(page, 'INS-02');
  const vis3 = await bubbleVisible(page);
  await check(page, 'C_photo', photo && !say3 && !vis3, { photo, say3, vis3 });
  await page.evaluate(() => window.__wedtmd.photoMode(false));
  await sleep(500);

  await page.keyboard.press('Escape');
  await sleep(500);
  const menu = await page.evaluate(() => window.__wedtmd.systemMenuOpen());
  const say4 = await worldSay(page, 'INS-02');
  const vis4 = await bubbleVisible(page);
  await check(page, 'C_menu', menu && !say4 && !vis4, { menu, say4, vis4 });
  await page.keyboard.press('Escape');
}

// D framings: the placements of era I (S7, framing e1), era II entry (S8, framing s8) and era II full (S9, framing s9) at UI 150.
// The buys run through buyInTree (the TECH INDEX open), as in real play.
async function caseD(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const s7 = await waitPlaced(page, 'e1', PLACED.e1);
  await check(page, 'D_s7_placed', s7.ok && buyS7.length === 0, { problems: s7.problems, buyFail: buyS7 });
  await shot(page, 'world-D-s7-150.png');

  const buyS8 = await buyInTree(page, S8.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const s8 = await waitPlaced(page, 's8', PLACED.s8);
  await check(page, 'D_s8_placed', s8.ok && buyS8.length === 0, { problems: s8.problems, buyFail: buyS8 });
  await shot(page, 'world-D-s8-150.png');

  // WP27 F6.1: the capacitorBank and sparkGap before the transformer frame s8w (the same buys as S9 up to the transformer)
  const preTransformer = S9.indexOf('transformer');
  const buyS8w = await buyInTree(page, S9.slice(S8.length, preTransformer));
  await sleep(300);
  const s8w = await waitPlaced(page, 's8w', PLACED.s8w);
  await check(page, 'D_s8w_placed', s8w.ok && buyS8w.length === 0, { problems: s8w.problems, buyFail: buyS8w });
  await shot(page, 'world-D-s8w-150.png');

  const buyS9 = await buyInTree(page, S9.slice(preTransformer));
  await sleep(300);
  const s9 = await waitPlaced(page, 's9', PLACED.s9);
  await check(page, 'D_s9_placed', s9.ok && buyS9.length === 0, { problems: s9.problems, buyFail: buyS9 });
  await shot(page, 'world-D-s9-150.png');
}

// crowTalk (WP27 A11 [R1], T14): the era I-II crow speaks with folded wings. Each case is a fresh run at UI 150 (the framing caseD checks):
// the hook buys, the F6.4 commit step (press t, 1.2 s, Escape) and the placements. worldSay forces the crow's line. Within 1.5 s the crow
// entry of livingWorld() speaks; six samples 600 ms apart (3 s) show its variant in perchHead or perchTalk, and nothing else.
const CROW_TALK_POSES = ['perchHead', 'perchTalk'];
const CROW_TALK_SAMPLES = 6;
const CROW_TALK_STEP_MS = 600;
// F6.4 commit: the TECH INDEX opens and closes after the buys, so the cast placements commit before the shot.
async function commitCast(page) {
  await page.keyboard.press('t');
  await sleep(1200);
  await page.keyboard.press('Escape');
  await sleep(600);
}
const crowEntry = (page) => page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).find((e) => e.id === 'crow') ?? null);
// Waits (cap 1.5 s) for the crow to speak, takes the shot, then samples its variant 3 s on. Not speaking: no samples, ok false.
async function crowTalkWindow(page, shotName) {
  const deadline = Date.now() + 1500;
  let entry = await crowEntry(page);
  while (entry?.speaking !== true && Date.now() < deadline) {
    await sleep(100);
    entry = await crowEntry(page);
  }
  await shot(page, shotName);
  if (entry?.speaking !== true) return { speaking: false, poses: [], ok: false };
  const poses = [];
  for (let i = 0; i < CROW_TALK_SAMPLES; i++) {
    if (i > 0) await sleep(CROW_TALK_STEP_MS);
    poses.push((await crowEntry(page))?.variant ?? null);
  }
  return { speaking: true, poses, ok: poses.every((v) => v !== null && CROW_TALK_POSES.includes(v)) };
}

// crowTalk_e1: era I (the S7 list, framing e1) and CRW-01, the era I line.
async function caseCrowTalkE1(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const buyFail = await buyList(page, S7);
  await commitCast(page);
  const placed = await waitPlaced(page, 'e1', PLACED.e1);
  await settle(page);
  const said = await worldSay(page, 'CRW-01');
  const win = await crowTalkWindow(page, 'world-crowTalk-e1.png');
  await check(page, 'crowTalk_e1', buyFail.length === 0 && placed.ok && said && win.speaking && win.ok,
    { buyFail, problems: placed.problems, said, ...win }, true);
}

// crowTalk_s8: era II entry (the S8 list, S7 + generator blueprint and generator, then the era card) and CRW-04, the crossedLines step 2 line.
// worldSay refuses CRW-04 until the chain reaches step 2 (the chain gate): that is a reasoned skip, not a fail. AD2 checks the shot by eye.
async function caseCrowTalkS8(page) {
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const buyFail = await buyList(page, S8);
  await dismissEraCard(page);
  await sleep(300);
  await commitCast(page);
  const placed = await waitPlaced(page, 's8', PLACED.s8);
  await settle(page);
  const said = await worldSay(page, 'CRW-04');
  if (!said) {
    await shot(page, 'world-crowTalk-s8.png');
    if (buyFail.length === 0 && placed.ok) skipCheck('crowTalk_s8', 'CRW-04 refused by worldSay (crossedLines step 2 chain gate): reasoned skip, AD2 checks by eye');
    else await check(page, 'crowTalk_s8', false, { buyFail, problems: placed.problems, said });
    return;
  }
  const win = await crowTalkWindow(page, 'world-crowTalk-s8.png');
  await check(page, 'crowTalk_s8', buyFail.length === 0 && placed.ok && win.speaking && win.ok,
    { buyFail, problems: placed.problems, ...win }, true);
}

// E settings: RARE refuses non-core lines (control: ON accepts them); OFF plays nothing, no blips, no seen change.
async function caseE(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'rare' }));
  const say1 = await worldSay(page, 'INS-02');
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'on' }));
  const say2 = await worldSay(page, 'INS-02');
  await check(page, 'E_rare', !say1 && say2 === true, { say1, say2 });
  await settle(page);

  await page.evaluate(() => window.__wedtmd.session.updateSettings({ worldVoices: 'off' }));
  await sleep(300);
  const readOff = () => page.evaluate(() => ({
    blips: window.__wedtmd.audioStats()?.worldBlips ?? null,
    seen: (window.__wedtmd.worldState()?.seen ?? []).join(','),
  }));
  const before = await readOff();
  const say3 = await worldSay(page, 'DOG-02');
  await sleep(800);
  const after = await readOff();
  const vis = await bubbleVisible(page);
  const noChange = before.blips !== null && after.blips === before.blips && after.seen === before.seen;
  await check(page, 'E_off', !say3 && !vis && noChange, { say3, vis, before, after });
}

// F persist: INS-01 seen, saveNow, reload keeps it. After 400 s the same log does not bring it back.
async function caseF(page) {
  await firstMoment(page);
  await waitBubble(page, true, 8000);
  await settle(page);
  for (let i = 0; i < 60 && !(await seenOf(page)).includes('INS-01'); i++) await sleep(250);
  await page.evaluate(() => window.__wedtmd.saveNow());
  await sleep(300);
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  const seen = await seenOf(page);
  await check(page, 'F_seen', seen.includes('INS-01'), { seen });

  await page.evaluate(() => {
    const w = window.__wedtmd;
    w.worldQuiet(false);
    w.worldAdvance(400000);
    w.worldLogShown('observer-count');
  });
  let repeated = false;
  for (let i = 0; i < 24 && !repeated; i++) {
    await sleep(250);
    const s = await page.evaluate(() => ({
      text: window.__wedtmd.worldBubble()?.text ?? null,
      live: document.getElementById('world-voice-live')?.textContent ?? null,
    }));
    repeated = s.text === INS01_TEXT || s.live === INS01_LIVE;
  }
  await check(page, 'F_no_repeat', !repeated, { repeated });
}

// G budget: the display list and the per-frame cost at era II full; era III visible once the TECH INDEX has opened and closed.
async function caseG(page) {
  await crankClicks(page, 45, 0);
  const buyS9 = await buyList(page, S9);
  await sleep(300);
  const objects = await page.evaluate(() => window.__wedtmd.displayObjects());
  await check(page, 'G_display', typeof objects === 'number' && objects <= 100 && buyS9.length === 0, { objects, buyFail: buyS9 }, true);

  // G_cost is a cost reading only while the world animates. Speech silences (era card, tech index, modal...) keep the world
  // updating, so they still count; the era card is closed first like a player would. Asleep / hidden layer / hidden tab stop the
  // world clocks: report-only, no sampling, no gate.
  await dismissEraCard(page);
  await sleep(300);
  const silence = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null);
  if (silence === 'asleep' || silence === 'layer-hidden' || silence === 'tab-hidden') {
    await check(page, 'G_cost', true, { skipped: 'world silent (' + silence + '): not a cost reading', silence }, true);
  } else {
    const samples = [];
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      samples.push(await page.evaluate(() => window.__wedtmd.worldStats()?.meanMs ?? null));
    }
    const numeric = samples.every((x) => typeof x === 'number');
    const meanMs = numeric ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
    // The per-part means (WP24 r2, informational: cast, props, atmos, clocks, runners), read once after the window.
    const parts = await page.evaluate(() => window.__wedtmd.worldStats()?.parts ?? null);
    await check(page, 'G_cost', numeric && meanMs <= 0.3, { meanMs, samples: samples.length, parts }, true);
  }

  if (await isDemo(page)) {
    await check(page, 'G_era3_visible', true, { skipped: 'demo edition: era III is refused, so there is no era III entry' }, true);
    return;
  }
  const bought = await buyList(page, S10.slice(S9.length));
  await page.keyboard.press('t');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(600);
  const st = await page.evaluate(() => {
    const w = window.__wedtmd;
    const list = w.livingWorld() ?? [];
    const s = w.worldState();
    return {
      entries: list.length,
      anyVisible: list.some((e) => e.visible === true),
      hidden: s?.hidden ?? null,
      era: s?.era ?? null,
    };
  });
  // WP23b: era III is in play (maxEra 5), so its entries are visible and the state is not hidden.
  await check(page, 'G_era3_visible', st.entries > 0 && st.anyVisible && st.hidden === false, { bought, ...st }, true);
}

// H tier port (WP23 A10, X1): the WP22 tier maths behind the living world. Era I and II only, so the demo runs every check.
// H_dog_line: DOG-04 (improvedPistons tier 3) is queued at level 10 and not at 9; the buy's tier event or the TECH INDEX close
// re-check queues it (an over-cap swap emits no event). H_first_top: the first MK V (motorTuning 25) queues INS-13 the same way.
// H_heartbeat: worldState().tierHeartbeat (the Sensor 7 LED beat) is off before the first top tier and on after it.
// H_hole: worldState().holeStage at motorRetrofit 16 / 26 / 36 once lifetime EE reached the load-beneath level (WORLD_HOLE).
// caseHOver (also case H): H_overcap_pre and H_overcap (a fresh era II save, then one TECH INDEX release that changes five tracks;
// the fifth change is past the four-beat cap, so it swaps with no partEvolved event, and INS-13 must come from the close re-check),
// and H_boot_seed (the same save reloaded: the heartbeat is on before any TECH INDEX close).
// Every H check carries tierProbe() in its detail: era, heartbeat, hole stage, lifetime EE, cameraState(), the Inspector and the Dog.
const HOLE_EE = 100000; // WORLD_HOLE.loadBeneathEe
const HOLE_STAGE = { 16: 2, 26: 3, 36: 4 }; // motorRetrofit tiers 3 / 4 / 5, less WORLD_HOLE.tierOffset (1)
const OVERCAP_BUYS = ['@gearRatio:6', '@flywheel:4', '@motorTuning:10', '@improvedPistons:5', '@motorRetrofit:36'];
const OVERCAP_TIERS = { gearRatio: 2, flywheel: 2, motorTuning: 3, improvedPistons: 2, motorRetrofit: 5 };

// Tier probe for the H checks: the heartbeat and hole stage, the era, lifetime EE, the camera, and where the Inspector and the Dog
// stand (R6: a line needs its speaker on screen).
const tierProbe = (page) => page.evaluate(() => {
  const w = window.__wedtmd;
  const s = w.worldState();
  const cast = (id) => (w.livingWorld() ?? []).find((e) => e.id === id) ?? null;
  return {
    era: s?.era ?? null,
    tierHeartbeat: s?.tierHeartbeat ?? null,
    holeStage: s?.holeStage ?? null,
    lifetimeEe: w.session.state.lifetime.ee,
    camera: w.cameraState(),
    inspector: cast('inspector'),
    dog: cast('dog'),
  };
});

// Polls partTiers() until every wanted track shows its tier (the beats swap about 1 s after a release). Returns the last snapshot.
async function waitTiers(page, want, capMs) {
  const deadline = Date.now() + capMs;
  const matches = (got) => Object.entries(want).every(([id, t]) => got?.[id] === t);
  let got = await page.evaluate(() => window.__wedtmd.partTiers());
  while (!matches(got) && Date.now() < deadline) {
    await sleep(150);
    got = await page.evaluate(() => window.__wedtmd.partTiers());
  }
  return got;
}

// Polls tierProbe until the heartbeat is on or capMs passed. A loaded save seeds the tracker on its first applied frame.
async function waitHeartbeat(page, capMs) {
  const deadline = Date.now() + capMs;
  let probe = await tierProbe(page);
  while (probe.tierHeartbeat !== true && Date.now() < deadline) {
    await sleep(150);
    probe = await tierProbe(page);
  }
  return probe;
}

// Lifetime EE up to need: 8 h stretches (the buy loop's own jump) while it is short, at most 40. Returns the EE reached.
// Clicks KEEP TINKERING when the demo END OF DEMO card is open (demo edition only); returns whether it was open.
async function closeDemoCard(page) {
  const open = await page.evaluate(() => document.getElementById('demo-end')?.classList.contains('is-open') === true).catch(() => false);
  if (open) {
    await page.click('#demo-keep', { timeout: 3000 }).catch(() => {});
    await sleep(600);
  }
  return open;
}

async function topUpLifetimeEe(page, need) {
  return page.evaluate((target) => {
    const s = window.__wedtmd.session;
    for (let k = 0; k < 40 && s.state.lifetime.ee < target; k++) s.update(s.state.lastSimTime + 8 * 3600 * 1000);
    return s.state.lifetime.ee;
  }, need);
}

async function caseH(page) {
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const buy9 = await buyInTree(page, ['@improvedPistons:9']);
  const dog9 = await lineState(page, 'DOG-04');
  const buy10 = await buyInTree(page, ['@improvedPistons:10']);
  const dog10 = await lineState(page, 'DOG-04');
  const dogFail = [...buyS7, ...buy9, ...buy10];
  // No top tier is bought yet, so the heartbeat is still off.
  const beforeTop = await tierProbe(page);
  await check(page, 'H_dog_line', dogFail.length === 0 && !lineHeld(dog9) && lineHeld(dog10), { buyFail: dogFail, dog9, dog10, ...beforeTop });

  // The first MK V: motorTuning 25 is the top tier of a 5-tier track, so the TECH INDEX close queues INS-13 (once per cycle).
  const buyTop = await buyInTree(page, ['@motorTuning:25']);
  const top = await lineState(page, 'INS-13');
  const afterTop = await tierProbe(page);
  const tuning = await page.evaluate(() => window.__wedtmd.partTiers()?.motorTuning ?? null);
  await check(page, 'H_first_top', buyTop.length === 0 && lineHeld(top), { buyFail: buyTop, top, motorTuningTier: tuning, ...afterTop });
  await check(page, 'H_heartbeat', beforeTop.tierHeartbeat === false && afterTop.tierHeartbeat === true, {
    heartbeatBeforeTop: beforeTop.tierHeartbeat, heartbeatAfterTop: afterTop.tierHeartbeat, motorTuningTier: tuning, ...afterTop,
  });

  // Era II: the rest of the S9 list (the generator opens the era card). Lifetime EE first reaches the load-beneath level, then
  // motorRetrofit to levels 16, 26 and 36 (tiers 3, 4, 5) each read the hole stage.
  const buyEra2 = await buyInTree(page, S9.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const ee = await topUpLifetimeEe(page, HOLE_EE);
  const holeRows = [];
  for (const level of [16, 26, 36]) {
    // Demo edition: the EE top-up reaches the plate cap, so the END OF DEMO card opens and holds the world; keep tinkering first.
    const demoCard = await closeDemoCard(page);
    const failed = await buyInTree(page, ['@motorRetrofit:' + level]);
    const demoCardAfter = await closeDemoCard(page);
    // the world state applies on its own cadence after the release: wait up to 3 s for the stage (demo runs were read too early)
    let probe = await tierProbe(page);
    for (let t = 0; t < 30 && probe.holeStage !== HOLE_STAGE[level]; t++) {
      await sleep(100);
      probe = await tierProbe(page);
    }
    const displayedTier = await page.evaluate(() => window.__wedtmd.partTiers()?.motorRetrofit ?? null);
    const actualLevel = await page.evaluate(() => window.__wedtmd.session.state.techLevels.motorRetrofit ?? 0);
    holeRows.push({ level, actualLevel, demoCard, demoCardAfter, failed, expected: HOLE_STAGE[level], holeStage: probe.holeStage, displayedTier });
  }
  const holeOk = holeRows.every((r) => r.failed.length === 0 && r.holeStage === r.expected);
  const holeProbe = await tierProbe(page);
  await check(page, 'H_hole', buyEra2.length === 0 && ee >= HOLE_EE && holeOk, { buyFail: buyEra2, lifetimeEe: ee, rows: holeRows, ...holeProbe });
}

// H_overcap (WP23 A10): a fresh era II save, then ONE TECH INDEX release that changes five tracks. The release plays at most four
// tier-up beats (PART_TIER_FX.maxBeatsPerRelease); the fifth change (motorRetrofit 10 -> 36, tier 5 = top) swaps instantly with no
// partEvolved event, so INS-13 must come from the close re-check. H_boot_seed: the same save reloaded, and the heartbeat is on
// before any TECH INDEX close.
async function caseHOver(page) {
  await crankClicks(page, 45, 0);
  const buyS7 = await buyInTree(page, S7);
  const buyEra2 = await buyInTree(page, S9.slice(S7.length));
  await dismissEraCard(page);
  await sleep(300);
  const pre = await tierProbe(page);
  const preIns = await lineState(page, 'INS-13');
  await check(page, 'H_overcap_pre', buyS7.length === 0 && buyEra2.length === 0 && pre.era === 2 && pre.tierHeartbeat === false && !lineHeld(preIns), {
    buyFail: [...buyS7, ...buyEra2], preIns, ...pre,
  });

  const release = await buyInTree(page, OVERCAP_BUYS);
  const tiers = await waitTiers(page, OVERCAP_TIERS, 3000);
  const ins = await lineState(page, 'INS-13');
  const post = await tierProbe(page);
  const tiersOk = Object.entries(OVERCAP_TIERS).every(([id, t]) => tiers?.[id] === t);
  await check(page, 'H_overcap', release.length === 0 && tiersOk && lineHeld(ins) && post.tierHeartbeat === true, {
    buyFail: release, tiers, expectedTiers: OVERCAP_TIERS, ins, ...post,
  });

  // Save, reload, and read the heartbeat before any TECH INDEX open: the boot seed is the only thing that can turn it on.
  const saved = await page.evaluate(() => window.__wedtmd.saveNow());
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  const booted = await waitHeartbeat(page, 5000);
  await check(page, 'H_boot_seed', saved === true && booted.tierHeartbeat === true, { saved, ...booted });
}

// ---- WP23b (T18): eras III-V, the finale film, the postgame, cycles 2+, the bubble box guard ----
// Expected values mirror the design numbers the checks compare with (DENIZEN_ART §3 rows, WORLD_ENDING, FINALE_WIPE, FINALE_REVEAL).
// The game derives its own film and postgame times: every time the film or the postgame reaches is read back through the hook.
const INNER_CLEAR = 88;   // WORLD_LAYOUT.innerClearPx (anchor 64 + wing 24)
const MACHINE_RANGE = { s10: { left: 1302, right: 2808 }, s11: { left: 1036, right: 2808 }, s15: { left: 848, right: 2992 } };
const WIPE = { startS: 21.3, regrowthLagS: 2, pxPerS: 120 };   // FINALE_WIPE (finale.ts) and worldFinale.restoreTimeOf
const restoreAt = (x) => WIPE.startS + WIPE.regrowthLagS + Math.abs(x - HUB_X) / WIPE.pxPerS;
const FILM_HOME = { inspector: 784, dog: 2856, crow: 3104, girl: 976, sensor7: 712 };   // WORLD_ENDING.homeX
const LAST_LOOK_S = 59.83;   // FINALE_REVEAL: 49.3 + 0.8 + 1.0, then the first three lines (25 / 39 / 18 chars at 30 cps, 2 s pauses)
const ANCHOR_BOXES = [[848, 912], [2928, 2992]];   // portrait anchor boxes (world px); Z1: the dog never overlaps one while visible
const DOG_HALF_PX = 28;
const INS14_TEXT = 'Same rounds. Page one. You look familiar.';   // INS-14 (cycle 2+, replaces INS-01), verbatim from §5.2
const GIRL_STEP_MAX_PX = 12;   // WORLD_GIRL.stepMaxWorldPx (B-A3): one committed change moves the girl at most this far
const GRL12_CYCLE3 = 'Cycle 0044. You came back. So did we.';   // GRL-12 at cycle 3: {cycle} is the label 42 + 3 - 1 = 0044
const DEMO_WHY = 'demo edition: eras III-V, the finale, the postgame and cycle 2 are refused';
const I_NAMES = ['I_s10_placed', 'I_s11_placed', 'I_s13_placed', 'I_s15_placed', 'I_puddle_sprout', 'I_girl_steps', 'I_girl_step_clamp',
  'I_nothing_unhappens', 'I_double_exposure', 'I_reverse', 'I_stare_dog', 'I_chladni'];
const M_NAMES = ['I_virga_frozen', 'I_sync', 'I_one_observer', 'I_accent_still'];
const J_NAMES = ['J_restore_times', 'J_shield', 'J_last_look', 'J_crow_flight', 'J_drawn', 'J_no_bubble', 'J_skip'];
const JR_NAMES = ['J_reduced'];
const K_NAMES = ['K_turn_away', 'K_mark42', 'K_loop', 'K_pay12', 'K_pay12_ui100', 'K_sensor_turn', 'K_ins_pg', 'K_drawn'];
const L_NAMES = ['L_marks', 'L_red_ball', 'L_readout', 'L_girl_stage', 'L_pay13', 'L_cyc_lines'];
// Era V peak object count (case I), read by case K's G_display_peak.
let eraVPeak = null;

// Feet x and row per framing (WP23b R6, WORLD_PLACEMENTS, DENIZEN_ART §3); null = off-stage. s11 covers stages S11-S14; the girl joins
// at era IV (R6_ERA4). Inner ids (INNER) sit in the inner gap: machine left + INNER_CLEAR .. machine right - INNER_CLEAR.
const rowAt = (x, r, extra = {}) => ({ x, row: r, ...extra });
const R6 = {
  s10: {
    sensor7: rowAt(1234, 'back'), inspector: rowAt(1276, 'back'), dog: rowAt(2858, 'front'), payphone: rowAt(2858, 'back'),
    stakeChain: rowAt(2842, 'front'), hole: null, clock: null, lamp: null, crow: null, scraps: null, puddles: null, sprout: null,
    lantern: null, girl: null,   // WP27 F6.5: Sensor 7 and the Inspector stand at s10 (the one Inspector spot)
  },
  s11: {
    sensor7: rowAt(750, 'back'), inspector: rowAt(816, 'back'), dog: rowAt(2856, 'front'), clock: rowAt(2890, 'back'),
    payphone: rowAt(3050, 'back'), lamp: rowAt(3104, 'back'), crow: rowAt(3104, 'back'), stakeChain: rowAt(2840, 'front'),
    hole: rowAt(2886, 'front'), scraps: rowAt(690, 'back'), puddles: rowAt(960, 'back'), sprout: rowAt(996, 'back'), lantern: null, girl: null,
  },
  s15: {
    sensor7: rowAt(712, 'back'), inspector: rowAt(784, 'back'), payphone: rowAt(3050, 'back'), lamp: rowAt(3104, 'back'),
    crow: rowAt(3104, 'back'), scraps: rowAt(690, 'back'), dog: rowAt(2856, 'front'), clock: rowAt(2890, 'back'),
    stakeChain: rowAt(2840, 'front'), hole: rowAt(2886, 'front'), puddles: rowAt(960, 'back'), sprout: rowAt(996, 'back'),
    lantern: rowAt(965, 'front', { dy: 40 }), girl: rowAt(976, 'front', { dy: 40 }),   // five girl steps of 8 world px
  },
};
const R6_ERA4 = { ...R6.s11, girl: rowAt(880, 'back') };
const INNER = { s15: ['dog', 'clock', 'stakeChain', 'hole', 'puddles', 'sprout', 'lantern', 'girl'] };

// Records a check the demo build cannot reach as passed, with value.skipped.
const skipCheck = (name, why = DEMO_WHY) => report.check(name, true, { skipped: why });
const skipAll = (names, why = DEMO_WHY) => names.forEach((n) => skipCheck(n, why));
const isDemo = (page) => page.evaluate(() => window.__wedtmd.demoState() !== null).catch(() => false);

// Demo cap (A10): the S9 buys put the demo at its cap and the World scene sleeps, so the world clocks stop. The reason is not enough on its own:
// quiet comes first in the reason order and hides asleep, so a clock that does not move over two frames counts as silent too. Returns the
// reason, or null when the world runs or the build is the full game (its checks stay strict). Asleep and the hidden layer or tab are silent.
const SILENT_STATES = ['asleep', 'layer-hidden', 'tab-hidden'];
async function demoSilence(page) {
  if (!(await isDemo(page))) return null;
  const silence = await page.evaluate(() => window.__wedtmd.worldState()?.silence ?? null).catch(() => null);
  if (SILENT_STATES.includes(silence)) return silence;
  // The 1 s timer covers a page whose frames do not run (hidden): a frame that never comes reads as stopped.
  const stopped = await page.evaluate(() => new Promise((resolve) => {
    const w = window.__wedtmd;
    const a = w.worldState()?.playMs ?? null;
    const done = () => resolve(a !== null && (w.worldState()?.playMs ?? null) === a);
    requestAnimationFrame(() => requestAnimationFrame(done));
    setTimeout(done, 1000);
  })).catch(() => false);
  return stopped ? 'clock-stopped' : null;
}
// Records each name as passed with value.skipped when reason (from demoSilence) is set; false (nothing recorded) when the world runs.
async function skipIfSilent(page, names, reason) {
  if (reason === null) return false;
  for (const name of names) await check(page, name, true, { skipped: `world silent (${reason}): demo cap`, silence: reason }, true);
  return true;
}

// The living-world fields the WP23b checks read (null without a director).
const worldSnap = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  if (!s) return null;
  return {
    era: s.era, cycle: s.cycle, phase: s.phase, stare: s.stare, vents: s.vents, reverse: s.reverse, readout: s.readout,
    girlStage: s.girlStage, girlSteps: s.girlSteps, marks: s.marks, puddle: s.puddle, sprout: s.sprout, holeStage: s.holeStage,
    unison: s.unison, doubleExposures: s.doubleExposures, hidden: s.hidden, framing: s.framing, placements: s.placements,
    pending: s.pending, activeLines: s.activeLines, seen: s.seen, script: s.script ?? null,
  };
});
// A line is queued, playing or seen (lineHeld on a worldSnap).
const heldIn = (s, id) => s.pending.includes(id) || s.activeLines.includes(id) || s.seen.includes(id);
// Ids of the living-world entries drawn now (livingWorld(), visible only).
const visibleIds = (page) => page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => e.id));
// Ids of the drawn entries (visible). The restored girl window reports as girlWindow, so the girl id is the girl figure only.
const drawnIds = (page) => page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => (e.id === 'girl' && e.variant === 'window-restored' ? 'girlWindow' : e.id)));
// True when livingWorld() shows the id with variant `want` within capMs (polled every 150 ms).
async function variantSeen(page, id, want, capMs) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const hit = await page.evaluate(([i, v]) => (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === i && e.visible === true && e.variant === v), [id, want]);
    if (hit || Date.now() >= deadline) return hit;
    await sleep(150);
  }
}

// Runs in the page. The placements against one framing's rows: want[id] = { x, row, dy? } or null (off-stage). Inner ids sit in the
// inner gap; every other id keeps the wing rule (outside the machine box by 24) and stays out of the crank circle + 24.
function rowsInPage(spec) {
  const s = window.__wedtmd.worldState();
  if (!s) return { ok: false, problems: ['no world state'] };
  const problems = [];
  if (s.framing !== spec.framing) problems.push(`framing ${s.framing} != ${spec.framing}`);
  const pl = s.placements || {};
  for (const [id, want] of Object.entries(spec.want)) {
    const p = pl[id] ?? null;
    if (want === null) {
      if (p !== null) problems.push(`${id} placed at ${p.x}`);
      continue;
    }
    if (p === null) {
      problems.push(`${id} off-stage`);
      continue;
    }
    if (p.x !== want.x) problems.push(`${id} x ${p.x} != ${want.x}`);
    if (p.row !== want.row) problems.push(`${id} row ${p.row} != ${want.row}`);
    if ((p.dy ?? 0) !== (want.dy ?? 0)) problems.push(`${id} dy ${p.dy} != ${want.dy ?? 0}`);
    const m = spec.machine;
    if (spec.inner.includes(id)) {
      if (p.x < m.left + spec.innerClear || p.x > m.right - spec.innerClear) problems.push(`${id} at ${p.x} outside the inner bounds`);
    } else if (!(p.x <= m.left - spec.wing || p.x >= m.right + spec.wing)) {
      problems.push(`${id} at ${p.x} over the machine box`);
    }
    if (Math.abs(p.x - spec.hub) < spec.clear) problems.push(`${id} at ${p.x} inside the crank circle + 24`);
  }
  return { ok: problems.length === 0, problems, framing: s.framing };
}

// Waits (cap 6 s) until the placements match the rows of one framing. Returns the last result.
async function waitRows(page, framing, want, inner, machine) {
  const spec = { framing, want, inner, machine, hub: HUB_X, clear: HUB_CLEAR, wing: WING_CLEAR, innerClear: INNER_CLEAR };
  const deadline = Date.now() + 6000;
  let r = await page.evaluate(rowsInPage, spec);
  while (!r.ok && Date.now() < deadline) {
    await sleep(200);
    r = await page.evaluate(rowsInPage, spec);
  }
  return r;
}

// The nothing-un-happens reads: holes, puddles, sprout and girl steps (null-safe).
const progressOf = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  return s ? { hole: s.holeStage ?? 0, puddle: s.puddle, sprout: s.sprout, girl: s.girlSteps } : null;
});
const UP_KEYS = ['hole', 'puddle', 'sprout', 'girl'];
// Every count only rises from S9 to S15: each sample is at least the one before it.
const risesOnly = (seq) => seq.every((p) => p !== null) && seq.every((p, i) => i === 0 || UP_KEYS.every((k) => p[k] >= seq[i - 1][k]));

// Buys a list through the TECH INDEX, closes the era card and settles 300 ms. Returns the failed entries.
async function buyEra(page, list) {
  const failed = await buyInTree(page, list);
  await dismissEraCard(page);
  await sleep(300);
  return failed;
}

// Waits (cap 3 s) until the applied girl steps are one of `wants` and the girl placement's dy is 8 world px a step. A list (g4: 4 or 5)
// covers the 8 h jump that lands two steps in one commit.
async function girlStepsAt(page, wants) {
  const list = Array.isArray(wants) ? wants : [wants];
  const met = (x) => x !== null && list.includes(x.girlSteps) && (x.placements?.girl?.dy ?? -1) === 8 * x.girlSteps;
  const deadline = Date.now() + 3000;
  let s = await worldSnap(page);
  while (!met(s) && Date.now() < deadline) {
    await sleep(150);
    s = await worldSnap(page);
  }
  return { want: wants, steps: s?.girlSteps ?? null, dy: s?.placements?.girl?.dy ?? null };
}

// Advances the scheduler clock stepMs at a time (worldAdvance, then 120 ms for a frame) until pred(worldSnap) holds. null after maxSteps.
async function advanceUntil(page, stepMs, maxSteps, pred) {
  for (let i = 0; i < maxSteps; i++) {
    await page.evaluate((ms) => window.__wedtmd.worldAdvance(ms), stepMs);
    await sleep(120);
    const s = await worldSnap(page);
    if (s !== null && pred(s)) return s;
  }
  return null;
}

// The film clock: seek to t and read the world script and the finale phase in the same evaluate (no frame in between).
const probeFilm = (page, t) => page.evaluate((x) => {
  const w = window.__wedtmd;
  w.finaleSeek(x);
  return { t: x, script: w.worldState()?.script ?? null, phase: w.finaleState()?.phase ?? null };
}, t);
const castOf = (snap, id) => snap?.script?.cast?.[id] ?? null;
const brief = (c) => (c === null ? null : { visible: c.visible, frame: c.frame, row: c.row, x: c.x });
// Bisects the film clock in (lo, hi] for the first t where pred(probe) holds (pred monotone on the range).
async function filmEdge(page, lo, hi, pred, iters = 16) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (pred(await probeFilm(page, m))) b = m;
    else a = m;
  }
  return b;
}

// Buys the whole list (primaryFunction starts the ending) and waits (cap 8 s) for the film script. reduced sets reduced motion first.
async function startFilm(page, reduced) {
  if (reduced) await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await crankClicks(page, 45, 0);
  const bought = await buyList(page, S16);
  await dismissEraCard(page);
  await sleep(300);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && (await page.evaluate(() => window.__wedtmd.worldState()?.script ?? null)) === null) await sleep(150);
  return bought;
}
// Starts the film, SKIPs it to the choice and waits (cap 6 s) for the choice phase: the KEEP and cycle buttons.
async function toChoice(page, reduced = false) {
  const bought = await startFilm(page, reduced);
  await page.evaluate(() => window.__wedtmd.skipFinale());
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline && (await page.evaluate(() => window.__wedtmd.session.state.ending.phase)) !== 'choice') await sleep(150);
  return bought;
}

// Samples the dog across the KEEP walk for capMs (150 ms steps): keepS, visible and the world x.
async function sampleDog(page, capMs) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    const r = await page.evaluate(() => {
      const sc = window.__wedtmd.worldState()?.script ?? null;
      return sc ? { keepS: sc.keepS, visible: sc.cast?.dog?.visible ?? null, x: sc.cast?.dog?.x ?? null } : null;
    });
    if (r !== null) out.push(r);
    await sleep(150);
  }
  return out;
}
// Z1 dog rule: hidden for keepS 4.6-6.9 s (KEEP 4.5-7 s); while visible its centre +- DOG_HALF_PX never overlaps an anchor box.
function dogRule(samples) {
  const gap = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 4.6 && s.keepS <= 6.9);
  const hiddenOk = gap.length > 0 && gap.every((s) => s.visible === false);
  const overlap = samples.some((s) => s.visible === true && typeof s.x === 'number'
    && ANCHOR_BOXES.some(([l, r]) => s.x + DOG_HALF_PX > l && s.x - DOG_HALF_PX < r));
  return { ok: hiddenOk && !overlap, hiddenSamples: gap.length, overlap };
}

// Samples the postgame every 250 ms until keepS reaches stopS (or capMs): cast poses, marks and the script's marksPlus (null when the
// script has none), the ids drawn (livingWorld visible, the restored window as girlWindow), the bubble text, INS-PG seen.
async function sampleKeep(page, stopS, capMs) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    const r = await page.evaluate(() => {
      const w = window.__wedtmd;
      const s = w.worldState();
      const sc = s?.script ?? null;
      const b = w.worldBubble();
      const drawn = (w.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => (e.id === 'girl' && e.variant === 'window-restored' ? 'girlWindow' : e.id));
      return sc ? {
        keepS: sc.keepS, loopS: sc.loopS, cast: sc.cast, marks: s.marks, marksPlus: sc.marksPlus ?? null, drawn,
        bubble: b?.visible === true ? b.text : null, insPgSeen: s.seen.includes('INS-PG'),
      } : null;
    });
    if (r !== null) {
      out.push(r);
      if (typeof r.keepS === 'number' && r.keepS >= stopS) break;
    }
    await sleep(250);
  }
  return out;
}
const LAST_LOOK_POSES = { inspector: ['front', 5], dog: ['head', 5], crow: ['head', 5], sensor7: ['headC', 5] };
const posesAre = (cast, want) => Object.entries(want).every(([id, [frame, r]]) => cast?.[id]?.frame === frame && cast?.[id]?.row === r);
// Turn away (KEEP 1.5 s on): the Inspector idle, the dog sits, the crow perches, Sensor 7 looks up.
const turnedAway = (cast) => /^idle/.test(cast?.inspector?.frame ?? '') && /^sit/.test(cast?.dog?.frame ?? '')
  && /^perch/.test(cast?.crow?.frame ?? '') && cast?.sensor7?.frame === 'headUp';

// Forces a line and waits (cap 2 s) for its bubble. Returns { said, text } (text null when no bubble showed).
async function sayText(page, id) {
  const said = await worldSay(page, id);
  let text = null;
  for (let i = 0; i < 20 && text === null; i++) {
    await sleep(100);
    const b = await page.evaluate(() => window.__wedtmd.worldBubble());
    if (b?.visible === true) text = b.text;
  }
  return { said, text };
}
// Cycle state the L checks read, plus the red ball on the living-world list.
const cycleProbe = (page) => page.evaluate(() => {
  const s = window.__wedtmd.worldState();
  const ball = (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === 'redBall' && e.visible === true);
  return s ? { cycle: s.cycle, marks: s.marks, girlStage: s.girlStage, readout: s.readout, redBall: ball } : null;
});
// The visible .wv.on box (client px) or null; the DOM the player sees.
const wvBox = (page) => page.evaluate(() => {
  const el = document.querySelector('.wv.on');
  if (!el || el.getClientRects().length === 0) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top };
});
async function waitBox(page, capMs) {
  const deadline = Date.now() + capMs;
  for (;;) {
    const box = await wvBox(page);
    if (box !== null || Date.now() >= deadline) return box;
    await sleep(100);
  }
}

// I eras III-V (full edition): the rows per framing (s10, s11 / s13, s15), vents, puddle and sprout, the girl's five
// steps, nothing un-happens (S9 to S15), the era V double exposure (none under reduced motion), the Chladni rings (I_chladni), the reversed loops and the stare dog.
async function caseI(page) {
  if (await isDemo(page)) { skipAll(I_NAMES); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  const progress = [];
  const f9 = await buyEra(page, S9);
  progress.push(await progressOf(page));
  const f10 = await buyEra(page, S10.slice(S9.length));
  const r10 = await waitRows(page, 's10', R6.s10, [], MACHINE_RANGE.s10);
  await check(page, 'I_s10_placed', f9.length === 0 && f10.length === 0 && r10.ok, { buyFail: [...f9, ...f10], problems: r10.problems }, true);

  const f11 = await buyEra(page, S11.slice(S10.length));
  progress.push(await progressOf(page));
  const r11 = await waitRows(page, 's11', R6.s11, [], MACHINE_RANGE.s11);
  await check(page, 'I_s11_placed', f11.length === 0 && r11.ok, { buyFail: f11, problems: r11.problems }, true);
  const ws11 = await worldSnap(page);
  await drain(page, ['puddle', 'sprout'], 120);
  const vis11 = await visibleIds(page);
  const era3PuddleSprout = ws11 !== null && ws11.puddle >= 1 && ws11.sprout >= 1 && vis11.includes('puddle') && vis11.includes('sprout');

  const f13 = await buyEra(page, S13.slice(S11.length));
  progress.push(await progressOf(page));
  const r13 = await waitRows(page, 's11', R6_ERA4, [], MACHINE_RANGE.s11);
  await check(page, 'I_s13_placed', f13.length === 0 && r13.ok, { buyFail: f13, problems: r13.problems }, true);
  // I_chladni (FX8, AD4 F7): the S13 standingWave buys raise the Chladni intensity; WORLD_CHLADNI.ringsByIntensity gives rings-3 at 1 and
  // rings-5 at 2. The visible `chladni` entry of livingWorld() shows one of them (rings-3 is polled for 3 s, else rings-5 for 0.5 s).
  // WP24: the chladni ring transition runs before the read (the queue drains; the read is the variant as today).
  await drain(page, ['chladni'], 60);
  const chladniState = await page.evaluate(() => window.__wedtmd.worldState()?.chladni ?? null);
  const rings = (await variantSeen(page, 'chladni', 'rings-3', 3000)) || (await variantSeen(page, 'chladni', 'rings-5', 500));
  await check(page, 'I_chladni', f13.length === 0 && chladniState !== null && chladniState >= 1 && rings, { buyFail: f13, chladni: chladniState, rings }, true);

  // Era V starts with nullChamber: the girl's first step. Then the steps in list order (lensArray, ten horizonField, the rest).
  // I_girl_step_clamp: a 50 ms sampler of the girl's dy (nulls skipped), installed before the first era V buy; read and cleared after g5.
  await page.evaluate(() => {
    window.__dySamples = [];
    window.__dyTimer = setInterval(() => {
      const dy = window.__wedtmd.worldState()?.placements?.girl?.dy;
      if (typeof dy === 'number') window.__dySamples.push(dy);
    }, 50);
  });
  const f14 = await buyInTree(page, S14.slice(S13.length));
  await dismissEraCard(page);
  await sleep(300);
  const g1 = await girlStepsAt(page, 1);
  progress.push(await progressOf(page));
  const iLens = S15.indexOf('lensArray');
  const iHor = S15.indexOf('horizonField');
  const iSky = S15.indexOf('skyAperture');
  const fA = await buyInTree(page, S15.slice(S14.length, iLens + 1));
  const g2 = await girlStepsAt(page, 2);
  const fB = await buyInTree(page, S15.slice(iHor, iHor + 10));
  const g3 = await girlStepsAt(page, 3);
  const fC = await buyInTree(page, S15.slice(iHor + 10, iSky + 1));
  const g4 = await girlStepsAt(page, [4, 5]);
  const fD = await buyInTree(page, S15.slice(iSky + 1));
  await dismissEraCard(page);
  const g5 = await girlStepsAt(page, 5);
  progress.push(await progressOf(page));
  const r15 = await waitRows(page, 's15', R6.s15, INNER.s15, MACHINE_RANGE.s15);
  const fS15 = [...f14, ...fA, ...fB, ...fC, ...fD];
  await check(page, 'I_s15_placed', r15.ok && fS15.length === 0, { buyFail: fS15, problems: r15.problems }, true);
  const girls = [g1, g2, g3, g4, g5];
  // g4 may see 4 or 5 steps (the 8 h jump can land both); the others are exact.
  const stepsOk = g1.steps === 1 && g1.dy === 8 && g2.steps === 2 && g2.dy === 16 && g3.steps === 3 && g3.dy === 24
    && [4, 5].includes(g4.steps ?? -1) && g4.dy === 8 * (g4.steps ?? 0) && g5.steps === 5 && g5.dy === 40;
  await check(page, 'I_girl_steps', stepsOk, { girls }, true);
  // I_girl_step_clamp: stop the sampler; every rise between two samples is at most GIRL_STEP_MAX_PX, with at least 5 samples.
  const dySamples = await page.evaluate(() => {
    clearInterval(window.__dyTimer);
    const a = window.__dySamples ?? [];
    window.__dySamples = [];
    return a;
  });
  let maxRise = 0;
  for (let k = 1; k < dySamples.length; k++) maxRise = Math.max(maxRise, dySamples[k] - dySamples[k - 1]);
  await check(page, 'I_girl_step_clamp', dySamples.length >= 5 && maxRise <= GIRL_STEP_MAX_PX, { samples: dySamples.length, maxRise }, true);
  await check(page, 'I_nothing_unhappens', risesOnly(progress), { progress }, true);

  const ws15 = await worldSnap(page);
  await drain(page, ['puddle', 'sprout'], 120);
  const blackPuddle = await page.evaluate(() => (window.__wedtmd.livingWorld() ?? []).some((e) => e.id === 'puddle' && e.visible === true && /black/i.test(e.variant)));
  await check(page, 'I_puddle_sprout', era3PuddleSprout && ws15 !== null && ws15.sprout === 4 && blackPuddle,
    { era3: era3PuddleSprout, sprout15: ws15?.sprout ?? null, blackPuddle }, true);
  await check(page, 'I_reverse', ws15 !== null && ws15.era === 5 && ws15.reverse === true, { era: ws15?.era ?? null, reverse: ws15?.reverse ?? null }, true);
  eraVPeak = await page.evaluate(() => window.__wedtmd.displayObjects());

  // Era V double exposure: a flash within 75 s of scheduler time, then none for 100 s under reduced motion.
  const flash = await advanceUntil(page, 1000, 75, (s) => s.doubleExposures >= 1);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await sleep(300);
  const quietFrom = (await worldSnap(page))?.doubleExposures ?? 0;
  const reducedFlash = await advanceUntil(page, 1000, 100, (s) => s.doubleExposures > quietFrom);
  await check(page, 'I_double_exposure', flash !== null && reducedFlash === null,
    { full: flash?.doubleExposures ?? null, reducedFlash: reducedFlash?.doubleExposures ?? null }, true);

  // I_stare_dog: era V after the observer-one SYS LOG (the stare). STORY_BIBLE 5.5: a denizen at rest faces the camera, in motion it
  // shows its profile, so the dog's roam walk steps keep profile frames under the stare. Two close samples both on the front frame `head` at
  // different x is a sideways glide. Reduced motion goes back off so the dog roams as in play.
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: false }));
  await page.evaluate(() => window.__wedtmd.worldLogShown('observer-one'));
  let stareOn = null;
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const s = await worldSnap(page);
    if (s?.stare === true) {
      stareOn = true;
      break;
    }
  }
  // WP24: the dog takes a wander now, so its walk is on screen for the samples below.
  const dogNext = await page.evaluate(() => window.__wedtmd.worldBehaviourNext('dog', 'wander'));
  const dogSamples = [];
  for (let i = 0; i < 24; i++) {
    await sleep(150);
    dogSamples.push(await page.evaluate(() => {
      const d = (window.__wedtmd.livingWorld() ?? []).find((e) => e.id === 'dog');
      return d ? { t: performance.now(), visible: d.visible === true, variant: String(d.variant), x: d.x } : null;
    }));
  }
  // A glide: two visible `head` samples at most 300 ms apart (a stall between them is skipped) whose x differs by more than 0.5.
  let glides = 0;
  for (let k = 1; k < dogSamples.length; k++) {
    const a = dogSamples[k - 1];
    const b = dogSamples[k];
    if (a && b && a.visible && b.visible && a.variant === 'head' && b.variant === 'head' && b.t - a.t <= 300 && Math.abs(b.x - a.x) > 0.5) {
      glides++;
    }
  }
  const walkSeen = dogSamples.some((s) => s !== null && s.visible && /^walk/.test(s.variant));
  await check(page, 'I_stare_dog', stareOn === true && glides === 0 && walkSeen,
    { stare: stareOn, next: dogNext, glides, walkSeen, samples: dogSamples.map((s) => (s === null ? null : `${s.variant}@${s.x}`)) }, true);
}

// I_accent_still (FX8). The Inspector entry of livingWorld() sampled once per rendered frame (requestAnimationFrame) for ms of wall time:
// visible, variant and x. The probe changes only when a frame renders and a headless frame takes 100-150 ms, so a faster timer would only
// repeat a sample. Runs in the page.
const sampleInspector = (page, ms) => page.evaluate((capMs) => new Promise((resolve) => {
  const out = [];
  const t0 = performance.now();
  const tick = () => {
    const e = (window.__wedtmd.livingWorld() ?? []).find((x) => x.id === 'inspector');
    out.push({ t: performance.now(), visible: e?.visible === true, variant: String(e?.variant), x: e?.x });
    if (performance.now() - t0 >= capMs) resolve(out);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), ms);
// A slide: two CONSECUTIVE samples, both visible, the same write0 or front variant, at most 200 ms apart (ACCENT_GAP_MS: a headless frame
// runs 100-150 ms), whose x differs by more than 0.5.
// pairs counts the accent pairs compared (a run with pairs 0 proves nothing about slides).
const ACCENT_FRAMES = ['write0', 'front'];
const ACCENT_GAP_MS = 200;
// A window is covered (no vacuous pass) with at least ACCENT_MIN_SAMPLES samples spanning at least ACCENT_MIN_SPAN_MS.
const ACCENT_MIN_SAMPLES = 40;
const ACCENT_MIN_SPAN_MS = 7500;
function accentPairs(samples) {
  let pairs = 0;
  let slides = 0;
  for (let k = 1; k < samples.length; k++) {
    const a = samples[k - 1];
    const b = samples[k];
    if (!a.visible || !b.visible || a.variant !== b.variant || !ACCENT_FRAMES.includes(a.variant) || b.t - a.t > ACCENT_GAP_MS) continue;
    pairs++;
    if (Math.abs(b.x - a.x) > 0.5) slides++;
  }
  return { pairs, slides };
}
// The length test short-circuits, so an empty array is never indexed.
const accentCovered = (s) => s.length >= ACCENT_MIN_SAMPLES && s[s.length - 1].t - s[0].t >= ACCENT_MIN_SPAN_MS;
const accentSpanMs = (s) => (s.length === 0 ? 0 : Math.round(s[s.length - 1].t - s[0].t));

// M era IV chains (full edition): SYNCHRONIZATION (sync-success: DOG-09 and CRW-06 on one tick, unison, PAY-09 after) and ONE OBSERVER
// (observer-one: readout one, stare, INS-10 then GRL-09). I_accent_still reads the Inspector for 8 s before the stare and 8 s after it.
async function caseM(page) {
  if (await isDemo(page)) { skipAll(M_NAMES); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await crankClicks(page, 45, 0);
  // The buys run through the TECH INDEX, as in real play: the relocation gate places the era IV girl (GRL-09's speaker) only while the
  // tree is open, and a line needs its speaker on screen.
  const bought = await buyInTree(page, S13);
  await dismissEraCard(page);
  await sleep(500);
  // I_virga_frozen (AD4 F3): S13 bought in one go from era I; the virga strip shows its frozen frame (it kept falling before FX1).
  await drain(page, ['virga'], 120);
  const virgaFrozen = await variantSeen(page, 'virga', 'frozen', 3000);
  await check(page, 'I_virga_frozen', bought.length === 0 && virgaFrozen, { virgaFrozen }, true);
  // I_accent_still (FX8): the Inspector for 8 s before the stare (the stare comes up with observer-one, below). Under CPU load a
  // write / front accent may not land in 8 s, so the window grows in 4 s steps (up to 20 s) until one same-variant pair is seen.
  // WP24: the conductor holds the still unison before the sampler (the Inspector stands still for the window).
  const stillNext = await page.evaluate(() => window.__wedtmd.worldBehaviourNext('conductor', 'still'));
  const accBefore = await sampleInspector(page, 8000);
  for (let extra = 0; extra < 3 && accentPairs(accBefore).pairs === 0; extra++) accBefore.push(...(await sampleInspector(page, 4000)));
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  // Cadence (WP23b Z9): a fresh page has played under 90 s, so the first moment, the 60 s warm-up and the 120 s minGap block the lines
  // until the scheduler clock moves on (as F_no_repeat does).
  await page.evaluate(() => window.__wedtmd.worldAdvance(400000));
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldLogShown('sync-success'));
  // The reply queues DOG-09 and CRW-06 behind minGapMs (120 s from the start of the last line, here the INS-09 that the 400 s advance
  // played), so the unison can start up to about 120 s of scheduler time after the log: the cap is 300 s of 1 s steps.
  const sync = await advanceUntil(page, 1000, 300, (s) => s.activeLines.includes('DOG-09') && s.activeLines.includes('CRW-06'));
  const pay09 = sync === null ? null : await advanceUntil(page, 1000, 80, (s) => heldIn(s, 'PAY-09'));
  await check(page, 'I_sync', bought.length === 0 && sync !== null && sync.unison === true && pay09 !== null,
    { buyFail: bought, unison: sync?.unison ?? null, pay09: pay09 !== null }, true);

  // minGapMs (120 s) passes after PAY-09 before the observer-one reply.
  await page.evaluate(() => window.__wedtmd.worldAdvance(130000));
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldLogShown('observer-one'));
  // The readout and the stare come up after the reply: poll (cap 120 x 500 ms) and keep the first sample where both hold.
  let readoutOne = null;
  let stareOn = null;
  for (let i = 0; i < 120 && readoutOne === null; i++) {
    await page.evaluate(() => window.__wedtmd.worldAdvance(500));
    await sleep(120);
    const s = await worldSnap(page);
    if (s === null) break;
    if (s.readout === 'one' && s.stare === true) {
      readoutOne = s.readout;
      stareOn = s.stare;
    }
  }
  // I_accent_still (FX8): the Inspector for 8 s after the stare is on (none when it is not on: the check fails on stareOn).
  // WP24: after the stare the conductor switches to the beat, so the Inspector walks on its first downbeat (walkSeenAfter).
  const beatNext = stareOn === true ? await page.evaluate(() => window.__wedtmd.worldBehaviourNext('conductor', 'beat')) : null;
  const accAfter = stareOn === true ? await sampleInspector(page, 8000) : [];
  let firstIns = null;
  let firstGrl = null;
  // INS-10 then GRL-09 (chain steps). The reply waits behind the minGap of the last line (120 s), so the cap is 300 s of 1 s steps.
  for (let i = 0; i < 300 && (firstIns === null || firstGrl === null); i++) {
    await page.evaluate(() => window.__wedtmd.worldAdvance(1000));
    await sleep(120);
    const s = await worldSnap(page);
    if (s === null) break;
    if (firstIns === null && heldIn(s, 'INS-10')) firstIns = i;
    if (firstGrl === null && heldIn(s, 'GRL-09')) firstGrl = i;
  }
  await check(page, 'I_one_observer', readoutOne === 'one' && stareOn === true && firstIns !== null && firstGrl !== null && firstIns <= firstGrl,
    { readout: readoutOne, stare: stareOn, insStep: firstIns, grlStep: firstGrl }, true);
  // I_accent_still (FX8): no slide in an accent or stare frame before or after the stare, a coverage gate of at least 40 samples spanning
  // at least 7500 ms per phase, and at least one accent pair per phase (so the check cannot pass vacuously). A walk frame is seen after the
  // stare (visible, so a hidden entry does not count).
  const slideB = accentPairs(accBefore);
  const slideA = accentPairs(accAfter);
  const walkSeenAfter = accAfter.some((s) => s.visible && /^walk/.test(s.variant));
  const accSample = (s) => `${s.variant}@${s.x}`;
  await check(page, 'I_accent_still', slideB.slides === 0 && slideA.slides === 0 && stareOn === true && accentCovered(accBefore) && accentCovered(accAfter) && slideB.pairs >= 1 && slideA.pairs >= 1 && walkSeenAfter,
    {
      slidesBefore: slideB.slides, slidesAfter: slideA.slides, stareOn, still: stillNext, beat: beatNext, pairsBefore: slideB.pairs, pairsAfter: slideA.pairs, walkSeenAfter,
      samplesBefore: accBefore.length, samplesAfter: accAfter.length, spanBeforeMs: accentSpanMs(accBefore), spanAfterMs: accentSpanMs(accAfter),
      samples: { before: accBefore.slice(0, 24).map(accSample), after: accAfter.slice(0, 24).map(accSample) },
    }, true);
}

// J finale film (BD3, WP23b B-A5): restore times, shield, LAST LOOK, the crow flight, no bubble in the film, SKIP to the choice and the
// Z1 dog rule on the KEEP walk. The film times come from the hook (finaleSeek / script), the expected values mirror the design.
async function caseJ(page) {
  if (await isDemo(page)) { skipAll(J_NAMES); return; }
  const bought = await startFilm(page, false);
  const buyFail = bought.filter((x) => !x.endsWith(':true'));

  // Restore: row 4 a quarter second before each restore time, row 5 once the 0.4 s crossfade is over (the girl leaves at 31.5 s).
  const restores = [];
  for (const id of ['inspector', 'dog', 'crow', 'sensor7', 'girl']) {
    const t = restoreAt(FILM_HOME[id]);
    const before = brief(castOf(await probeFilm(page, t - 0.25), id));
    const after = id === 'girl' ? null : brief(castOf(await probeFilm(page, t + 0.55), id));
    restores.push({ id, t: Math.round(t * 100) / 100, before, after });
  }
  const restoreOk = buyFail.length === 0 && restores.every((r) => r.before !== null && r.before.visible === true && r.before.row === 4
    && (r.id === 'girl' || (r.after !== null && r.after.visible === true && r.after.row === 5)));
  await check(page, 'J_restore_times', restoreOk, { buyFail, restores }, true);

  // Shield poses from the beam (13 s) to the eclipse restore (19.3 s); the stare pose is back at 19.6 s.
  const sh15 = await probeFilm(page, 15);
  const sh196 = await probeFilm(page, 19.6);
  const shieldOk = castOf(sh15, 'inspector')?.frame === 'shield' && castOf(sh15, 'girl')?.frame === 'shield'
    && castOf(sh15, 'dog')?.frame === 'flat' && castOf(sh15, 'crow')?.frame === 'perch1' && castOf(sh196, 'inspector')?.frame === 'front';
  await check(page, 'J_shield', shieldOk, { at15: brief(castOf(sh15, 'inspector')), at196: brief(castOf(sh196, 'inspector')) }, true);

  // LAST LOOK: the flag edge is bisected in the film (50-62 s); the stare poses at row 5 snap there and the girl is gone.
  const lastAt = await filmEdge(page, 50, 62, (s) => s.script?.lastLook === true);
  const ll = await probeFilm(page, lastAt + 0.05);
  const llOk = Math.abs(lastAt - LAST_LOOK_S) <= 0.05 && ll.script?.lastLook === true && posesAre(ll.script?.cast, LAST_LOOK_POSES)
    && castOf(ll, 'girl')?.visible !== true;
  await check(page, 'J_last_look', llOk, { lastLookAt: Math.round(lastAt * 1000) / 1000, poses: brief(castOf(ll, 'inspector')) }, true);

  // Crow: takeoff 37 s (dx and dy climb), the lead flock 38-47.5 s (the world crow hidden, lead on the fx.bird pool), the glide 47.5-49.3 s.
  const c375 = castOf(await probeFilm(page, 37.5), 'crow');
  const at40 = await probeFilm(page, 40);
  const c485 = castOf(await probeFilm(page, 48.5), 'crow');
  const c498 = castOf(await probeFilm(page, 49.8), 'crow');
  const flightOk = c375?.visible === true && /^fly/.test(c375.frame) && c375.x > 3104 && c375.x < 3404
    && castOf(at40, 'crow')?.visible === false && at40.script?.lead?.row === 5 && /^fly/.test(at40.script?.lead?.frame ?? '')
    && c485?.visible === true && c485.x > 3104 && c485.x < 3624
    && c498?.visible === true && /^perch/.test(c498.frame) && Math.abs(c498.x - 3104) < 0.5;
  await check(page, 'J_crow_flight', flightOk, { takeoff: brief(c375), lead: at40.script?.lead ?? null, glide: brief(c485), back: brief(c498) }, true);

  // J_drawn: the entries livingWorld() draws (visible) at each seek, 350 ms after it. The girl leaves at 31.5 s, the lead flock flies
  // 38-47.5 s, and at LAST LOOK (59.9 s) the girl is gone while the other four and the restored window (girlWindow) are drawn.
  const drawn = {};
  for (const t of [30, 36, 40, 48.5, 59.9]) {
    await page.evaluate((x) => window.__wedtmd.finaleSeek(x), t);
    await sleep(350);
    drawn[String(t)] = await drawnIds(page);
  }
  const drawnAt = (t, id) => (drawn[String(t)] ?? []).includes(id);
  const drawnOk = drawnAt(30, 'girl') && !drawnAt(36, 'girl') && drawnAt(36, 'crow') && !drawnAt(40, 'crow')
    && drawnAt(40, 'inspector') && drawnAt(40, 'dog') && drawnAt(48.5, 'crow') && !drawnAt(59.9, 'girl')
    && ['inspector', 'dog', 'crow', 'sensor7'].every((id) => drawnAt(59.9, id))
    && drawnAt(59.9, 'girlWindow') && !drawnAt(36, 'girlWindow');
  await check(page, 'J_drawn', drawnOk, { drawn }, true);

  // No bubble in the film: the scheduler is silent while the film runs.
  await settle(page);
  const bubbles = [];
  for (const t of [20, 30, 40, 50, 60]) {
    await probeFilm(page, t);
    await sleep(250);
    bubbles.push(await bubbleVisible(page));
  }
  await check(page, 'J_no_bubble', bubbles.every((b) => b === false), { bubbles }, true);

  // SKIP lands in the choice with the LAST LOOK poses; KEEP IT RUNNING then runs the dog's walk (Z1, sampled for 10 s).
  await page.evaluate(() => window.__wedtmd.skipFinale());
  await sleep(400);
  const after = await page.evaluate(() => ({ phase: window.__wedtmd.session.state.ending.phase, lastLook: window.__wedtmd.worldState()?.script?.lastLook ?? null }));
  await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 8000 });
  const dog = dogRule(await sampleDog(page, 10000));
  await check(page, 'J_skip', after.phase === 'choice' && after.lastLook === true && dog.ok, { phase: after.phase, lastLook: after.lastLook, dog }, true);
}

// J_reduced: the same film under reduced motion: all whole at 24.3 s (no crossfade), the girl gone, shields stay, the crow cut at 38 s
// and back at 49.3 s, LAST LOOK instant.
async function caseJR(page) {
  if (await isDemo(page)) { skipAll(JR_NAMES); return; }
  await startFilm(page, true);
  const s15 = await probeFilm(page, 15);
  const s24 = await probeFilm(page, 24.5);
  const s36 = await probeFilm(page, 36);
  const s385 = await probeFilm(page, 38.5);
  const s50 = await probeFilm(page, 50);
  const s599 = await probeFilm(page, 59.9);
  const whole = ['inspector', 'dog', 'crow', 'sensor7'].every((id) => castOf(s24, id)?.row === 5 && castOf(s24, id)?.visible === true);
  const shields = castOf(s15, 'inspector')?.frame === 'shield' && castOf(s15, 'girl')?.frame === 'shield';
  const crowCut = castOf(s385, 'crow')?.visible === false && s385.script?.lead == null && castOf(s36, 'crow')?.visible === true
    && /^perch/.test(castOf(s36, 'crow')?.frame ?? '') && castOf(s50, 'crow')?.visible === true && castOf(s50, 'crow')?.frame === 'perch0';
  const lastLookNow = s599.script?.lastLook === true && posesAre(s599.script?.cast, LAST_LOOK_POSES);
  const reduced = s24.script?.reduced === true;
  await check(page, 'J_reduced', reduced && whole && castOf(s24, 'girl')?.visible !== true && shields && crowCut && lastLookNow,
    { reduced, whole, shields, crowCut, lastLookNow }, true);
}

// K postgame (WP23b B-A6, bible §9.2): KEEP turns everyone away, the crow's mark, the 90 s loop (the pat, INS-PG), PAY-12 after 600 s
// (its bubble above the booth hood, clear of the UI 150 and UI 100 buttons), the Sensor 7 turn after 1200 s. worldAdvance moves the postgame gates; the loop runs on the clock.
async function caseK(page) {
  if (await isDemo(page)) { skipAll(K_NAMES); skipCheck('G_display_peak'); return; }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150, worldVoices: 'on' }));
  await toChoice(page, false);
  await page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 8000 });
  const samples = await sampleKeep(page, 30, 42000);
  const between = (lo, hi) => samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= lo && s.keepS < hi);

  const lastLookSamples = between(0, 1.2);
  const awaySamples = between(2.2, 2.8);
  const turnOk = lastLookSamples.length > 0 && lastLookSamples.every((s) => posesAre(s.cast, LAST_LOOK_POSES))
    && awaySamples.length > 0 && awaySamples.every((s) => turnedAway(s.cast));
  await check(page, 'K_turn_away', turnOk, { lastLook: lastLookSamples.length, away: awaySamples.length }, true);

  // K_mark42: the drawn tally is state marks + the script's marksPlus (the crow's extra peck mark): 42 from keepS 5.5 on.
  const late = between(5.5, 1000);
  const tally = (s) => s.marks + (s.marksPlus ?? 0);
  const lastLate = late[late.length - 1] ?? null;
  await check(page, 'K_mark42', late.length > 0 && late.every((s) => tally(s) === 42),
    { marks: lastLate?.marks ?? null, marksPlus: lastLate?.marksPlus ?? null }, true);

  // The loop clock (script.loopS): the Inspector rests at home (784), crosses to the pat (742, pat frames at 14.5 s) and the dog sleeps at 732.
  const pat = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 14.6 && s.loopS < 19.9);
  const rest = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 1 && s.loopS < 12);
  const loopOk = pat.length > 0 && pat.every((s) => s.cast?.inspector?.x === 742 && /^pat/.test(s.cast?.inspector?.frame ?? ''))
    && rest.length > 0 && rest.every((s) => s.cast?.inspector?.x === 784 && s.cast?.dog?.x === 732);
  await check(page, 'K_loop', loopOk, { pat: pat.length, rest: rest.length }, true);

  // INS-PG: the pat says Good boy. in-world once; it never enters seen (scripted, not persisted).
  const insWin = samples.filter((s) => typeof s.loopS === 'number' && s.loopS >= 14.4 && s.loopS < 21);
  await check(page, 'K_ins_pg', insWin.some((s) => s.bubble === 'Good boy.') && samples.every((s) => s.insPgSeen === false),
    { window: insWin.length }, true);

  // K_drawn: the girl figure is never drawn; the restored window (girlWindow) is drawn in every sample; the dog is hidden for keepS 4.6-6.9 and drawn from 9 s; the crow is drawn in every sample.
  const drawnGap = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 4.6 && s.keepS <= 6.9);
  const drawnLate = samples.filter((s) => typeof s.keepS === 'number' && s.keepS >= 9);
  const drawnOk = samples.length > 0 && samples.every((s) => !s.drawn.includes('girl') && s.drawn.includes('crow'))
    && samples.every((s) => s.drawn.includes('girlWindow'))
    && drawnGap.length > 0 && drawnGap.every((s) => !s.drawn.includes('dog'))
    && drawnLate.length > 0 && drawnLate.every((s) => s.drawn.includes('dog'));
  await check(page, 'K_drawn', drawnOk, { samples: samples.length, gap: drawnGap.length, late: drawnLate.length }, true);

  // PAY-12 after 600 s of postgame: its bubble sits above the booth hood and clear of the UI 150 buttons.
  await settle(page);
  await page.evaluate(() => window.__wedtmd.worldAdvance(600000));
  let shown = false;
  for (let i = 0; i < 80 && !shown; i++) {
    await sleep(150);
    shown = await page.evaluate(() => {
      const b = window.__wedtmd.worldBubble();
      return b?.visible === true && b.text === 'Thank you for holding.';
    });
  }
  const m = shown ? await page.evaluate(measureInPage) : null;
  const c = m === null ? ['no-bubble-box'] : clashes(m);
  await check(page, 'K_pay12', shown && m !== null && m.dom !== null && m.bubble?.side === 'above' && !c.includes('hud-buttons'), { clashes: c, side: m?.bubble?.side ?? null }, true);

  // K_pay12_ui100 (AD4 F2): the same line forced at UI 100; its bubble stays above the booth hood and clear of the HUD buttons.
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 100 }));
  await sleep(600);
  await settle(page);
  const said100 = await worldSay(page, 'PAY-12');
  let shown100 = false;
  for (let i = 0; i < 40 && !shown100; i++) {
    await sleep(150);
    shown100 = await page.evaluate(() => {
      const b = window.__wedtmd.worldBubble();
      return b?.visible === true && b.text === 'Thank you for holding.';
    });
  }
  const m100 = shown100 ? await page.evaluate(measureInPage) : null;
  await check(page, 'K_pay12_ui100', said100 && shown100 && m100 !== null && m100.dom !== null && m100.bubble?.side === 'above' && !clashes(m100).includes('hud-buttons'), { said: said100, side: m100?.bubble?.side ?? null, clashes: m100 === null ? null : clashes(m100) }, true);
  await settle(page);
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ uiScale: 150 }));
  await sleep(400);

  // Sensor 7 camera turn after 1200 s of postgame: head on the camera (headC) for 3 s, then back to headUp.
  await page.evaluate(() => window.__wedtmd.worldAdvance(600000));
  const scriptNow = () => page.evaluate(() => window.__wedtmd.worldState()?.script ?? null);
  let on = null;
  for (let i = 0; i < 100 && on === null; i++) {
    await sleep(150);
    const sc = await scriptNow();
    if (sc?.sensorTurn === true) on = { sensor7: sc.cast?.sensor7?.frame ?? null };
  }
  let off = null;
  for (let i = 0; i < 50 && on !== null && off === null; i++) {
    await sleep(150);
    const sc = await scriptNow();
    if (sc?.sensorTurn === false) off = { sensor7: sc.cast?.sensor7?.frame ?? null };
  }
  await check(page, 'K_sensor_turn', on !== null && on.sensor7 === 'headC' && off !== null && off.sensor7 === 'headUp', { on, off }, true);

  const postObjects = await page.evaluate(() => window.__wedtmd.displayObjects());
  await check(page, 'G_display_peak', eraVPeak !== null && eraVPeak <= 100 && postObjects <= 100, { eraV: eraVPeak, postgame: postObjects }, true);
}

// L cycles 2+ (B-A7, bible §9.3): cycle 2 and cycle 3 through session.beginNewCycle (the ending must be revealed: the choice).
async function caseL(page) {
  if (await isDemo(page)) { skipAll(L_NAMES); return; }
  await toChoice(page, false);
  const c1 = await cycleProbe(page);
  const began2 = await page.evaluate(() => window.__wedtmd.session.beginNewCycle());
  await sleep(1200);
  const c2 = await cycleProbe(page);
  await settle(page);
  // Right after beginNewCycle the onboarding prompt is a hard silence: one crank click, then 16 clicks pay for Gear Ratio. That first
  // purchase of the cycle arms the PAY-13 opener, so the INS-14 line comes after it.
  await crankClicks(page, 16, 0);
  const buyFirst = await buyList(page, ['gearRatio']);
  await settle(page);
  const ins14 = await sayText(page, 'INS-14');
  await settle(page);
  // PAY-13: the opener plays 60 s of scheduler time after that purchase (worldAdvance).
  const pay13 = await advanceUntil(page, 1000, 75, (s) => heldIn(s, 'PAY-13'));
  await settle(page);

  await toChoice(page, false);
  const began3 = await page.evaluate(() => window.__wedtmd.session.beginNewCycle());
  await sleep(1200);
  const c3 = await cycleProbe(page);
  // Cycle 3 starts the same way (crank, buy, settle) before the GRL-12 line.
  await crankClicks(page, 16, 0);
  const buyCycle3 = await buyList(page, ['gearRatio']);
  await settle(page);
  const grl12 = await sayText(page, 'GRL-12');

  await check(page, 'L_marks', began2 && began3 && c2?.marks === 42 && c3?.marks === 43, { cycle2: c2?.marks ?? null, cycle3: c3?.marks ?? null }, true);
  await check(page, 'L_readout', c2?.readout === 'one' && c3?.readout === 'one', { cycle2: c2?.readout ?? null, cycle3: c3?.readout ?? null }, true);
  await check(page, 'L_girl_stage', c2?.girlStage === 'mini' && c3?.girlStage === 'ground', { cycle2: c2?.girlStage ?? null, cycle3: c3?.girlStage ?? null }, true);
  await check(page, 'L_red_ball', c1 !== null && c1.redBall === false && c2?.redBall === true && c3?.redBall === true,
    { cycle1: c1?.redBall ?? null, cycle2: c2?.redBall ?? null, cycle3: c3?.redBall ?? null }, true);
  await check(page, 'L_pay13', buyFirst.length === 0 && pay13 !== null, { buyFail: buyFirst }, true);
  await check(page, 'L_cyc_lines', ins14.said && ins14.text === INS14_TEXT && grl12.said && grl12.text === GRL12_CYCLE3 && buyCycle3.length === 0,
    { ins14, grl12, buyFail: [...buyFirst, ...buyCycle3] }, true);
}

// F23 (Z12, the WP23b repo guard): the bubble box must not flip. Viewport 1280x800, era II entry (S8). Six forced PAY-03 lines; per line,
// seven samples of the .wv.on box over 700 ms after it turns on: its left and top stay within 4 px of the first sample.
async function caseF23(page) {
  await crankClicks(page, 45, 0);
  const buyFail = await buyInTree(page, S8);
  await dismissEraCard(page);
  await sleep(300);
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  const rounds = [];
  for (let i = 0; i < 6; i++) {
    await settle(page);
    const said = await worldSay(page, 'PAY-03');
    const box = await waitBox(page, 3000);
    const samples = [box];
    if (box !== null) {
      for (let k = 1; k < 7; k++) {
        await sleep(700 / 6);
        samples.push(await wvBox(page));
      }
    }
    const first = samples[0];
    const flips = samples.filter((b) => b === null || first === null || Math.abs(b.l - first.l) > 4 || Math.abs(b.t - first.t) > 4).length;
    rounds.push({ said, first, flips });
  }
  await check(page, 'F23_no_flip', buyFail.length === 0 && rounds.length === 6 && rounds.every((r) => r.said && r.first !== null && r.flips === 0),
    { buyFail, rounds }, true);
}

// ---- WP24 (T9a): the living-world v2 cases NV, NC, NT, NU, NK. One fresh context per case. The members read here are the WP24 debug
// contract (C7): worldBehaviour, worldBehaviourLog, worldTransitions, worldProps and livingWorld with alpha and y. Samples run on the
// scheduler clock (worldAdvance STEP_MS per sample); frames adds one rAF per sample so the living and prop rows are redrawn first.
const WALKERS = ['inspector', 'dog', 'crow', 'girl'];
// The walkers one crank click steps: visible in livingWorld() and not parked (the girl parks in the window stage and keeps step 0).
const steppable = (visible, behaviour) => WALKERS.filter((id) => visible.includes(id)
  && (behaviour.find((e) => e.id === id)?.activity ?? null) !== 'parked');
const WALK_RE = /^walk/;
const STEP_MS = 250;          // one sample = one worldAdvance step
const VARIETY_STEPS = 2400;   // 10 min of scheduler time
const CHANGE_STEPS = 720;     // 3 min of scheduler time
const LOCK_MS = 125;          // V5: a start this close to another runner's start counts as lockstep
const ALPHA_MOVE = 0.02;      // V4: alpha moves by this much (or x / y by PX_MOVE, or the variant differs) counts as a change
const PX_MOVE = 1;
const LIT_ALPHA = 0.02;       // a prop row is shown above this alpha
const WALK_PX = 8;            // V6: the largest step on a walk variant
const REST_PX = 4;            // V6: the largest step off a walk variant (the crow stutter hop, WORLD_ENV.crowStutterPx)
const REPEAT_MAX = 2;         // V2b: an exact 4-activity run recurs at most this often in one window
const WALK_SHARE_MAX = 0.3;   // V8
const LOCK_REST_MAX = 0.12;   // V5 outside era IV
const LOCK_IV_MIN = 0.9;      // V5 in era IV (the conductor's downbeat)
// Rest frames a denizen may draw under the stare (WORLD_STARE_SAFE, src/data/worldBehaviour.ts; mirrored, this smoke is plain JS).
const STARE_SAFE = {
  inspector: ['front', 'talk'], dog: ['head', 'talk'], crow: ['head', 'talk'], girl: ['stand0', 'stand1', 'talk', 'lanternUp', 'tilt'],
};
// V1: the minimum distinct looks per 10 min window (the plan's V1 table). The crow is off-stage at s10 and is not checked there.
const VARIETY_MIN = {
  s7: { inspector: 6, dog: 5, crow: 2 },
  s8: { inspector: 5, dog: 5, crow: 3, girl: 2 },
  s9: { inspector: 6, dog: 5, crow: 3, girl: 2 },
  s10: { inspector: 4, dog: 5, girl: 2 },
  s11: { inspector: 7, dog: 6, crow: 3, girl: 2 },
  s13b: { inspector: 5, dog: 5, crow: 5, girl: 5 },
  s13a: { inspector: 4, dog: 4, crow: 4, girl: 4 },
  s15: { inspector: 3, dog: 3, crow: 2, girl: 3 },
};
const VARIETY_TAILS = ['distinct', 'no_repeat', 'walk_share', 'lockstep'];
const varietyNames = (s) => VARIETY_TAILS.map((t) => `N_${s}_${t}`);
const changeNames = (s) => (s === 's13a' || s === 's15' ? [`N_${s}_changes`, `N_${s}_rendered`] : [`N_${s}_changes`]);
// Stages that need era III or later (s13b / s13a: era IV; s15: era V). The demo edition cannot reach them.
const ERA3_VARIETY = ['s10', 's11', 's13b', 's13a', 's15'];

// Runs in the page. `steps` times: worldAdvance(stepMs), then (frames) one animation frame, then the runner snapshot. Returns the runner k
// at the start, the walk and presence counts per runner, the behaviour log entries that ended inside the window (everything after the
// last entry the log held at the start; cut when that entry has left the ring), the stare flag and, with frames, the compact rows per sample.
// With micro (WP24 r2), each sample also carries d: the four micro flags [hitch, clockTwitch, lampDip, boothDip] of worldDay() (null
// while the day clock is hidden).
async function windowRunInPage(spec) {
  const w = window.__wedtmd;
  const logKey = (e) => `${e.id}|${e.atMs}`;
  const behaviour = () => w.worldBehaviour() ?? [];
  const k0 = {};
  for (const e of behaviour()) k0[e.id] = e.k;
  const logStart = w.worldBehaviourLog() ?? [];
  const cursor = logStart.length > 0 ? logKey(logStart[logStart.length - 1]) : null;
  const walking = {};
  const present = {};
  const samples = [];
  for (let i = 0; i < spec.steps; i++) {
    w.worldAdvance(spec.stepMs);
    if (spec.frames) await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const b = behaviour();
    for (const e of b) {
      present[e.id] = (present[e.id] ?? 0) + 1;
      if (e.walking === true) walking[e.id] = (walking[e.id] ?? 0) + 1;
    }
    if (spec.frames || spec.micro) {
      const row = {};
      if (spec.frames) {
        row.l = (w.livingWorld() ?? []).map((e) => [e.id, e.variant, e.x, e.y, e.alpha, e.visible === true]);
        row.p = (w.worldProps() ?? []).map((r) => [r.id, r.frame, r.alpha, r.x, r.y]);
        row.b = b.map((e) => [e.id, e.activity]);
      }
      if (spec.micro) {
        const m = w.worldDay()?.micro;
        row.d = m ? [m.hitch, m.clockTwitch, m.lampDip, m.boothDip] : null;
      }
      samples.push(row);
    }
  }
  const log = w.worldBehaviourLog() ?? [];
  let from = 0;
  let cut = false;
  if (cursor !== null) {
    let at = -1;
    for (let j = log.length - 1; j >= 0 && at < 0; j--) if (logKey(log[j]) === cursor) at = j;
    if (at >= 0) from = at + 1;
    else cut = true;
  }
  const entries = log.slice(from).map((e) => ({
    id: e.id, activity: e.activity, atMs: e.atMs, durMs: e.durMs, walked: e.walked, reaction: e.reaction, look: e.look,
  }));
  return { k0, walking, present, log: entries, cut, steps: spec.steps, stare: w.worldState()?.stare === true, samples };
}

// Runs in the page. The living entries of the walkers, once per animation frame, for ms of wall time: [id, visible, variant, x] tuples.
function teleportInPage(spec) {
  return new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const tick = () => {
      out.push((window.__wedtmd.livingWorld() ?? []).filter((e) => spec.ids.includes(e.id)).map((e) => [e.id, e.visible === true, e.variant, e.x]));
      if (performance.now() - t0 >= spec.ms) resolve(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Advances the world 1 s at a time (one rAF per step) until worldTransitions() lists none of ids, at most capS seconds of advance.
// Returns whether the ids drained.
async function drain(page, ids, capS) {
  const busy = () => page.evaluate((list) => (window.__wedtmd.worldTransitions() ?? []).some((t) => list.includes(t.id)), ids);
  for (let s = 0; s < capS; s++) {
    if (!(await busy())) return true;
    await page.evaluate(() => window.__wedtmd.worldAdvance(1000));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
  }
  return !(await busy());
}
// Ids of the transitions queued or running now: the set drain waits for.
const transitionIds = (page) => page.evaluate(() => (window.__wedtmd.worldTransitions() ?? []).map((t) => t.id));

// Buys a stage list (TECH INDEX, era card closed), keeps the world quiet (no lines, no glances) and drains the transition queue.
// Returns the failed buys.
async function stageSetup(page, list) {
  const failed = await buyEra(page, list);
  await page.evaluate(() => window.__wedtmd.worldQuiet(true));
  await drain(page, await transitionIds(page), 120);
  return failed;
}

// The observer-one log: quiet off for the reply, quiet back on once the stare is up (cap 120 s of scheduler time). Returns whether it is up.
async function observerOne(page) {
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  await page.evaluate(() => window.__wedtmd.worldLogShown('observer-one'));
  let on = false;
  for (let i = 0; i < 240 && !on; i++) {
    await page.evaluate(() => window.__wedtmd.worldAdvance(500));
    await sleep(120);
    on = await page.evaluate(() => window.__wedtmd.worldState()?.stare === true);
  }
  await page.evaluate(() => window.__wedtmd.worldQuiet(true));
  await drain(page, await transitionIds(page), 120);
  return on;
}

// Groups log entries by runner id, in log order.
function byActor(entries) {
  const map = new Map();
  for (const e of entries) {
    const list = map.get(e.id) ?? [];
    list.push(e);
    map.set(e.id, list);
  }
  return map;
}
// V2a: adjacent entries of one runner with the same activity id. V2b: the largest count of one exact 4-activity run (ids and
// durations rounded to 1 s) of one runner.
function repeatsOf(actors) {
  let adjacent = 0;
  let maxGram = 0;
  for (const list of actors.values()) {
    const grams = new Map();
    for (let j = 1; j < list.length; j++) if (list[j].activity === list[j - 1].activity) adjacent += 1;
    for (let j = 0; j + 4 <= list.length; j++) {
      const key = list.slice(j, j + 4).map((e) => `${e.activity}:${Math.round(e.durMs / 1000)}`).join('|');
      const n = (grams.get(key) ?? 0) + 1;
      grams.set(key, n);
      maxGram = Math.max(maxGram, n);
    }
  }
  return { adjacent, maxGram };
}
// V5: the share of starts within LOCK_MS of another runner's start (every runner in the window).
function lockstepOf(entries) {
  let near = 0;
  for (const s of entries) {
    if (entries.some((o) => o.id !== s.id && Math.abs(o.atMs - s.atMs) <= LOCK_MS)) near += 1;
  }
  return { starts: entries.length, near, share: entries.length > 0 ? near / entries.length : null };
}

// The N variety rows of one stage (C8: distinct looks, no repeats, walk share, lockstep). Every value carries the runner k at the
// window start. extra.ok (the stage state) joins the distinct check; extra.buyFail lists the buys that failed on the way.
function varietyRows(stage, win, extra) {
  const actors = byActor(win.log);
  const min = VARIETY_MIN[stage];
  const distinct = {};
  for (const id of Object.keys(min)) distinct[id] = new Set((actors.get(id) ?? []).map((e) => e.look)).size;
  const rep = repeatsOf(actors);
  const shares = {};
  for (const id of Object.keys(win.present)) shares[id] = Math.round(((win.walking[id] ?? 0) / win.steps) * 1000) / 1000;
  const lock = lockstepOf(win.log);
  const base = { k0: win.k0, buyFail: extra.buyFail ?? [], stare: win.stare, cut: win.cut };
  const era4 = stage === 's13b' || stage === 's13a';
  return [
    [`N_${stage}_distinct`, Object.entries(min).every(([id, m]) => distinct[id] >= m) && (extra.ok ?? true), { ...base, distinct, min }],
    [`N_${stage}_no_repeat`, rep.adjacent === 0 && rep.maxGram <= REPEAT_MAX, { ...base, adjacent: rep.adjacent, maxGram: rep.maxGram }],
    [`N_${stage}_walk_share`, Object.values(shares).every((v) => v <= WALK_SHARE_MAX), { ...base, shares }],
    [`N_${stage}_lockstep`, lock.starts > 0 && (era4 ? lock.share >= LOCK_IV_MIN : lock.share <= LOCK_REST_MAX),
      { ...base, starts: lock.starts, near: lock.near, share: lock.share }],
  ];
}

// One stage of N variety: 10 min of scheduler time in one evaluate (no frames), then the rows.
async function varietyStage(page, stage, extra = {}) {
  const win = await page.evaluate(windowRunInPage, { steps: VARIETY_STEPS, stepMs: STEP_MS, frames: false });
  for (const [name, cond, detail] of varietyRows(stage, win, extra)) await check(page, name, cond, detail, true);
}

// C8 required rows per stage: a row listed here must be shown in the window, so a missing row fails the changes check and does not pass
// on no data. The four denizens stay checked by the `denizens` test.
const CHANGE_REQUIRED = {
  s9: ['receiver', 'lampGlow', 'boothHood', 'sensorLed', 'mote0', 'mote1', 'mote2', 'mote3', 'mote4', 'scrap0', 'scrap1', 'clockMinute'],
  s11: ['receiver', 'lampGlow', 'boothHood', 'sensorLed', 'mote0', 'mote1', 'mote2', 'mote3', 'mote4', 'scrap0', 'sprout', 'clockMinute'],
  s13a: ['lampGlow', 'boothHood', 'sensorLed', 'clockMinute'],
  s15: ['boothHood', 'sensorLed', 'ring0', 'ring1', 'ring2', 'clockMinute'],
};
// The V4 rules of one stage: the element (a living entry or a prop row), its gap limit in seconds, whether the era IV hold action pauses its
// clock (runners only) and whether the row is required (CHANGE_REQUIRED). Denizens 20 s (era V 30 s); receiver 10 s and motes 1 s (eras II-III);
// lamp glow, booth hood and Sensor 7 LED 30 s while lit; scraps 60 s and sprout 30 s (era III); Chladni rings 20 s (era V); clock 120 s (from era II).
function changeRules(stage) {
  const early = stage === 's9' || stage === 's11';
  const need = (key) => (CHANGE_REQUIRED[stage] ?? []).includes(key);
  const rules = WALKERS.map((id) => ({ key: id, src: 'living', limitS: stage === 's15' ? 30 : 20, hold: true }));
  if (early) rules.push({ key: 'receiver', src: 'living', limitS: 10, required: need('receiver') });
  if (early) for (let i = 0; i < 5; i++) rules.push({ key: `mote${i}`, src: 'prop', limitS: 1, required: need(`mote${i}`) });
  for (const key of ['lampGlow', 'boothHood', 'sensorLed']) rules.push({ key, src: 'prop', limitS: 30, required: need(key) });
  if (early) for (let i = 0; i < 3; i++) rules.push({ key: `scrap${i}`, src: 'prop', limitS: 60, required: need(`scrap${i}`) });
  if (stage === 's11') rules.push({ key: 'sprout', src: 'prop', limitS: 30, required: need('sprout') });
  if (stage === 's15') for (let i = 0; i < 5; i++) rules.push({ key: `ring${i}`, src: 'prop', limitS: 20, required: need(`ring${i}`) });
  rules.push({ key: 'clockMinute', src: 'prop', limitS: 120, required: need('clockMinute') });
  return rules;
}

// Per sample: Maps of the living entries (first visible one wins a duplicate id), the prop rows (visible above LIT_ALPHA) and the runner
// activities. The compact rows of windowRunInPage become Maps here.
function indexSamples(samples) {
  return samples.map((s) => {
    const living = new Map();
    for (const [id, variant, x, y, alpha, visible] of s.l) {
      const prev = living.get(id);
      if (prev === undefined || (visible && prev.visible !== true)) living.set(id, { variant, x, y, alpha, visible });
    }
    const props = new Map();
    for (const [id, frame, alpha, x, y] of s.p) props.set(id, { variant: frame, x, y, alpha, visible: alpha >= LIT_ALPHA });
    return { living, props, act: new Map(s.b) };
  });
}
// The change test (V4 / C8): the variant differs, alpha moves by ALPHA_MOVE, or x or y moves by PX_MOVE world px (against the last change).
const moved = (a, b) => a.variant !== b.variant || Math.abs(a.alpha - b.alpha) >= ALPHA_MOVE
  || Math.abs(a.x - b.x) >= PX_MOVE || Math.abs(a.y - b.y) >= PX_MOVE;
// The longest gap (ms) between two changes of one element, counted from the first sample it is shown. A hidden sample or a hold
// sample pauses the clock: the gap ends there and restarts when the element shows again. null when the element is never shown.
function worstGap(indexed, rule) {
  let measured = false;
  let ref = null;
  let last = 0;
  let worst = 0;
  for (let i = 0; i < indexed.length; i++) {
    const s = indexed[i];
    const cur = (rule.src === 'living' ? s.living : s.props).get(rule.key) ?? null;
    const paused = cur === null || !cur.visible || (rule.hold === true && s.act.get(rule.key) === 'hold');
    if (paused) {
      if (measured) worst = Math.max(worst, i - last);
      last = i;
      ref = null;
      continue;
    }
    if (!measured || ref === null) {
      measured = true;
      ref = cur;
      last = i;
      continue;
    }
    if (moved(ref, cur)) {
      worst = Math.max(worst, i - last);
      last = i;
      ref = cur;
    }
  }
  return measured ? Math.max(worst, indexed.length - 1 - last) * STEP_MS : null;
}
// Per walker: the shown samples, the distinct (variant, round x, round y) states, and the non-walk variants outside the stare set.
function renderedOf(indexed) {
  const out = {};
  for (const id of WALKERS) {
    const states = new Set();
    const variants = new Set();
    let visible = 0;
    for (const s of indexed) {
      const e = s.living.get(id);
      if (!e || !e.visible) continue;
      visible += 1;
      states.add(`${e.variant}|${Math.round(e.x)}|${Math.round(e.y)}`);
      if (!WALK_RE.test(e.variant)) variants.add(e.variant);
    }
    out[id] = { visible, distinct: states.size, variants: [...variants].sort(), stray: [...variants].filter((v) => !STARE_SAFE[id].includes(v)) };
  }
  return out;
}

// One stage of N changes (C8 V4): 720 samples of worldAdvance(250) and one rAF each (180 s of scheduler time). The denizens must all be
// shown, every required row too (a missing one lands in over as missing:<key>), and every element within its limit. The stare stages
// (s13a, s15) also check N_<s>_rendered.
async function changesStage(page, stage, extra = {}) {
  const win = await page.evaluate(windowRunInPage, { steps: CHANGE_STEPS, stepMs: STEP_MS, frames: true });
  const indexed = indexSamples(win.samples);
  const worst = {};
  const over = [];
  for (const rule of changeRules(stage)) {
    const ms = worstGap(indexed, rule);
    if (ms === null) {
      if (rule.required) over.push(`missing:${rule.key}`);
      continue;
    }
    worst[rule.key] = ms / 1000;
    if (ms > rule.limitS * 1000) over.push(rule.key);
  }
  const denizens = WALKERS.every((id) => worst[id] !== undefined);
  await check(page, `N_${stage}_changes`, denizens && over.length === 0, { worstS: worst, over, stare: win.stare, buyFail: extra.buyFail ?? [] }, true);
  if (stage === 's13a' || stage === 's15') {
    const rendered = renderedOf(indexed);
    const ok = win.stare === true && WALKERS.every((id) => rendered[id].visible > 0 && rendered[id].distinct >= 3 && rendered[id].stray.length === 0);
    await check(page, `N_${stage}_rendered`, ok, { stare: win.stare, rendered }, true);
  }
}

// N variety (C8, V1 / V2 / V5 / V8): the stages in one context. Each is sampled for 10 min after its setup; the era IV stages straddle ONE OBSERVER.
async function caseNV(page) {
  const demo = await isDemo(page);
  await crankClicks(page, 45, 0);
  await varietyStage(page, 's7', { buyFail: await stageSetup(page, S7) });
  await varietyStage(page, 's8', { buyFail: await stageSetup(page, S8.slice(S7.length)) });
  const buy9 = await stageSetup(page, S9.slice(S8.length));
  if (!(await skipIfSilent(page, varietyNames('s9'), await demoSilence(page)))) await varietyStage(page, 's9', { buyFail: buy9 });
  if (demo) {
    for (const s of ERA3_VARIETY) skipAll(varietyNames(s));
    return;
  }
  await varietyStage(page, 's10', { buyFail: await stageSetup(page, S10.slice(S9.length)) });
  await varietyStage(page, 's11', { buyFail: await stageSetup(page, S11.slice(S10.length)) });
  await varietyStage(page, 's13b', { buyFail: await stageSetup(page, S13.slice(S11.length)) });
  const on = await observerOne(page);
  await varietyStage(page, 's13a', { ok: on });
  const buyFail = [...(await stageSetup(page, S14.slice(S13.length))), ...(await stageSetup(page, S15.slice(S14.length)))];
  await varietyStage(page, 's15', { buyFail });
}

// N changes (C8 V4 and the rendered stare): S9, S11, S13 (after ONE OBSERVER) and S15.
async function caseNC(page) {
  const demo = await isDemo(page);
  await crankClicks(page, 45, 0);
  const buy9 = await stageSetup(page, S9);
  if (!(await skipIfSilent(page, changeNames('s9'), await demoSilence(page)))) await changesStage(page, 's9', { buyFail: buy9 });
  if (demo) {
    for (const s of ['s11', 's13a', 's15']) skipAll(changeNames(s));
    return;
  }
  await changesStage(page, 's11', { buyFail: await stageSetup(page, S11.slice(S9.length)) });
  const buy13 = await stageSetup(page, S13.slice(S11.length));
  await observerOne(page);
  await changesStage(page, 's13a', { buyFail: buy13 });
  const buy15 = [...(await stageSetup(page, S14.slice(S13.length))), ...(await stageSetup(page, S15.slice(S14.length)))];
  await changesStage(page, 's15', { buyFail: buy15 });
}

// N_no_teleport (S9): a rAF sampler for 15 s; a line (INS-02) is forced at 2 s with quiet off, so a talk pause falls inside the window.
// Per step: |dx| <= WALK_PX when either side of the step is a walk variant, REST_PX otherwise (the crow stutter hop).
function teleportOf(frames) {
  let steps = 0;
  let walkSteps = 0;
  let moving = 0;
  const violations = [];
  for (const id of WALKERS) {
    let prev = null;
    for (const f of frames) {
      const cur = f.find((t) => t[0] === id);
      if (cur === undefined || cur[1] !== true) {
        prev = null;
        continue;
      }
      if (prev !== null) {
        const dx = Math.abs(cur[3] - prev[3]);
        const walk = WALK_RE.test(cur[2]) || WALK_RE.test(prev[2]);
        steps += 1;
        if (walk) walkSteps += 1;
        if (dx > 0) moving += 1;
        if (dx > (walk ? WALK_PX : REST_PX)) violations.push({ id, dx: Math.round(dx), from: prev[2], to: cur[2] });
      }
      prev = cur;
    }
  }
  return { steps, walkSteps, moving, violations: violations.slice(0, 10), violationCount: violations.length };
}
async function caseNT(page) {
  await crankClicks(page, 45, 0);
  await stageSetup(page, S9);
  if (await skipIfSilent(page, ['N_no_teleport'], await demoSilence(page))) return;
  await page.evaluate(() => window.__wedtmd.worldQuiet(false));
  const sampling = page.evaluate(teleportInPage, { ms: 15000, ids: WALKERS });
  await sleep(2000);
  const said = await worldSay(page, 'INS-02');
  const frames = await sampling;
  const res = teleportOf(frames);
  await check(page, 'N_no_teleport', res.violationCount === 0 && res.steps > 0 && said === true, { said, ...res }, true);
}

// N_umbrella and N_umbrella_talk (S11, vents). The trigger is read from the behaviour log only (a finished activity is logged at its end),
// so the case does not depend on snapshot sampling. N_umbrella is seen && ended; N_umbrella_talk is said && talkSeen.
// (a) seen: worldAdvance in 1 s steps (180 at most) until the log holds an Inspector umbrella with reaction true (the vent-puff reaction).
// (b) talk: worldBehaviourNext('inspector', 'umbrella') pins the umbrella (it starts at the runner's next step; vents hold at S11). Real
//     sleeps of 50 ms (4 s at most) wait until worldBehaviour() shows it open; then worldQuiet(false) and worldSay('INS-08'); real sleeps of
//     150 ms (3 s at most) wait for the bubble and the inspector's talkUmbrella variant.
// (c) ended: worldQuiet(true), then 1 s steps (180 at most) until the log holds an umbrella entry after the pin's cursor (the last log entry
//     before the pin). Without the opening, ended stays false. The demo skips both checks.
async function caseNU(page) {
  if (await isDemo(page)) {
    skipCheck('N_umbrella');
    skipCheck('N_umbrella_talk');
    return;
  }
  await crankClicks(page, 45, 0);
  await stageSetup(page, S11);
  let seen = false;
  for (let i = 0; i < 180 && !seen; i++) {
    seen = await page.evaluate(() => {
      const w = window.__wedtmd;
      w.worldAdvance(1000);
      return (w.worldBehaviourLog() ?? []).some((e) => e.id === 'inspector' && e.activity === 'umbrella' && e.reaction === true);
    });
  }
  const pin = await page.evaluate(() => {
    const w = window.__wedtmd;
    const log = w.worldBehaviourLog() ?? [];
    const last = log.length > 0 ? log[log.length - 1] : null;
    return { pinned: w.worldBehaviourNext('inspector', 'umbrella'), cursor: last === null ? null : `${last.id}|${last.atMs}` };
  });
  let opened = false;
  for (let i = 0; i < 80 && pin.pinned && !opened; i++) {
    await sleep(50);
    opened = await page.evaluate(() => (window.__wedtmd.worldBehaviour() ?? []).some((e) => e.id === 'inspector' && e.activity === 'umbrella'));
  }
  let said = null;
  let talkSeen = false;
  if (opened) {
    said = await page.evaluate(() => {
      window.__wedtmd.worldQuiet(false);
      return window.__wedtmd.worldSay('INS-08');
    });
    for (let i = 0; i < 20 && !talkSeen; i++) {
      await sleep(150);
      talkSeen = await page.evaluate(() => {
        const w = window.__wedtmd;
        const inspector = (w.livingWorld() ?? []).find((e) => e.id === 'inspector');
        return w.worldBubble()?.visible === true && inspector?.variant === 'talkUmbrella';
      });
    }
  }
  await page.evaluate(() => window.__wedtmd.worldQuiet(true));
  let ended = false;
  for (let i = 0; i < 180 && opened && !ended; i++) {
    ended = await page.evaluate((cursor) => {
      const w = window.__wedtmd;
      w.worldAdvance(1000);
      const log = w.worldBehaviourLog() ?? [];
      let from = 0;
      for (let j = log.length - 1; cursor !== null && j >= 0; j--) {
        if (`${log[j].id}|${log[j].atMs}` === cursor) {
          from = j + 1;
          break;
        }
      }
      return log.slice(from).some((e) => e.id === 'inspector' && e.activity === 'umbrella');
    }, pin.cursor);
  }
  await check(page, 'N_umbrella', seen && ended, { seen, ended }, true);
  await check(page, 'N_umbrella_talk', said === true && talkSeen, { said, talkSeen }, true);
}

// N_crank (S0, a fresh page, no purchase): one crank click steps every visible walker by 1, and the walkers' snapshot holds for 2 s
// without clicks (crank mode has no real-time progress).
async function crankCheck(page) {
  const before = await page.evaluate(() => ({
    b: window.__wedtmd.worldBehaviour() ?? [],
    vis: (window.__wedtmd.livingWorld() ?? []).filter((e) => e.visible === true).map((e) => e.id),
  }));
  await crankClicks(page, 1, 0);
  await sleep(400);
  const after = await page.evaluate(() => window.__wedtmd.worldBehaviour() ?? []);
  await sleep(2000);
  const later = await page.evaluate(() => window.__wedtmd.worldBehaviour() ?? []);
  const walkers = steppable(before.vis, before.b);
  const pick = (list) => list.filter((e) => walkers.includes(e.id));
  const stepOf = (list, id) => list.find((e) => e.id === id)?.step ?? null;
  const stepped = walkers.length > 0 && walkers.every((id) => {
    const a = stepOf(before.b, id);
    return a !== null && stepOf(after, id) === a + 1;
  });
  const still = JSON.stringify(pick(later)) === JSON.stringify(pick(after));
  await check(page, 'N_crank', stepped && still, { walkers, before: pick(before.b), after: pick(after), still }, true);
}

// The micro flags that reduced motion switches off (WorldClocks reducedOff): each must read false on every sample (WP24 r2).
const MICRO_FLAGS = ['hitch', 'clockTwitch', 'lampDip', 'boothDip'];
// N_reduced (S9, S11 and S13 under reduced motion, 10 min each): the receiver is 'hang' on every shown sample; the micro flags (read from
// worldDay(), not a proxy) are never true; every runner shows at least three activities, the girl at S9 two (the mini has two before the
// vents). The Sensor 7 double blink is canon under reduced motion, so its head is not checked here.
async function reducedStage(page, stage) {
  const win = await page.evaluate(windowRunInPage, { steps: VARIETY_STEPS, stepMs: STEP_MS, frames: true, micro: true });
  const indexed = indexSamples(win.samples);
  let receiverVisible = 0;
  let receiverHang = 0;
  for (const s of indexed) {
    const r = s.living.get('receiver');
    if (r && r.visible) {
      receiverVisible += 1;
      if (r.variant === 'hang') receiverHang += 1;
    }
  }
  const micro = { samples: 0, hitch: 0, clockTwitch: 0, lampDip: 0, boothDip: 0 };
  for (const row of win.samples) {
    if (!Array.isArray(row.d)) continue;
    micro.samples += 1;
    MICRO_FLAGS.forEach((flag, j) => {
      if (row.d[j] === true) micro[flag] += 1;
    });
  }
  const actors = byActor(win.log);
  const activities = {};
  for (const id of WALKERS) activities[id] = new Set((actors.get(id) ?? []).map((e) => e.activity)).size;
  const need = (id) => (stage === 's9' && id === 'girl' ? 2 : 3);
  const ok = receiverVisible > 0 && receiverHang === receiverVisible && micro.samples > 0
    && MICRO_FLAGS.every((flag) => micro[flag] === 0) && WALKERS.every((id) => activities[id] >= need(id));
  return { stage, ok, receiver: { visible: receiverVisible, hang: receiverHang }, micro, activities };
}
// N_crank (s0) and N_reduced (S9, S11, S13 with reduced motion, one page after the crank check). The stage lists are cumulative (S9 is a
// prefix of S11, S11 of S13), so each stage buys only the rest of its list.
async function caseNK(page) {
  await crankCheck(page);
  if (await isDemo(page)) {
    skipCheck('N_reduced');
    return;
  }
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await sleep(300);
  await crankClicks(page, 45, 0);
  const buyS9 = await stageSetup(page, S9);
  const s9 = await reducedStage(page, 's9');
  const buyS11 = await stageSetup(page, S11.slice(S9.length));
  const s11 = await reducedStage(page, 's11');
  const buyS13 = await stageSetup(page, S13.slice(S11.length));
  const s13 = await reducedStage(page, 's13');
  const buyFail = [...buyS9, ...buyS11, ...buyS13];
  await check(page, 'N_reduced', buyFail.length === 0 && s9.ok && s11.ok && s13.ok, { buyFail, s9, s11, s13 }, true);
}

// --- WP24 T9b: the defer (ND), era (NE), day (NY) and settle (NS) cases. The constants mirror src/data (WORLD_TRANSITIONS, WORLD_DAY,
// WORLD_ENV, WORLD_AMBIENT); this smoke is plain JS, so they are copied here and move with the data.
const LAMP_BUZZ_MS = 3000;             // WORLD_TRANSITIONS.rows.lamp.buzzMs: the buzz-on stutter, then the glow (from the lamp's first start)
const LAMP_GLOW_MS = 4000;             // WORLD_TRANSITIONS.rows.lamp.glowMs: the glow after the buzz
const LAMP_FADE_WINDOW_MS = LAMP_BUZZ_MS + LAMP_GLOW_MS + 2000;   // N_flicker_reduced: buzz and glow, with 2 s of slack for the start and the frames
const FADE_GLOW_MIN = 0.2;             // N_flicker_reduced: the lamp glow reaches this alpha inside the window
const FADE_TOL = 0.01;                 // N_flicker_reduced: a fall of this much or less keeps the fade non-decreasing
const LAMP_SETTLE_MIN_MS = 2500;       // N_lamp_buzz: the lamp reads lit for good from this long after its first start
const DEFER_START_MIN_MS = 1000;       // WORLD_TRANSITIONS.startAfterCloseMs
const DEFER_GAP_MIN_MS = 600;          // WORLD_TRANSITIONS.staggerMs[0]
const FRAME_SLACK_MS = 150;            // the samplers read wall time once per frame (a headless frame is 100-150 ms)
const DEFER_WINDOW_MS = 50000;         // the rAF sampler after the TECH INDEX closes: six windows start 3-6 s apart after a 1 s delay (19-37 s)
const WINDOWS_SPREAD_MIN_MS = 15000;   // N_windows_stagger: the first and the last window to light are this far apart
const WINDOW_FULL = 0.95;              // a window reads lit at this share of its own peak (the dim level is WORLD_ENV.windowDimLevel, 0.85)
const WINDOW_RISE_MIN = 0.05;          // N_windows_stagger: a window is lit only when its series rises by this much (peak minus its first sample)
const FLICKER_MAX = 3;                 // N_flicker: on-to-off toggles per 1 s window (the toggle gap keeps a stutter at this rate)
const FLICKER_WINDOW_MS = 1000;
const ERA_FADE_CAP_STEPS = 120;        // N_era_fade: 30 s of advance at most (1 s queued, then the 8 s ramp; every step adds its own rAF step on top)
const ERA_FADE_MIN_MS = 8000;          // WORLD_TRANSITIONS.rows.eraRow.ms
const ERA_DONE_K = 0.95;               // the last live sample before the era row leaves the list
const DAY_BANDS = { s0: [540, 660], s9: [660, 780], s11: [780, 880], s15: [950, 1001] };   // WORLD_DAY.bands (eras I, II, III, V)
const DAY_TINT_MINUTES = [540, 780, 950, 1001];   // WORLD_DAY.tintKeys: one hold each
const DAY_MIN_BRIGHTNESS = 0.86;       // WORLD_DAY.minBrightness
const DAY_HELD_MIN = 1001;             // WORLD_DAY.heldMin
const DAY_HELD_TINT = 0xdcc3a6;        // WORLD_DAY.tintKeys: the 16:41 key
const DEMO_DAY_MAX = 780;              // WORLD_DAY.demoMaxMin (13:00)
const HELD_SETTLE_STEPS = 10;          // N_day_held: 10 s of advance before the sampling (the minute and the tint ease into the key)
const HELD_STEPS = 60;                 // N_day_held: 60 s of advance sampled, one per second
const NE_NAMES = ['N_era_fade'];
const NS_NAMES = ['N_settle'];
const NH_NAMES = ['N_demo_hold'];
const NH_IDS = ['PAY-05', 'INS-07', 'GRL-06', 'DOG-12'];   // the post-cap lines in order; DOG-12 is the line that holds the dog
const NH_CARD_CAP_MS = 70000;   // the teaser and the END OF DEMO card after the S9 buys
const NH_LEAD_MS = 21000;       // PAY-05 is seen 21 s after the card (demo.mjs POST_CAP_FIRST_MS)
const NH_GAP_MS = 125000;       // each later line 125 s after the one before (demo.mjs POST_CAP_GAP_MS)
const NH_SEEN_CAP_MS = 10000;   // the seen mark of each line, polled every 250 ms
const NH_RUN_STEPS = 4;         // one run: 4 steps of 20 s (80 s of advance)
const NH_STEP_MS = 20000;
const NH_INSPECTOR_MIN = 3;     // the Inspector's k grows by at least 3 in a run
const NH_CROW_MIN = 2;          // the crow's k grows by at least 2 in a run
const NY_DEMO_SKIP = ['N_day_tint', 'N_day_held'];
const DEFER_IDS = ['lamp', 'booth', 'windows'];   // the transition rows the S9 power buy queues behind the TECH INDEX
const DEFER_WINDOWS = ['window0', 'window1', 'window2', 'window3', 'window4', 'window5'];

// One worldAdvance step of ms and one animation frame (the drain loop's step).
const stepFrame = (page, ms) => page.evaluate(async (stepMs) => {
  window.__wedtmd.worldAdvance(stepMs);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}, ms);

// A second page in a fresh context of the same browser (its own save and settings), with the hook. The caller closes ctx.
async function freshPage(page) {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  watchPage(p, errors, tag);
  await p.goto(target, { waitUntil: 'load' });
  await waitReady(p);
  return { ctx, page: p };
}

// Runs in the page. One sample per animation frame for ms of wall time: the TECH INDEX state, the transition queue ([id, startedAtMs, k]),
// the prop rows ([id, alpha]) and the lamp entry of livingWorld() ([variant, alpha, visible], null without it).
function deferSampleInPage(spec) {
  return new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const tick = () => {
      const w = window.__wedtmd;
      const lamp = (w.livingWorld() ?? []).find((e) => e.id === 'lamp');
      out.push({
        t: performance.now(),
        open: w.techTreeOpen() === true,
        tr: (w.worldTransitions() ?? []).map((x) => [x.id, x.startedAtMs, x.k]),
        props: (w.worldProps() ?? []).map((r) => [r.id, r.alpha]),
        lamp: lamp === undefined ? null : [lamp.variant, lamp.alpha, lamp.visible === true],
      });
      if (performance.now() - t0 >= spec.ms) resolve(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
// Runs in the page: the lamp entry's variant and the ids the transition queue lists (queued or running).
function deferHoldInPage() {
  const w = window.__wedtmd;
  const lamp = (w.livingWorld() ?? []).find((e) => e.id === 'lamp');
  return { lamp: lamp === undefined ? null : lamp.variant, ids: (w.worldTransitions() ?? []).map((t) => t.id) };
}

// One defer run on a page: the S8 state, the TECH INDEX open with the rest of S9 bought inside and 3 s held, then the close (Escape).
// The sampler starts before the close, so the close shows in its samples. The silence is read twice (WP24 r2): right after the buys, and
// again after the sampling window, because the demo cap puts the world to sleep during the 3 s hold. The first non-null read counts.
async function deferRun(page) {
  await crankClicks(page, 45, 0);
  const setup = await stageSetup(page, S8);
  await page.keyboard.press('t');
  await sleep(400);
  const buyFail = await buyList(page, S9.slice(S8.length));
  const silenceAfterBuys = await demoSilence(page);
  await sleep(3000);
  const hold = await page.evaluate(deferHoldInPage);
  const sampling = page.evaluate(deferSampleInPage, { ms: DEFER_WINDOW_MS });
  await sleep(200);
  await page.keyboard.press('Escape');
  const samples = await sampling;
  const silence = silenceAfterBuys ?? (await demoSilence(page));
  return { setup, buyFail, silence, hold, samples };
}

const startedRows = (s) => s.tr.filter((row) => typeof row[1] === 'number');
const lampStartOf = (samples) => samples.findIndex((s) => s.tr.some((row) => row[0] === 'lamp' && typeof row[1] === 'number'));
// The alpha of one prop row per sample (0 when the row is not listed).
const alphaSeries = (samples, id) => samples.map((s) => s.props.find((row) => row[0] === id)?.[1] ?? 0);

// N_defer (C8): the queue starts after the close (DEFER_START_MIN_MS, one frame of slack, wall time), its starts sit DEFER_GAP_MIN_MS apart or
// more on the queue's own clock (startedAtMs, exact), none starts while the index is open, and the lamp, booth and windows all start.
function deferStartsOf(samples) {
  const closeIdx = samples.findIndex((s) => !s.open);
  const startIdx = samples.findIndex((s) => startedRows(s).length > 0);
  const starts = new Map();
  for (const s of samples) for (const [id, at] of startedRows(s)) if (!starts.has(id)) starts.set(id, at);
  const sorted = [...starts.values()].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  return {
    ids: [...starts.keys()],
    firstMs: closeIdx >= 0 && startIdx >= 0 ? samples[startIdx].t - samples[closeIdx].t : null,
    minGapMs: gaps.length > 0 ? Math.min(...gaps) : null,
    startedWhileOpen: samples.some((s) => s.open && startedRows(s).length > 0),
  };
}
// N_windows_stagger: a window is lit when its series rises by WINDOW_RISE_MIN or more (peak minus its first sample) and reaches WINDOW_FULL of
// its peak at a sample after the first (the rise sample). All six windows must light, one at a time: the rise samples strictly increase in
// window order and are distinct, and the first and the last rise are WINDOWS_SPREAD_MIN_MS apart. det gives [id, rise sample, ms, peak].
function windowLitOf(samples) {
  const lit = [];
  for (const id of DEFER_WINDOWS) {
    const series = alphaSeries(samples, id);
    if (series.length < 2) continue;
    const peak = Math.max(...series);
    if (peak - series[0] < WINDOW_RISE_MIN) continue;
    const idx = series.findIndex((a, i) => i > 0 && a >= WINDOW_FULL * peak);
    if (idx < 1) continue;
    lit.push({ id, idx, t: samples[idx].t, peak });
  }
  const times = lit.map((l) => l.t);
  const t0 = samples.length > 0 ? samples[0].t : 0;
  return {
    lit: lit.map((l) => l.id),
    det: lit.map((l) => [l.id, l.idx, Math.round(l.t - t0), Math.round(l.peak * 1000) / 1000]),
    spreadMs: times.length > 0 ? Math.max(...times) - Math.min(...times) : 0,
    oneAtATime: lit.length >= 2 && lit.every((l, i) => i === 0 || l.idx > lit[i - 1].idx) && new Set(lit.map((l) => l.idx)).size === lit.length,
  };
}
// The most event times (ascending, ms) inside any FLICKER_WINDOW_MS.
function mostInWindow(times) {
  let most = 0;
  for (let i = 0; i < times.length; i++) {
    let n = 0;
    for (let j = i; j >= 0 && times[i] - times[j] < FLICKER_WINDOW_MS; j--) n += 1;
    most = Math.max(most, n);
  }
  return most;
}
// N_flicker: an on-to-off toggle is a series falling through half its peak. The most toggles in any FLICKER_WINDOW_MS, per series (lamp glow,
// booth hood, the six windows); a series that never shows is not counted (checked must be > 0). lampToggles (informational only) is the most
// lamp variant changes (dead, lit, warm) inside one FLICKER_WINDOW_MS.
function flickerOf(samples) {
  const worst = {};
  let checked = 0;
  for (const id of ['lampGlow', 'boothHood', ...DEFER_WINDOWS]) {
    const series = alphaSeries(samples, id);
    const peak = Math.max(0, ...series);
    if (peak < LIT_ALPHA) continue;
    checked += 1;
    const half = peak / 2;
    const offs = [];
    for (let i = 1; i < series.length; i++) if (series[i - 1] >= half && series[i] < half) offs.push(samples[i].t);
    worst[id] = mostInWindow(offs);
  }
  const changes = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].lamp;
    const b = samples[i].lamp;
    if (a !== null && b !== null && a[0] !== b[0]) changes.push(samples[i].t);
  }
  return { checked, worst, lampToggles: mostInWindow(changes), ok: checked > 0 && Object.values(worst).every((n) => n <= FLICKER_MAX) };
}
// N_lamp_buzz: the lamp reads lit for good (the trailing run of lit samples) from LAMP_SETTLE_MIN_MS after its first start.
function lampOf(samples) {
  const startIdx = lampStartOf(samples);
  let settleIdx = -1;
  for (let i = samples.length - 1; i >= 0 && samples[i].lamp !== null && samples[i].lamp[0] === 'lit'; i--) settleIdx = i;
  const settleMs = startIdx >= 0 && settleIdx >= 0 ? samples[settleIdx].t - samples[startIdx].t : null;
  return { settleMs, ok: settleMs !== null && settleMs >= LAMP_SETTLE_MIN_MS - FRAME_SLACK_MS };
}
// N_flicker_reduced: under reduced motion the buzz is a plain fade. From the lamp's first start over LAMP_FADE_WINDOW_MS (the buzz and the
// glow): the lamp glow (the lampGlow prop row) reaches FADE_GLOW_MIN, never falls by more than FADE_TOL from its first sample above LIT_ALPHA,
// and the lamp variant changes at most once. The top sprite alpha of the lamp entry is not read (it stays near 1).
function fadeOf(samples) {
  const startIdx = lampStartOf(samples);
  if (startIdx < 0) return { ok: false, n: 0, peak: null, monotone: false, variantChanges: null, variants: [] };
  const t0 = samples[startIdx].t;
  const win = samples.slice(startIdx).filter((s) => s.t - t0 <= LAMP_FADE_WINDOW_MS);
  const glow = alphaSeries(win, 'lampGlow');
  const first = glow.findIndex((a) => a > LIT_ALPHA);
  const monotone = first >= 0 && glow.slice(first).every((a, i, arr) => i === 0 || a >= arr[i - 1] - FADE_TOL);
  const peak = Math.max(0, ...glow);
  const variants = win.map((s) => (s.lamp === null ? null : s.lamp[0]));
  let variantChanges = 0;
  for (let i = 1; i < variants.length; i++) if (variants[i] !== variants[i - 1]) variantChanges += 1;
  return {
    ok: win.length >= 3 && peak >= FADE_GLOW_MIN && monotone && variants.every((v) => v !== null) && variantChanges <= 1,
    n: win.length,
    peak: Math.round(peak * 1000) / 1000,
    monotone,
    variantChanges,
    variants: [...new Set(variants)],
  };
}

// ND (C8 N defer, WP24 D-T): the TECH INDEX holds the lamp, booth and windows. They start after the close, 600 ms apart or more; the lamp
// buzzes before it glows; the windows light one by one; nothing flickers more than 3 times a second. Reduced motion turns the buzz into a fade.
// Demo cap (A10): when the world is silent after the S9 buys the motion checks record value.skipped (N_defer_hold stays strict).
async function caseND(page) {
  const run = await deferRun(page);
  const holdOk = run.hold.lamp === 'dead' && DEFER_IDS.every((id) => run.hold.ids.includes(id));
  await check(page, 'N_defer_hold', run.buyFail.length === 0 && holdOk, { buyFail: run.buyFail, lamp: run.hold.lamp, ids: run.hold.ids }, true);
  const silentRun = await skipIfSilent(page, ['N_defer_start', 'N_windows_stagger', 'N_lamp_buzz', 'N_flicker'], run.silence);
  if (!silentRun) {
    const d = deferStartsOf(run.samples);
    const startOk = d.firstMs !== null && d.firstMs >= DEFER_START_MIN_MS - FRAME_SLACK_MS && d.minGapMs !== null
      && d.minGapMs >= DEFER_GAP_MIN_MS && !d.startedWhileOpen && DEFER_IDS.every((id) => d.ids.includes(id));
    await check(page, 'N_defer_start', startOk, { firstMs: d.firstMs, minGapMs: d.minGapMs, startedWhileOpen: d.startedWhileOpen, ids: d.ids }, true);
    const win = windowLitOf(run.samples);
    const staggerOk = win.lit.length === DEFER_WINDOWS.length && win.oneAtATime && win.spreadMs >= WINDOWS_SPREAD_MIN_MS;
    await check(page, 'N_windows_stagger', staggerOk, { lit: win.lit, spreadMs: win.spreadMs, det: win.det }, true);
    const lamp = lampOf(run.samples);
    await check(page, 'N_lamp_buzz', lamp.ok, { settleMs: lamp.settleMs }, true);
    const flick = flickerOf(run.samples);
    await check(page, 'N_flicker', flick.ok, { worst: flick.worst, checked: flick.checked, lampToggles: flick.lampToggles }, true);
  }

  // The reduced-motion page: the same buys on a fresh save, then the lamp glow over the buzz-and-glow window.
  const fresh = await freshPage(page);
  try {
    await fresh.page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
    await sleep(300);
    const red = await deferRun(fresh.page);
    if (!(await skipIfSilent(page, ['N_flicker_reduced'], red.silence))) {
      const fade = fadeOf(red.samples);
      await check(page, 'N_flicker_reduced', fade.ok && red.buyFail.length === 0,
        { buyFail: red.buyFail, n: fade.n, peak: fade.peak, monotone: fade.monotone, variantChanges: fade.variantChanges, variants: fade.variants }, true);
    }
  } finally {
    await fresh.ctx.close();
  }
}

// N_era_fade: the eraRow entry per 250 ms step ({ k, durMs }; null once the row has left the list). From 0 (queued), k starts at 0.05 or
// less, never falls, and reaches ERA_DONE_K before the row leaves. durMs, read at the first positive sample, is the ramp length and must be
// at least ERA_FADE_MIN_MS. The ramp is not timed on the step grid: every step adds a real rAF step on top of the 250 ms.
function eraFadeOf(rows) {
  const ks = rows.map((r) => (r === null ? null : r.k));
  const first = ks.findIndex((k) => k !== null);
  if (first < 0) return { ok: false, seen: 0, monotone: false, durMs: null };
  const rowEnd = ks.findIndex((k, i) => i > first && k === null);
  const endIdx = rowEnd < 0 ? ks.length : rowEnd;
  const live = ks.slice(first, endIdx);
  const monotone = live.every((k, i) => i === 0 || k >= live[i - 1] - 1e-9);
  const pos = ks.findIndex((k) => k !== null && k > 0);
  const durMs = pos < 0 ? null : rows[pos].durMs;
  const last = live[live.length - 1];
  return {
    seen: live.length, from: live[0] ?? null, last: last ?? null, monotone, durMs,
    ok: live.length >= 3 && live[0] <= 0.05 && monotone && last >= ERA_DONE_K && durMs !== null && durMs >= ERA_FADE_MIN_MS,
  };
}

// NE (C8 N era, WP24 D-T): S9, then one era III keystone bought in the TECH INDEX and the era card dismissed. The era row crossfades from 0 to 1
// once the queue starts it; the eraRow entry is read after every 250 ms of advance.
async function caseNE(page) {
  if (await isDemo(page)) { skipAll(NE_NAMES); return; }
  await crankClicks(page, 45, 0);
  await stageSetup(page, S9);
  const bought = await buyEra(page, ['@substationBlueprint', 'boiler']);
  const rows = [];
  for (let i = 0; i < ERA_FADE_CAP_STEPS; i++) {
    await stepFrame(page, STEP_MS);
    const row = await page.evaluate(() => {
      const t = (window.__wedtmd.worldTransitions() ?? []).find((x) => x.id === 'eraRow');
      return t === undefined ? null : { k: t.k, durMs: t.durMs };
    });
    rows.push(row);
    if (row === null && rows.slice(0, -1).some((v) => v !== null)) break;
  }
  const fade = eraFadeOf(rows);
  await check(page, 'N_era_fade', bought.length === 0 && fade.ok, { buyFail: bought, ...fade }, true);
}

// NS (C8 N settle, WP24 settle mode): S9, worldSettle(true), one era III keystone bought and the era card dismissed. The queue is empty
// within 1 s, no runner steps for 3 s, and the day minute equals its target.
async function caseNS(page) {
  if (await isDemo(page)) { skipAll(NS_NAMES); return; }
  await crankClicks(page, 45, 0);
  await stageSetup(page, S9);
  await page.evaluate(() => window.__wedtmd.worldSettle(true));
  const bought = await buyEra(page, ['@substationBlueprint', 'boiler']);
  await stepFrame(page, 1000);
  const queued = await transitionIds(page);
  const steps = () => page.evaluate(() => (window.__wedtmd.worldBehaviour() ?? []).map((e) => [e.id, e.step]));
  const start = await steps();
  let held = true;
  for (let i = 0; i < 12; i++) {   // 3 s on the 250 ms grid
    await stepFrame(page, STEP_MS);
    if (JSON.stringify(await steps()) !== JSON.stringify(start)) held = false;
  }
  const day = await page.evaluate(() => window.__wedtmd.worldDay());
  const dayOk = day !== null && day.min === day.target;
  await check(page, 'N_settle', bought.length === 0 && queued.length === 0 && start.length > 0 && held && dayOk,
    { buyFail: bought, queued, runners: start.length, held, day }, true);
}

// Day read: one advance step of ms, then the presented minute and its target (null without the layer).
async function dayRead(page, ms) {
  return page.evaluate(async (stepMs) => {
    const w = window.__wedtmd;
    w.worldAdvance(stepMs);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const d = w.worldDay();
    return d ? { min: d.min, target: d.target } : null;
  }, ms);
}
// The tint at one hold of the minute: 3 s of advance so the presented tint eases to its key (the hold pins the minute).
async function holdTint(page, min) {
  return page.evaluate(async (m) => {
    const w = window.__wedtmd;
    w.worldDayHold(m);
    for (let i = 0; i < 12; i++) {
      w.worldAdvance(250);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    const d = w.worldDay();
    return d ? { hold: m, min: d.min, tint: d.tint } : null;
  }, min);
}
// R >= G >= B (no blue cast) and max(R, G, B) / 255 >= DAY_MIN_BRIGHTNESS (at most 14 % darker than neutral).
function tintOk(rgb) {
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  return r >= g && g >= b && Math.max(r, g, b) / 255 >= DAY_MIN_BRIGHTNESS;
}

// NY (C8 N day, WP24 D3 / A4): the target rises through the bands from the recorded Tuesday toward 16:41 and the minute never falls. The
// demo edition refuses era III, so there the target stays at or under the demo cap and the tint checks are skipped.
async function caseNY(page) {
  const demo = await isDemo(page);
  const s0 = await dayRead(page, 1000);   // no crank and no purchase yet: a cranked ME moves the day
  await crankClicks(page, 45, 0);
  const f9 = await stageSetup(page, S9);
  const s9 = await dayRead(page, 5000);
  const f11 = await stageSetup(page, S11.slice(S9.length));
  const s11 = await dayRead(page, 5000);
  if (demo) {
    await check(page, 'N_day_bands', s11 !== null && s11.target <= DEMO_DAY_MAX, { demoMax: DEMO_DAY_MAX, s0, s9, s11, buyFail: f11 }, true);
    skipAll(NY_DEMO_SKIP);
    return;
  }
  const f15 = [...(await stageSetup(page, S13.slice(S11.length))), ...(await stageSetup(page, S14.slice(S13.length))),
    ...(await stageSetup(page, S15.slice(S14.length)))];
  const s15 = await dayRead(page, 5000);
  const reads = [s0, s9, s11, s15];
  const inBand = (r, [lo, hi]) => r !== null && r.target >= lo && r.target <= hi;
  const bands = inBand(s0, DAY_BANDS.s0) && inBand(s9, DAY_BANDS.s9) && inBand(s11, DAY_BANDS.s11) && inBand(s15, DAY_BANDS.s15);
  const rising = reads.every((r, i) => r !== null && (i === 0 || (reads[i - 1] !== null && r.target > reads[i - 1].target)));
  const mins = reads.map((r) => (r === null ? null : r.min));
  const minsOk = mins.every((m, i) => m !== null && (i === 0 || (mins[i - 1] !== null && m >= mins[i - 1])));
  await check(page, 'N_day_bands', bands && rising && minsOk && f9.length === 0 && f11.length === 0 && f15.length === 0,
    { s0, s9, s11, s15, buyFail: [...f9, ...f11, ...f15] }, true);

  const tints = [];
  for (const m of DAY_TINT_MINUTES) tints.push(await holdTint(page, m));
  await page.evaluate(() => window.__wedtmd.worldDayHold(null));
  const tintsOk = tints.every((t) => t !== null && tintOk(t.tint));
  await check(page, 'N_day_tint', tintsOk,
    { tints: tints.map((t) => (t === null ? null : { hold: t.hold, min: t.min, tint: `0x${t.tint.toString(16).padStart(6, '0')}` })) }, true);

  // N_day_held: the postgame on a fresh save (KEEP IT RUNNING after the skipped film, as case K): the minute holds 1001, the tint is the 16:41
  // key and the wind is 0 over HELD_STEPS seconds of advance (after the settle steps).
  const fresh = await freshPage(page);
  try {
    await toChoice(fresh.page, false);
    await fresh.page.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 8000 });
    for (let i = 0; i < HELD_SETTLE_STEPS; i++) await stepFrame(fresh.page, 1000);
    const held = [];
    for (let i = 0; i < HELD_STEPS; i++) {
      await stepFrame(fresh.page, 1000);
      held.push(await fresh.page.evaluate(() => window.__wedtmd.worldDay()));
    }
    const heldOk = held.every((d) => d !== null && d.min === DAY_HELD_MIN && d.tint === DAY_HELD_TINT && Math.abs(d.wind) < 1e-6);
    await check(page, 'N_day_held', heldOk, { samples: held.length, last: held[held.length - 1] ?? null }, true);
  } finally {
    await fresh.ctx.close();
  }
}

// NH (WP24 r3, demo hold guard): DOG-12 suspends the dog runner only. Demo edition: the S9 buys open the END OF DEMO card, KEEP TINKERING,
// then PAY-05, INS-07, GRL-06 and DOG-12 are seen (worldAdvance, as demo.mjs case G). Over 80 s of advance the Inspector and the crow keep
// stepping (worldBehaviour k) and the dog reads `lie`: right away, and again after a save and a reload (the seen state comes back from the save).
async function caseNH(page) {
  if (!(await isDemo(page))) { skipAll(NH_NAMES, 'full edition: the demo hold exists only in the demo build'); return; }
  const advance = (ms) => page.evaluate((m) => window.__wedtmd.worldAdvance(m), ms);
  const seenEver = () => page.evaluate(() => window.__wedtmd.worldState()?.seenEver ?? []);
  const read = () => page.evaluate(() => {
    const w = window.__wedtmd;
    const beh = w.worldBehaviour() ?? [];
    const k = (id) => beh.find((e) => e.id === id)?.k ?? null;
    return { inspector: k('inspector'), crow: k('crow'), dog: (w.livingWorld() ?? []).find((e) => e.id === 'dog')?.variant ?? null };
  });
  // One run: the readings before and after the 80 s of advance (4 x 20 s, 400 ms settle after each step).
  const run = async () => {
    const before = await read();
    for (let i = 0; i < NH_RUN_STEPS; i++) {
      await advance(NH_STEP_MS);
      await sleep(400);
    }
    return { before, after: await read() };
  };

  await crankClicks(page, 45, 0);
  const buyFail = await buyList(page, [...S9, '@substationBlueprint']);
  // The cap: the teaser runs, then the END OF DEMO card (phase 'card') opens. Polled every 100 ms up to NH_CARD_CAP_MS.
  const cardDeadline = Date.now() + NH_CARD_CAP_MS;
  let phase = await page.evaluate(() => window.__wedtmd.demoState()?.phase ?? null);
  while (phase !== 'card' && Date.now() < cardDeadline) {
    await sleep(100);
    phase = await page.evaluate(() => window.__wedtmd.demoState()?.phase ?? null);
  }
  if (phase !== 'card') {
    await check(page, 'N_demo_hold', false, { cardOpened: false, phase, buyFail }, true);
    return;
  }
  await page.evaluate(() => document.getElementById('demo-keep').click());
  await advance(NH_LEAD_MS);
  for (let i = 0; i < NH_IDS.length; i++) {
    if (i > 0) await advance(NH_GAP_MS);
    const seenDeadline = Date.now() + NH_SEEN_CAP_MS;
    while (!(await seenEver()).includes(NH_IDS[i]) && Date.now() < seenDeadline) await sleep(250);
  }
  const seenNow = await seenEver();
  const seen = NH_IDS.filter((id) => seenNow.includes(id));

  const first = await run();
  // Save and reload: the seen state comes back from the save, and the dog must still hold in the second run.
  await page.evaluate(() => window.__wedtmd.saveNow());
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  const second = await run();
  const grew = (a, b, min) => a !== null && b !== null && b - a >= min;
  const holds = (r) => grew(r.before.inspector, r.after.inspector, NH_INSPECTOR_MIN) && grew(r.before.crow, r.after.crow, NH_CROW_MIN)
    && r.after.dog === 'lie';
  await check(page, 'N_demo_hold', holds(first) && holds(second), {
    seen, buyFail, before: first.before, after: first.after, reload: { before: second.before, after: second.after },
  }, true);
}

// One fresh context per case. Errors are tagged with the case key that is current when they happen.
// An exception becomes FAILED:<case>:<message> in fail. viewport defaults to 1280x720 (F23 runs at 1280x800).
async function runCase(browser, key, fn, viewport = { width: 1280, height: 720 }) {
  currentKey = key;
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watchPage(page, errors, tag);
    await page.goto(target, { waitUntil: 'load' });
    await waitReady(page);
    await fn(page);
  } catch (e) {
    fail.push(`FAILED:${key}:${firstLine(e)}`);
  } finally {
    if (ctx) await ctx.close();
  }
}

// ONLY (env): a comma list of case keys to run alone (A B C D E F G H I M J JR K L NV NC NT NU NK ND NE NY NS NH F23 crowTalk_e1 crowTalk_s8); unset runs every case. An unknown key exits 2.
const CASE_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'M', 'J', 'JR', 'K', 'L', 'NV', 'NC', 'NT', 'NU', 'NK', 'ND', 'NE', 'NY', 'NS', 'NH', 'F23', 'crowTalk_e1', 'crowTalk_s8'];
const ONLY = (process.env.ONLY ?? '').split(',').map((k) => k.trim()).filter((k) => k !== '');
const badKey = ONLY.find((k) => !CASE_KEYS.includes(k));
if (badKey !== undefined) {
  console.error('ONLY: unknown case key ' + badKey + ' (keys: ' + CASE_KEYS.join(',') + ')');
  process.exit(2);
}
const runs = (key) => ONLY.length === 0 || ONLY.includes(key);

let browser = null;
try {
  browser = await chromium.launch();
  if (runs('A')) await runCase(browser, 'A', caseA);
  if (runs('B')) await runCase(browser, 'B', caseB);
  if (runs('C')) await runCase(browser, 'C', caseC);
  if (runs('D')) await runCase(browser, 'D', caseD);
  if (runs('crowTalk_e1')) await runCase(browser, 'crowTalk_e1', caseCrowTalkE1);
  if (runs('crowTalk_s8')) await runCase(browser, 'crowTalk_s8', caseCrowTalkS8);
  if (runs('E')) await runCase(browser, 'E', caseE);
  if (runs('F')) await runCase(browser, 'F', caseF);
  if (runs('G')) await runCase(browser, 'G', caseG);
  if (runs('H')) await runCase(browser, 'H', caseH);
  if (runs('H')) await runCase(browser, 'H', caseHOver);
  if (runs('I')) await runCase(browser, 'I', caseI);
  if (runs('M')) await runCase(browser, 'M', caseM);
  if (runs('J')) await runCase(browser, 'J', caseJ);
  if (runs('JR')) await runCase(browser, 'JR', caseJR);
  if (runs('K')) await runCase(browser, 'K', caseK);
  if (runs('L')) await runCase(browser, 'L', caseL);
  if (runs('NV')) await runCase(browser, 'NV', caseNV);
  if (runs('NC')) await runCase(browser, 'NC', caseNC);
  if (runs('NT')) await runCase(browser, 'NT', caseNT);
  if (runs('NU')) await runCase(browser, 'NU', caseNU);
  if (runs('NK')) await runCase(browser, 'NK', caseNK);
  if (runs('ND')) await runCase(browser, 'ND', caseND);
  if (runs('NE')) await runCase(browser, 'NE', caseNE);
  if (runs('NY')) await runCase(browser, 'NY', caseNY);
  if (runs('NS')) await runCase(browser, 'NS', caseNS);
  if (runs('NH')) await runCase(browser, 'NH', caseNH);
  if (runs('F23')) await runCase(browser, 'F23', caseF23, { width: 1280, height: 800 });
} catch (e) {
  fail.push(`FAILED:setup:${firstLine(e)}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
