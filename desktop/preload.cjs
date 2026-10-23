// Sandboxed preload for the Electron host shell.
// Exposes window.wedtmdHost to the game page through contextBridge (only contextBridge and ipcRenderer are used).
// Channel names ('host:*', 'storage:*') are the contract with desktop/main.cjs; keep both sides in sync.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('host:info') || {};

contextBridge.exposeInMainWorld('wedtmdHost', {
  kind: 'electron',
  version: String(info.version || '0.0.0'),
  platform: String(info.platform || ''),
  isPackaged: info.isPackaged === true,
  storage: {
    loadAll: () => ipcRenderer.sendSync('storage:loadAll') || {},
    set: (key, value) => ipcRenderer.send('storage:set', String(key), String(value)),
    remove: (key) => ipcRenderer.send('storage:remove', String(key)),
    flush: (pending) => ipcRenderer.sendSync('storage:flush', pending) === true,
  },
  openExternal: (url) => ipcRenderer.send('host:openExternal', String(url)),
  quit: () => ipcRenderer.send('host:quit'),
  setFullscreen: (on) => ipcRenderer.send('host:setFullscreen', on === true),
  isFullscreen: () => ipcRenderer.sendSync('host:isFullscreen') === true,
  onFullscreenChange: (cb) => {
    const l = (_e, on) => cb(on === true);
    ipcRenderer.on('host:fullscreen', l);
    return () => ipcRenderer.removeListener('host:fullscreen', l);
  },
});
