/**
 * SoundKeys — Main Process
 *
 * Full featured desktop shell:
 * - System tray with green/red status indicator & keypress pulse
 * - Global keyhook via uiohook-napi
 * - Configurable hotkeys, taskbar visibility, autostart, and close behavior
 * - Custom app icon (replaces default Electron logo)
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
    activeTheme:          { type: 'string',  default: 'default' },
    volume:               { type: 'number',  minimum: 0, maximum: 1, default: 0.7 },
    muted:                { type: 'boolean', default: false },
    autoLaunch:           { type: 'boolean', default: false },
    mouseSounds:          { type: 'boolean', default: false },
    globalToggleHotkey:   { type: 'string',  default: 'CommandOrControl+Shift+S' },
    hideInTaskbar:        { type: 'boolean', default: false },
    closeAppAction:       { type: 'string',  default: 'tray' }, // 'tray' | 'quit'
    dynamicTrayIndicator: { type: 'boolean', default: true }
  }
})

// ─── Windows Auto-Launch Handler ──────────────────────────────────────────
function setAutoLaunch(enabled) {
  try {
    const exePath = app.getPath('exe')
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,          // start minimised to tray, no window flash
      path: exePath,
      args: ['--hidden']           // custom flag (no-op, helps identify startup)
    })
    store.set('autoLaunch', Boolean(enabled))
    console.log(`[Main] Windows auto-launch set to ${enabled} → ${exePath}`)
    // Also update tray menu label so it reflects new state
    updateTrayMenu()
  } catch (err) {
    console.error('[Main] Failed to update auto-launch:', err.message)
  }
}

// ─── Theme Manager (inline) ───────────────────────────────────────────────
function getSoundsBasePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'sounds')
    : path.join(process.cwd(), 'sounds')
}

function listThemes() {
  const themesDir = path.join(getSoundsBasePath(), 'themes')
  try {
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true })
    }
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
  const themeDir      = path.join(getSoundsBasePath(), 'themes', themeId)
  const themeJsonPath = path.join(themeDir, 'theme.json')
  try {
    const config = JSON.parse(fs.readFileSync(themeJsonPath, 'utf-8'))
    return { id: themeId, basePath: themeDir, ...config }
  } catch (err) {
    console.error(`[ThemeManager] Cannot load theme '${themeId}':`, err.message)
    return null
  }
}

function createCustomTheme({ id, name, author, description, filesMap }) {
  const cleanId  = (id || name).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const themeDir = path.join(getSoundsBasePath(), 'themes', cleanId)
  if (!fs.existsSync(themeDir)) {
    fs.mkdirSync(themeDir, { recursive: true })
  }

  const themeConfig = {
    name: name || 'Custom Theme',
    author: author || 'Apoorv Nema',
    description: description || 'Custom user sound pack',
    typing: []
  }

  // Save wav files
  for (const [key, fileData] of Object.entries(filesMap)) {
    if (!fileData) continue
    if (key.startsWith('typing')) {
      const fileName = `${key}.wav`
      const filePath = path.join(themeDir, fileName)
      fs.writeFileSync(filePath, Buffer.from(fileData))
      themeConfig.typing.push(fileName)
    } else {
      const fileName = `${key}.wav`
      const filePath = path.join(themeDir, fileName)
      fs.writeFileSync(filePath, Buffer.from(fileData))
      themeConfig[key] = fileName
    }
  }

  if (themeConfig.typing.length === 0) {
    themeConfig.typing = ['typing_1.wav']
  }

  fs.writeFileSync(path.join(themeDir, 'theme.json'), JSON.stringify(themeConfig, null, 2))
  return cleanId
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
let activeModifiers = { ctrl: false, shift: false, alt: false }

function checkHotkeyMatch(keycode) {
  const targetHotkey = (store.get('globalToggleHotkey') || 'Ctrl+Shift+S').toUpperCase()

  const needCtrl  = targetHotkey.includes('CTRL') || targetHotkey.includes('COMMANDORCONTROL')
  const needShift = targetHotkey.includes('SHIFT')
  const needAlt   = targetHotkey.includes('ALT')

  if (needCtrl !== activeModifiers.ctrl) return false
  if (needShift !== activeModifiers.shift) return false
  if (needAlt !== activeModifiers.alt) return false

  // Parse target key char from hotkey string (e.g., 'S' from 'Ctrl+Shift+S')
  const parts = targetHotkey.split('+')
  const keyChar = parts[parts.length - 1]

  // Keycode mappings for common shortcut keys
  const keycodeMap = {
    'S': 31, 'M': 50, 'K': 37, 'A': 30, 'B': 48, 'C': 46, 'D': 32, 'E': 18,
    'F': 33, 'G': 34, 'H': 35, 'I': 23, 'J': 36, 'L': 38, 'N': 49, 'O': 24,
    'P': 25, 'Q': 16, 'R': 19, 'T': 20, 'U': 22, 'V': 47, 'W': 17, 'X': 45,
    'Y': 21, 'Z': 44, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7,
    '7': 8, '8': 9, '9': 10, '0': 11, 'SPACE': 57
  }

  const targetCode = keycodeMap[keyChar]
  return targetCode ? keycode === targetCode : false
}

function startKeyHook(onKeyPress) {
  try {
    const { uIOhook } = require('uiohook-napi')
    hookInstance = uIOhook

    uIOhook.on('keydown', (event) => {
      // Track modifiers
      if (event.keycode === 29 || event.keycode === 285) activeModifiers.ctrl  = true
      if (event.keycode === 42 || event.keycode === 54)  activeModifiers.shift = true
      if (event.keycode === 56 || event.keycode === 312) activeModifiers.alt   = true

      // Check global shortcut match in uiohook
      if (checkHotkeyMatch(event.keycode)) {
        console.log('[KeyHook] Global hotkey intercepted via uiohook!')
        toggleMute()
        return
      }

      const soundType = getSoundType(event.keycode)
      if (soundType) onKeyPress({ soundType, keycode: event.keycode })
    })

    uIOhook.on('keyup', (event) => {
      if (event.keycode === 29 || event.keycode === 285) activeModifiers.ctrl  = false
      if (event.keycode === 42 || event.keycode === 54)  activeModifiers.shift = false
      if (event.keycode === 56 || event.keycode === 312) activeModifiers.alt   = false
    })

    uIOhook.start()
    hookRunning = true
    console.log('[KeyHook] Global key hook listening')
  } catch (err) {
    console.error('[KeyHook] Failed to start uiohook-napi:', err.message)
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
let trayPulseTimer = null

// ─── Tray & App Window Icon ────────────────────────────────────────────────
function makeAppIcon() {
  // Works in both dev (cwd = project root) and packaged (resources dir)
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),          // dev: src/main -> project root
    path.join(process.resourcesPath || '', 'app/build/icon.png'), // packaged asar
    path.join(process.cwd(), 'build/icon.png'),            // fallback cwd
    path.join(__dirname, '../../../build/icon.png')        // extra fallback
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return nativeImage.createFromPath(p)
  }
  return makeTrayIcon('active') // last-resort generated icon
}

/** Build a small overlay badge (green dot = active, red dot = muted) */
function makeOverlayIcon(state = 'active') {
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2 - 1
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size), o = i * 4
    const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    if (d <= r) {
      if (state === 'active') {
        // Green #22c55e (BGRA: B=94, G=197, R=34)
        buf[o]   = 94
        buf[o+1] = 197
        buf[o+2] = 34
      } else {
        // Red #ef4444 (BGRA: B=68, G=68, R=239)
        buf[o]   = 68
        buf[o+1] = 68
        buf[o+2] = 239
      }
      buf[o+3] = 255
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

/** Apply/remove the taskbar overlay badge on the main window */
function updateWindowOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (isMuted) {
    mainWindow.setOverlayIcon(makeOverlayIcon('muted'), 'Muted')
  } else {
    mainWindow.setOverlayIcon(makeOverlayIcon('active'), 'Active')
  }
}

