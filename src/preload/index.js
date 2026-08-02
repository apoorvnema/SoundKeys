const { contextBridge, ipcRenderer } = require('electron')

/**
 * Preload script — exposes a safe, typed API to the renderer via window.soundkeys
 */
contextBridge.exposeInMainWorld('soundkeys', {
  // ── Settings ─────────────────────────────────────────────────────────
  getSettings: ()        => ipcRenderer.invoke('settings:get'),
  setSettings: (updates) => ipcRenderer.invoke('settings:set', updates),

  // ── Themes ───────────────────────────────────────────────────────────
  listThemes:     ()        => ipcRenderer.invoke('theme:list'),
  getCurrentTheme:()        => ipcRenderer.invoke('theme:current'),
  switchTheme:    (id)      => ipcRenderer.invoke('theme:switch', id),
  createTheme:    (data)    => ipcRenderer.invoke('theme:create', data),
  updateTheme:    (id, data)=> ipcRenderer.invoke('theme:update', { id, ...data }),
  deleteTheme:    (id)      => ipcRenderer.invoke('theme:delete', id),
  getThemeConfig: (id)      => ipcRenderer.invoke('theme:get-config', id),

  // ── Analytics ────────────────────────────────────────────────────────
  getAnalyticsSummary: ()            => ipcRenderer.invoke('analytics:summary'),
  getAnalyticsHourly:  (dateStr)     => ipcRenderer.invoke('analytics:hourly', dateStr),
  getAnalyticsDaily:   (days)        => ipcRenderer.invoke('analytics:daily', days),
  getAnalyticsTopKeys: (limit)       => ipcRenderer.invoke('analytics:top-keys', limit),
  getAnalyticsHeatmap: ()            => ipcRenderer.invoke('analytics:heatmap'),
  getAnalyticsDbSize:  ()            => ipcRenderer.invoke('analytics:db-size'),
  purgeAnalyticsData:  (beforeDate)  => ipcRenderer.invoke('analytics:purge', beforeDate),
  exportAnalyticsCSV:  ()            => ipcRenderer.invoke('analytics:export'),

  // ── Unified Data Directory ───────────────────────────────────────────
  getDataDir:          ()      => ipcRenderer.invoke('datadir:get'),
  getDefaultDataDir:   ()      => ipcRenderer.invoke('datadir:default-path'),
  selectDataDir:       ()      => ipcRenderer.invoke('datadir:select'),
  changeDataDir:       (path)  => ipcRenderer.invoke('datadir:change', path),

  // ── Window Controls ──────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  close:    () => ipcRenderer.send('window:close'),

  // ── Events: main → renderer ──────────────────────────────────────────
  onPlaySound: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('sound:play', handler)
    return () => ipcRenderer.removeListener('sound:play', handler)
  },

  onThemeChanged: (cb) => {
    const handler = (_, theme) => cb(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },

  onSettingsUpdated: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('settings:updated', handler)
    return () => ipcRenderer.removeListener('settings:updated', handler)
  },

  onDataDirChanged: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('datadir:changed', handler)
    return () => ipcRenderer.removeListener('datadir:changed', handler)
  }
})
