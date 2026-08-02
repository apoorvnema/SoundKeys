/**
 * SoundKeys — Main Process (v2.0.0)
 *
 * Full featured desktop shell:
 * - System tray with status indicator & keypress pulse
 * - Global keyhook via uiohook-napi
 * - Unified Data Directory (sounds, settings, analytics DB)
 * - SQLite Analytics Engine (sql.js inline)
 * - Theme CRUD & Multi-sound typing support
 * - Typing Test with Gemini AI paragraph generation
 */

const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, globalShortcut, dialog
} = require('electron')
const path  = require('path')
const fs    = require('fs')
const https = require('https')
const Store = require('electron-store')
const initSqlJs = require('sql.js/dist/sql-asm.js')

// ─── Inline SQLite Analytics Engine ──────────────────────────────────────
class AnalyticsDB {
  constructor() {
    this.db = null
    this.dbPath = null
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    this.dirty = false
    this.saveInterval = null
  }

  async init(dbPath) {
    this.dbPath = dbPath
    const SQL = await initSqlJs()

    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (fs.existsSync(dbPath)) {
      try {
        const filebuffer = fs.readFileSync(dbPath)
        this.db = new SQL.Database(filebuffer)
      } catch (e) {
        console.warn('[AnalyticsDB] Could not read existing DB file, starting fresh:', e.message)
        this.db = new SQL.Database()
      }
    } else {
      this.db = new SQL.Database()
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS keystrokes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        keycode INTEGER NOT NULL,
        key_name TEXT NOT NULL,
        sound_type TEXT NOT NULL,
        session_id TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_keystrokes_ts ON keystrokes(timestamp);
      CREATE INDEX IF NOT EXISTS idx_keystrokes_key ON keystrokes(key_name);

      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY,
        total_keys INTEGER DEFAULT 0,
        typing_chars INTEGER DEFAULT 0,
        peak_wpm INTEGER DEFAULT 0,
        active_minutes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS typing_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        wpm INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        chars_correct INTEGER NOT NULL,
        chars_total INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        mode TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        category TEXT,
        paragraph_snippet TEXT,
        is_personal_best INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_typing_ts ON typing_sessions(timestamp);
    `)

    this.save()

    // Save database to disk periodically if modified
    if (this.saveInterval) clearInterval(this.saveInterval)
    this.saveInterval = setInterval(() => {
      if (this.dirty) this.save()
    }, 5000)

    console.log(`[AnalyticsDB] Database (sql.js ASM) initialized at: ${dbPath}`)
  }


  save() {
    if (!this.db || !this.dbPath) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.dbPath, buffer)
      this.dirty = false
    } catch (err) {
      console.error('[AnalyticsDB] Error saving DB to disk:', err.message)
    }
  }

  logKeystroke(keycode, keyName, soundType, currentWpm = 0) {
    if (!this.db) return
    const now = Date.now()
    const dateStr = new Date().toISOString().split('T')[0]
    const isTyping = soundType === 'typing' ? 1 : 0

    try {
      this.db.run(
        `INSERT INTO keystrokes (timestamp, keycode, key_name, sound_type, session_id) VALUES (?, ?, ?, ?, ?)`,
        [now, keycode, keyName, soundType, this.sessionId]
      )

      this.db.run(
        `INSERT INTO daily_stats (date, total_keys, typing_chars, peak_wpm)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           total_keys = total_keys + 1,
           typing_chars = typing_chars + excluded.typing_chars,
           peak_wpm = MAX(daily_stats.peak_wpm, excluded.peak_wpm)`,
        [dateStr, isTyping, currentWpm]
      )

      this.dirty = true
    } catch (err) {
      console.error('[AnalyticsDB] Failed to log keystroke:', err.message)
    }
  }

  getTodayCount() {
    if (!this.db) return 0
    const dateStr = new Date().toISOString().split('T')[0]
    try {
      const res = this.db.exec(`SELECT total_keys FROM daily_stats WHERE date = '${dateStr}'`)
      if (res.length > 0 && res[0].values.length > 0) {
        return res[0].values[0][0] || 0
      }
    } catch (_) {}
    return 0
  }

  getSummaryStats() {
    if (!this.db) return { totalKeys: 0, todayKeys: 0, peakWpm: 0, totalDays: 0 }

    const todayStr = new Date().toISOString().split('T')[0]
    let totalKeys = 0, peakWpm = 0, totalDays = 0, todayKeys = 0

    try {
      const res1 = this.db.exec(`SELECT SUM(total_keys), MAX(peak_wpm), COUNT(date) FROM daily_stats`)
      if (res1.length > 0 && res1[0].values.length > 0) {
        const v = res1[0].values[0]
        totalKeys = v[0] || 0
        peakWpm = v[1] || 0
        totalDays = v[2] || 0
      }

      const res2 = this.db.exec(`SELECT total_keys FROM daily_stats WHERE date = '${todayStr}'`)
      if (res2.length > 0 && res2[0].values.length > 0) {
        todayKeys = res2[0].values[0][0] || 0
      }
    } catch (err) {
      console.error('[AnalyticsDB] getSummaryStats error:', err.message)
    }

    return { totalKeys, todayKeys, peakWpm, totalDays }
  }

  getHourlyBreakdown(dateStr) {
    if (!this.db) return Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }))
    const startMs = new Date(`${dateStr}T00:00:00`).getTime()
    const endMs = startMs + 86400000

    const hoursMap = {}
    for (let i = 0; i < 24; i++) hoursMap[i] = 0

    try {
      const res = this.db.exec(`
        SELECT timestamp FROM keystrokes WHERE timestamp >= ${startMs} AND timestamp < ${endMs}
      `)
      if (res.length > 0) {
        res[0].values.forEach(row => {
          const ts = row[0]
          const hr = Math.floor((ts - startMs) / 3600000)
          if (hr >= 0 && hr < 24) hoursMap[hr]++
        })
      }
    } catch (err) {
      console.error('[AnalyticsDB] getHourlyBreakdown error:', err.message)
    }

    return Object.keys(hoursMap).map(hr => ({ hour: `${hr}:00`, count: hoursMap[hr] }))
  }

  getDailyTrend(days = 30) {
    if (!this.db) return []
    try {
      const res = this.db.exec(`
        SELECT date, total_keys, typing_chars, peak_wpm
        FROM daily_stats
        ORDER BY date DESC
        LIMIT ${parseInt(days)}
      `)
      if (res.length > 0) {
        return res[0].values.map(r => ({
          date: r[0],
          total_keys: r[1],
          typing_chars: r[2],
          peak_wpm: r[3]
        })).reverse()
      }
    } catch (err) {
      console.error('[AnalyticsDB] getDailyTrend error:', err.message)
    }
    return []
  }

  getTopKeys(limit = 10) {
    if (!this.db) return []
    try {
      const res = this.db.exec(`
        SELECT key_name, COUNT(*) as count
        FROM keystrokes
        GROUP BY key_name
        ORDER BY count DESC
        LIMIT ${parseInt(limit)}
      `)
      if (res.length > 0) {
        return res[0].values.map(r => ({ key_name: r[0], count: r[1] }))
      }
    } catch (err) {
      console.error('[AnalyticsDB] getTopKeys error:', err.message)
    }
    return []
  }

  getLetterHeatmap() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const result = {}
    letters.forEach(l => { result[l] = 0 })

    if (!this.db) return result

    try {
      const res = this.db.exec(`
        SELECT UPPER(key_name) as letter, COUNT(*) as count
        FROM keystrokes
        GROUP BY UPPER(key_name)
      `)
      if (res.length > 0) {
        res[0].values.forEach(r => {
          const l = r[0]
          if (letters.includes(l)) {
            result[l] = r[1]
          }
        })
      }
    } catch (err) {
      console.error('[AnalyticsDB] getLetterHeatmap error:', err.message)
    }
    return result
  }

  getDatabaseSize() {
    try {
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        const stats = fs.statSync(this.dbPath)
        return (stats.size / (1024 * 1024)).toFixed(2)
      }
    } catch (_) {}
    return '0.00'
  }

  purgeData(beforeTimestamp) {
    if (!this.db) return 0
    try {
      this.db.run(`DELETE FROM keystrokes WHERE timestamp < ${beforeTimestamp}`)
      this.save()
      return true
    } catch (err) {
      console.error('[AnalyticsDB] purgeData error:', err.message)
    }
    return false
  }

  exportToCSV(filePath) {
    if (!this.db) return false
    try {
      const res = this.db.exec(`
        SELECT id, timestamp, keycode, key_name, sound_type
        FROM keystrokes
        ORDER BY timestamp DESC
      `)

      let csv = 'ID,Date Time,Key Code,Key Name,Sound Type\n'
      if (res.length > 0) {
        res[0].values.forEach(r => {
          const dtStr = new Date(r[1]).toLocaleString().replace(/"/g, '""')
          csv += `${r[0]},"${dtStr}",${r[2]},"${r[3]}","${r[4]}"\n`
        })
      }

      fs.writeFileSync(filePath, csv, 'utf-8')
      return true
    } catch (err) {
      console.error('[AnalyticsDB] exportToCSV error:', err.message)
    }
    return false
  }

  close() {
    if (this.saveInterval) clearInterval(this.saveInterval)
    this.save()
    if (this.db) {
      try { this.db.close() } catch (_) {}
      this.db = null
    }
  }

  // ─── Typing Session Methods ───────────────────────────────────────────
  logTypingSession({ wpm, accuracy, charsCorrect, charsTotal, durationSeconds, mode, difficulty, category, paragraphSnippet }) {
    if (!this.db) return false
    try {
      const now = Date.now()
      // Check if this is a personal best
      const bestRes = this.db.exec(`SELECT MAX(wpm) FROM typing_sessions`)
      const currentBest = bestRes.length > 0 && bestRes[0].values.length > 0 ? (bestRes[0].values[0][0] || 0) : 0
      const isPersonalBest = wpm > currentBest ? 1 : 0

      this.db.run(
        `INSERT INTO typing_sessions (timestamp, wpm, accuracy, chars_correct, chars_total, duration_seconds, mode, difficulty, category, paragraph_snippet, is_personal_best)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [now, wpm, accuracy, charsCorrect, charsTotal, durationSeconds, mode, difficulty, category || '', (paragraphSnippet || '').substring(0, 100), isPersonalBest]
      )
      this.dirty = true
      this.save()
      return { success: true, isPersonalBest: isPersonalBest === 1 }
    } catch (err) {
      console.error('[AnalyticsDB] logTypingSession error:', err.message)
      return false
    }
  }

  getTypingSessions(limit = 50) {
    if (!this.db) return []
    try {
      const res = this.db.exec(`
        SELECT id, timestamp, wpm, accuracy, chars_correct, chars_total, duration_seconds, mode, difficulty, category, is_personal_best
        FROM typing_sessions
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `)
      if (res.length > 0) {
        return res[0].values.map(r => ({
          id: r[0], timestamp: r[1], wpm: r[2], accuracy: r[3],
          charsCorrect: r[4], charsTotal: r[5], durationSeconds: r[6],
          mode: r[7], difficulty: r[8], category: r[9], isPersonalBest: r[10] === 1
        }))
      }
    } catch (err) {
      console.error('[AnalyticsDB] getTypingSessions error:', err.message)
    }
    return []
  }

  getTypingPersonalBest() {
    if (!this.db) return 0
    try {
      const res = this.db.exec(`SELECT MAX(wpm) FROM typing_sessions`)
      if (res.length > 0 && res[0].values.length > 0) return res[0].values[0][0] || 0
    } catch (_) {}
    return 0
  }

  getTypingStats() {
    if (!this.db) return { totalTests: 0, personalBest: 0, avgWpm: 0, bestAccuracy: 0 }
    try {
      const res = this.db.exec(`
        SELECT COUNT(*), MAX(wpm), CAST(AVG(wpm) AS INTEGER), MAX(accuracy)
        FROM typing_sessions
      `)
      if (res.length > 0 && res[0].values.length > 0) {
        const v = res[0].values[0]
        return { totalTests: v[0] || 0, personalBest: v[1] || 0, avgWpm: v[2] || 0, bestAccuracy: v[3] || 0 }
      }
    } catch (err) {
      console.error('[AnalyticsDB] getTypingStats error:', err.message)
    }
    return { totalTests: 0, personalBest: 0, avgWpm: 0, bestAccuracy: 0 }
  }

  getTypingTrend(limit = 30) {
    if (!this.db) return []
    try {
      const res = this.db.exec(`
        SELECT id, timestamp, wpm, accuracy, difficulty, mode
        FROM typing_sessions
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `)
      if (res.length > 0) {
        return res[0].values.map(r => ({
          id: r[0], timestamp: r[1], wpm: r[2], accuracy: r[3], difficulty: r[4], mode: r[5]
        })).reverse()
      }
    } catch (err) {
      console.error('[AnalyticsDB] getTypingTrend error:', err.message)
    }
    return []
  }

  getTypingByDifficulty() {
    if (!this.db) return []
    try {
      const res = this.db.exec(`
        SELECT difficulty, CAST(AVG(wpm) AS INTEGER) as avg_wpm, COUNT(*) as count
        FROM typing_sessions
        GROUP BY difficulty
      `)
      if (res.length > 0) {
        return res[0].values.map(r => ({ difficulty: r[0], avgWpm: r[1], count: r[2] }))
      }
    } catch (err) {
      console.error('[AnalyticsDB] getTypingByDifficulty error:', err.message)
    }
    return []
  }
}