function makeTrayIcon(state = 'active') { // 'active' | 'muted' | 'pulse'
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2 - 1

  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size), o = i * 4
    const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)

    if (d <= r) {
      if (state === 'active') {
        // Vibrant Green #22c55e (BGRA: B=94, G=197, R=34)
        buf[o]   = 94
        buf[o+1] = 197
        buf[o+2] = 34
      } else if (state === 'pulse') {
        // Bright Neon Green #4ade80 (BGRA: B=128, G=222, R=74)
        buf[o]   = 128
        buf[o+1] = 222
        buf[o+2] = 74
      } else {
        // Red #ef4444 (Muted) (BGRA: B=68, G=68, R=239)
        buf[o]   = 68
        buf[o+1] = 68
        buf[o+2] = 239
      }
      buf[o+3] = 255
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

function flashTrayPulse() {
  if (isMuted || !tray || !store.get('dynamicTrayIndicator')) return
  tray.setImage(makeTrayIcon('pulse'))
  if (trayPulseTimer) clearTimeout(trayPulseTimer)
  trayPulseTimer = setTimeout(() => {
    if (tray && !isMuted) tray.setImage(makeTrayIcon('active'))
  }, 120)
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
  updateWindowOverlay()   // ← update taskbar badge (red/green dot)
  sendToRenderer('settings:updated', { muted: isMuted })
  console.log(`[Main] Mute toggled: ${isMuted}`)
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
  tray = new Tray(makeTrayIcon(isMuted ? 'muted' : 'active'))
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

  const autoLaunchEnabled    = store.get('autoLaunch') || false
  const dynTrayEnabled       = store.get('dynamicTrayIndicator') !== false

  const menu = Menu.buildFromTemplate([
    { label: isMuted ? '▶  Unmute Sounds' : '🔇  Mute Sounds', click: toggleMute },
    { type: 'separator' },
    {
      label: 'Sound Themes',
      submenu: themeSubmenu.length > 0
        ? themeSubmenu
        : [{ label: 'No themes found', enabled: false }]
    },
    { type: 'separator' },
    // ── Quick Settings ──────────────────────────────────────
    {
      label: autoLaunchEnabled ? '✅  Start with Windows (On)' : '⬜  Start with Windows (Off)',
      click: () => setAutoLaunch(!autoLaunchEnabled)
    },
    {
      label: dynTrayEnabled ? '✅  Dynamic Status Icon (On)' : '⬜  Dynamic Status Icon (Off)',
      click: () => {
        const newVal = !dynTrayEnabled
        store.set('dynamicTrayIndicator', newVal)
        sendToRenderer('settings:updated', { dynamicTrayIndicator: newVal })
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    { label: '⚙  Open SoundKeys', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit SoundKeys', click: () => { app.isQuitting = true; app.quit() } }
  ])

  tray?.setContextMenu(menu)
  tray?.setImage(makeTrayIcon(isMuted ? 'muted' : 'active'))
  tray?.setToolTip(`SoundKeys — ${isMuted ? 'Muted 🔴' : 'Active 🟢'}`)
}

// ─── Window ───────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js')
  const hideTaskbar = store.get('hideInTaskbar') || false

  mainWindow = new BrowserWindow({
    width: 920, height: 660,
    minWidth: 800, minHeight: 560,
    frame: false,
    icon: makeAppIcon(),
    skipTaskbar: hideTaskbar,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    show: false,
    resizable: true
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (event) => {
    const action = store.get('closeAppAction') || 'tray'
    if (action === 'quit' || app.isQuitting) {
      // allow window to close and app to quit
    } else {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('settings:get', () => ({
    activeTheme:          store.get('activeTheme'),
    volume:               store.get('volume'),
    muted:                store.get('muted'),
    autoLaunch:           store.get('autoLaunch'),
    mouseSounds:          store.get('mouseSounds'),
    globalToggleHotkey:   store.get('globalToggleHotkey'),
    hideInTaskbar:        store.get('hideInTaskbar'),
    closeAppAction:       store.get('closeAppAction'),
    dynamicTrayIndicator: store.get('dynamicTrayIndicator')
  }))

  ipcMain.handle('settings:set', (_, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      store.set(key, value)
      if (key === 'muted') {
        isMuted = value
        updateTrayMenu()
        updateWindowOverlay()
      } else if (key === 'hideInTaskbar') {
        mainWindow?.setSkipTaskbar(value)
      } else if (key === 'autoLaunch') {
        setAutoLaunch(value)
      } else if (key === 'globalToggleHotkey') {
        registerGlobalShortcut(value)
      }
    }
    return true
  })

  ipcMain.handle('theme:list',    ()      => listThemes())
  ipcMain.handle('theme:current', ()      => serializeTheme(currentTheme))
  ipcMain.handle('theme:switch',  (_, id) => {
    switchTheme(id)
    return serializeTheme(currentTheme)
  })

  ipcMain.handle('theme:create', (_, themeData) => {
    const newId = createCustomTheme(themeData)
    switchTheme(newId)
    return listThemes()
  })

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:close',    () => {
    const action = store.get('closeAppAction') || 'tray'
    if (action === 'quit') {
      app.isQuitting = true
      app.quit()
    } else {
      mainWindow?.hide()
    }
  })
}

// ─── Global Shortcuts ─────────────────────────────────────────────────────
function normalizeHotkey(str) {
  if (!str) return 'CommandOrControl+Shift+S'
  return str
    .replace(/^Ctrl\+/i, 'CommandOrControl+')
    .replace(/\+Ctrl\+/i, '+CommandOrControl+')
    .replace(/\+Ctrl$/i, '+CommandOrControl')
}

function registerGlobalShortcut(hotkeyStr) {
  globalShortcut.unregisterAll()
  if (!hotkeyStr) hotkeyStr = 'Ctrl+Shift+S'

  const candidates = [
    normalizeHotkey(hotkeyStr),
    hotkeyStr,
    hotkeyStr.replace(/Ctrl/gi, 'Control')
  ]

  let registered = false
  for (const combo of candidates) {
    try {
      if (globalShortcut.register(combo, () => toggleMute())) {
        console.log(`[Main] Global hotkey registered successfully: ${combo}`)
        registered = true
        break
      }
    } catch (err) {
      console.warn(`[Main] Could not register hotkey candidate '${combo}':`, err.message)
    }
  }

  if (!registered) {
    console.warn(`[Main] Electron globalShortcut registration fell back to uiohook listener for '${hotkeyStr}'`)
  }
  return registered
}

// ─── App Lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  isMuted = store.get('muted') || false

  // Apply autoLaunch on startup
  const autoLaunchConfig = store.get('autoLaunch') || false
  setAutoLaunch(autoLaunchConfig)

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
  registerGlobalShortcut(store.get('globalToggleHotkey'))

  // Apply taskbar overlay badge after window is ready
  mainWindow.once('ready-to-show', () => {
    updateWindowOverlay()
  })

  // Key hook sends sounds & flashes tray green
  setTimeout(startKeyHook.bind(null, ({ soundType, keycode }) => {
    if (isMuted) return
    flashTrayPulse()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sound:play', { soundType, keycode })
    }
  }), 1200)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray unless closeAppAction === 'quit'
})

app.on('before-quit', () => {
  stopKeyHook()
  globalShortcut.unregisterAll()
})
