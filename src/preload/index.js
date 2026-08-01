const { contextBridge, ipcRenderer } = require('electron')

/**
 * Preload script — exposes a safe, typed API to the renderer
 * via window.soundkeys (contextBridge).
 */
contextBridge.exposeInMainWorld('soundkeys', {
  // ── Settings ─────────────────────────────────────────────────────────
  getSettings: ()        => ipcRenderer.invoke('settings:get'),
  setSettings: (updates) => ipcRenderer.invoke('settings:set', updates),

  // ── Themes ───────────────────────────────────────────────────────────
  listThemes:     ()       => ipcRenderer.invoke('theme:list'),
  getCurrentTheme:()       => ipcRenderer.invoke('theme:current'),
  switchTheme:    (id)     => ipcRenderer.invoke('theme:switch', id),

  // ── Window Controls ──────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  close:    () => ipcRenderer.send('window:close'),

  // ── Events: main → renderer ──────────────────────────────────────────
  /** Called when a key is pressed and a sound should play */
  onPlaySound: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('sound:play', handler)
    return () => ipcRenderer.removeListener('sound:play', handler)
  },

  /** Called when the active theme changes (e.g., via tray menu) */
  onThemeChanged: (cb) => {
    const handler = (_, theme) => cb(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },

  /** Called when settings change externally (e.g., mute via tray) */
  onSettingsUpdated: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('settings:updated', handler)
    return () => ipcRenderer.removeListener('settings:updated', handler)
  }
})