const analyticsDB = new AnalyticsDB()


// ─── Comprehensive Key Name Map ───────────────────────────────────────────
const KEYCODE_TO_NAME = {
  // Letters
  30: 'A', 48: 'B', 46: 'C', 32: 'D', 18: 'E', 33: 'F', 34: 'G',
  35: 'H', 23: 'I', 36: 'J', 37: 'K', 38: 'L', 50: 'M', 49: 'N',
  24: 'O', 25: 'P', 16: 'Q', 19: 'R', 31: 'S', 20: 'T', 22: 'U',
  47: 'V', 17: 'W', 45: 'X', 21: 'Y', 44: 'Z',

  // Numbers
  2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',

  // Special / Controls
  57: 'Space', 28: 'Enter', 284: 'Enter', 3612: 'Enter', 14: 'Backspace',
  1: 'Escape', 15: 'Tab', 58: 'CapsLock',

  // Modifiers
  29: 'Ctrl', 285: 'Ctrl', 3613: 'Ctrl',
  42: 'Shift', 54: 'Shift',
  56: 'Alt', 312: 'Alt', 3640: 'Alt',
  347: 'Win', 348: 'Win', 3675: 'Win', 3676: 'Win',

  // Symbols
  12: '-', 13: '=', 26: '[', 27: ']', 43: '\\', 39: ';', 40: "'",
  41: '`', 51: ',', 52: '.', 53: '/',

  // Function Keys
  59: 'F1', 60: 'F2', 61: 'F3', 62: 'F4', 63: 'F5', 64: 'F6',
  65: 'F7', 66: 'F8', 67: 'F9', 68: 'F10', 87: 'F11', 88: 'F12',

  // Navigation & Editing (Standard + Extended uiohook scan codes)
  328: '↑', 57416: '↑', 3640: '↑',
  336: '↓', 57424: '↓', 3648: '↓',
  331: '←', 57419: '←', 3643: '←',
  333: '→', 57421: '→', 3645: '→',
  327: 'Home', 3655: 'Home', 57399: 'Home',
  335: 'End', 3663: 'End', 57401: 'End',
  329: 'PgUp', 3657: 'PgUp', 57397: 'PgUp',
  337: 'PgDn', 3665: 'PgDn', 57405: 'PgDn',
  338: 'Insert', 3666: 'Insert', 57426: 'Insert',
  339: 'Delete', 3667: 'Delete', 57427: 'Delete',

  // Media & System Keys (Windows Extended + PS/2 + uIOhook)
  57390: 'VolDown', 3616: 'VolDown', 174: 'VolDown',
  57392: 'VolUp',   3632: 'VolUp',   175: 'VolUp',
  57376: 'VolMute', 57360: 'VolMute', 57362: 'VolMute', 3618: 'VolMute', 160: 'VolMute',
  57364: 'Play/Pause', 57378: 'Play/Pause', 3620: 'Play/Pause', 179: 'Play/Pause',
  57368: 'MediaStop', 3624: 'MediaStop', 178: 'MediaStop',
  57354: 'PrevTrack', 3610: 'PrevTrack', 177: 'PrevTrack',
  57369: 'NextTrack', 3625: 'NextTrack', 176: 'NextTrack',
  3631: 'MediaSelect', 57375: 'MediaSelect', 182: 'MediaSelect',
  3628: 'Mail', 57372: 'Mail', 180: 'Mail',
  3633: 'Calc', 57377: 'Calc', 183: 'Calc',
  3629: 'MyComputer', 57373: 'MyComputer',
  3622: 'BrowserHome', 57366: 'BrowserHome', 172: 'BrowserHome',
  3621: 'BrowserSearch', 57365: 'BrowserSearch', 170: 'BrowserSearch',
  3617: 'BrowserBack', 57361: 'BrowserBack', 166: 'BrowserBack',
  3619: 'BrowserFwd', 57363: 'BrowserFwd', 167: 'BrowserFwd',
  3677: 'MenuKey', 57437: 'MenuKey', 93: 'MenuKey',
  3639: 'PrtSc', 99: 'PrtSc',
  69: 'NumLock', 3653: 'NumLock',
  70: 'ScrollLock',
  3650: 'Pause'
}

