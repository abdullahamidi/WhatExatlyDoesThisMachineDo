'use strict';
// What Exactly Does This Machine Do? - Electron main process (Steam depot shell).
// CommonJS, Electron 44 + Node built-ins only. Channel names must match desktop/preload.cjs.

const fs = require('fs');
const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  screen,
  session,
  shell,
} = require('electron');

// 1. Constants

const APP_HOST = 'wedtmd';
const START_URL = 'app://wedtmd/index.html';
const APP_PREFIX = 'app://wedtmd/';
const USER_DIR = 'WhatExactlyDoesThisMachineDo';
const APP_USER_MODEL_ID = 'com.abdullahamidi.wedtmd';
const WINDOW = Object.freeze({ width: 1280, height: 720, minWidth: 960, minHeight: 540 });
const BG = '#0d0b09';
const TITLE = 'What Exactly Does This Machine Do?';
const LOG_MAX_BYTES = 1048576;
const LOG_MSG_MAX = 2000;
const SAVE_MAX_BYTES = 8388608;
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const EXTERNAL_ALLOW = ['https://store.steampowered.com/', 'steam://'];
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; media-src 'self' data: blob:; object-src 'none'; base-uri 'none'";
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
});
const DIST_DIR = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, '..', 'dist');
const ZOOM_KEYS = new Set(['+', '=', '-', '0']);
const ZOOM_CODES = new Set(['NumpadAdd', 'NumpadSubtract']);
const RENAME_RETRIES = 5;
const RENAME_WAIT_MS = 40;
const WINDOW_SAVE_DELAY_MS = 500;
const RELOAD_LIMIT = 3;
const RELOAD_WINDOW_MS = 60000;
const CRASH_TEXT = 'The game stopped several times. Your saves are in '
  + path.join('%APPDATA%', USER_DIR, 'saves') + '.';
const SHOW_FALLBACK_MS = 10000;
const ERR_ABORTED = -3;
const LOAD_FAIL_TEXT = 'The game files could not be loaded. In Steam use Properties > Installed Files > Verify integrity of game files, or reinstall the game.';

// 2. Paths and logging

function userDataDir() { return app.getPath('userData'); }
function savesDir() { return path.join(userDataDir(), 'saves'); }
function logsDir() { return path.join(userDataDir(), 'logs'); }
function windowStatePath() { return path.join(userDataDir(), 'window.json'); }

function errText(err) {
  return err && err.stack ? String(err.stack) : String(err);
}

// Renames an oversized log to <name>.1 (old .1 removed first; Windows rename does not overwrite).
function rotateLog(file) {
  try {
    if (fs.statSync(file).size <= LOG_MAX_BYTES) return;
    fs.rmSync(file + '.1', { force: true });
    fs.renameSync(file, file + '.1');
  } catch (_err) {
    // missing file or locked file: keep appending
  }
}

function appendLog(fileName, level, message, suffix) {
  try {
    const dir = logsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, fileName);
    rotateLog(file);
    const text = String(message).replace(/[\r\n]+/g, ' ').slice(0, LOG_MSG_MAX);
    fs.appendFileSync(file, `${new Date().toISOString()} [${level}] ${text}${suffix}\n`, 'utf8');
  } catch (_err) {
    // logging must never throw
  }
}

function logMain(level, message) {
  appendLog('main.log', level, message, '');
}

// 3. Saves (LocalStorage replacement: saves/<key>.json, atomic write with .bak)

function isValidKey(key) {
  return typeof key === 'string' && KEY_RE.test(key) && !key.includes('..');
}

function isValidEntry(key, value) {
  if (!isValidKey(key)) return false;
  if (value === null) return true;
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= SAVE_MAX_BYTES;
}

function saveFile(key) {
  return path.join(savesDir(), key + '.json');
}

// Keys whose save exists but cannot be read (for example a short antivirus lock). Writes stay blocked for them.
const lockedKeys = new Set();

// { text, locked }: text null when missing or empty; locked when the file exists but stays unreadable.
function readSaveFile(file) {
  for (let attempt = 0; attempt <= RENAME_RETRIES; attempt += 1) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      return { text: text.trim() === '' ? null : text, locked: false };
    } catch (err) {
      if (err && err.code === 'ENOENT') return { text: null, locked: false };
      if (isBusyError(err) && attempt < RENAME_RETRIES) {
        sleepSync(RENAME_WAIT_MS);
        continue;
      }
      return { text: null, locked: true };
    }
  }
  return { text: null, locked: true };
}

// Current file first; unreadable or empty falls back to the .bak copy. Null when both fail.
function readSave(key) {
  const file = saveFile(key);
  const current = readSaveFile(file);
  if (current.text !== null) return current.text;
  const backup = readSaveFile(file + '.bak');
  if (backup.text !== null) return backup.text;
  if (current.locked) {
    lockedKeys.add(key);
    logMain('error', 'save unreadable, writes blocked for this session: ' + key);
  }
  return null;
}

