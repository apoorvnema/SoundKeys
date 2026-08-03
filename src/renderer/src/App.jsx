import React, { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import TypingTest from './pages/TypingTest'
import KeyboardLayout from './pages/KeyboardLayout'
import AudioEngine from './components/AudioEngine'

class ErrorBoundary extends React.Component {

  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('[App ErrorBoundary] Caught error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, margin: 20, color: '#f87171' }}>
          <h3 style={{ margin: 0 }}>⚠️ Page Error Caught</h3>
          <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginTop: 8 }}>{this.state.error?.toString()}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', color: '#fff', borderRadius: 6, cursor: 'pointer', marginTop: 10 }}
          >
            🔄 Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
          audioRef.current.setVolume(s?.volume ?? 0.7)
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
      audioRef.current?.play(data.soundType, data.externalFile)
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
          <ErrorBoundary key={activePage}>
            {activePage === 'dashboard' && (
              <Dashboard
                settings={settings}
                currentTheme={currentTheme}
                lastKeyEvent={lastKeyEvent}
                onSettingChange={handleSettingChange}
              />
            )}
            {activePage === 'typing-test' && (
              <TypingTest />
            )}
            {activePage === 'keyboard-layout' && (
              <KeyboardLayout />
            )}
            {activePage === 'analytics' && (
              <Analytics />
            )}
            {activePage === 'settings' && (
              <Settings
                settings={settings}
                themes={themes}
                currentTheme={currentTheme}
                onSettingChange={handleSettingChange}
                onThemeSwitch={handleThemeSwitch}
                onThemesUpdated={(newThemes) => {
                  setThemes(newThemes)
                  if (typeof window.soundkeys?.getCurrentTheme === 'function') {
                    window.soundkeys.getCurrentTheme().then(ct => {
                      if (ct) {
                        setCurrentTheme(ct)
                        audioRef.current?.loadTheme(ct)
                      }
                    })
                  }
                }}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

