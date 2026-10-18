// WP3 smoke. Usage: PW_PATH=... node smoke3.mjs <url> <outdir>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
const errors = [], failed = [], res = {};
const ok = (k, v) => { res[k] = v; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('requestfailed', r => failed.push(r.url()));
page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 });
await page.waitForTimeout(500);
const txt = s => page.$eval(s, e => e.textContent.trim()).catch(() => null);
const cs = id => page.evaluate(i => window.__wedtmd.componentState(i), id);
const crank = async n => { const p = await page.evaluate(() => window.__wedtmd.crankClientPoint()); for (let i = 0; i < n; i++) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(40); } };
ok('1_boot', [await txt('#hud-me'), await txt('#hud-per-click'), await txt('#hud-per-second'), (await cs('gearSmall'))?.visible]);
await crank(1); await page.waitForTimeout(150);
ok('2_toast', await page.$$eval('.toast', ts => ts.map(t => t.textContent.trim())));
await crank(14); await page.waitForTimeout(150); ok("2_me15", await txt('#hud-me'));
await page.click('#hud-tech'); await page.waitForTimeout(300);
ok('3_tree', { open: await page.evaluate(() => window.__wedtmd.techTreeOpen()), nodes: (await page.$$('.tech-node')).length, edges: (await page.$$('#tech-edges path')).length,
  rcLocked: await page.$eval('[data-tech=reinforcedCrank]', e => e.classList.contains('is-locked')).catch(() => 'missing'),
  gbMilestone: await page.$eval('[data-tech=generatorBlueprint]', e => e.classList.contains('is-milestone')).catch(() => 'missing') });
await crank(1); ok('4_shielded_me', await txt('#hud-me'));
await page.click('[data-tech=gearRatio]'); await page.waitForTimeout(150); ok('5_buyLabel', await txt('#tech-buy'));
await page.screenshot({ path: out + '/w3-01-tree.png' });
await page.click('#tech-buy'); await page.waitForTimeout(200);
ok('5_after', [await txt('#hud-per-click'), await txt('#hud-me'), await txt('[data-tech=gearRatio]')]);
await page.click('#tech-buy'); await page.waitForTimeout(150); ok('5_feedback', [await txt('#tech-feedback'), await txt('#hud-me')]);
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
ok('6_closed', await page.evaluate(() => window.__wedtmd.techTreeOpen()));
await page.screenshot({ path: out + '/w3-02-assembling.png' });
await page.waitForTimeout(1500); ok('6_gear', await cs('gearSmall'));
await crank(20); await page.waitForTimeout(150); ok("7_me", await txt('#hud-me'));
await page.click('#hud-tech'); await page.waitForTimeout(200); await page.click('[data-tech=wornMotor]'); await page.click('#tech-buy'); await page.waitForTimeout(200);
ok('7_after', [await txt('#hud-per-second'), await page.$$eval('.toast', ts => ts.map(t => t.textContent.trim()))]);
await page.keyboard.press('Escape'); await page.waitForTimeout(1200); ok('7_motor', await cs('wornMotor'));
const me0 = await txt('#hud-me'); await page.waitForTimeout(3000); ok('8_auto', [me0, await txt('#hud-me')]);
await page.screenshot({ path: out + '/w3-03-machine.png' });
// fast-forward: give lots of ME and buy most of the tree to see full machine
await page.evaluate(() => { const s = window.__wedtmd.session; if (s && s.debugGrant) s.debugGrant(1e6); });
res.errors = errors; res.failed = failed;
console.log(JSON.stringify(res, null, 1));
await browser.close();
