// usage: PW_PATH=... node stages.mjs <url> <outdir> [frames]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const url = process.argv[2], out = process.argv[3], nframes = +(process.argv[4] || 0);
const S7 = ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...Array(25).fill('containmentRing'), ...Array(20).fill('resonantSiphon'), ...Array(10).fill('graviticAnchor'), 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];
// the 16 Era III machine parts (WP9 C3), reported for s10_boiler / s11_era3_full
const PARTS = ['boiler', 'chimney', 'steamManifold', 'pressureGauge', 'gaugeNeedle', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3', 'inductionHeater', 'superheater', 'reliefValves', 'steamHammer', 'hammerRam', 'condenser', 'turbine', 'turbineRotor'];
// the 16 Era IV machine parts (WP10 C3), reported for s12_spire / s13_era4_full
const PARTS4 = ['spireTower', 'spireExciter', 'spireWave', 'coilRing1', 'coilRing2', 'coilRing3', 'coilRing4', 'calliope', 'servoBase', 'servoArm', 'koenigFork', 'emitterDishL', 'emitterDishR', 'dishWavesL', 'dishWavesR', 'crystal'];
// the 38 Era V machine parts (WP11 C3), reported for s14_null / s15_era5_full / s16_postgame
const PARTS5 = ['nullGallery', 'nullChamber', 'nullCore', 'nullCoreGlint', 'ring1Back', 'ring2Back', 'ring3Back', 'ring4Back', 'ring1Front', 'ring2Front', 'ring3Front', 'ring4Front', 'ring1Bead', 'ring2Bead', 'ring3Bead', 'ring4Bead', 'siphonTube1L', 'siphonTube1R', 'siphonTube2L', 'siphonTube2R', 'siphonTube3L', 'siphonTube3R', 'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'graviticAnchorL', 'graviticAnchorR', 'anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R', 'inversionGhost', 'lensLight', 'lensColumn', 'aperture', 'namePlate'];
const PERF = process.env.PERF === '1';
const stages = {
  s0_crank: [],
  s1_gear: ['gearRatio'],
  s2_motor: ['wornMotor'],
  s3_gearmotor: ['wornMotor', 'gearRatio'],
  s4_reinforced: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank'],
  s5_flywheel: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'flywheel'],
  s6_pistons_nofly: ['wornMotor', 'motorTuning','motorTuning','motorTuning','motorTuning','motorTuning', 'pistonArray'],
  s7_full: S7,
  s8_generator: [...S7, '@blueprint', 'generator'],
  s9_era2_full: S9,
  s10_boiler: S10,
  s11_era3_full: S11,
  s12_spire: S12,
  s13_era4_full: S13,
  s14_null: S14,
  s15_era5_full: S15,
  s16_postgame: S16,
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(stages);
const b = await chromium.launch();
const errors = [];
for (const name of only) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(name + ':' + e.message));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'));
  const pt = await p.evaluate(() => window.__wedtmd.crankClientPoint());
  const buys = stages[name];
  if (buys.length) {
    for (let i = 0; i < 45; i++) await p.mouse.click(pt.x, pt.y);
    const res = await p.evaluate((buys) => {
      const s = window.__wedtmd.session; const o = []; let t = Date.now();
      const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
      for (const id of buys) {
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
    }, buys);
    console.log(name, JSON.stringify(res));
  }
  // s16_postgame: skip the finale, click KEEP IT RUNNING (postgame), then the 2.5 s settle below
  if (name === 's16_postgame') {
    await p.evaluate(() => window.__wedtmd?.skipFinale?.());
    await p.locator('button', { hasText: 'KEEP IT RUNNING' }).first().click({ timeout: 5000 }).catch(e => errors.push(name + ':keep ' + String(e).split('\n')[0]));
  }
  // settle wait: env WAIT_MS overrides; s16_postgame waits 2.5 s; Era IV+ stages (s14 and later, numeric compare) get 12 s
  await p.waitForTimeout(+(process.env.WAIT_MS ?? (name === 's16_postgame' ? 2500 : (+name.slice(1).split('_')[0] >= 14 ? 12000 : 2500))));
  // era V stages: click the crank 3x so the 3 s inversion ghost shows in the shot and the frames
  if (name === 's15_era5_full' || name === 's16_postgame') {
    const cp = await p.evaluate(() => window.__wedtmd.crankClientPoint());
    for (let i = 0; i < 3; i++) await p.mouse.click(cp.x, cp.y);
    await p.waitForTimeout(150);
  }
  await p.mouse.move(5, 5);
  await p.screenshot({ path: `${out}/${name}.png` });
  if (PERF && (name === 's13_era4_full' || name === 's15_era5_full')) {
    await p.waitForTimeout(3000);
    console.log(name, 'machineStats', JSON.stringify(await p.evaluate(() => window.__wedtmd.machineStats?.() ?? null)));
  }
  console.log(name, 'camera', JSON.stringify(await p.evaluate(() => window.__wedtmd.cameraState())));
  console.log(name, 'plaque', JSON.stringify(await p.$eval('#hud-plaque', e => e.textContent.trim()).catch(() => null)));
  if (name === 's10_boiler' || name === 's11_era3_full') {
    console.log(name, 'parts', JSON.stringify(await p.evaluate((ids) => Object.fromEntries(ids.map(i => [i, window.__wedtmd.componentState(i)?.visible ?? null])), PARTS)));
  }
  if (name === 's12_spire' || name === 's13_era4_full') {
    console.log(name, 'parts4', JSON.stringify(await p.evaluate((ids) => Object.fromEntries(ids.map(i => [i, window.__wedtmd.componentState(i)?.visible ?? null])), PARTS4)));
  }
  if (name === 's14_null' || name === 's15_era5_full' || name === 's16_postgame') {
    console.log(name, 'parts5', JSON.stringify(await p.evaluate((ids) => Object.fromEntries(ids.map(i => [i, window.__wedtmd.componentState(i)?.visible ?? null])), PARTS5)));
  }
  for (let f = 0; f < nframes; f++) {
    await p.screenshot({ path: `${out}/${name}-f${String(f).padStart(2,'0')}.png` });
    await p.waitForTimeout(+(process.env.FRAME_MS || 60));
  }
  await ctx.close();
}
console.log(JSON.stringify({ errors }));
await b.close();