// ─── Unified Data Directory Bootstrap ─────────────────────────────────────
let dataDir = path.normalize(app.getPath('userData'))

function getBootstrapPath() {
  return path.join(app.getPath('userData'), 'bootstrap.json')
}

function loadBootstrap() {
  const defaultDir = path.normalize(app.getPath('userData'))
  try {
    const p = getBootstrapPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (data.dataDir) {
        const normCustom = path.normalize(data.dataDir)
        if (fs.existsSync(normCustom)) {
          dataDir = normCustom
          return
        } else {
          console.warn(`[Bootstrap] Custom directory "${normCustom}" no longer exists. Falling back to default directory: ${defaultDir}`)
        }
      }
    }
  } catch (err) {
    console.error('[Bootstrap] Failed to load bootstrap.json:', err.message)
  }
  dataDir = defaultDir
}

function saveBootstrap(targetDir) {
  const defaultDir = path.normalize(app.getPath('userData'))
  const normTarget = path.normalize(targetDir)
  const normDefault = path.normalize(defaultDir)
  const p = getBootstrapPath()

  try {
    if (normTarget.toLowerCase() === normDefault.toLowerCase()) {
      if (fs.existsSync(p)) fs.rmSync(p, { force: true })
      dataDir = normDefault
    } else {
      fs.writeFileSync(p, JSON.stringify({ dataDir: normTarget }, null, 2))
      dataDir = normTarget
    }
  } catch (err) {
    console.error('[Bootstrap] Failed to save bootstrap.json:', err.message)
    dataDir = normTarget
  }
}

function copyFolderRecursiveSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true })
  fs.readdirSync(from, { withFileTypes: true }).forEach(element => {
    const fromPath = path.join(from, element.name)
    const toPath = path.join(to, element.name)
    if (element.isDirectory()) {
      copyFolderRecursiveSync(fromPath, toPath)
    } else {
      fs.copyFileSync(fromPath, toPath)
    }
  })
}

function cleanOldDataDir(oldDir, targetDir) {
  const defaultDir = path.normalize(app.getPath('userData'))
  const normOld = path.normalize(oldDir).toLowerCase()
  const normTarget = path.normalize(targetDir).toLowerCase()

  if (normOld === normTarget) return { hasRemainingFiles: false, oldDir }

  // Remove SoundKeys data folders/files from old directory
  const soundsDir = path.join(oldDir, 'sounds')
  const analyticsDir = path.join(oldDir, 'analytics')
  const configFile = path.join(oldDir, 'config.json')

  try {
    if (fs.existsSync(soundsDir)) fs.rmSync(soundsDir, { recursive: true, force: true })
    if (fs.existsSync(analyticsDir)) fs.rmSync(analyticsDir, { recursive: true, force: true })
    if (fs.existsSync(configFile)) fs.rmSync(configFile, { force: true })
    console.log(`[DataDir] Successfully cleaned SoundKeys data files from: ${oldDir}`)
  } catch (err) {
    console.warn('[DataDir] Error cleaning old data files:', err.message)
  }

  let hasRemainingFiles = false
  // If oldDir was a custom directory (not default AppData), check if files remain or remove custom folder
  if (normOld !== path.normalize(defaultDir).toLowerCase() && fs.existsSync(oldDir)) {
    try {
      const remainingFiles = fs.readdirSync(oldDir)
      if (remainingFiles.length === 0) {
        fs.rmSync(oldDir, { recursive: true, force: true })
        console.log(`[DataDir] Successfully removed empty custom directory: ${oldDir}`)
      } else {
        hasRemainingFiles = true
      }
    } catch (_) {
      hasRemainingFiles = true
    }
  }

  return { hasRemainingFiles, oldDir }
}

function ensureDataDirectoryStructure() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const userSoundsDir = path.join(dataDir, 'sounds', 'themes')
  if (!fs.existsSync(userSoundsDir)) {
    fs.mkdirSync(userSoundsDir, { recursive: true })
  }

  // Copy bundled default sounds if default theme doesn't exist in dataDir
  const defaultThemeDir = path.join(userSoundsDir, 'default')
  if (!fs.existsSync(defaultThemeDir)) {
    const bundledSoundsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'sounds')
      : path.join(process.cwd(), 'sounds')

    if (fs.existsSync(bundledSoundsDir)) {
      console.log(`[DataDir] Copying default sound themes from ${bundledSoundsDir} to ${dataDir}/sounds`)
      copyFolderRecursiveSync(bundledSoundsDir, path.join(dataDir, 'sounds'))
    }
  }
}

// Initialize bootstrap & directories before store/DB init
loadBootstrap()
ensureDataDirectoryStructure()

