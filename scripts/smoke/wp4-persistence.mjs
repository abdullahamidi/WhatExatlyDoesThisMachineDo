// WP4 smoke. Usage: PW_PATH=... node smoke4.mjs <url> <outdir>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
const errors = [], res = {};
const ok = (k, v) => { res[k] = v; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  try { if (sessionStorage.getItem('corrupt') === '1') { sessionStorage.removeItem('corrupt'); localStorage.setItem('wedtmd.save', '{broken'); } } catch (e) {}
  try { if (sessionStorage.getItem('shiftBack') === '1') { sessionStorage.removeItem('shiftBack');
    const k = 'wedtmd.save'; const d = JSON.parse(localStorage.getItem(k)); const back = 2 * 3600 * 1000;
    d.savedAt -= back; d.state.lastSimTime -= back; localStorage.setItem(k, JSON.stringify(d)); } } catch (e) {}
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const ready = async () => { await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 }); await page.waitForTimeout(400); };
const txt = s => page.$eval(s, e => e.textContent.trim()).catch(() => null);
const toasts = () => page.$$eval('.toast', ts => ts.map(t => t.textContent.trim()));
const st = () => page.evaluate(() => { const s = window.__wedtmd.session; return { me: s.state.res.me, clicks: s.state.totalClicks, lv: { ...s.state.techLevels }, ps: s.rates.perSecond.me, muted: s.settings.muted }; });
const crank = async n => { const p = await page.evaluate(() => window.__wedtmd.crankClientPoint()); for (let i = 0; i < n; i++) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(30); } };
const save = () => page.evaluate(() => window.__wedtmd.saveNow && window.__wedtmd.saveNow());
try {
await page.goto(url, { waitUntil: 'networkidle' }); await ready();
// 1 persistence
await crank(60); await page.click('#hud-tech', { timeout: 4000 }); await page.click('[data-tech=gearRatio]', { timeout: 4000 }); await page.click('#tech-buy', { timeout: 4000 }); await page.click('[data-tech=wornMotor]', { timeout: 4000 }); await page.click('#tech-buy', { timeout: 4000 }); await page.keyboard.press('Escape');
await save(); const before = await st();
await page.reload({ waitUntil: 'networkidle' }); await ready(); const after = await st();
ok('1_persist', { before, after, toasts: await toasts() });
// 2 offline
await save();
await page.evaluate(() => sessionStorage.setItem('shiftBack', '1'));
const pre = await st(); await page.reload({ waitUntil: 'networkidle' }); await ready();
const post = await st(); ok('2_offline', { preMe: pre.me, postMe: post.me, ps: pre.ps, expected: pre.ps * 7200, toasts: await toasts() });
await page.reload({ waitUntil: 'networkidle' }); await ready(); const post2 = await st();
ok('2_reload_again', { me: post2.me, toasts: await toasts() });
// esc stack + modal count
await page.click('#hud-tech', { timeout: 4000 }); await page.keyboard.press('Escape'); ok('e1_tree_closed', await page.evaluate(() => window.__wedtmd.techTreeOpen()));
await page.click('#hud-system', { timeout: 4000 }); await page.click('#sys-reset', { timeout: 4000 }); const armed = await page.evaluate(() => window.__wedtmd.modalCount && window.__wedtmd.modalCount());
await page.keyboard.press('Escape'); const c1 = await page.evaluate(() => window.__wedtmd.modalCount()); const lbl = await txt('#sys-reset');
await page.keyboard.press('Escape'); const c0 = await page.evaluate(() => window.__wedtmd.modalCount());
ok('e_stack', { armed, c1, lbl, c0 });
// mutual exclusion + shield
await page.click('#hud-tech', { timeout: 4000 });
ok('mx', { tree: await page.evaluate(() => window.__wedtmd.techTreeOpen()), count: await page.evaluate(() => window.__wedtmd.modalCount()) });
const c = (await st()).clicks; await crank(2); ok('mx_shield', [(await st()).clicks === c]);
await page.keyboard.press('Escape'); await page.click('#hud-system', { timeout: 4000 }); await page.screenshot({ path: out + '/w4-01-menu.png' }); await page.keyboard.press('Escape');
// 4 mute persists
await page.click('#hud-system', { timeout: 4000 }); await page.click('#sys-mute', { timeout: 4000 }); await page.keyboard.press('Escape'); await save(); await page.reload({ waitUntil: 'networkidle' }); await ready();
await page.click('#hud-system', { timeout: 4000 }); ok('4_mute', { muted: (await st()).muted, label: await txt('#sys-mute') }); await page.keyboard.press('Escape');
// welcome-back on update gap
await page.evaluate(() => window.__wedtmd.session.update(Date.now() + 120000)); await page.waitForTimeout(300); ok('6_gap_toast', await toasts());
// 5 reset
await page.click('#hud-system', { timeout: 4000 }); await page.click('#sys-reset', { timeout: 4000 }); await page.waitForTimeout(6500); ok('5_single_press', { me: (await st()).me > 0, label: await txt('#sys-reset') });
await page.click('#sys-reset', { timeout: 4000 }); await page.click('#sys-reset', { timeout: 4000 }); await page.waitForTimeout(300);
const r = await st(); ok('5_reset', { me: r.me, lv: r.lv, gear: await page.evaluate(() => window.__wedtmd.componentState('gearSmall')), motor: await page.evaluate(() => window.__wedtmd.componentState('wornMotor')) });
await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' }); await ready(); ok('5_reload', (await st()).me);
// 3 corrupt
await page.evaluate(() => sessionStorage.setItem('corrupt', '1')); await page.reload({ waitUntil: 'networkidle' }); await ready();
ok('3_corrupt', { me: (await st()).me, backup: await page.evaluate(() => localStorage.getItem('wedtmd.save.corrupt')), toasts: await toasts() });
await page.screenshot({ path: out + '/w4-02-recovered.png' });
} catch (e) { res.FAILED = String(e).split('\n')[0]; }
res.errors = errors; console.log(JSON.stringify(res, null, 1)); await browser.close();
