// WP12 smoke (menus, keyboard, settings, records, export/import). Usage: PW_PATH=... node wp12-menus.mjs <url> <outdir>
// Run by the Director after WP11 W3 + Mode B and WP12 T9 are merged. Records keys only (no asserts).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, out] = process.argv.slice(2);
const errors = [], res = {};
const ok = (k, v) => { res[k] = v; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const ready = async () => { await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 }); await page.waitForTimeout(400); };
const txt = s => page.$eval(s, e => e.textContent.trim()).catch(() => null);
const toasts = () => page.$$eval('.toast', ts => ts.map(t => t.textContent.trim()));
const st = () => page.evaluate(() => { const s = window.__wedtmd.session; return { me: s.state.res.me, clicks: s.state.totalClicks, statsClicks: s.stats.clicks, lv: { ...s.state.techLevels }, settings: { ...s.settings } }; });
const menuOpen = () => page.evaluate(() => window.__wedtmd.systemMenuOpen());
const treeOpen = () => page.evaluate(() => window.__wedtmd.techTreeOpen());
const save = () => page.evaluate(() => window.__wedtmd.saveNow && window.__wedtmd.saveNow());
const selectedTabs = () => page.$$eval('[role=tab]', ts => ts.filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.id));
// Closes whichever modal is open (Esc only when something is open, so a bare Esc never opens the menu by accident).
const closeMenus = async () => { if (await page.evaluate(() => window.__wedtmd.techTreeOpen() || window.__wedtmd.systemMenuOpen())) await page.keyboard.press('Escape'); await page.waitForTimeout(200); };
const openMenu = async () => { await closeMenus(); await page.keyboard.press('Escape'); await page.waitForTimeout(200); };
const crankPoint = () => page.evaluate(() => window.__wedtmd.crankClientPoint());
try {
await page.goto(url, { waitUntil: 'networkidle' }); await ready();
// 1 first crank: pointer click, RECORD LOGGED toast
const p = await crankPoint(); await page.mouse.click(p.x, p.y); await page.waitForTimeout(300);
ok('1_first_crank_toasts', await toasts());
// 2 Esc opens the menu; ArrowRight moves the tab selection
await openMenu(); ok('2_esc_menu', await menuOpen());
await page.focus('#sys-tab-system'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
ok('2_arrow_right', await selectedTabs());
// 3 focus trap: 12 Tabs stay inside the menu
for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
ok('3_tab_trapped', await page.evaluate(() => { const a = document.activeElement; return a !== null && a.closest('#system-menu') !== null; }));
// 4 settings: volume 40, reduced motion, UI scale 125, notation scientific
await page.click('#sys-tab-settings'); await page.waitForTimeout(150);
await page.$eval('#sys-set-masterVolume', el => { el.value = '40'; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('#sys-set-reducedMotion');
await page.$eval('input[name="sys-set-uiScale"][value="125"]', el => el.click());
await page.$eval('input[name="sys-set-notation"][value="scientific"]', el => el.click());
await page.waitForTimeout(150);
ok('4_settings', (await st()).settings);
ok('4_volume_sliders', await page.$$eval('input[type="range"][id^="sys-set-"]', ns => ns.map(n => n.id)));
ok('4_root_attrs', await page.evaluate(() => { const r = document.getElementById('ui-root'); return r ? { zoom: r.style.zoom, reducedMotion: r.dataset.reducedMotion, statusMarkers: r.dataset.statusMarkers } : null; }));
await page.screenshot({ path: out + '/wp12-01-settings.png' });
// 5 Space x10 = +10 clicks; held-key repeat adds 0
await closeMenus();
await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
const c0 = (await st()).clicks;
for (let i = 0; i < 10; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
const c1 = (await st()).clicks;
await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true })); });
const c2 = (await st()).clicks;
ok('5_space', { delta: c1 - c0, heldDelta: c2 - c1 });
// 6 't' toggles the tech tree
await page.keyboard.press('t'); await page.waitForTimeout(200); const t1 = await treeOpen();
await page.keyboard.press('t'); await page.waitForTimeout(200); const t2 = await treeOpen();
ok('6_tree_t', [t1, t2]);
// 7 RECORDS tab: firstTurn badge unlocked, counter
await openMenu(); await page.click('#sys-tab-records'); await page.waitForTimeout(150);
ok('7_records_firstTurn', await page.$$eval('[data-achievement-id="firstTurn"][data-unlocked="true"]', ns => ns.length));
ok('7_records_counter', await txt('.ach-counter'));
await page.screenshot({ path: out + '/wp12-02-records.png' });
// 8 STATS: CLICKS cell matches session.stats.clicks
await page.click('#sys-tab-stats'); await page.waitForTimeout(150);
ok('8_stats_clicks_cell', await page.$$eval('#sys-stats .stats-row', rows => { const r = rows.find(x => x.querySelector('.stats-label')?.textContent === 'CLICKS'); return r ? r.querySelector('.stats-value')?.textContent : null; }));
ok('8_stats_clicks_session', (await st()).statsClicks);
await page.screenshot({ path: out + '/wp12-03-stats.png' });
// 9 grant ME past 1000 (session clicks, no animation), then HUD in scientific notation
await closeMenus();
await page.evaluate(() => { const s = window.__wedtmd.session; for (let i = 0; i < 1100; i++) s.click(); });
await page.waitForTimeout(300);
ok('9_hud_me_scientific', await txt('#hud-me'));
// 10 buy a tech, save, reload: settings survive
ok('10_buy', await page.evaluate(() => window.__wedtmd.session.purchase('gearRatio').ok));
await save(); await page.reload({ waitUntil: 'networkidle' }); await ready();
ok('10_settings_after_reload', (await st()).settings);
// 11 export -> two-step reset -> import -> reload restores me / tech levels / stats clicks
await openMenu(); await page.click('#sys-tab-data'); await page.waitForTimeout(150);
await page.click('#sys-data-export'); await page.waitForTimeout(150);
const exported = await page.$eval('#sys-data-export-text', el => el.value);
ok('11_export_length', exported.length);
const before = await st();
await page.click('#sys-tab-system'); await page.waitForTimeout(100);
await page.click('#sys-reset'); await page.click('#sys-reset'); await page.waitForTimeout(300);
ok('11_after_reset', { me: (await st()).me, clicks: (await st()).clicks });
await openMenu(); await page.click('#sys-tab-data'); await page.waitForTimeout(150);
await page.fill('#sys-data-import-text', exported);
await page.click('#sys-data-import');
await Promise.all([page.waitForEvent('load', { timeout: 15000 }).catch(() => null), page.click('#sys-data-import')]);
await ready();
const after = await st();
ok('11_restored', { me: after.me === before.me, lv: JSON.stringify(after.lv) === JSON.stringify(before.lv), statsClicks: after.statsClicks === before.statsClicks, beforeMe: before.me, afterMe: after.me });
// 12 garbage import: error text, state unchanged
await openMenu(); await page.click('#sys-tab-data'); await page.waitForTimeout(150);
const pre12 = await st();
await page.fill('#sys-data-import-text', 'not a save at all');
await page.click('#sys-data-import'); await page.click('#sys-data-import'); await page.waitForTimeout(250);
const post12 = await st();
ok('12_garbage', { status: await txt('#sys-data-import-status'), meSame: post12.me === pre12.me, clicksSame: post12.clicks === pre12.clicks });
await page.screenshot({ path: out + '/wp12-04-import-error.png' });
// 13 typing 't ' in the import textarea triggers nothing
await page.fill('#sys-data-import-text', '');
await page.click('#sys-data-import-text');
const pre13 = await st();
await page.keyboard.type('t ');
ok('13_typing_in_textarea', { treeOpen: await treeOpen(), clicksDelta: (await st()).clicks - pre13.clicks, text: await page.$eval('#sys-data-import-text', el => el.value) });
// 14 WP20: Space inside the tree keeps it open and the focus on a tech node
await closeMenus();
await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
await page.keyboard.press('t'); await page.waitForTimeout(250);
await page.keyboard.press('Space'); await page.waitForTimeout(250);
ok('14_tree_space', { open: await treeOpen(), focusNode: await page.evaluate(() => document.activeElement?.classList.contains('tech-node') === true) });
await closeMenus();
} catch (e) { res.FAILED = String(e).split('\n')[0]; }
res.errors = errors; console.log(JSON.stringify(res, null, 1)); await browser.close();
