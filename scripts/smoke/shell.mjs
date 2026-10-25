// WP19 T11 shell smoke: no-hook production boot, debug / title switches, title flows, SYSTEM footer, fullscreen row,
// crash overlay. Usage: PW_PATH=... node scripts/smoke/shell.mjs <base-url-without-query> <outdir>
// base = preview URL with a trailing slash and NO query (e.g. http://localhost:4174/); each case adds its own query.
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail or errors is non-empty.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { APP_VERSION } from './lib/common.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const results = {}, fail = [], errors = [];
let cur = 'setup';
// Records one check. Optional detail is the observed value (shown as { ok, value }).
const check = (name, cond, detail) => {
  results[name] = detail === undefined ? !!cond : { ok: !!cond, value: detail };
  if (!cond) fail.push(name);
};
// G_crash throws on purpose: its crash messages are not errors for that case only.
const isCrashNoise = t => t.includes('smoke crash') || t.startsWith('[crash]');
const note = text => {
  if (cur === 'G_crash' && isCrashNoise(text)) return;
  errors.push(`${cur}: ${text}`);
};
const shot = (page, file) => page.screenshot({ path: path.join(out, file) });
const settle = page => page.waitForTimeout(300);
const count = (page, sel) => page.locator(sel).count();
const isVisible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const waitFor = (page, sel, state = 'attached', timeout = 15000) =>
  page.waitForSelector(sel, { state, timeout }).then(() => true, () => false);
