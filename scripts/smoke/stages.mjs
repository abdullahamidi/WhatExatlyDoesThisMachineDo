// usage: PW_PATH=... node stages.mjs <url> <outdir> [frames]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const url = process.argv[2], out = process.argv[3], nframes = +(process.argv[4] || 0);
const stages = {
  s0_crank: [],
  s1_gear: ['gearRatio'],
  s2_motor: ['wornMotor'],
  s3_gearmotor: ['wornMotor', 'gearRatio'],
  s4_reinforced: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank'],
  s5_flywheel: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'flywheel'],
  s6_pistons_nofly: ['wornMotor', 'motorTuning','motorTuning','motorTuning','motorTuning','motorTuning', 'pistonArray'],
  s7_full: ['wornMotor', 'gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'],
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
      for (const id of buys) {
        if (s.state.techLevels.wornMotor) { t += 8 * 3600 * 1000; s.update(t); }
        o.push(id + ':' + s.purchase(id).ok);
      }
      return o;
    }, buys);
    console.log(name, JSON.stringify(res));
  }
  await p.waitForTimeout(2500);
  await p.mouse.move(5, 5);
  await p.screenshot({ path: `${out}/${name}.png` });
  for (let f = 0; f < nframes; f++) {
    await p.screenshot({ path: `${out}/${name}-f${String(f).padStart(2,'0')}.png` });
    await p.waitForTimeout(+(process.env.FRAME_MS || 60));
  }
  await ctx.close();
}
console.log(JSON.stringify({ errors }));
await b.close();
