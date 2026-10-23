// WP19 T14 desktop smoke: drives the PACKAGED Electron exe over CDP (--remote-debugging-port).
// Playwright's _electron.launch is not usable: the EnableNodeCliInspectArguments fuse is OFF.
// Usage: PW_PATH=... node scripts/smoke/desktop.mjs <exePath> <outdir>
//   env DESKTOP_CDP_PORT (default 9339). The run uses <outdir>/userdata as WEDTMD_USER_DATA (deleted first).
// Prints ONE JSON object { results, fail, errors }; exit code 1 when fail is non-empty.
// Fallback: when CDP never attaches, boot_only runs (process alive 10 s, boot save written) and cdp_attach fails.
import { createRequire } from 'module';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const [exeArg, outArg] = process.argv.slice(2);

const DEFAULT_PORT = 9339;
const APP_PREFIX = 'app://wedtmd/';
const VERSION_LINE = 'v0.9.0 · SAVE v2';
const CSP_RE = /Content Security Policy|Refused to/i;
const CDP_WAIT_MS = 20000;
const PAGE_WAIT_MS = 20000;
const TITLE_WAIT_MS = 20000;
const EXIT_WAIT_MS = 10000;
const BOOT_ALIVE_MS = 10000;
const FS_SETTLE_MS = 800;
const KEY_GAP_MS = 100;
const CRANK_PRESSES = 20;
const RELAUNCH_PRESSES = 5;
const QUIT_MIN_CLICKS = 15;
const RELAUNCH_MIN_GAIN = 3;
const CLOSE_WAIT_MS = 5000;
const CLICK_WAIT_MS = 5000;
const FOCUS_WAIT_MS = 3000;
const SUMMARY_EXIT_MS = 3000;
const CONTENT_W = 1280;
const CONTENT_H = 720;

let chromium = null;
let outDir = '';
let cur = 'setup';
const P = {};
const results = {};
const fail = [];
const errors = [];
const pageErrors = [];
const children = new Set();
const sessions = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errMsg = (err) => String(err && err.message ? err.message : err).split('\n')[0];
// Records one check. Optional value is the observed detail (shown as { ok, value }).
const check = (name, ok, value) => {
  results[name] = value === undefined ? { ok: !!ok } : { ok: !!ok, value };
  if (!ok && !fail.includes(name)) fail.push(name);
};
// An exception in the current stage: the stage key fails and the message is kept.
const failStage = (err) => {
  if (!fail.includes(cur)) fail.push(cur);
  fail.push(`FAILED:${cur}:${errMsg(err)}`);
};
const noteError = (tag, kind, text, isPage) => {
  const line = `${tag}: ${kind}: ${text}`;
  errors.push(line);
  if (isPage) pageErrors.push(line);
};

// Process helpers

const isAlive = (child) => child.exitCode === null && child.signalCode === null;

// Kills the whole process tree (Electron starts GPU / utility children).
function kill(child) {
  if (!isAlive(child) || child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  } catch (_err) {
    // already gone
  }
}

