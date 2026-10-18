import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5200/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, {timeout: 60000});
await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/deps/phaser.js'));
  const mod = await import(url); const Phaser = mod.default || mod;
  const orig = Phaser.GameObjects.Text.prototype.setText;
  Phaser.GameObjects.Text.prototype.setText = function (v) { window.__ft = this; return orig.call(this, v); };
});
const pt = await p.evaluate(() => window.__wedtmd.crankClientPoint());
await p.mouse.click(pt.x, pt.y);
const samples = await p.evaluate(async () => {
  const t = window.__ft; const s = [];
  const t0=performance.now(); while (performance.now()-t0 < 1300) { await new Promise(r => setTimeout(r, 100)); s.push([(performance.now()-t0)|0, +t.alpha.toFixed(2), t.y|0, t.visible, t.scene.game.loop.actualFps|0, t.style.color]); }
  return s;
});
console.log(JSON.stringify(samples));
await b.close();
