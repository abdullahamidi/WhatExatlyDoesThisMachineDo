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
// the 16 Era III machine parts (WP9 C3), reported for s10_boiler / s11_era3_full
const PARTS = ['boiler', 'chimney', 'steamManifold', 'pressureGauge', 'gaugeNeedle', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3', 'inductionHeater', 'superheater', 'reliefValves', 'steamHammer', 'hammerRam', 'condenser', 'turbine', 'turbineRotor'];
// the 16 Era IV machine parts (WP10 C3), reported for s12_spire / s13_era4_full
const PARTS4 = ['spireTower', 'spireExciter', 'spireWave', 'coilRing1', 'coilRing2', 'coilRing3', 'coilRing4', 'calliope', 'servoBase', 'servoArm', 'koenigFork', 'emitterDishL', 'emitterDishR', 'dishWavesL', 'dishWavesR', 'crystal'];
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
  s13_era4_full: [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence'],
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
  await p.waitForTimeout(2500);
  await p.mouse.move(5, 5);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'camera', JSON.stringify(await p.evaluate(() => window.__wedtmd.cameraState())));
  console.log(name, 'plaque', JSON.stringify(await p.$eval('#hud-plaque', e => e.textContent.trim()).catch(() => null)));
  if (name === 's10_boiler' || name === 's11_era3_full') {
    console.log(name, 'parts', JSON.stringify(await p.evaluate((ids) => Object.fromEntries(ids.map(i => [i, window.__wedtmd.componentState(i)?.visible ?? null])), PARTS)));
  }
  if (name === 's12_spire' || name === 's13_era4_full') {
    console.log(name, 'parts4', JSON.stringify(await p.evaluate((ids) => Object.fromEntries(ids.map(i => [i, window.__wedtmd.componentState(i)?.visible ?? null])), PARTS4)));
  }
  for (let f = 0; f < nframes; f++) {
    await p.screenshot({ path: `${out}/${name}-f${String(f).padStart(2,'0')}.png` });
    await p.waitForTimeout(+(process.env.FRAME_MS || 60));
  }
  await ctx.close();
}
console.log(JSON.stringify({ errors }));
await b.close();
