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

  // ── Gemini AI ────────────────────────────────────────────────────────
  geminiSetKey:      (key)  => ipcRenderer.invoke('gemini:set-key', key),
  geminiGetKey:      ()     => ipcRenderer.invoke('gemini:get-key'),
  geminiValidateKey: (key)  => ipcRenderer.invoke('gemini:validate-key', key),
  geminiGenerate:    (opts) => ipcRenderer.invoke('gemini:generate', opts),

  // ── Typing Paragraphs Library ────────────────────────────────────────
  getParagraphs:      ()       => ipcRenderer.invoke('typing:get-paragraphs'),
  saveParagraph:      (data)   => ipcRenderer.invoke('typing:save-paragraph', data),
  deleteParagraph:    (id)     => ipcRenderer.invoke('typing:delete-paragraph', id),
  useParagraph:       (id)     => ipcRenderer.invoke('typing:use-paragraph', id),
  exportParagraphs:   ()       => ipcRenderer.invoke('typing:export-paragraphs'),
  importParagraphs:   ()       => ipcRenderer.invoke('typing:import-paragraphs'),

  // ── Typing Sessions (Analytics) ──────────────────────────────────────
  logTypingSession:     (data)  => ipcRenderer.invoke('typing:log-session', data),
  getTypingSessions:    (limit) => ipcRenderer.invoke('typing:get-sessions', limit),
  getTypingPersonalBest:()      => ipcRenderer.invoke('typing:get-best'),
  getTypingStats:       ()      => ipcRenderer.invoke('typing:get-stats'),
  getTypingTrend:       (limit) => ipcRenderer.invoke('typing:get-trend', limit),
  getTypingByDifficulty:()      => ipcRenderer.invoke('typing:get-by-diff'),

  // ── Key Layout Overrides ─────────────────────────────────────────────
  getKeyOverrides:   () => ipcRenderer.invoke('keylayout:get-overrides'),
  setKeyOverride:    (data) => ipcRenderer.invoke('keylayout:set-override', data),
  resetKeyOverrides: () => ipcRenderer.invoke('keylayout:reset-all'),
  pickOverrideFile:  () => ipcRenderer.invoke('keylayout:pick-file'),

  // ── Window Controls ──────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  close:    () => ipcRenderer.send('window:close'),

  // ── Events: main → renderer ──────────────────────────────────────────
  onPlaySound: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('sound:play', handler)
    return () => ipcRenderer.removeListener('sound:play', handler)
  },

  onKeyLayoutDown: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('keylayout:keydown', handler)
    return () => ipcRenderer.removeListener('keylayout:keydown', handler)
  },

  onKeyLayoutUp: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('keylayout:keyup', handler)
    return () => ipcRenderer.removeListener('keylayout:keyup', handler)
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
