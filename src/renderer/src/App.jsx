import React, { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import AudioEngine from './components/AudioEngine'

export default function App() {
  const [activePage, setActivePage]     = useState('dashboard')
  const [settings, setSettings]         = useState(null)
  const [themes, setThemes]             = useState([])
  const [currentTheme, setCurrentTheme] = useState(null)
  const [lastKeyEvent, setLastKeyEvent] = useState(null)
  const audioRef = useRef(null)

  // ── Initialise on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cleanups = []

    async function init() {
      if (!window.soundkeys) {
        console.warn('[SoundKeys] Running outside Electron shell (window.soundkeys is undefined).')
        setSettings({ volume: 0.7, muted: false, globalToggleHotkey: 'Ctrl+Shift+S' })
        setThemes([{ id: 'default', name: 'Default' }])
        setCurrentTheme({ id: 'default', name: 'Default' })
        return
      }

      try {
        const [s, t, ct] = await Promise.all([
          window.soundkeys.getSettings(),
          window.soundkeys.listThemes(),
          window.soundkeys.getCurrentTheme()
        ])
        setSettings(s)
        setThemes(t)
        setCurrentTheme(ct)

        if (ct && audioRef.current) {
          audioRef.current.loadTheme(ct)
          audioRef.current.setVolume(s.volume ?? 0.7)
        }
      } catch (err) {
        console.error('[SoundKeys] Failed to load settings/themes:', err)
      }
    }

    init()

    if (!window.soundkeys) return

    // sound:play — key pressed in main process
    const u1 = window.soundkeys.onPlaySound((data) => {
      setLastKeyEvent({ ...data, ts: Date.now() })
      audioRef.current?.play(data.soundType)
    })

    // theme:changed — switched via tray menu
    const u2 = window.soundkeys.onThemeChanged((theme) => {
      setCurrentTheme(theme)
      audioRef.current?.loadTheme(theme)
    })

    // settings:updated — e.g., mute toggled from tray
    const u3 = window.soundkeys.onSettingsUpdated((updates) => {
      setSettings(prev => ({ ...prev, ...updates }))
    })

    cleanups = [u1, u2, u3].filter(Boolean)
    return () => cleanups.forEach(fn => fn?.())
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSettingChange = useCallback(async (key, value) => {
    await window.soundkeys?.setSettings({ [key]: value })
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'volume') audioRef.current?.setVolume(value)
  }, [])

  const handleThemeSwitch = useCallback(async (themeId) => {
    const theme = await window.soundkeys?.switchTheme(themeId)
    if (theme) {
      setCurrentTheme(theme)
      audioRef.current?.loadTheme(theme)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Non-visual audio engine */}
      <AudioEngine ref={audioRef} />

      {/* Frameless custom titlebar */}
      <header className="titlebar">
        <div className="titlebar-drag-region">
          <div className="titlebar-brand">
            <div className="brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="brand-name">SoundKeys</span>
          </div>

          {settings?.muted && (
            <div className="muted-indicator">
              <span className="muted-dot" />
              MUTED
            </div>
          )}
        </div>

        <div className="titlebar-buttons">
          <button
            className="titlebar-btn"
            onClick={() => window.soundkeys?.minimize()}
            title="Minimize"
          >
            <svg width="10" height="2" viewBox="0 0 10 2">
              <path d="M0 1h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="titlebar-btn close-btn"
            onClick={() => window.soundkeys?.close()}
            title="Minimize to tray"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="app-body">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />

        <main className="content">
          {activePage === 'dashboard' && (
            <Dashboard
              settings={settings}
              currentTheme={currentTheme}
              lastKeyEvent={lastKeyEvent}
              onSettingChange={handleSettingChange}
            />
          )}
          {activePage === 'settings' && (
            <Settings
              settings={settings}
              themes={themes}
              currentTheme={currentTheme}
              onSettingChange={handleSettingChange}
              onThemeSwitch={handleThemeSwitch}
            />
          )}
        </main>
      </div>
    </div>
  )
}
