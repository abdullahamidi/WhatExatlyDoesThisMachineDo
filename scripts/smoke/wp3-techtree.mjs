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
// era tabs: era II still signal-locked at this point
await page.click('#hud-tech'); await page.waitForTimeout(200);
ok('9_tabs', await page.$$eval('.tech-tab', bs => bs.map(b => ({ text: b.textContent.trim(), selected: b.getAttribute('aria-selected') === 'true', disabled: b.disabled }))));
ok('9_tabCount', await page.$$eval('.tech-tab', bs => bs.length));
ok('9_header', await txt('#tech-me'));
await page.focus('#tech-tab-1'); await page.keyboard.press('ArrowRight');
ok('9_arrow', await page.evaluate(() => document.activeElement && document.activeElement.id));
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
// fast-forward to era II (stages.mjs s7 recipe)
await crank(45);
res['9_buys'] = await page.evaluate((buys) => {
  const s = window.__wedtmd.session; const o = []; let t = Date.now();
  for (const id of buys) {
    if (s.state.techLevels.wornMotor) { t += 8 * 3600 * 1000; s.update(t); }
    o.push(id + ':' + s.purchase(id).ok);
  }
  for (let i = 0; i < 5 && s.state.techLevels.generatorBlueprint !== 1; i++) { t += 8 * 3600 * 1000; s.update(t); }
  return o.concat(['generatorBlueprint:' + s.state.techLevels.generatorBlueprint]);
}, ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons']);
await page.click('#hud-tech'); await page.waitForTimeout(200);
ok('10_tabs', { tabs: await page.$$eval('.tech-tab', bs => bs.map(b => ({ text: b.textContent.trim(), selected: b.getAttribute('aria-selected') === 'true', disabled: b.disabled }))), me: await txt('#tech-me') });
ok('10_tabCount', await page.$$eval('.tech-tab', bs => bs.length));
ok('10_nodes', await page.$$eval('.tech-node', ns => ns.filter(n => !n.hidden).length));
await page.focus('#tech-tab-2'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
ok('10_back', { tabs: await page.$$eval('.tech-tab', bs => bs.map(b => b.getAttribute('aria-selected'))), nodes: await page.$$eval('.tech-node', ns => ns.filter(n => !n.hidden).length), me: await txt('#tech-me') });
// era III fast-forward (stages.mjs s11 recipe: s9 list + '@substationBlueprint'), one page.evaluate
const S9 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons', '@blueprint', 'generator', ...Array(5).fill('motorRetrofit'), ...Array(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap', ...Array(3).fill('transformer'), 'powerLines'];
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
await page.evaluate((buys) => {
  const s = window.__wedtmd.session;
  // start from the session's own clock: a backwards update() credits nothing
  let t = Math.max(Date.now(), s.state.lastSimTime);
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of buys) {
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
  }
}, [...S9, '@substationBlueprint']);
await page.click('#hud-tech'); await page.waitForTimeout(200);
ok('11_tabs', { tabs: await page.$$eval('.tech-tab', bs => bs.map(b => ({ text: b.textContent.trim(), selected: b.getAttribute('aria-selected') === 'true', disabled: b.disabled }))), me: await txt('#tech-me') });
ok('11_tabCount', await page.$$eval('.tech-tab', bs => bs.length)); // expect 5 (era V tab exists)
await page.click('#tech-tab-3'); await page.waitForTimeout(200);
ok('11_header', await txt('#tech-me'));
ok('11_nodes', await page.$$eval('.tech-node', ns => ns.filter(n => !n.hidden).length)); // expect 10 (era III tab)
ok('11_boiler', await page.$eval('[data-tech=boiler]', e => [...e.classList]).catch(() => 'missing'));
// era IV fast-forward (stages.mjs s13 recipe: s11 list + resonatorSpire lead-in), one page.evaluate
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
await page.evaluate((buys) => {
  const s = window.__wedtmd.session;
  // start from the session's own clock: a backwards update() credits nothing
  let t = Math.max(Date.now(), s.state.lastSimTime);
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of buys) {
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
  }
}, [...S9, '@substationBlueprint', 'boiler', ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint']);
await page.click('#hud-tech'); await page.waitForTimeout(200);
ok('12_tabs', { tabs: await page.$$eval('.tech-tab', bs => bs.map(b => ({ text: b.textContent.trim(), selected: b.getAttribute('aria-selected') === 'true', disabled: b.disabled }))), me: await txt('#tech-me') });
ok('12_tabCount', await page.$$eval('.tech-tab', bs => bs.length)); // expect 5 (era V tab exists)
ok('12_tab5', await page.$$eval('.tech-tab', bs => (bs[4] ? bs[4].textContent.trim() : ''))); // expect 'SIGNAL ?'
await page.click('#tech-tab-4'); await page.waitForTimeout(200);
ok('12_header', await txt('#tech-me'));
ok('12_nodes', await page.$$eval('.tech-node', ns => ns.filter(n => !n.hidden).length)); // expect 10 (era IV tab)
ok('12_spire', await page.$eval('[data-tech=resonatorSpire]', e => [...e.classList]).catch(() => 'missing'));
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
// era V fast-forward (stages.mjs S13 full list written inline), one page.evaluate
await page.evaluate((buys) => {
  const s = window.__wedtmd.session;
  // start from the session's own clock: a backwards update() credits nothing
  let t = Math.max(Date.now(), s.state.lastSimTime);
  const jump = () => { t += 8 * 3600 * 1000; s.update(t); };
  for (const id of buys) {
    if (id.startsWith('@')) {
      const tech = id === '@blueprint' ? 'generatorBlueprint' : id.slice(1);
      for (let k = 0; k < 8 && s.state.techLevels[tech] !== 1; k++) jump();
      continue;
    }
    if (s.state.techLevels.wornMotor) jump();
    let r = s.purchase(id);
    for (let k = 0; k < 6 && !r.ok; k++) { jump(); r = s.purchase(id); }
  }
}, [...S9, '@substationBlueprint', 'boiler', ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint', 'resonatorSpire', ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence']);
await page.click('#hud-tech'); await page.waitForTimeout(200);
ok('13_tabs', { tabs: await page.$$eval('.tech-tab', bs => bs.map(b => ({ text: b.textContent.trim(), selected: b.getAttribute('aria-selected') === 'true', disabled: b.disabled }))), me: await txt('#tech-me') });
ok('13_tabCount', await page.$$eval('.tech-tab', bs => bs.length)); // expect 5
await page.click('#tech-tab-5'); await page.waitForTimeout(200);
ok('13_header', await txt('#tech-me')); // expect ends '???'
ok('13_nodes', await page.$$eval('.tech-node', ns => ns.filter(n => !n.hidden).length)); // expect 12 (era V tab)
ok('13_null', await page.$eval('[data-tech=nullChamber]', e => [...e.classList]).catch(() => 'missing'));
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
res.errors = errors; res.failed = failed;
console.log(JSON.stringify(res, null, 1));
await browser.close();
