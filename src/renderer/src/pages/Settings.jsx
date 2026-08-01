import React, { useState, useCallback } from 'react'

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
  // Count wav files in the theme as a proxy for "sound count"
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
          {theme.author ? ` · ${theme.author}` : ''}
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

// ── Settings Page ───────────────────────────────────────────────────────────
export default function Settings({ settings, themes, currentTheme, onSettingChange, onThemeSwitch }) {
  const [volLocal, setVolLocal] = useState(settings?.volume ?? 0.7)

  const handleVolume = useCallback((v) => {
    setVolLocal(v)
    onSettingChange('volume', v)
  }, [onSettingChange])

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Customise your SoundKeys experience</p>
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
            Audio
          </h2>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Master Volume</span>
              <span className="settings-row-desc">Controls the volume of all key sounds</span>
            </div>
            <div className="settings-row-control">
              <VolumeSlider value={volLocal} onChange={handleVolume} />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Mute All Sounds</span>
              <span className="settings-row-desc">Also toggleable via tray icon or Ctrl+Shift+S</span>
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
              <span className="settings-row-label">Mouse Click Sounds</span>
              <span className="settings-row-desc">Coming in Phase 2</span>
            </div>
            <div className="settings-row-control">
              <Toggle value={false} onChange={() => {}} disabled />
            </div>
          </div>
        </section>

        {/* ── Themes ────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Sound Themes
          </h2>

          <p className="section-desc">
            Add custom themes by placing a folder with WAV files and a <code>theme.json</code> inside{' '}
            <code>sounds/themes/</code>.
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
              <div className="empty-state">No themes found in sounds/themes/</div>
            )}
          </div>
        </section>

        {/* ── System ────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            System
          </h2>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Global Toggle Hotkey</span>
              <span className="settings-row-desc">Mute / unmute sounds from any app</span>
            </div>
            <div className="settings-row-control">
              <kbd className="hotkey-badge">{settings?.globalToggleHotkey || 'Ctrl+Shift+S'}</kbd>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Auto-start with Windows</span>
              <span className="settings-row-desc">Launch SoundKeys when you log in</span>
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
          <h2 className="section-title">About</h2>
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
              <div className="about-version">v1.0.0-beta</div>
              <div className="about-tagline">Opera GX-style sound effects for Windows</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
