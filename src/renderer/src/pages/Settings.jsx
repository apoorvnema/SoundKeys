import React, { useState, useEffect, useCallback } from 'react'
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

function ThemeCard({ theme, isActive, onSelect, onEdit, onDelete }) {
  const wavCount = Object.values(theme).filter(
    v => typeof v === 'string' && v.toLowerCase().endsWith('.wav')
  ).length + (Array.isArray(theme.typing) ? theme.typing.length - 1 : 0)

  const isDefault = theme.id === 'default'

  return (
    <div className={`theme-card ${isActive ? 'active' : ''}`}>
      <div className="theme-card-main" onClick={() => onSelect(theme.id)}>
        <div className="theme-card-emoji">🎵</div>
        <div className="theme-card-body">
          <div className="theme-card-name-row">
            <span className="theme-card-name">{theme.name || theme.id}</span>
            {isDefault && <span className="builtin-badge">Built-in</span>}
          </div>
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
      </div>

      {!isDefault && (
        <div className="theme-card-actions">
          <button
            className="btn-theme-action"
            onClick={(e) => { e.stopPropagation(); onEdit(theme) }}
            title="Edit theme config & sounds"
          >
            ✏️ Edit
          </button>
          <button
            className="btn-theme-action danger"
            onClick={(e) => { e.stopPropagation(); onDelete(theme) }}
            title="Delete custom theme"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
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
  const [editingTheme, setEditingTheme] = useState(null)

  // Data & Storage states
  const [dbSize, setDbSize]               = useState('0.00')
  const [dataDir, setDataDir]             = useState('')
  const [defaultDataDir, setDefaultDataDir] = useState('')
  const [dataLimit, setDataLimit]         = useState(100)
  const [purgeDays, setPurgeDays]         = useState(30)
  const [statusMsg, setStatusMsg]         = useState('')

  // Gemini API Key states
  const [geminiKey, setGeminiKey]         = useState('')
  const [geminiKeyIsSet, setGeminiKeyIsSet] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [geminiStatus, setGeminiStatus]   = useState('')

  const loadDataStorageMeta = useCallback(async () => {
    if (!window.soundkeys) return
    try {
      const [sz, dir, defDir, setts, keyStatus] = await Promise.all([
        window.soundkeys.getAnalyticsDbSize(),
        window.soundkeys.getDataDir(),
        window.soundkeys.getDefaultDataDir(),
        window.soundkeys.getSettings(),
        window.soundkeys.geminiGetKey()
      ])
      if (sz) setDbSize(sz)
      if (dir) setDataDir(dir)
      if (defDir) setDefaultDataDir(defDir)
      if (setts?.dataLimitMb) setDataLimit(setts.dataLimitMb)
      if (keyStatus) setGeminiKeyIsSet(keyStatus.isSet)
    } catch (_) {}
  }, [])

  useEffect(() => {
    loadDataStorageMeta()
  }, [loadDataStorageMeta])

  const handleVolume = useCallback((v) => {
    setVolLocal(v)
    onSettingChange('volume', v)
  }, [onSettingChange])

  const handleEditTheme = (theme) => {
    setEditingTheme(theme)
    setIsCreatorOpen(true)
  }

  const handleDeleteTheme = async (theme) => {
    if (confirm(`Are you sure you want to delete custom theme "${theme.name || theme.id}"?`)) {
      const res = await window.soundkeys?.deleteTheme(theme.id)
      if (res?.themes) {
        onThemesUpdated(res.themes)
      }
    }
  }

  const handleModalClose = () => {
    setIsCreatorOpen(false)
    setEditingTheme(null)
  }

  const handleChangeDataDir = async () => {
    const selected = await window.soundkeys?.selectDataDir()
    if (!selected) return
    setStatusMsg('Migrating data & restarting SoundKeys...')
    const res = await window.soundkeys?.changeDataDir(selected)
    if (res?.success) {
      if (res.hasRemainingFiles && res.oldDir) {
        alert(`Data directory moved to:\n${res.dataDir}\n\nSoundKeys will now restart. Note: Leftover non-SoundKeys files in "${res.oldDir}" may be manually deleted if desired.`)
      }
    } else {
      const errMsg = res?.error || 'Failed to move data directory.'
      setStatusMsg(errMsg)
      alert(`Data Directory Error:\n${errMsg}`)
      setTimeout(() => setStatusMsg(''), 4500)
    }
  }

  const handleResetToDefaultDir = async () => {
    const targetDir = defaultDataDir || (await window.soundkeys?.getDefaultDataDir())
    if (!targetDir) return
    if (confirm(`Reset data directory back to default location?\n${targetDir}\n\nSoundKeys will restart automatically to apply changes.`)) {
      setStatusMsg('Restoring default directory & restarting SoundKeys...')
      const res = await window.soundkeys?.changeDataDir(targetDir)
      if (res?.success) {
        if (res.hasRemainingFiles && res.oldDir) {
          alert(`Data directory restored to default location!\n\nSoundKeys will now restart. Note: Leftover non-SoundKeys files in "${res.oldDir}" may be manually deleted if desired.`)
        }
      } else {
        const errMsg = res?.error || 'Failed to restore default directory.'
        setStatusMsg(errMsg)
        alert(`Data Directory Error:\n${errMsg}`)
        setTimeout(() => setStatusMsg(''), 4500)
      }
    }
  }

  const handlePurge = async () => {
    const beforeDateStr = new Date(Date.now() - purgeDays * 86400000).toISOString()
    if (confirm(`Are you sure you want to purge all analytics data older than ${purgeDays} days?`)) {
      await window.soundkeys?.purgeAnalyticsData(beforeDateStr)
      setStatusMsg(`Purged data older than ${purgeDays} days.`)
      loadDataStorageMeta()
      setTimeout(() => setStatusMsg(''), 4000)
    }
  }

  const handleExportCSV = async () => {
    const success = await window.soundkeys?.exportAnalyticsCSV()
    if (success) {
      setStatusMsg('Analytics data exported successfully!')
    } else {
      setStatusMsg('Export cancelled or failed.')
    }
  }

  const handleValidateGeminiKey = async (customKeyToTest) => {
    setGeminiStatus('⌛ Validating API key with Gemini...')
    const res = await window.soundkeys?.geminiValidateKey(customKeyToTest || (geminiKey.trim() || null))
    if (res?.valid) {
      if (res?.quotaExceeded || res?.warning) {
        setGeminiStatus(`⚠️ Key is valid! (${res.warning || 'Free tier quota temporarily reached'})`)
      } else {
        setGeminiStatus('✅ API Key is valid and working!')
      }
    } else {
      setGeminiStatus(`❌ Validation error: ${res?.error || 'Failed to validate key'}`)
    }
  }

  const handleSaveGeminiKey = async () => {
    const keyToSave = geminiKey.trim()
    if (!keyToSave) return
    setGeminiStatus('⌛ Saving & validating key...')

    // Save key to store
    const res = await window.soundkeys?.geminiSetKey(keyToSave)
    if (res?.success) {
      setGeminiKeyIsSet(true)
      setGeminiKey('')
      setShowGeminiKey(false)

      // Test key validation
      const valRes = await window.soundkeys?.geminiValidateKey(keyToSave)
      if (valRes?.valid) {
        if (valRes.quotaExceeded) {
          setGeminiStatus('✅ Key saved! (Note: Gemini Free Tier quota temporarily reached)')
        } else {
          setGeminiStatus('✅ Key saved and verified successfully!')
        }
      } else {
        setGeminiStatus(`⚠️ Key saved, but Google API returned: ${valRes?.error || 'Validation warning'}`)
      }
      setTimeout(() => setGeminiStatus(''), 5000)
    }
  }


  const handleClearGeminiKey = async () => {
    if (confirm('Clear the Gemini API key? AI generation will be unavailable until a key is added again.')) {
      await window.soundkeys?.geminiSetKey('')
      setGeminiKeyIsSet(false)
      setGeminiKey('')
      setGeminiStatus('🗑️ API key cleared.')
      setTimeout(() => setGeminiStatus(''), 3000)
    }
  }


  const handleSaveDataLimit = async (limit) => {
    setDataLimit(limit)
    onSettingChange('dataLimitMb', limit)
  }

  const normalizePathStr = (p) => (p || '').toLowerCase().replace(/[/\\]+/g, '/').replace(/\/+$/, '')
  const isCustomDir = Boolean(
    dataDir && defaultDataDir &&
    normalizePathStr(dataDir) !== normalizePathStr(defaultDataDir)
  )


  return (
    <div className="page settings-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Customise your SoundKeys audio, system options, and data storage</p>
        </div>
      </div>

      {statusMsg && (
        <div className="status-toast-banner margin-bottom-md">
          {statusMsg}
        </div>
      )}

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
              onClick={() => { setEditingTheme(null); setIsCreatorOpen(true) }}
            >
              + Create Sound Theme
            </button>
          </div>

          <p className="section-desc">
            Select an audio playlist theme below or create/edit custom themes mapping audio files to key presses.
          </p>

          <div className="theme-grid">
            {themes.length > 0 ? (
              themes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={currentTheme?.id === theme.id}
                  onSelect={onThemeSwitch}
                  onEdit={handleEditTheme}
                  onDelete={handleDeleteTheme}
                />
              ))
            ) : (
              <div className="empty-state">No themes found</div>
            )}
          </div>
        </section>

        {/* ── Data & Storage Management ────────────────────── */}
        <section className="settings-section">
          <h2 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Data & Storage Management
          </h2>

          <div className="settings-row flex-col items-start">
            <div className="settings-row-info full-width">
              <span className="settings-row-label">Unified Data Directory</span>
              <span className="settings-row-desc">SoundKeys keeps settings, custom sound packs, and analytics database together in one folder.</span>
            </div>
            <div className="path-display-row full-width margin-top-xs">
              <input
                type="text"
                className="path-input"
                value={dataDir}
                readOnly
              />
              <button className="btn-secondary" onClick={handleChangeDataDir}>
                Move Directory…
              </button>
              {isCustomDir && (
                <button className="btn-secondary" onClick={handleResetToDefaultDir} title="Reset to default AppData directory">
                  Reset to Default
                </button>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Database File Size</span>
              <span className="settings-row-desc">Current size of local SQLite analytics DB</span>
            </div>
            <div className="settings-row-control">
              <span className="meta-value text-neon-blue font-bold">{dbSize} MB</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Maximum Storage Limit</span>
              <span className="settings-row-desc">Auto-purges data older than 30 days when exceeded</span>
            </div>
            <div className="settings-row-control">
              <div className="limit-input-group">
                <input
                  type="number"
                  className="number-input"
                  value={dataLimit}
                  onChange={e => handleSaveDataLimit(parseInt(e.target.value) || 100)}
                  min="10"
                  max="5000"
                />
                <span className="input-unit">MB</span>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Export Keystroke Log</span>
              <span className="settings-row-desc">Export analytics data to a CSV spreadsheet file</span>
            </div>
            <div className="settings-row-control">
              <button className="btn-secondary-sm" onClick={handleExportCSV}>
                📥 Export CSV
              </button>
            </div>
          </div>

          <div className="settings-row danger-row">
            <div className="settings-row-info">
              <span className="settings-row-label danger">Purge Historical Data</span>
              <span className="settings-row-desc">Delete key logs older than threshold (daily totals preserved)</span>
            </div>
            <div className="settings-row-control gap-sm">
              <select
                className="select-input-sm"
                value={purgeDays}
                onChange={e => setPurgeDays(parseInt(e.target.value))}
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
                <option value={365}>1 Year</option>
              </select>
              <button className="btn-danger-sm" onClick={handlePurge}>
                Purge Data
              </button>
            </div>
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
              <div className="about-version">v2.0.0 · Created by Apoorv Nema</div>
              <div className="about-tagline">Tactile audio feedback and sound effects for every keypress on Windows</div>
            </div>
          </div>
        </section>

        {/* ── AI & Typing Test ─────────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-title">✨ AI &amp; Typing Test</div>
            <div className="section-subtitle">Configure Gemini AI for paragraph generation in Typing Test</div>
          </div>

          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Gemini API Key</div>
                <div className="setting-desc">
                  Used to generate typing test paragraphs. Stored securely — never exposed to the UI or bundled.
                  {' '}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>Get a free key →</a>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>
                  {geminiKeyIsSet
                    ? <span style={{ color: '#4ade80' }}>✅ API Key Configured &amp; Active</span>
                    : <span style={{ color: 'var(--t2)' }}>⚠️ No API Key (Offline Mode — built-in paragraphs active)</span>
                  }
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveGeminiKey()}
                    placeholder={geminiKeyIsSet ? '••••••••••••••••••••••••••••••••••••••••' : 'Paste your Gemini API key (AIzaSy...)'}
                    className="data-dir-input"
                    style={{ width: '100%', paddingRight: 45, boxSizing: 'border-box' }}
                    autoComplete="off"
                  />
                  <button
                    onClick={() => setShowGeminiKey(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '0.9rem' }}
                    title={showGeminiKey ? 'Hide key' : 'Show key'}
                  >
                    {showGeminiKey ? '🙈' : '👁️'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn-primary"
                    onClick={handleSaveGeminiKey}
                    disabled={!geminiKey.trim()}
                  >
                    💾 Validate &amp; Save Key
                  </button>
                  {geminiKeyIsSet && (
                    <>
                      <button
                        className="typing-source-btn ai-btn"
                        onClick={() => handleValidateGeminiKey()}
                      >
                        🧪 Test Key
                      </button>
                      <button className="btn-danger" onClick={handleClearGeminiKey}>
                        🗑️ Clear Key
                      </button>
                    </>
                  )}
                </div>
              </div>

              {geminiStatus && (
                <div style={{
                  fontSize: '0.82rem',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: geminiStatus.startsWith('✅') ? 'rgba(34,197,94,0.1)' : geminiStatus.startsWith('⌛') ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  color: geminiStatus.startsWith('✅') ? '#4ade80' : geminiStatus.startsWith('⌛') ? '#60a5fa' : '#f87171',
                  border: '1px solid currentColor'
                }}>
                  {geminiStatus}
                </div>
              )}
            </div>

          </div>
        </section>

      </div>

      {/* Custom Theme Creator / Editor Modal */}
      <ThemeCreatorModal
        isOpen={isCreatorOpen}
        editingTheme={editingTheme}
        onClose={handleModalClose}
        onCreated={(updatedList) => {
          if (onThemesUpdated) onThemesUpdated(updatedList)
        }}
      />
    </div>
  )
}