// ─── Settings Store ────────────────────────────────────────────────────────
const store = new Store({
  cwd: dataDir,
  schema: {
    activeTheme:          { type: 'string',  default: 'default' },
    volume:               { type: 'number',  minimum: 0, maximum: 1, default: 0.7 },
    muted:                { type: 'boolean', default: false },
    autoLaunch:           { type: 'boolean', default: false },
    mouseSounds:          { type: 'boolean', default: false },
    globalToggleHotkey:   { type: 'string',  default: 'CommandOrControl+Shift+S' },
    hideInTaskbar:        { type: 'boolean', default: false },
    closeAppAction:       { type: 'string',  default: 'tray' },
    dynamicTrayIndicator: { type: 'boolean', default: true },
    dataLimitMb:          { type: 'number',  default: 100 }
  }
})

// ─── Windows Auto-Launch Handler ──────────────────────────────────────────
function setAutoLaunch(enabled) {
  try {
    const exePath = app.getPath('exe')
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,
      path: exePath,
      args: ['--hidden']
    })
    store.set('autoLaunch', Boolean(enabled))
    updateTrayMenu()
  } catch (err) {
    console.error('[Main] Failed to update auto-launch:', err.message)
  }
}

// ─── Theme Manager ────────────────────────────────────────────────────────
function getSoundsBasePath() {
  return path.join(dataDir, 'sounds')
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

function saveCustomTheme({ id, name, author, description, filesMap }) {
  const cleanId  = (id || name).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const themeDir = path.join(getSoundsBasePath(), 'themes', cleanId)
  if (!fs.existsSync(themeDir)) {
    fs.mkdirSync(themeDir, { recursive: true })
  }

  // Load existing theme.json if updating
  const themeJsonPath = path.join(themeDir, 'theme.json')
  let themeConfig = {
    name: name || 'Custom Theme',
    author: author || 'Apoorv Nema',
    description: description || 'Custom user sound pack',
    typing: []
  }

  if (fs.existsSync(themeJsonPath)) {
    try {
      themeConfig = { ...themeConfig, ...JSON.parse(fs.readFileSync(themeJsonPath, 'utf-8')) }
      if (name) themeConfig.name = name
      if (author) themeConfig.author = author
      if (description !== undefined) themeConfig.description = description
    } catch (_) {}
  }

  if (filesMap && Object.keys(filesMap).length > 0) {
    const typingList = Array.isArray(themeConfig.typing) ? [...themeConfig.typing] : []
    for (const [key, fileData] of Object.entries(filesMap)) {
      if (!fileData) continue
      if (key.startsWith('typing')) {
        const fileName = `${key}.wav`
        const filePath = path.join(themeDir, fileName)
        fs.writeFileSync(filePath, Buffer.from(fileData))
        if (!typingList.includes(fileName)) typingList.push(fileName)
      } else {
        const fileName = `${key}.wav`
        const filePath = path.join(themeDir, fileName)
        fs.writeFileSync(filePath, Buffer.from(fileData))
        themeConfig[key] = fileName
      }
    }
    if (typingList.length > 0) {
      themeConfig.typing = typingList
    }
  }

  if (!Array.isArray(themeConfig.typing) || themeConfig.typing.length === 0) {
    themeConfig.typing = ['typing_1.wav']
  }

  fs.writeFileSync(themeJsonPath, JSON.stringify(themeConfig, null, 2))
  return cleanId
}

function deleteCustomTheme(themeId) {
  if (themeId === 'default') return false
  const themeDir = path.join(getSoundsBasePath(), 'themes', themeId)
  if (fs.existsSync(themeDir)) {
    fs.rmSync(themeDir, { recursive: true, force: true })
    if (store.get('activeTheme') === themeId) {
      switchTheme('default')
    }
    return true
  }
  return false
}

// ─── Key Hook ─────────────────────────────────────────────────────────────
const FUNCTION_KEYS = new Set([59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 87, 88])

function getSoundType(keycode) {
  switch (keycode) {
    case 57:  return 'spacebar'
    case 28:
    case 284:
    case 3612: return 'enter'
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
let isElectronShortcutActive = false

function checkHotkeyMatch(keycode) {
  const targetHotkey = (store.get('globalToggleHotkey') || 'Ctrl+Shift+S').toUpperCase()
  const needCtrl  = targetHotkey.includes('CTRL') || targetHotkey.includes('COMMANDORCONTROL')
  const needShift = targetHotkey.includes('SHIFT')
  const needAlt   = targetHotkey.includes('ALT')

  if (needCtrl !== activeModifiers.ctrl) return false
  if (needShift !== activeModifiers.shift) return false
  if (needAlt !== activeModifiers.alt) return false

  const parts = targetHotkey.split('+')
  const keyChar = parts[parts.length - 1]

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
      if (event.keycode === 29 || event.keycode === 285 || event.keycode === 3613) activeModifiers.ctrl  = true
      if (event.keycode === 42 || event.keycode === 54)  activeModifiers.shift = true
      if (event.keycode === 56 || event.keycode === 312 || event.keycode === 3640) activeModifiers.alt   = true

      if (checkHotkeyMatch(event.keycode)) {
        if (!isElectronShortcutActive) {
          console.log('[KeyHook] Global hotkey intercepted via uiohook fallback!')
          toggleMute()
        }
        return // Do not play audio sound for the hotkey keypress itself
      }

      const soundType = getSoundType(event.keycode)
      if (soundType) {
        const keyName = KEYCODE_TO_NAME[event.keycode] || `Key_${event.keycode}`
        onKeyPress({ soundType, keycode: event.keycode, keyName })
      }
    })

    uIOhook.on('keyup', (event) => {
      if (event.keycode === 29 || event.keycode === 285 || event.keycode === 3613) activeModifiers.ctrl  = false
      if (event.keycode === 42 || event.keycode === 54)  activeModifiers.shift = false
      if (event.keycode === 56 || event.keycode === 312 || event.keycode === 3640) activeModifiers.alt   = false
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
  const candidates = [
    path.join(process.resourcesPath || '', 'build/icon.png'),
    path.join(process.resourcesPath || '', 'app/build/icon.png'),
    path.join(__dirname, '../../build/icon.png'),
    path.join(process.cwd(), 'build/icon.png'),
    path.join(__dirname, '../../../build/icon.png')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return nativeImage.createFromPath(p)
  }
  return makeTrayIcon('active')
}

function makeOverlayIcon(state = 'active') {
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2 - 1
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size), o = i * 4
    const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    if (d <= r) {
      if (state === 'active') {
        buf[o] = 94; buf[o+1] = 197; buf[o+2] = 34
      } else {
        buf[o] = 68; buf[o+1] = 68; buf[o+2] = 239
      }
      buf[o+3] = 255
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

function updateWindowOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (isMuted) {
    mainWindow.setOverlayIcon(makeOverlayIcon('muted'), 'Muted')
  } else {
    // Clear overlay icon when active so clean app icon shows without green octagon
    mainWindow.setOverlayIcon(null, '')
  }
}

function makeTrayIcon(state = 'active') {
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2 - 1

  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size), o = i * 4
    const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    if (d <= r) {
      if (state === 'active') {
        buf[o] = 94; buf[o+1] = 197; buf[o+2] = 34
      } else if (state === 'pulse') {
        buf[o] = 128; buf[o+1] = 222; buf[o+2] = 74
      } else {
        buf[o] = 68; buf[o+1] = 68; buf[o+2] = 239
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

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function serializeTheme(theme) {
  return theme ? { ...theme } : null
}

function toggleMute() {
  isMuted = !isMuted
  store.set('muted', isMuted)
  updateTrayMenu()
  updateWindowOverlay()
  sendToRenderer('settings:updated', { muted: isMuted })
}

function switchTheme(themeId) {
  const theme = loadTheme(themeId)
  if (!theme) return console.error(`[Main] Theme '${themeId}' not found`)
  currentTheme = theme
  store.set('activeTheme', themeId)
  updateTrayMenu()
  sendToRenderer('theme:changed', serializeTheme(theme))
}

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

  const autoLaunchEnabled = store.get('autoLaunch') || false
  const dynTrayEnabled    = store.get('dynamicTrayIndicator') !== false

  const menu = Menu.buildFromTemplate([
    { label: isMuted ? '▶  Unmute Sounds' : '🔇  Mute Sounds', click: toggleMute },
    { type: 'separator' },
    {
      label: 'Sound Themes',
      submenu: themeSubmenu.length > 0 ? themeSubmenu : [{ label: 'No themes found', enabled: false }]
    },
    { type: 'separator' },
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

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js')
  const hideTaskbar = store.get('hideInTaskbar') || false

  mainWindow = new BrowserWindow({
    width: 960, height: 680,
    minWidth: 840, minHeight: 580,
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
      // Allow window to close and process to exit
    } else {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────
function setupIPC() {
  // Settings
  ipcMain.handle('settings:get', () => ({
    activeTheme:          store.get('activeTheme'),
    volume:               store.get('volume'),
    muted:                store.get('muted'),
    autoLaunch:           store.get('autoLaunch'),
    mouseSounds:          store.get('mouseSounds'),
    globalToggleHotkey:   store.get('globalToggleHotkey'),
    hideInTaskbar:        store.get('hideInTaskbar'),
    closeAppAction:       store.get('closeAppAction'),
    dynamicTrayIndicator: store.get('dynamicTrayIndicator'),
    dataLimitMb:          store.get('dataLimitMb') || 100
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

  // Themes
  ipcMain.handle('theme:list',    () => listThemes())
  ipcMain.handle('theme:current', () => serializeTheme(currentTheme))
  ipcMain.handle('theme:switch',  (_, id) => {
    switchTheme(id)
    return serializeTheme(currentTheme)
  })
  ipcMain.handle('theme:create', (_, themeData) => {
    const newId = saveCustomTheme(themeData)
    switchTheme(newId)
    return listThemes()
  })
  ipcMain.handle('theme:update', (_, { id, ...themeData }) => {
    const updatedId = saveCustomTheme({ id, ...themeData })
    if (currentTheme?.id === updatedId) {
      switchTheme(updatedId)
    }
    return listThemes()
  })
  ipcMain.handle('theme:delete', (_, id) => {
    const success = deleteCustomTheme(id)
    return { success, themes: listThemes() }
  })
  ipcMain.handle('theme:get-config', (_, id) => {
    const themeDir = path.join(getSoundsBasePath(), 'themes', id)
    const jsonPath = path.join(themeDir, 'theme.json')
    try {
      if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
      }
    } catch (_) {}
    return null
  })

  // Analytics
  ipcMain.handle('analytics:summary', () => analyticsDB.getSummaryStats())
  ipcMain.handle('analytics:hourly',  (_, dateStr) => analyticsDB.getHourlyBreakdown(dateStr || new Date().toISOString().split('T')[0]))
  ipcMain.handle('analytics:daily',   (_, days) => analyticsDB.getDailyTrend(days || 30))
  ipcMain.handle('analytics:top-keys',(_, limit) => analyticsDB.getTopKeys(limit || 10))
  ipcMain.handle('analytics:heatmap', () => analyticsDB.getLetterHeatmap())
  ipcMain.handle('analytics:db-size', () => analyticsDB.getDatabaseSize())
  ipcMain.handle('analytics:purge',  (_, beforeDateStr) => {
    const ts = beforeDateStr ? new Date(beforeDateStr).getTime() : Date.now()
    return analyticsDB.purgeData(ts)
  })
  ipcMain.handle('analytics:export', async () => {
    if (!mainWindow) return false
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export SoundKeys Analytics Data',
      defaultPath: `soundkeys_analytics_${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (!filePath) return false
    return analyticsDB.exportToCSV(filePath)
  })

  // Unified Data Directory
  ipcMain.handle('datadir:get',          () => dataDir)
  ipcMain.handle('datadir:default-path', () => path.normalize(app.getPath('userData')))
  ipcMain.handle('datadir:select', async () => {
    if (!mainWindow) return null
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select SoundKeys Data Directory',
      properties: ['openDirectory', 'createDirectory']
    })
    return filePaths?.[0] ? path.normalize(filePaths[0]) : null
  })
  ipcMain.handle('datadir:change', async (_, targetDir) => {
    if (!targetDir) return { success: false, dataDir }
    const normTarget = path.normalize(targetDir)
    const normCurrent = path.normalize(dataDir)

    // Check if target is equal to current
    if (normTarget.toLowerCase() === normCurrent.toLowerCase()) {
      // Force relaunch even if resetting to same location so app refreshes cleanly
      app.isQuitting = true
      app.relaunch()
      setTimeout(() => app.quit(), 300)
      return { success: true, dataDir: normTarget, oldDir: dataDir, hasRemainingFiles: false, relaunching: true }
    }

    // Prevent selecting a subdirectory inside the current data directory to avoid infinite recursion
    const rel = path.relative(normCurrent, normTarget)
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return {
        success: false,
        dataDir,
        error: 'Cannot select a subdirectory inside the current data folder as target location.'
      }
    }

    try {
      const oldDir = dataDir
      console.log(`[DataDir] Migrating data directory from ${oldDir} -> ${normTarget}`)
      copyFolderRecursiveSync(oldDir, normTarget)

      // Save bootstrap configuration
      saveBootstrap(normTarget)
      dataDir = normTarget

      // Clean old data files
      const { hasRemainingFiles } = cleanOldDataDir(oldDir, normTarget)

      // Mark app as quitting so window close listener doesn't minimize to tray
      app.isQuitting = true

      // Register relaunch request and quit process gracefully
      app.relaunch()
      setTimeout(() => {
        app.quit()
      }, 300)

      return { success: true, dataDir: normTarget, oldDir, hasRemainingFiles, relaunching: true }
    } catch (err) {
      console.error('[DataDir] Migration failed:', err.message)
      return { success: false, dataDir, error: err.message }
    }
  })


  // Window Controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:close',    () => {
    const action = store.get('closeAppAction') || 'tray'
    if (action === 'quit' || app.isQuitting) {
      app.isQuitting = true
      app.quit()
    } else {
      mainWindow?.hide()
    }
  })

  // ─── Gemini API Key Management ─────────────────────────────────────────
  // Key is stored in a dedicated secure store, never sent to renderer raw
  const geminiStore = new Store({ name: 'gemini-secure', cwd: dataDir })

  function callGeminiAPI(apiKey, promptText, modelName = 'gemini-2.0-flash') {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.error) {
              const errMsg = json.error.message || ''
              if (errMsg.includes('Quota exceeded') || json.error.code === 429 || json.error.status === 'RESOURCE_EXHAUSTED') {
                return resolve({
                  success: false,
                  quotaExceeded: true,
                  error: 'Gemini Free Tier quota exceeded. Please wait 1 minute before retrying or use offline mode.'
                })
              }
              return resolve({ success: false, error: errMsg })
            }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
            if (text) resolve({ success: true, text })
            else resolve({ success: false, error: 'No text returned from Gemini API.' })
          } catch (err) {
            resolve({ success: false, error: 'Failed to parse Gemini API response.' })
          }
        })
      })

      req.on('error', (err) => resolve({ success: false, error: err.message }))
      req.write(postData)
      req.end()
    })
  }

  async function tryGeminiModels(apiKey, promptText) {
    const candidateModels = [
      'gemini-3.5-flash-lite'
    ]

    let lastError = null

    for (const modelName of candidateModels) {
      const res = await callGeminiAPI(apiKey, promptText, modelName)
      if (res.success || res.quotaExceeded) {
        return res
      }
      lastError = res
      // If error is model not found or no longer available, continue to next candidate
      const err = res.error || ''
      if (err.includes('no longer available') || err.includes('not found') || err.includes('is not supported')) {
        continue
      }
      // If error is invalid API key or auth error, return immediately
      return res
    }

    return lastError || { success: false, error: 'Failed to connect to Gemini API. Please check network/key.' }
  }



  ipcMain.handle('gemini:set-key', (_, key) => {
    if (key && typeof key === 'string' && key.trim()) {
      geminiStore.set('apiKey', key.trim())
      return { success: true }
    } else {
      geminiStore.delete('apiKey')
      return { success: true, cleared: true }
    }
  })

  ipcMain.handle('gemini:get-key', () => {
    const key = geminiStore.get('apiKey')
    return { isSet: Boolean(key && key.length > 0) }
  })

  ipcMain.handle('gemini:validate-key', async (_, customKey) => {
    const apiKey = customKey ? customKey.trim() : geminiStore.get('apiKey')
    if (!apiKey) return { valid: false, error: 'No API key provided.' }

    const res = await tryGeminiModels(apiKey, 'Respond with OK')
    if (res.success) return { valid: true }

    // If quota is exceeded, the key IS valid (just rate limited)
    if (res.quotaExceeded) {
      return { valid: true, quotaExceeded: true, warning: 'Key is valid, but current free tier quota is temporarily exceeded.' }
    }

    return { valid: false, error: res.error }
  })

  ipcMain.handle('gemini:generate', async (_, { category, prompt, difficulty }) => {
    const apiKey = geminiStore.get('apiKey')
    if (!apiKey) return { success: false, error: 'No Gemini API key configured. Please add your key in Settings.' }

    const difficultyInstructions = {
      easy:   'Use simple, common words. Short sentences. Suitable for beginners.',
      medium: 'Use everyday vocabulary with moderate sentence complexity. Mix of short and medium sentences.',
      hard:   'Use advanced vocabulary, complex sentence structures, and technical terminology.'
    }

    const difficultyText = difficultyInstructions[difficulty] || difficultyInstructions.medium
    const categoryContext = category ? `Category/Topic: ${category}.` : (prompt ? `Topic: ${prompt}.` : 'Category: General Knowledge.')

    const fullPrompt = `Generate a single paragraph of approximately 150 words for a typing speed test. ${categoryContext} Difficulty level: ${difficulty || 'medium'}. ${difficultyText} Return ONLY the paragraph text. No headings, no titles, no quotes around the paragraph, no extra explanations.`

    return tryGeminiModels(apiKey, fullPrompt)
  })




  // ─── Typing Paragraphs Library ─────────────────────────────────────────
  function getParagraphsFilePath() {
    return path.join(dataDir, 'typing-paragraphs.json')
  }

  function readParagraphs() {
    try {
      const fp = getParagraphsFilePath()
      if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'))
    } catch (_) {}
    return []
  }

  function writeParagraphs(list) {
    try {
      fs.writeFileSync(getParagraphsFilePath(), JSON.stringify(list, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[Typing] writeParagraphs error:', err.message)
      return false
    }
  }

  ipcMain.handle('typing:get-paragraphs', () => readParagraphs())

  ipcMain.handle('typing:save-paragraph', (_, { text, category, source }) => {
    const list = readParagraphs()
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text,
      category: category || 'Custom',
      source: source || 'user',
      savedAt: new Date().toISOString(),
      timesUsed: 0
    }
    list.push(entry)
    writeParagraphs(list)
    return { success: true, paragraph: entry }
  })

  ipcMain.handle('typing:delete-paragraph', (_, id) => {
    const list = readParagraphs().filter(p => p.id !== id)
    writeParagraphs(list)
    return { success: true }
  })

  ipcMain.handle('typing:use-paragraph', (_, id) => {
    const list = readParagraphs()
    const idx = list.findIndex(p => p.id === id)
    if (idx !== -1) { list[idx].timesUsed = (list[idx].timesUsed || 0) + 1; writeParagraphs(list) }
    return { success: true }
  })

  ipcMain.handle('typing:export-paragraphs', async () => {
    if (!mainWindow) return false
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Typing Paragraphs',
      defaultPath: `soundkeys_paragraphs_${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (!filePath) return false
    try {
      fs.writeFileSync(filePath, JSON.stringify(readParagraphs(), null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[Typing] exportParagraphs error:', err.message)
      return false
    }
  })

  ipcMain.handle('typing:import-paragraphs', async () => {
    if (!mainWindow) return { success: false }
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Typing Paragraphs',
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (!filePaths?.[0]) return { success: false }
    try {
      const imported = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
      if (!Array.isArray(imported)) return { success: false, error: 'Invalid file format' }
      const existing = readParagraphs()
      const existingIds = new Set(existing.map(p => p.id))
      const merged = [...existing, ...imported.filter(p => p.id && !existingIds.has(p.id))]
      writeParagraphs(merged)
      return { success: true, imported: merged.length - existing.length, total: merged.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ─── Typing Sessions (Analytics) ────────────────────────────────────────
  ipcMain.handle('typing:log-session',  (_, data) => analyticsDB.logTypingSession(data))
  ipcMain.handle('typing:get-sessions', (_, limit) => analyticsDB.getTypingSessions(limit || 50))
  ipcMain.handle('typing:get-best',     () => analyticsDB.getTypingPersonalBest())
  ipcMain.handle('typing:get-stats',    () => analyticsDB.getTypingStats())
  ipcMain.handle('typing:get-trend',    (_, limit) => analyticsDB.getTypingTrend(limit || 30))
  ipcMain.handle('typing:get-by-diff',  () => analyticsDB.getTypingByDifficulty())
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
  isElectronShortcutActive = false
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
        isElectronShortcutActive = true
        registered = true
        break
      }
    } catch (err) {
      console.warn(`[Main] Could not register hotkey candidate '${combo}':`, err.message)
    }
  }
  return registered
}

// ─── App Lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  isMuted = store.get('muted') || false

  // Init SQLite Analytics DB
  await analyticsDB.init(path.join(dataDir, 'analytics', 'soundkeys.db'))

  // Check DB size limit
  const limitMb = store.get('dataLimitMb') || 100
  const currentSizeMb = parseFloat(analyticsDB.getDatabaseSize())
  if (currentSizeMb > limitMb) {
    console.log(`[AnalyticsDB] Database size (${currentSizeMb}MB) exceeds limit (${limitMb}MB). Purging data older than 30 days...`)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    analyticsDB.purgeData(thirtyDaysAgo)
  }

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

  mainWindow.once('ready-to-show', () => {
    updateWindowOverlay()
  })

  // Key hook: sound playback + analytics logging
  setTimeout(startKeyHook.bind(null, ({ soundType, keycode, keyName }) => {
    analyticsDB.logKeystroke(keycode, keyName, soundType)

    if (isMuted) return
    flashTrayPulse()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sound:play', { soundType, keycode, keyName })
    }
  }), 1200)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  stopKeyHook()
  analyticsDB.close()
  globalShortcut.unregisterAll()
})
