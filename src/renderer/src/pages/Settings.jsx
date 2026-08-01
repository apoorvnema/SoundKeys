import React, { useState, useCallback } from 'react'
import ThemeCreatorModal from '../components/ThemeCreatorModal'

// ── Sub-components ──────────────────────────────────────────────────────────

function VolumeSlider({ value, onChange }) {
  const pct = Math.round((value ?? 0.7) * 100)
  return (
    <div className="volume-control">
      <svg className="vol-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <input
        id="volume-slider"
        type="range"
        className="volume-slider"
        min="0" max="1" step="0.01"
        value={value ?? 0.7}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <svg className="vol-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <span className="volume-pct">{pct}%</span>
    </div>
  )
}

function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      className={`toggle-switch ${value ? 'on' : 'off'} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onChange(!value)}
      role="switch"
      aria-checked={value}
      disabled={disabled}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

function ThemeCard({ theme, isActive, onSelect }) {
  const wavCount = Object.values(theme).filter(
    v => typeof v === 'string' && v.toLowerCase().endsWith('.wav')
  ).length + (Array.isArray(theme.typing) ? theme.typing.length - 1 : 0)

  return (
    <button
      className={`theme-card ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(theme.id)}
    >
      <div className="theme-card-emoji">🎵</div>
      <div className="theme-card-body">
        <div className="theme-card-name">{theme.name || theme.id}</div>
        <div className="theme-card-meta">
          {wavCount} sound{wavCount !== 1 ? 's' : ''}
          {theme.author ? ` · By ${theme.author}` : ''}
          {theme.description ? ` · ${theme.description}` : ''}
        </div>
      </div>
      {isActive && (
        <div className="theme-card-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  )
}

function HotkeyRecorder({ currentHotkey, onChange }) {
  const [isRecording, setIsRecording] = useState(false)

  const handleKeyDown = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      setIsRecording(false)
      return
    }

    const modifiers = []
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl')
    if (e.shiftKey) modifiers.push('Shift')
    if (e.altKey) modifiers.push('Alt')

    let key = e.key.toUpperCase()
    if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return
    if (key === ' ') key = 'Space'

    const newHotkey = [...modifiers, key].join('+')
    onChange(newHotkey)
    setIsRecording(false)
  }

  return (
    <div className="hotkey-control">
      {isRecording ? (
        <input
          type="text"
          className="hotkey-input recording"
          value="Listening... (Esc to cancel)"
          onKeyDown={handleKeyDown}
          autoFocus
          onBlur={() => setIsRecording(false)}
          readOnly
        />
      ) : (
        <div className="hotkey-display">
          <kbd className="hotkey-badge">{currentHotkey || 'Ctrl+Shift+S'}</kbd>
          <button
            className="btn-secondary-sm"
            onClick={() => setIsRecording(true)}
          >
            Change
          </button>
        </div>
      )}
    </div>
  )
}

// ── Settings Page ───────────────────────────────────────────────────────────
export default function Settings({ settings, themes, currentTheme, onSettingChange, onThemeSwitch, onThemesUpdated }) {
  const [volLocal, setVolLocal] = useState(settings?.volume ?? 0.7)
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)

  const handleVolume = useCallback((v) => {
    setVolLocal(v)
    onSettingChange('volume', v)
  }, [onSettingChange])

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Customise your SoundKeys experience & audio themes</p>
        </div>
      </div>

      <div className="settings-content">

        {/* ── Audio ─────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Audio & Feedback
          </h2>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Master Volume</span>
              <span className="settings-row-desc">Controls output volume for all key press audio</span>
            </div>
            <div className="settings-row-control">
              <VolumeSlider value={volLocal} onChange={handleVolume} />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Mute All Sounds</span>
              <span className="settings-row-desc">Toggleable instantly via global hotkey or tray icon</span>
            </div>
            <div className="settings-row-control">
              <Toggle
                value={settings?.muted ?? false}
                onChange={v => onSettingChange('muted', v)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Dynamic Status Indicator Icon</span>
              <span className="settings-row-desc">Tray icon shows Green when active, Red when muted</span>
            </div>
            <div className="settings-row-control">
              <Toggle
                value={settings?.dynamicTrayIndicator ?? true}
                onChange={v => onSettingChange('dynamicTrayIndicator', v)}
              />
            </div>
          </div>
        </section>

        {/* ── Themes / Playlists ────────────────────────────── */}
        <section className="settings-section">
          <div className="section-header-row">
            <h2 className="section-title margin-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Sound Themes & Playlists
            </h2>

            <button
              className="btn-primary-sm"
              onClick={() => setIsCreatorOpen(true)}
            >
              + Create Sound Theme
            </button>
          </div>

          <p className="section-desc">
            Select an audio playlist theme below or create your own custom theme mapping WAV audio files to key presses.
          </p>

          <div className="theme-grid">
            {themes.length > 0 ? (
              themes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={currentTheme?.id === theme.id}
                  onSelect={onThemeSwitch}
                />
              ))
            ) : (
              <div className="empty-state">No themes found</div>
            )}
          </div>
        </section>

        {/* ── System & Window Controls ──────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            System & Windows Integration
          </h2>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Global Toggle Hotkey</span>
              <span className="settings-row-desc">Press shortcut anywhere to mute/unmute sounds</span>
            </div>
            <div className="settings-row-control">
              <HotkeyRecorder
                currentHotkey={settings?.globalToggleHotkey}
                onChange={hk => onSettingChange('globalToggleHotkey', hk)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Hide from Taskbar</span>
              <span className="settings-row-desc">Keep SoundKeys running silently in system tray only</span>
            </div>
            <div className="settings-row-control">
              <Toggle
                value={settings?.hideInTaskbar ?? false}
                onChange={v => onSettingChange('hideInTaskbar', v)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Close Button Action</span>
              <span className="settings-row-desc">What happens when clicking the [X] window close button</span>
            </div>
            <div className="settings-row-control">
              <select
                className="select-input"
                value={settings?.closeAppAction ?? 'tray'}
                onChange={e => onSettingChange('closeAppAction', e.target.value)}
              >
                <option value="tray">Minimize to System Tray</option>
                <option value="quit">Exit Application</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Auto-start with Windows</span>
              <span className="settings-row-desc">Launch SoundKeys automatically on system login</span>
            </div>
            <div className="settings-row-control">
              <Toggle
                value={settings?.autoLaunch ?? false}
                onChange={v => onSettingChange('autoLaunch', v)}
              />
            </div>
          </div>
        </section>

        {/* ── About ─────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">About SoundKeys</h2>
          <div className="about-card">
            <div className="about-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="about-name">SoundKeys</div>
              <div className="about-version">v1.0.0 · Created by Apoorv Nema</div>
              <div className="about-tagline">Tactile audio feedback and sound effects for every keypress on Windows</div>
            </div>
          </div>
        </section>

      </div>

      {/* Custom Theme Creator Modal */}
      <ThemeCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onCreated={(updatedList) => {
          if (onThemesUpdated) onThemesUpdated(updatedList)
        }}
      />
    </div>
  )
}