const titleOpen = async page => (await count(page, '#title-screen.is-open')) > 0;
const menuOpen = page => page.evaluate(() => window.__wedtmd.systemMenuOpen());
const totalClicks = page => page.evaluate(() => window.__wedtmd.session.state.totalClicks);
const text = (page, sel) => page.$eval(sel, el => (el.textContent || '').trim()).catch(() => null);
const ready = async page => {
  await page.waitForFunction(() => window.__wedtmd && window.__wedtmd.componentState && window.__wedtmd.componentState('handCrank'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
};
const crankClicks = async (page, n) => {
  for (let i = 0; i < n; i++) {
    const p = await page.evaluate(() => window.__wedtmd.crankClientPoint());
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(40);
  }
};
// One fresh 1280x720 context per case; listeners tag errors with the running case key.
const newCase = async (browser, key) => {
  cur = key;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') note('console: ' + m.text()); });
  page.on('pageerror', e => note('pageerror: ' + e.message));
  page.on('requestfailed', r => note('requestfailed: ' + r.url() + ' ' + (r.failure() ? r.failure().errorText : '')));
  return { ctx, page };
};
// Runs one case body; an exception becomes FAILED:<case>:<message> in fail.
const guard = async (key, fn) => {
  cur = key;
  try {
    await fn();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).split('\n')[0];
    fail.push(`FAILED:${key}:${msg}`);
  }
};

let browser = null;
try {
  browser = await chromium.launch();

  // A_nohook: production build without ?debug=1 has no hook; splash is gone; title shows; Escape closes it.
  {
    const { ctx, page } = await newCase(browser, 'A_nohook');
    await guard('A_nohook', async () => {
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForFunction(() => performance.getEntriesByName('wedtmd:first-frame').length > 0, null, { timeout: 15000 });
      await page.waitForTimeout(600);
      await waitFor(page, '#title-screen.is-open');
      await waitFor(page, '#splash', 'detached');
      check('A_no_hook', await page.evaluate(() => typeof window.__wedtmd === 'undefined'));
      check('A_title_open', await titleOpen(page));
      check('A_splash_gone', (await count(page, '#splash')) === 0);
      const marks = await page.evaluate(() => ({
        boot: performance.getEntriesByName('wedtmd:boot')[0]?.startTime ?? null,
        frame: performance.getEntriesByName('wedtmd:first-frame')[0]?.startTime ?? null,
      }));
      check('A_boot_mark_before_first_frame', marks.boot !== null && marks.frame !== null && marks.boot < marks.frame, marks);
      const version = await text(page, '#title-version');
      check('A_title_version', version === `v${APP_VERSION} · SAVE v2`, version);
      const continueVisible = await isVisible(page, '#title-continue');
      check('A_continue_hidden', !continueVisible, continueVisible);
      await shot(page, 'shell-A-title.png');
      await page.keyboard.press('Escape');
      await settle(page);
      check('A_escape_closes_title', !(await titleOpen(page)));
    });
    await ctx.close();
  }

  // B_debug: ?debug=1 exposes the hook and skips the title.
  {
    const { ctx, page } = await newCase(browser, 'B_debug');
    await guard('B_debug', async () => {
      await page.goto(base + '?debug=1', { waitUntil: 'load' });
      await ready(page);
      check('B_hook_defined', await page.evaluate(() => typeof window.__wedtmd !== 'undefined'));
      check('B_title_closed', !(await titleOpen(page)));
    });
    await ctx.close();
  }

  // C_title (fresh profile, then D_newgame in the same context): title buttons, overlays, audio, crank.
  {
    const { ctx, page } = await newCase(browser, 'C_title');
    await guard('C_title', async () => {
      await page.goto(base + '?debug=1&title=1', { waitUntil: 'load' });
      await ready(page);
      await waitFor(page, '#title-screen.is-open');
      check('C_title_open', await titleOpen(page));
      await page.click('#title-settings');
      await settle(page);
      check('C_settings_menu_open', await menuOpen(page));
      check('C_settings_tab_selected', (await page.getAttribute('#sys-tab-settings', 'aria-selected')) === 'true');
      await page.keyboard.press('Escape');
      await settle(page);
      check('C_esc_closes_menu', !(await menuOpen(page)));
      check('C_title_open_after_menu', await titleOpen(page));
      await page.click('#title-credits');
      check('C_credits_open', await waitFor(page, '#credits-overlay.is-open', 'attached', 5000));
      await shot(page, 'shell-C-credits.png');
      await page.keyboard.press('Escape');
      await settle(page);
      check('C_esc_closes_credits', (await count(page, '#credits-overlay.is-open')) === 0);
      check('C_title_open_after_credits', await titleOpen(page));
      await page.click('#title-new');
      await settle(page);
      check('C_new_game_closes_title', !(await titleOpen(page)));
      check('C_audio_unlocked', (await page.evaluate(() => window.__wedtmd.audioUnlocked())) === true);
      await crankClicks(page, 3);
      await page.waitForTimeout(150);
      const clicks = await totalClicks(page);
      check('C_three_crank_clicks', clicks === 3, clicks);
    });

    // D_newgame: same context. Save, reload: CONTINUE shows and is focused; NEW GAME arms, then erases.
    await guard('D_newgame', async () => {
      await page.evaluate(() => window.__wedtmd.saveNow());
      await page.reload({ waitUntil: 'load' });
      await ready(page);
      await waitFor(page, '#title-screen.is-open');
      await settle(page);
      check('D_continue_visible', await isVisible(page, '#title-continue'));
      const focused = await page.evaluate(() => document.activeElement?.id ?? null);
      check('D_continue_focused', focused === 'title-continue', focused);
      await page.click('#title-new');
      await settle(page);
      const armed = await text(page, '#title-new');
      check('D_new_game_armed_label', armed === 'CONFIRM: ERASE ALL?', armed);
      await page.click('#title-new');
      await settle(page);
      check('D_new_game_closes_title', !(await titleOpen(page)));
      const clicks = await totalClicks(page);
      check('D_clicks_reset', clicks === 0, clicks);
    });
    await ctx.close();
  }

  // E_footer: SYSTEM menu footer (version line), credits row, no QUIT on web.
  {
    const { ctx, page } = await newCase(browser, 'E_footer');
    await guard('E_footer', async () => {
      await page.goto(base + '?debug=1', { waitUntil: 'load' });
      await ready(page);
      await page.keyboard.press('Escape');
      await settle(page);
      check('E_menu_open', await menuOpen(page));
      const footer = await text(page, '#sys-footer');
      check('E_footer_text', footer === `v${APP_VERSION} · SAVE v2`, footer);
      const fontPx = await page.$eval('#sys-footer', el => parseFloat(getComputedStyle(el).fontSize)).catch(() => null);
      check('E_footer_font_size_12px', fontPx !== null && fontPx >= 12, fontPx);
      const aria = await page.getAttribute('#sys-footer', 'aria-label').catch(() => null);
      check('E_footer_aria_label', aria === `Version ${APP_VERSION}`, aria);
      check('E_credits_visible', await isVisible(page, '#sys-credits'));
      const quitVisible = await isVisible(page, '#sys-quit');
      check('E_quit_absent_or_hidden', !quitVisible, { present: (await count(page, '#sys-quit')) > 0, visible: quitVisible });
      await shot(page, 'shell-E-menu.png');
      await page.click('#sys-credits');
      check('E_credits_opens', await waitFor(page, '#credits-overlay.is-open', 'attached', 5000));
    });
    await ctx.close();
  }

  // F_fullscreen: SETTINGS tab shows the fullscreen control (when the API exists) and the F11 / ALT+ENTER hint.
  {
    const { ctx, page } = await newCase(browser, 'F_fullscreen');
    await guard('F_fullscreen', async () => {
      await page.goto(base + '?debug=1', { waitUntil: 'load' });
      await ready(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await page.click('#sys-tab-settings');
      await settle(page);
      const fullscreenEnabled = await page.evaluate(() => document.fullscreenEnabled === true);
      const control = (await count(page, '#sys-set-fullscreen')) > 0;
      check('F_fullscreen_control', !fullscreenEnabled || control, { fullscreenEnabled, control });
      const keys = await page.$$eval('.settings-keys li', lis => lis.map(li => (li.textContent || '').trim()));
      check('F_keys_hint', keys.includes('F11 / ALT+ENTER  FULLSCREEN'), keys);
    });
    await ctx.close();
  }

  // G_crash: a thrown error shows the crash overlay once; reload clears it. Crash noise is excluded (G_crash only).
  {
    const { ctx, page } = await newCase(browser, 'G_crash');
    await guard('G_crash', async () => {
      await page.goto(base + '?debug=1', { waitUntil: 'load' });
      await ready(page);
      await page.evaluate(() => { setTimeout(() => { throw new Error('smoke crash'); }, 0); });
      check('G_overlay_visible_3s', await waitFor(page, '#crash-overlay', 'visible', 3000));
      const body = await page.$eval('#crash-overlay', el => (el.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => '');
      check('G_overlay_text', body.includes('THE MACHINE STALLED') && body.includes('smoke crash'), body.slice(0, 300));
      await shot(page, 'shell-G-crash.png');
      await page.evaluate(() => { setTimeout(() => { throw new Error('smoke crash'); }, 0); });
      await page.waitForTimeout(300);
      const overlays = await page.evaluate(() => document.querySelectorAll('#crash-overlay').length);
      check('G_single_overlay', overlays === 1, overlays);
      await Promise.all([page.waitForEvent('load', { timeout: 15000 }), page.click('#crash-reload')]);
      await page.waitForTimeout(500);
      check('G_reload_clears_overlay', (await count(page, '#crash-overlay')) === 0);
    });
    await ctx.close();
  }
} catch (e) {
  const msg = String(e && e.message ? e.message : e).split('\n')[0];
  fail.push(`FAILED:${cur}:${msg}`);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 || errors.length > 0 ? 1 : 0;
