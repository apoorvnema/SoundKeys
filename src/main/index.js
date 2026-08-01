/**
 * SoundKeys — Main Process (consolidated single file)
 *
 * All logic is in one file to avoid electron-vite's automatic
 * externalization of local require() calls.
 */

const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, globalShortcut
} = require('electron')
const path = require('path')
const fs   = require('fs')

// ─── Settings Store (inline) ──────────────────────────────────────────────
const Store = require('electron-store')
const store = new Store({
  schema: {
    activeTheme:        { type: 'string',  default: 'default' },
    volume:             { type: 'number',  minimum: 0, maximum: 1, default: 0.7 },
    muted:              { type: 'boolean', default: false },
    autoLaunch:         { type: 'boolean', default: false },
    mouseSounds:        { type: 'boolean', default: false },
    globalToggleHotkey: { type: 'string',  default: 'Ctrl+Shift+S' }
  }
})

// ─── Theme Manager (inline) ───────────────────────────────────────────────
function getSoundsBasePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'sounds')
    : path.join(process.cwd(), 'sounds')
}

function listThemes() {
  const themesDir = path.join(getSoundsBasePath(), 'themes')
  try {
    return fs.readdirSync(themesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const themeJsonPath = path.join(themesDir, e.name, 'theme.json')
        try {
          const config = JSON.parse(fs.readFileSync(themeJsonPath, 'utf-8'))
          return { id: e.name, ...config }
        } catch {
          return { id: e.name, name: e.name }
        }
      })
  } catch (err) {
    console.error('[ThemeManager] Cannot list themes:', err.message)
    return []
  }
}

function loadTheme(themeId) {
  const themeDir     = path.join(getSoundsBasePath(), 'themes', themeId)
  const themeJsonPath = path.join(themeDir, 'theme.json')
  try {
    const config = JSON.parse(fs.readFileSync(themeJsonPath, 'utf-8'))
    return { id: themeId, basePath: themeDir, ...config }
  } catch (err) {
    console.error(`[ThemeManager] Cannot load theme '${themeId}':`, err.message)
    return null
  }
}

// ─── Key Hook (inline) ────────────────────────────────────────────────────
const MODIFIER_KEYS = new Set([42, 54, 29, 285, 56, 312, 347, 348, 58])
const FUNCTION_KEYS = new Set([59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 87, 88])

function getSoundType(keycode) {
  if (MODIFIER_KEYS.has(keycode)) return null
  switch (keycode) {
    case 57:  return 'spacebar'
    case 28:
    case 284: return 'enter'
    case 14:  return 'backspace'
    case 1:   return 'escape'
    case 15:  return 'tab'
    default:
      return FUNCTION_KEYS.has(keycode) ? 'functionKeys' : 'typing'
  }
}

let hookInstance = null
let hookRunning  = false

function startKeyHook(onKeyPress) {
  try {
    const { uIOhook } = require('uiohook-napi')
    hookInstance = uIOhook
    uIOhook.on('keydown', (event) => {
      const soundType = getSoundType(event.keycode)
      if (soundType) onKeyPress({ soundType, keycode: event.keycode })
    })
    uIOhook.start()
    hookRunning = true
    console.log('[KeyHook] Started — listening for global key events')
  } catch (err) {
    console.error('[KeyHook] Failed to start uiohook-napi:', err.message)
    console.warn('[KeyHook] Run "npm run rebuild" if this persists')
  }
}

function stopKeyHook() {
  if (hookInstance && hookRunning) {
    try { hookInstance.stop() } catch (_) {}
    hookRunning = false
  }
}

// ─── App State ────────────────────────────────────────────────────────────
let mainWindow   = null
let tray         = null
let currentTheme = null
let isMuted      = false

