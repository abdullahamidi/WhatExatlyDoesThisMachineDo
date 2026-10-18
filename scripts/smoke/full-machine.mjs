// Buys the whole tree via the debug session (time jump through offline path) and screenshots the full machine.
// Usage: PW_PATH=... node fullmachine.mjs <url> <out.png>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
await p.goto(process.argv[2], { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'));
const pt = await p.evaluate(() => window.__wedtmd.crankClientPoint());
for (let i = 0; i < 45; i++) { await p.mouse.click(pt.x, pt.y); }
const r = await p.evaluate(() => {
  const s = window.__wedtmd.session; const out = [];
  out.push(s.purchase('wornMotor').ok);
  s.update(Date.now() + 8 * 3600 * 1000); s.purchase('motorTuning'); s.purchase('motorTuning'); s.purchase('motorTuning'); s.update(Date.now() + 16 * 3600 * 1000); s.update(Date.now() + 24 * 3600 * 1000);
  const order = ['gearRatio','gearRatio','gearRatio','reinforcedCrank','motorTuning','motorTuning','motorTuning','motorTuning','motorTuning','flywheel','pistonArray','improvedPistons'];
  for (const id of order) out.push(id + ':' + s.purchase(id).ok);
  return { out, rates: s.rates, levels: s.state.techLevels };
});
await p.waitForTimeout(2500);
await p.screenshot({ path: process.argv[3] });
await p.mouse.move(640, 360); for (let i = 0; i < 4; i++) await p.mouse.wheel(0, -200);
await p.waitForTimeout(400); await p.screenshot({ path: process.argv[3].replace('.png', '-zoom.png') });
console.log(JSON.stringify({ r, errors }));
await b.close();