function loadAllSaves() {
  const out = {};
  let names = [];
  try {
    names = fs.readdirSync(savesDir());
  } catch (_err) {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const key = name.slice(0, -'.json'.length);
    if (!isValidKey(key)) continue;
    const text = readSave(key);
    if (text !== null) out[key] = text;
  }
  return out;
}

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));

function sleepSync(ms) {
  Atomics.wait(SLEEP_CELL, 0, 0, ms);
}

function isBusyError(err) {
  return err !== null && typeof err === 'object' && (err.code === 'EPERM' || err.code === 'EBUSY');
}

function renameWithRetry(from, to, text) {
  for (let attempt = 0; attempt <= RENAME_RETRIES; attempt += 1) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      if (!isBusyError(err)) throw err;
      if (attempt < RENAME_RETRIES) sleepSync(RENAME_WAIT_MS);
    }
  }
  logMain('warn', `rename busy after ${RENAME_RETRIES} retries, direct write: ${path.basename(to)}`);
  fs.writeFileSync(to, text, 'utf8');
  fs.rmSync(from, { force: true });
}

function writeAtomic(key, text) {
  const file = saveFile(key);
  const tmp = file + '.tmp';
  fs.mkdirSync(savesDir(), { recursive: true });
  const fd = fs.openSync(tmp, 'w');
  try {
    const buf = Buffer.from(text, 'utf8');
    let off = 0;
    while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, file + '.bak');
    } catch (err) {
      logMain('warn', `backup failed for ${key}: ${errText(err)}`);
    }
  }
  renameWithRetry(tmp, file, text);
}

function setSave(key, value) {
  if (!isValidKey(key) || typeof value !== 'string') return;
  if (lockedKeys.has(key)) return;
  if (Buffer.byteLength(value, 'utf8') > SAVE_MAX_BYTES) return;
  writeAtomic(key, value);
}

function removeSave(key) {
  if (!isValidKey(key)) return;
  if (lockedKeys.has(key)) return;
  try {
    fs.unlinkSync(saveFile(key));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function flushSaves(pending) {
  if (pending === null || typeof pending !== 'object' || Array.isArray(pending)) return false;
  let ok = true;
  for (const key of Object.keys(pending)) {
    const value = pending[key];
    if (lockedKeys.has(key)) {
      ok = false;
      continue;
    }
    if (!isValidEntry(key, value)) {
      ok = false;
      continue;
    }
    try {
      if (value === null) removeSave(key);
      else writeAtomic(key, value);
    } catch (err) {
      ok = false;
      logMain('error', `flush failed for ${key}: ${errText(err)}`);
    }
  }
  return ok;
}

// 4. Window state (userData/window.json)

let mainWin = null;
let saveTimer = null;
let crashTimes = [];

// Last normal (not maximized / fullscreen / minimized) page size and window position. window.json stores this,
// because the normal-bounds API reports the OUTER size and would make the window grow by the frame on every launch.
let lastNormal = null;

function rememberNormal(win) {
  try {
    if (win.isDestroyed() || win.isMaximized() || win.isFullScreen() || win.isMinimized()) return;
    const content = win.getContentBounds();
    const outer = win.getBounds();
    lastNormal = { width: content.width, height: content.height, x: outer.x, y: outer.y };
  } catch (_err) {
    // keep the previous value
  }
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isWindowState(raw) {
  if (raw === null || typeof raw !== 'object') return false;
  return isFiniteNumber(raw.width) && raw.width >= WINDOW.minWidth
    && isFiniteNumber(raw.height) && raw.height >= WINDOW.minHeight
    && typeof raw.maximized === 'boolean'
    && typeof raw.fullscreen === 'boolean'
    && (raw.x === undefined || isFiniteNumber(raw.x))
    && (raw.y === undefined || isFiniteNumber(raw.y));
}

function defaultWindowState() {
  return {
    width: WINDOW.width,
    height: WINDOW.height,
    maximized: false,
    fullscreen: process.env.SteamDeck === '1',
  };
}

function readWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    return isWindowState(raw) ? raw : defaultWindowState();
  } catch (_err) {
    return defaultWindowState();
  }
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// Saved x/y are kept only when at least half the window sits in the matching display's work area.
function boundsFor(state) {
  const size = { width: state.width, height: state.height };
  if (!isFiniteNumber(state.x) || !isFiniteNumber(state.y)) return size;
  const rect = { x: state.x, y: state.y, width: state.width, height: state.height };
  const work = screen.getDisplayMatching(rect).workArea;
  const visible = overlapArea(rect, work);
  return visible * 2 >= rect.width * rect.height ? rect : size;
}

function persistWindowState() {
  try {
    if (!mainWin || mainWin.isDestroyed()) return;
    rememberNormal(mainWin);
    const base = lastNormal || { width: WINDOW.width, height: WINDOW.height };
    const state = {
      width: base.width,
      height: base.height,
      maximized: mainWin.isMaximized(),
      fullscreen: mainWin.isFullScreen(),
    };
    if (isFiniteNumber(base.x) && isFiniteNumber(base.y)) {
      state.x = base.x;
      state.y = base.y;
    }
    fs.mkdirSync(userDataDir(), { recursive: true });
    fs.writeFileSync(windowStatePath(), JSON.stringify(state), 'utf8');
  } catch (err) {
    logMain('warn', `window state save failed: ${errText(err)}`);
  }
}

function scheduleWindowSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistWindowState();
  }, WINDOW_SAVE_DELAY_MS);
}

function cancelWindowSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
}

// 5. Protocol: app://wedtmd/ serves the dist folder with CSP and nosniff

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
  };
}

function textResponse(status, text) {
  return new Response(text, { status, headers: securityHeaders('text/plain; charset=utf-8') });
}

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function handleAppRequest(req) {
  let url;
  try {
    url = new URL(req.url);
  } catch (_err) {
    return textResponse(400, 'Bad request');
  }
  if (url.hostname !== APP_HOST) return textResponse(404, 'Not found');
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch (_err) {
    return textResponse(400, 'Bad request');
  }
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(DIST_DIR, '.' + rel);
  if (file !== DIST_DIR && !file.startsWith(DIST_DIR + path.sep)) return textResponse(403, 'Forbidden');
  try {
    const body = await fs.promises.readFile(file);
    return new Response(body, {
      status: 200,
      headers: { ...securityHeaders(mimeFor(file)), 'cache-control': 'no-cache' },
    });
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'EISDIR')) return textResponse(404, 'Not found');
    logMain('error', `protocol read failed: ${errText(err)}`);
    return textResponse(500, 'Server error');
  }
}

// 6. Window and webContents hooks

function isAllowedExternal(url) {
  return typeof url === 'string' && EXTERNAL_ALLOW.some((prefix) => url.startsWith(prefix));
}

function openExternal(url) {
  shell.openExternal(url).catch((err) => logMain('warn', `openExternal failed: ${errText(err)}`));
}

function isBlockedInPackaged(input) {
  const k = String(input.key).toLowerCase();
  if (k === 'f5' || k === 'f12') return true;
  return input.control && (k === 'r' || (input.shift && k === 'i'));
}

function onBeforeInput(win, event, input) {
  if (input.type !== 'keyDown' || input.isAutoRepeat) return;
  const isAltEnter = input.key === 'Enter' && input.alt && !input.control && !input.meta;
  if (input.key === 'F11' || isAltEnter) {
    event.preventDefault();
    if (!win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
    return;
  }
  if ((input.control || input.meta) && (ZOOM_KEYS.has(input.key) || ZOOM_CODES.has(input.code))) {
    event.preventDefault();
    return;
  }
  if (app.isPackaged) {
    if (isBlockedInPackaged(input)) event.preventDefault();
    return;
  }
  if (input.key === 'F12') win.webContents.toggleDevTools();
}

function logConsoleMessage(event) {
  if (event.level !== 'warning' && event.level !== 'error') return;
  appendLog('renderer.log', event.level, event.message, ` (${event.sourceId}:${event.lineNumber})`);
}

function onRenderGone(win, details) {
  logMain('warn', `renderer gone: ${details.reason} exit ${details.exitCode}`);
  if (details.reason === 'clean-exit') return;
  const now = Date.now();
  crashTimes = crashTimes.filter((t) => now - t < RELOAD_WINDOW_MS);
  if (crashTimes.length < RELOAD_LIMIT) {
    crashTimes.push(now);
    if (!win.isDestroyed()) win.webContents.reload();
    return;
  }
  dialog.showErrorBox(TITLE, CRASH_TEXT);
  app.quit();
}

function hookContents(win) {
  const wc = win.webContents;
  wc.on('before-input-event', (event, input) => onBeforeInput(win, event, input));
  wc.on('did-finish-load', () => {
    wc.setVisualZoomLevelLimits(1, 1).catch(() => {});
  });
  wc.on('zoom-changed', () => wc.setZoomLevel(0));
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_PREFIX)) event.preventDefault();
  });
  wc.on('render-process-gone', (_event, details) => onRenderGone(win, details));
  wc.on('console-message', (event) => logConsoleMessage(event));
  wc.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === ERR_ABORTED) return;
    logMain('error', `did-fail-load ${code} ${desc} ${url}`);
    dialog.showErrorBox(TITLE, LOAD_FAIL_TEXT);
    app.quit();
  });
}