// ─── Tray Icon (programmatic RGBA circle — no external files needed) ──────
function makeTrayIcon(active) {
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2 - 1

  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size), o = i * 4
    const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    if (d <= r) {
      if (active) { buf[o]=147; buf[o+1]=51;  buf[o+2]=234 } // purple
      else        { buf[o]=80;  buf[o+1]=80;  buf[o+2]=80  } // gray
      buf[o+3] = 255
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function serializeTheme(theme) {
  return theme ? { ...theme } : null
}

// ─── Mute Toggle ─────────────────────────────────────────────────────────
function toggleMute() {
  isMuted = !isMuted
  store.set('muted', isMuted)
  updateTrayMenu()
  sendToRenderer('settings:updated', { muted: isMuted })
  console.log(`[Main] Sound ${isMuted ? 'muted' : 'unmuted'}`)
}

// ─── Theme Switch ─────────────────────────────────────────────────────────
function switchTheme(themeId) {
  const theme = loadTheme(themeId)
  if (!theme) return console.error(`[Main] Theme '${themeId}' not found`)
  currentTheme = theme
  store.set('activeTheme', themeId)
  updateTrayMenu()
  sendToRenderer('theme:changed', serializeTheme(theme))
  console.log(`[Main] Theme → ${theme.name || themeId}`)
}

// ─── Tray ─────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(makeTrayIcon(!isMuted))
  tray.setToolTip('SoundKeys')
  tray.on('click', toggleMute)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  updateTrayMenu()
}

function updateTrayMenu() {
  const themes = listThemes()
  const themeSubmenu = themes.map(t => ({
    label:   t.name || t.id,
    type:    'radio',
    checked: !!(currentTheme && currentTheme.id === t.id),
    click:   () => switchTheme(t.id)
  }))

  const menu = Menu.buildFromTemplate([
    { label: isMuted ? '▶  Unmute' : '🔇  Mute', click: toggleMute },
    { type: 'separator' },
    {
      label: 'Themes',
      submenu: themeSubmenu.length > 0
        ? themeSubmenu
        : [{ label: 'No themes found', enabled: false }]
    },
    { type: 'separator' },
    { label: '⚙  Open SoundKeys', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } }
  ])

  tray?.setContextMenu(menu)
  tray?.setImage(makeTrayIcon(!isMuted))
  tray?.setToolTip(`SoundKeys — ${isMuted ? 'Muted' : 'Active'}`)
}

// ─── Window ───────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 900, height: 640,
    minWidth: 800, minHeight: 560,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false   // required for file:// audio loading in Howler.js
    },
    show: false,
    resizable: true
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) { event.preventDefault(); mainWindow.hide() }
  })
}

// ─── IPC ─────────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('settings:get', () => ({
    activeTheme:        store.get('activeTheme'),
    volume:             store.get('volume'),
    muted:              store.get('muted'),
    autoLaunch:         store.get('autoLaunch'),
    mouseSounds:        store.get('mouseSounds'),
    globalToggleHotkey: store.get('globalToggleHotkey')
  }))

  ipcMain.handle('settings:set', (_, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      store.set(key, value)
      if (key === 'muted') { isMuted = value; updateTrayMenu() }
    }
    return true
  })

  ipcMain.handle('theme:list',    ()      => listThemes())
  ipcMain.handle('theme:current', ()      => serializeTheme(currentTheme))
  ipcMain.handle('theme:switch',  (_, id) => {
    switchTheme(id)
    return serializeTheme(currentTheme)
  })

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:close',    () => mainWindow?.hide())
}

// ─── Global Shortcuts ─────────────────────────────────────────────────────
function setupShortcuts() {
  const hotkey = store.get('globalToggleHotkey') || 'Ctrl+Shift+S'
  try {
    globalShortcut.register(hotkey, toggleMute)
    console.log(`[Main] Shortcut: ${hotkey}`)
  } catch (err) {
    console.error('[Main] Shortcut failed:', err.message)
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  isMuted = store.get('muted') || false

  // Load active theme
  const savedId = store.get('activeTheme') || 'default'
  currentTheme  = loadTheme(savedId)
  if (!currentTheme) {
    const all = listThemes()
    if (all.length > 0) currentTheme = loadTheme(all[0].id)
  }

  createWindow()
  createTray()
  setupIPC()
  setupShortcuts()

  // Start key hook after renderer has had time to initialise Howler
  setTimeout(startKeyHook.bind(null, ({ soundType, keycode }) => {
    if (isMuted || !mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('sound:play', { soundType, keycode })
  }), 1500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => { /* keep running in tray */ })

app.on('before-quit', () => {
  stopKeyHook()
  globalShortcut.unregisterAll()
})
