// WP21 demo smoke cases C, D, E, F. demo.mjs (the runner) owns the browser, the report and the kit; these only run checks.
// C continues case B's page (cap owned, card closed). D, E and F each get a fresh ?debug=1 page.
// Expected values mirror src/data/showcase.ts and src/data/demo.ts; plain Node smokes cannot import the TS data.

const TEASER_END_S = 9.5;
const PORTRAIT = { centerX: 1920, centerY: 1080, zoom: 0.5 };
const SAVE_FULLGAME_KEY = 'wedtmd.save.fullgame';
const POLL_MS = 50;

// Polls fn every POLL_MS until it holds. Resolves the ms waited, or null on timeout. Zero is a valid wait, so callers test !== null.
async function pollUntil(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return Date.now() - t0;
    if (Date.now() - t0 >= ms) return null;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

// The END OF DEMO card carries is-open while it is on screen.
const cardOpen = (page) => page.evaluate(() => document.getElementById('demo-end')?.classList.contains('is-open') === true);

// A missing button fails its named check instead of stalling the case on the 30 s click timeout.
const clickDemo = (page, sel) => page.click(sel, { timeout: 3000 }).catch(() => {});

// C: same page as case B (cap owned, card closed). Boot opens the card with no teaser, REPLAY runs the teaser, Esc skips to the card.
export async function caseC(kit, page) {
  await page.evaluate(() => window.__wedtmd.saveNow());
  await kit.reload(page);
  const opened = await pollUntil(() => cardOpen(page), 3000);
  const boot = await kit.demo(page);
  const bootShowcase = await kit.showcase(page);
  kit.ok(
    'C_boot_card',
    opened !== null && boot?.phase === 'card' && boot?.teaserActive === false && bootShowcase === null,
    { opened, phase: boot?.phase ?? null, teaserActive: boot?.teaserActive ?? null },
  );
  await kit.shot(page, 'demo-C1-boot-card');

  await clickDemo(page, '#demo-replay');
  const replayed = await pollUntil(
    async () => (await kit.demo(page))?.phase === 'teaser' && (await kit.showcase(page))?.active === true,
    3000,
  );
  kit.ok('C_replay_teaser', replayed !== null, { waited: replayed });

  await page.keyboard.press('Escape');
  const skipped = await pollUntil(async () => (await kit.demo(page))?.phase === 'card', 1000);
  // skipToEnd seeks the teaser clock synchronously, so the end frame is already the reading right after the card opens
  const afterSkip = await kit.showcase(page);
  kit.ok(
    'C_skip_card',
    skipped !== null && afterSkip !== null && afterSkip.t >= TEASER_END_S,
    { waited: skipped, t: afterSkip?.t ?? null },
  );

  await clickDemo(page, '#demo-keep');
  await kit.sleep(500);
  kit.note('C_final_phase', (await kit.demo(page))?.phase ?? null);
}

// D: fresh page, reduced motion. The teaser opens on the portrait from t 0 (no camera ramp), then the card follows.
export async function caseD(kit, page) {
  // set before the buys so the teaser that the cap milestone starts already runs reduced
  await page.evaluate(() => window.__wedtmd.session.updateSettings({ reducedMotion: true }));
  await kit.buys(page, [...kit.S9, '@substationBlueprint']);
  await kit.waitPhase(page, 'teaser', 8000);

  // only the first live sample counts: the camera must already sit at the end pose on that frame
  let first = null;
  await pollUntil(async () => {
    first = await kit.showcase(page);
    return first !== null && first.active === true;
  }, 8000);
  const cam = first?.camera;
  const portrait = cam !== undefined
    && Math.abs(cam.zoom - PORTRAIT.zoom) <= 0.01
    && Math.abs(cam.centerX - PORTRAIT.centerX) <= 2
    && Math.abs(cam.centerY - PORTRAIT.centerY) <= 2;
  kit.ok('D_reduced_portrait', portrait, cam ?? null);

  const waitedCard = await kit.waitPhase(page, 'card', 60000);
  kit.ok('D_reduced_card', waitedCard !== null && (await cardOpen(page)), { waited: waitedCard });
  // the reduced teaser keeps the redacted name plate frame (2, RES?OR?) on the card too
  const plate = (await kit.showcase(page))?.plateFrame;
  kit.ok('D_plate_redacted', plate === 2, { plate });
  await kit.shot(page, 'demo-D1-reduced');
  await clickDemo(page, '#demo-keep');
}

// E: a full-game save (era III+ levels, ending engaged, Echoes) loaded by the demo is clamped to era II, and the raw text is backed up.
export async function caseE(kit, page) {
  await page.evaluate(() => window.__wedtmd.saveNow());
  await kit.editOnNextLoad(page, [
    { path: 'state.techLevels.boiler', set: 1 },
    { path: 'state.techLevels.resonatorSpire', set: 1 },
    { path: 'state.techLevels.primaryFunction', set: 1 },
    { path: 'state.techLevels.copperWinding', set: 2 },
    { path: 'state.ending.phase', set: 'postgame' },
    { path: 'state.ending.engagedAt', set: '$lastSimTime' },
    { path: 'prestige', set: { cycle: 3, echoesEarned: 6, perks: [] } },
  ]);
  await kit.reload(page);
  const S = await kit.editedSave(page);

  const clamped = await page.evaluate(() => {
    const s = window.__wedtmd.session;
    return {
      boiler: s.state.techLevels.boiler,
      copperWinding: s.state.techLevels.copperWinding,
      resonatorSpire: s.state.techLevels.resonatorSpire,
      primaryFunction: s.state.techLevels.primaryFunction,
      ending: s.state.ending.phase,
      cycle: window.__wedtmd.prestige().cycle,
    };
  });
  kit.ok(
    'E_clamped',
    clamped.copperWinding === 2 && clamped.boiler === 0 && clamped.resonatorSpire === 0 && clamped.primaryFunction === 0
      && clamped.ending === 'none' && clamped.cycle === 1,
    clamped,
  );

  const backup = await page.evaluate((key) => localStorage.getItem(key), SAVE_FULLGAME_KEY);
  kit.ok(
    'E_backup',
    typeof S === 'string' && S.length > 0 && backup === S,
    { saved: typeof S === 'string' ? S.length : null, backup: backup === null ? null : backup.length },
  );

  const d = await kit.demo(page);
  kit.ok('E_no_card', !(await cardOpen(page)) && d?.phase === 'idle', { phase: d?.phase ?? null });
}

// F: the stored save has the cap reset (substationBlueprint 0) and lifetime EE just under 4M, saved 1 h ago, so the boot catch-up crosses the cap and the teaser starts with no 4 s wait.
export async function caseF(kit, page) {
  await kit.buys(page, kit.S9);
  // the 8 h buy jumps leave lastSimTime ahead of the clock; the world loop pulls it back, so the save below is clean
  await kit.sleep(1500);
  await page.evaluate(() => window.__wedtmd.saveNow());
  await kit.editOnNextLoad(page, [
    { path: 'state.techLevels.substationBlueprint', set: 0 },
    { path: 'state.lifetime.ee', set: 3990000 },
    { path: 'state.lastSimTime', add: -3600000 },
    { path: 'savedAt', add: -3600000 },
  ]);
  await kit.reload(page);
  const stored = JSON.parse((await kit.editedSave(page)) ?? '{}');
  const capStored = stored?.state?.techLevels?.substationBlueprint;
  kit.ok('F_cap_not_yet', capStored === 0, { substationBlueprint: capStored ?? null });
  const waited = await kit.waitPhase(page, 'teaser', 5000);
  kit.ok('F_boot_teaser', waited !== null, waited);
  await kit.shot(page, 'demo-F1-boot-teaser');
  if (await kit.visible(page, '#demo-skip')) await clickDemo(page, '#demo-skip');
}