function onFullscreenChanged(win, on) {
  if (!win.isDestroyed()) win.webContents.send('host:fullscreen', on);
  scheduleWindowSave();
}

function hookWindow(win) {
  win.on('enter-full-screen', () => onFullscreenChanged(win, true));
  win.on('leave-full-screen', () => onFullscreenChanged(win, false));
  win.on('resize', () => {
    rememberNormal(win);
    scheduleWindowSave();
  });
  win.on('move', () => {
    rememberNormal(win);
    scheduleWindowSave();
  });
  win.on('close', () => {
    cancelWindowSave();
    persistWindowState();
  });
  win.on('closed', () => {
    if (mainWin === win) mainWin = null;
    cancelWindowSave();
  });
}

function createWindow() {
  const state = readWindowState();
  const bounds = boundsFor(state);
  lastNormal = { ...bounds };
  const win = new BrowserWindow({
    ...bounds,
    // width/height/min sizes are the page area, so the 1280x720 canvas is not shrunk by the window frame.
    useContentSize: true,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    backgroundColor: BG,
    show: false,
    title: TITLE,
    icon: path.join(__dirname, 'icon.png'),
    fullscreen: state.fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  });
  mainWin = win;
  let revealed = false;
  let revealTimer = null;
  const reveal = (why) => {
    if (revealed || win.isDestroyed()) return;
    revealed = true;
    if (revealTimer !== null) clearTimeout(revealTimer);
    if (why !== 'ready-to-show') logMain('warn', `window shown by ${why}`);
    if (state.maximized) win.maximize();
    win.show();
    rememberNormal(win);
  };
  win.once('ready-to-show', () => reveal('ready-to-show'));
  revealTimer = setTimeout(() => reveal('timeout'), SHOW_FALLBACK_MS);
  win.once('closed', () => {
    if (revealTimer !== null) clearTimeout(revealTimer);
  });
  hookWindow(win);
  hookContents(win);
  const debug = !app.isPackaged && process.env.WEDTMD_DEBUG === '1';
  win.loadURL(START_URL + (debug ? '?debug=1' : '')).catch((err) => {
    logMain('error', `loadURL failed: ${errText(err)}`);
  });
  return win;
}

function focusMainWindow() {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.focus();
}

// 7. IPC (every handler checks the sender frame is the app origin; handlers never throw)

function isAppSender(event) {
  try {
    const frame = event.senderFrame;
    return Boolean(frame) && typeof frame.url === 'string' && frame.url.startsWith(APP_PREFIX);
  } catch (_err) {
    return false;
  }
}

function handleSync(channel, fallback, fn) {
  ipcMain.on(channel, (event, ...args) => {
    let value = fallback;
    try {
      if (isAppSender(event)) value = fn(...args);
    } catch (err) {
      logMain('error', `${channel} failed: ${errText(err)}`);
    }
    event.returnValue = value;
  });
}

function handleAsync(channel, fn) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isAppSender(event)) return;
    try {
      fn(...args);
    } catch (err) {
      logMain('error', `${channel} failed: ${errText(err)}`);
    }
  });
}

function registerIpc() {
  handleSync('host:info', null, () => ({
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));
  handleSync('storage:loadAll', null, () => loadAllSaves());
  handleAsync('storage:set', (key, value) => setSave(key, value));
  handleAsync('storage:remove', (key) => removeSave(key));
  handleSync('storage:flush', false, (pending) => flushSaves(pending));
  handleAsync('host:quit', () => {
    persistWindowState();
    app.quit();
  });
  handleAsync('host:openExternal', (url) => {
    if (isAllowedExternal(url)) openExternal(url);
  });
  handleAsync('host:setFullscreen', (on) => {
    if (mainWin && !mainWin.isDestroyed()) mainWin.setFullScreen(Boolean(on));
  });
  handleSync('host:isFullscreen', false, () => Boolean(mainWin && !mainWin.isDestroyed() && mainWin.isFullScreen()));
}

// 8. Startup

function setUserData() {
  const custom = process.env.WEDTMD_USER_DATA;
  if (custom && path.isAbsolute(custom)) {
    app.setPath('userData', custom);
    return;
  }
  const dir = USER_DIR + (app.isPackaged ? '' : '-dev');
  app.setPath('userData', path.join(app.getPath('appData'), dir));
}

function onReady() {
  protocol.handle('app', handleAppRequest);
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  Menu.setApplicationMenu(null);
  registerIpc();
  createWindow();
}

process.on('uncaughtException', (err) => {
  logMain('error', `uncaught: ${errText(err)}`);
});

setUserData();
app.setAppUserModelId(APP_USER_MODEL_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
  ]);
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(onReady).catch((err) => {
    logMain('error', `startup failed: ${errText(err)}`);
    app.quit();
  });
}