// Isolated user data: WEDTMD_USER_DATA is read by desktop/main.cjs; ELECTRON_RUN_AS_NODE must not leak in.
function spawnExe(exe, port, userData) {
  const env = { ...process.env, WEDTMD_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, [`--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
  children.add(child);
  child.once('exit', () => children.delete(child));
  child.on('error', () => undefined);
  return child;
}

// Resolves true when the process exits within ms.
function waitExit(child, ms) {
  if (!isAlive(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function waitCdp(port, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch (_err) {
      // not listening yet
    }
    await sleep(250);
  }
  return false;
}

async function findAppPage(browser, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const ctx of browser.contexts()) {
      for (const page of ctx.pages()) {
        if (page.url().startsWith(APP_PREFIX)) return page;
      }
    }
    await sleep(250);
  }
  return null;
}

// Starts the exe, waits for CDP and finds the app page. session.page stays null when the attach fails.
async function attach(exe, port, userData, tag) {
  const s = { tag, child: spawnExe(exe, port, userData), browser: null, page: null, reason: '' };
  sessions.push(s);
  if (!(await waitCdp(port, CDP_WAIT_MS))) {
    s.reason = `no /json/version on port ${port} in ${CDP_WAIT_MS} ms`;
    return s;
  }
  try {
    s.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  } catch (err) {
    s.reason = `connectOverCDP: ${errMsg(err)}`;
    return s;
  }
  s.page = await findAppPage(s.browser, PAGE_WAIT_MS);
  if (s.page === null) {
    s.reason = `no page at ${APP_PREFIX} in ${PAGE_WAIT_MS} ms`;
    return s;
  }
  s.page.on('pageerror', (e) => noteError(tag, 'pageerror', e.message, true));
  s.page.on('console', (m) => {
    if (m.type() === 'error') noteError(tag, 'console', m.text(), false);
  });
  return s;
}

async function closeSession(s) {
  if (s.browser !== null && isAlive(s.child)) {
    await Promise.race([s.browser.close().catch(() => undefined), sleep(CLOSE_WAIT_MS)]);
  }
  kill(s.child);
}

// Page helpers

const titleOpen = (page) => page.locator('#title-screen.is-open').count().then((n) => n > 0);
const menuOpen = (page) => page.locator('#system-menu.is-open').count().then((n) => n > 0);
const isVisible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.$eval(sel, (el) => (el.textContent || '').trim()).catch(() => null);
const shot = (page, file) => page.screenshot({ path: path.join(outDir, file) }).then(() => true, () => false);
const fsOn = (page) => page.evaluate(() => window.wedtmdHost.isFullscreen() === true);
const contentSize = (page) => page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
const waitTitleClosed = (page) => page.waitForFunction(
  () => !document.querySelector('#title-screen.is-open'),
  null,
  { timeout: TITLE_WAIT_MS },
).then(() => true, () => false);
const blurActive = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
});

// SYSTEM menu open: Escape only when it is closed (a bare Escape opens it). Lands on the SYSTEM tab.
async function openMenu(page) {
  if (!(await menuOpen(page))) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('#system-menu.is-open', { state: 'visible', timeout: CLICK_WAIT_MS }).catch(() => null);
  }
  if (await isVisible(page, '#sys-tab-system')) await page.click('#sys-tab-system');
  return menuOpen(page);
}

async function closeMenu(page) {
  if (await menuOpen(page)) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('#system-menu.is-open', { state: 'hidden', timeout: CLICK_WAIT_MS }).catch(() => null);
  }
}

async function pressSpace(page, n) {
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.press('Space');
    await sleep(KEY_GAP_MS);
  }
}

// Clicks SYSTEM > QUIT TO DESKTOP. Returns the click error text or null.
async function clickQuit(page) {
  let clickErr = null;
  await page.click('#sys-quit', { timeout: CLICK_WAIT_MS }).catch((e) => { clickErr = errMsg(e); });
  return clickErr;
}

// Saved state.totalClicks, or null when the save is missing or unreadable.
function savedClicks(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const n = data && data.state ? data.state.totalClicks : null;
    return typeof n === 'number' ? n : null;
  } catch (_err) {
    return null;
  }
}

// Run 1 (fresh profile): checks 1_title_fresh .. 5_quit. Returns the saved totalClicks after quit.
async function firstRun(s) {
  const { page, child } = s;

  cur = '1_title_fresh';
  await page.waitForSelector('#title-screen.is-open', { timeout: TITLE_WAIT_MS }).catch(() => null);
  const open = await titleOpen(page);
  const continueVisible = await isVisible(page, '#title-continue');
  const quitVisible = await isVisible(page, '#title-quit');
  const version = await text(page, '#title-version');
  check('1_title_fresh', open && !continueVisible && quitVisible && version === VERSION_LINE,
    { open, continueVisible, quitVisible, version });
  await shot(page, 'desktop-title.png');
  const content = await contentSize(page);
  check('1b_content_size', content.w === CONTENT_W && content.h === CONTENT_H, content);

  cur = '2_gates';
  const gates = await page.evaluate(() => ({
    hook: typeof window.__wedtmd,
    kind: window.wedtmdHost ? window.wedtmdHost.kind : null,
    isPackaged: window.wedtmdHost ? window.wedtmdHost.isPackaged : null,
  }));
  check('2_gates', gates.hook === 'undefined' && gates.kind === 'electron' && gates.isPackaged === true, gates);

  cur = '3_crank';
  await page.click('#title-new');
  const closed = await waitTitleClosed(page);
  await blurActive(page);
  const before = await text(page, '#hud-me');
  await pressSpace(page, CRANK_PRESSES);
  const after = await text(page, '#hud-me');
  await sleep(300);
  await shot(page, 'desktop-game.png');
  check('3_crank', closed && before !== null && after !== before, { titleClosed: closed, before, after });

  cur = '4_fullscreen';
  // F11 through CDP; the main process handles it in before-input-event.
  await page.keyboard.press('F11');
  await sleep(FS_SETTLE_MS);
  const f11On = await fsOn(page);
  let f11Off = false;
  if (f11On) {
    await page.keyboard.press('F11');
    await sleep(FS_SETTLE_MS);
    f11Off = !(await fsOn(page));
  }
  const f11Routed = f11On && f11Off;
  const fsDetail = { f11Routed, f11On, f11Off, settings: null };
  if (f11Routed) {
    check('4_fullscreen', true, fsDetail);
  } else {
    // Fallback: SETTINGS > DISPLAY > FULLSCREEN calls the same host bridge.
    await openMenu(page);
    await page.click('#sys-tab-settings');
    const leftover = await fsOn(page);
    if (leftover) {
      await page.click('#sys-set-fullscreen');
      await sleep(FS_SETTLE_MS);
    }
    await page.click('#sys-set-fullscreen');
    await sleep(FS_SETTLE_MS);
    const settingsOn = await fsOn(page);
    await page.click('#sys-set-fullscreen');
    await sleep(FS_SETTLE_MS);
    const settingsOff = !(await fsOn(page));
    fsDetail.settings = { leftover, on: settingsOn, off: settingsOff };
    await closeMenu(page);
    check('4_fullscreen', settingsOn && settingsOff, fsDetail);
  }

  cur = '5_quit';
  await openMenu(page);
  const clickErr = await clickQuit(page);
  const exited = await waitExit(child, EXIT_WAIT_MS);
  const totalClicks = savedClicks(P.save);
  const windowJson = fs.existsSync(P.window);
  check('5_quit', exited && totalClicks !== null && totalClicks >= QUIT_MIN_CLICKS && windowJson,
    { exited, totalClicks, windowJson, clickErr });
  return totalClicks;
}

// Run 2 (same user data): checks 6_relaunch.
async function relaunchRun(exe, port, prevClicks) {
  cur = '6_relaunch';
  const s = await attach(exe, port, P.ud, 'run2');
  if (s.page === null) {
    check('6_relaunch', false, { attached: false, reason: s.reason });
    return;
  }
  const { page, child } = s;
  await page.waitForSelector('#title-continue', { state: 'visible', timeout: TITLE_WAIT_MS }).catch(() => null);
  const continueVisible = await isVisible(page, '#title-continue');
  const content = await contentSize(page);
  check('6b_content_size_stable', content.w === CONTENT_W && content.h === CONTENT_H, content);
  const focused = await page.waitForFunction(
    () => document.activeElement !== null && document.activeElement.id === 'title-continue',
    null,
    { timeout: FOCUS_WAIT_MS },
  ).then(() => true, () => false);
  await page.click('#title-continue');
  const closed = await waitTitleClosed(page);
  await blurActive(page);
  await pressSpace(page, RELAUNCH_PRESSES);
  await openMenu(page);
  const clickErr = await clickQuit(page);
  const exited = await waitExit(child, EXIT_WAIT_MS);
  const totalClicks = savedClicks(P.save);
  const bak = fs.existsSync(P.save + '.bak');
  const gain = totalClicks !== null && prevClicks !== null ? totalClicks - prevClicks : null;
  check('6_relaunch',
    continueVisible && focused && closed && exited && gain !== null && gain >= RELAUNCH_MIN_GAIN && bak,
    { continueVisible, focused, titleClosed: closed, exited, prevClicks, totalClicks, gain, bak, clickErr });
}

// Fallback: CDP never attached. The process must stay alive and the boot save must appear.
async function bootOnly(s) {
  cur = 'boot_only';
  await sleep(BOOT_ALIVE_MS);
  const alive = isAlive(s.child);
  const save = fs.existsSync(P.save);
  check('boot_only', alive && save, { alive, save });
}

// 7_csp: renderer.log has no CSP / refused lines and no page error was collected after attach.
function checkCsp() {
  cur = '7_csp';
  const logPresent = fs.existsSync(P.renderLog);
  const logText = logPresent ? fs.readFileSync(P.renderLog, 'utf8') : '';
  const cspLines = logText.split(/\r?\n/).filter((line) => CSP_RE.test(line));
  check('7_csp', cspLines.length === 0 && pageErrors.length === 0,
    { logPresent, cspLines: cspLines.slice(0, 5), pageErrors: pageErrors.length });
}

async function main() {
  cur = 'setup';
  if (!exeArg || !outArg) throw new Error('usage: desktop.mjs <exePath> <outdir>');
  if (!process.env.PW_PATH) throw new Error('PW_PATH is not set');
  ({ chromium } = require(process.env.PW_PATH));
  const exe = path.resolve(exeArg);
  if (!fs.existsSync(exe)) throw new Error(`exe missing: ${exe}`);
  outDir = path.resolve(outArg);
  fs.mkdirSync(outDir, { recursive: true });
  P.ud = path.join(outDir, 'userdata');
  fs.rmSync(P.ud, { recursive: true, force: true });
  P.save = path.join(P.ud, 'saves', 'wedtmd.save.json');
  P.window = path.join(P.ud, 'window.json');
  P.renderLog = path.join(P.ud, 'logs', 'renderer.log');
  const port = Number(process.env.DESKTOP_CDP_PORT || DEFAULT_PORT);

  try {
    const s1 = await attach(exe, port, P.ud, 'run1');
    check('cdp_attach', s1.page !== null, { port, reason: s1.reason });
    if (s1.page === null) {
      await bootOnly(s1);
    } else {
      let prev = null;
      try {
        prev = await firstRun(s1);
      } catch (err) {
        failStage(err);
      }
      await closeSession(s1);
      try {
        await relaunchRun(exe, port, prev);
      } catch (err) {
        failStage(err);
      }
    }
    checkCsp();
  } catch (err) {
    failStage(err);
  } finally {
    for (const s of sessions) await closeSession(s);
    for (const child of children) kill(child);
  }
}

await main();
console.log(JSON.stringify({ results, fail, errors }, null, 1));
process.exitCode = fail.length > 0 ? 1 : 0;
// Playwright sockets can hold the loop open after a failed run; force exit shortly after the output.
setTimeout(() => process.exit(process.exitCode ?? 0), SUMMARY_EXIT_MS).unref();
