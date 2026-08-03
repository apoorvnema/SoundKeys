import React, { useState, useEffect, useRef } from 'react'

// ─── 104-Key ANSI Keyboard Layout Definition ─────────────────────────────
const KEYBOARD_ROWS = [
  // Row 0: Function Keys & System Cluster
  [
    { keycode: 1, label: 'Esc', defaultSound: 'escape', width: 1 },
    { isSpacer: true, width: 0.5 },
    { keycode: 59, label: 'F1', defaultSound: 'functionKeys', width: 1 },
    { keycode: 60, label: 'F2', defaultSound: 'functionKeys', width: 1 },
    { keycode: 61, label: 'F3', defaultSound: 'functionKeys', width: 1 },
    { keycode: 62, label: 'F4', defaultSound: 'functionKeys', width: 1 },
    { isSpacer: true, width: 0.5 },
    { keycode: 63, label: 'F5', defaultSound: 'functionKeys', width: 1 },
    { keycode: 64, label: 'F6', defaultSound: 'functionKeys', width: 1 },
    { keycode: 65, label: 'F7', defaultSound: 'functionKeys', width: 1 },
    { keycode: 66, label: 'F8', defaultSound: 'functionKeys', width: 1 },
    { isSpacer: true, width: 0.5 },
    { keycode: 67, label: 'F9', defaultSound: 'functionKeys', width: 1 },
    { keycode: 68, label: 'F10', defaultSound: 'functionKeys', width: 1 },
    { keycode: 87, label: 'F11', defaultSound: 'functionKeys', width: 1 },
    { keycode: 88, label: 'F12', defaultSound: 'functionKeys', width: 1 },
    { isSpacer: true, width: 0.5 },
    { keycode: 3639, label: 'PrtSc', defaultSound: null, width: 1 },
    { keycode: 70, label: 'ScrlLk', defaultSound: null, width: 1 },
    { keycode: 3650, label: 'Pause', defaultSound: null, width: 1 }
  ],
  // Row 1: Number Row & Nav Top
  [
    { keycode: 41, label: '`', defaultSound: 'typing', width: 1 },
    { keycode: 2, label: '1', defaultSound: 'typing', width: 1 },
    { keycode: 3, label: '2', defaultSound: 'typing', width: 1 },
    { keycode: 4, label: '3', defaultSound: 'typing', width: 1 },
    { keycode: 5, label: '4', defaultSound: 'typing', width: 1 },
    { keycode: 6, label: '5', defaultSound: 'typing', width: 1 },
    { keycode: 7, label: '6', defaultSound: 'typing', width: 1 },
    { keycode: 8, label: '7', defaultSound: 'typing', width: 1 },
    { keycode: 9, label: '8', defaultSound: 'typing', width: 1 },
    { keycode: 10, label: '9', defaultSound: 'typing', width: 1 },
    { keycode: 11, label: '0', defaultSound: 'typing', width: 1 },
    { keycode: 12, label: '-', defaultSound: 'typing', width: 1 },
    { keycode: 13, label: '=', defaultSound: 'typing', width: 1 },
    { keycode: 14, label: 'Backspace', defaultSound: 'backspace', width: 2 },
    { isSpacer: true, width: 0.5 },
    { keycode: 338, label: 'Ins', defaultSound: null, width: 1 },
    { keycode: 327, label: 'Home', defaultSound: null, width: 1 },
    { keycode: 329, label: 'PgUp', defaultSound: null, width: 1 }
  ],
  // Row 2: QWERTY Row & Nav Mid
  [
    { keycode: 15, label: 'Tab', defaultSound: 'tab', width: 1.5 },
    { keycode: 16, label: 'Q', defaultSound: 'typing', width: 1 },
    { keycode: 17, label: 'W', defaultSound: 'typing', width: 1 },
    { keycode: 18, label: 'E', defaultSound: 'typing', width: 1 },
    { keycode: 19, label: 'R', defaultSound: 'typing', width: 1 },
    { keycode: 20, label: 'T', defaultSound: 'typing', width: 1 },
    { keycode: 21, label: 'Y', defaultSound: 'typing', width: 1 },
    { keycode: 22, label: 'U', defaultSound: 'typing', width: 1 },
    { keycode: 23, label: 'I', defaultSound: 'typing', width: 1 },
    { keycode: 24, label: 'O', defaultSound: 'typing', width: 1 },
    { keycode: 25, label: 'P', defaultSound: 'typing', width: 1 },
    { keycode: 26, label: '[', defaultSound: 'typing', width: 1 },
    { keycode: 27, label: ']', defaultSound: 'typing', width: 1 },
    { keycode: 43, label: '\\', defaultSound: 'typing', width: 1.5 },
    { isSpacer: true, width: 0.5 },
    { keycode: 339, label: 'Del', defaultSound: null, width: 1 },
    { keycode: 335, label: 'End', defaultSound: null, width: 1 },
    { keycode: 337, label: 'PgDn', defaultSound: null, width: 1 }
  ],
  // Row 3: Home Row
  [
    { keycode: 58, label: 'Caps Lock', defaultSound: null, width: 1.75 },
    { keycode: 30, label: 'A', defaultSound: 'typing', width: 1 },
    { keycode: 31, label: 'S', defaultSound: 'typing', width: 1 },
    { keycode: 32, label: 'D', defaultSound: 'typing', width: 1 },
    { keycode: 33, label: 'F', defaultSound: 'typing', width: 1 },
    { keycode: 34, label: 'G', defaultSound: 'typing', width: 1 },
    { keycode: 35, label: 'H', defaultSound: 'typing', width: 1 },
    { keycode: 36, label: 'J', defaultSound: 'typing', width: 1 },
    { keycode: 37, label: 'K', defaultSound: 'typing', width: 1 },
    { keycode: 38, label: 'L', defaultSound: 'typing', width: 1 },
    { keycode: 39, label: ';', defaultSound: 'typing', width: 1 },
    { keycode: 40, label: "'", defaultSound: 'typing', width: 1 },
    { keycode: 28, label: 'Enter', defaultSound: 'enter', width: 2.25 },
    { isSpacer: true, width: 3.5 }
  ],
  // Row 4: Bottom Alpha Row & Up Arrow
  [
    { keycode: 42, label: 'Shift', defaultSound: null, width: 2.25 },
    { keycode: 44, label: 'Z', defaultSound: 'typing', width: 1 },
    { keycode: 45, label: 'X', defaultSound: 'typing', width: 1 },
    { keycode: 46, label: 'C', defaultSound: 'typing', width: 1 },
    { keycode: 47, label: 'V', defaultSound: 'typing', width: 1 },
    { keycode: 48, label: 'B', defaultSound: 'typing', width: 1 },
    { keycode: 49, label: 'N', defaultSound: 'typing', width: 1 },
    { keycode: 50, label: 'M', defaultSound: 'typing', width: 1 },
    { keycode: 51, label: ',', defaultSound: 'typing', width: 1 },
    { keycode: 52, label: '.', defaultSound: 'typing', width: 1 },
    { keycode: 53, label: '/', defaultSound: 'typing', width: 1 },
    { keycode: 54, label: 'Shift', defaultSound: null, width: 2.75 },
    { isSpacer: true, width: 1.5 },
    { keycode: 328, label: '↑', defaultSound: null, width: 1 },
    { isSpacer: true, width: 1 }
  ],
  // Row 5: Bottom Modifier Row & Arrow Cluster
  [
    { keycode: 29, label: 'Ctrl', defaultSound: null, width: 1.25 },
    { keycode: 347, label: 'Win', defaultSound: null, width: 1.25 },
    { keycode: 56, label: 'Alt', defaultSound: null, width: 1.25 },
    { keycode: 57, label: 'Space', defaultSound: 'spacebar', width: 6.25 },
    { keycode: 312, label: 'Alt', defaultSound: null, width: 1.25 },
    { keycode: 348, label: 'Win', defaultSound: null, width: 1.25 },
    { keycode: 3677, label: 'Menu', defaultSound: null, width: 1.25 },
    { keycode: 285, label: 'Ctrl', defaultSound: null, width: 1.25 },
    { isSpacer: true, width: 0.5 },
    { keycode: 331, label: '←', defaultSound: null, width: 1 },
    { keycode: 336, label: '↓', defaultSound: null, width: 1 },
    { keycode: 333, label: '→', defaultSound: null, width: 1 }
  ]
]

// Keycode alias lookup to match scan code events in tester mode
const KEYCODE_ALIAS_MAP = {
  284: 28, 3612: 28, // Enter
  285: 29, 3613: 29, // Ctrl
  54: 42,           // Shift
  312: 56, 3640: 56, // Alt
  348: 347, 3675: 347, 3676: 347, // Win
  57416: 328, 3640: 328, // Up
  57424: 336, 3648: 336, // Down
  57419: 331, 3643: 331, // Left
  57421: 333, 3645: 333, // Right
  3655: 327, 57399: 327, // Home
  3663: 335, 57401: 335, // End
  3657: 329, 57397: 329, // PgUp
  3665: 337, 57405: 337, // PgDn
  3666: 338, 57426: 338, // Insert
  3667: 339, 57427: 339  // Delete
}

function resolvePrimary(kc) {
  return KEYCODE_ALIAS_MAP[kc] || kc
}

const SOUND_TYPES = [
  { id: 'typing', label: 'Typing Sound' },
  { id: 'spacebar', label: 'Spacebar Sound' },
  { id: 'enter', label: 'Enter Key Sound' },
  { id: 'backspace', label: 'Backspace Sound' },
  { id: 'escape', label: 'Escape Key Sound' },
  { id: 'tab', label: 'Tab Key Sound' },
  { id: 'functionKeys', label: 'Function Key Sound' }
]

export default function KeyboardLayout() {
  const [activeTab, setActiveTab] = useState('config') // 'config' | 'tester'
  const [overrides, setOverrides] = useState({})
  const [selectedKey, setSelectedKey] = useState(null) // key object selected for config
  const [pressedKeys, setPressedKeys] = useState(new Set()) // keycodes currently down (tester mode)
  const [keyLog, setKeyLog] = useState([]) // last 10 pressed keys (tester mode)

  // Config Modal State
  const [configMode, setConfigMode] = useState('normal') // 'normal' | 'disabled' | 'builtin' | 'external'
  const [selectedBuiltin, setSelectedBuiltin] = useState('typing')
  const [externalPath, setExternalPath] = useState('')

  const releaseTimersRef = useRef({})

  // ── Load Overrides ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (window.soundkeys?.getKeyOverrides) {
        try {
          const ov = await window.soundkeys.getKeyOverrides()
          setOverrides(ov || {})
        } catch (e) {
          console.error('[KeyLayout] Failed to load overrides:', e)
        }
      }
    }
    load()
  }, [])

  // ── Subscribe to Keydown / Keyup Events for Tester Mode ───────────────
  useEffect(() => {
    if (!window.soundkeys) return

    const unsubDown = window.soundkeys.onKeyLayoutDown(({ keycode }) => {
      const primary = resolvePrimary(keycode)
      setPressedKeys(prev => {
        const next = new Set(prev)
        next.add(primary)
        return next
      })

      // Cancel pending release timer if re-pressed quickly
      if (releaseTimersRef.current[primary]) {
        clearTimeout(releaseTimersRef.current[primary])
        delete releaseTimersRef.current[primary]
      }

      // Find label for key log
      let label = `Key_${keycode}`
      for (const row of KEYBOARD_ROWS) {
        for (const k of row) {
          if (k.keycode === primary) {
            label = k.label
            break
          }
        }
      }

      setKeyLog(prev => [
        { id: Date.now() + Math.random(), label, keycode, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9)
      ])
    })

    const unsubUp = window.soundkeys.onKeyLayoutUp(({ keycode }) => {
      const primary = resolvePrimary(keycode)
      // Fade unglow after 250ms
      releaseTimersRef.current[primary] = setTimeout(() => {
        setPressedKeys(prev => {
          const next = new Set(prev)
          next.delete(primary)
          return next
        })
        delete releaseTimersRef.current[primary]
      }, 250)
    })

    return () => {
      unsubDown?.()
      unsubUp?.()
      Object.values(releaseTimersRef.current).forEach(t => clearTimeout(t))
    }
  }, [])

  // ── Key Click Handler (Config Mode) ────────────────────────────────────
  const handleKeyClick = (keyObj) => {
    if (activeTab !== 'config' || keyObj.isSpacer) return
    const primary = resolvePrimary(keyObj.keycode)
    const ov = overrides[primary]

    setSelectedKey(keyObj)

    if (ov?.disabled) {
      setConfigMode('disabled')
      setSelectedBuiltin('typing')
      setExternalPath('')
    } else if (ov?.externalFile) {
      setConfigMode('external')
      setSelectedBuiltin('typing')
      setExternalPath(ov.externalFile)
    } else if (ov?.soundOverride) {
      setConfigMode('builtin')
      setSelectedBuiltin(ov.soundOverride)
      setExternalPath('')
    } else {
      setConfigMode('normal')
      setSelectedBuiltin(keyObj.defaultSound || 'typing')
      setExternalPath('')
    }
  }

  // ── Browse External File ───────────────────────────────────────────────
  const handleBrowseFile = async () => {
    if (window.soundkeys?.pickOverrideFile) {
      const path = await window.soundkeys.pickOverrideFile()
      if (path) setExternalPath(path)
    }
  }

  // ── Save Override ──────────────────────────────────────────────────────
  const handleSaveOverride = async () => {
    if (!selectedKey) return
    const primary = resolvePrimary(selectedKey.keycode)

    let updateData = { keycode: primary, disabled: false, soundOverride: null, externalFile: null }

    if (configMode === 'disabled') {
      updateData.disabled = true
    } else if (configMode === 'builtin') {
      updateData.soundOverride = selectedBuiltin
    } else if (configMode === 'external' && externalPath) {
      updateData.externalFile = externalPath
    }

    if (window.soundkeys?.setKeyOverride) {
      const updated = await window.soundkeys.setKeyOverride(updateData)
      setOverrides(updated || {})
    }
    setSelectedKey(null)
  }

  // ── Reset All Overrides ────────────────────────────────────────────────
  const handleResetAll = async () => {
    if (window.soundkeys?.resetKeyOverrides) {
      const res = await window.soundkeys.resetKeyOverrides()
      setOverrides(res || {})
    }
  }

  // ── Stats Calculation ──────────────────────────────────────────────────
  let disabledCount = 0
  let overriddenCount = 0
  let totalKeys = 0

  KEYBOARD_ROWS.forEach(row => {
    row.forEach(k => {
      if (!k.isSpacer) {
        totalKeys++
        const ov = overrides[resolvePrimary(k.keycode)]
        if (ov?.disabled) disabledCount++
        else if (ov?.soundOverride || ov?.externalFile) overriddenCount++
      }
    })
  })

  return (
    <div className="keyboard-page">
      {/* Top Controls Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Keyboard Layout</h1>
          <p className="page-subtitle">Configure per-key audio behavior or perform a real-time keypress test</p>
        </div>

        {/* Mode Tabs */}
        <div className="keyboard-tab-strip">
          <button
            className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙ Layout Config
          </button>
          <button
            className={`tab-btn ${activeTab === 'tester' ? 'active' : ''}`}
            onClick={() => setActiveTab('tester')}
          >
            🎹 Key Tester
          </button>
        </div>
      </div>

      {/* Mode 1 Stats / Controls bar */}
      <div className="keyboard-stats-bar glass-card">
        <div className="stats-pills">
          <span className="stat-pill total">
            <span className="pill-dot green" />
            Active: {totalKeys - disabledCount}
          </span>
          <span className="stat-pill disabled">
            <span className="pill-dot red" />
            Disabled: {disabledCount}
          </span>
          <span className="stat-pill override">
            <span className="pill-dot amber" />
            Overridden: {overriddenCount}
          </span>
        </div>

        {activeTab === 'config' && (
          <button
            className="btn-secondary-sm"
            onClick={handleResetAll}
            disabled={disabledCount === 0 && overriddenCount === 0}
          >
            🔄 Reset All Overrides
          </button>
        )}
      </div>

      {/* Visual 104-Key Board Container */}
      <div className="keyboard-container glass-card">
        <div className="keyboard-board">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="keyboard-row">
              {row.map((kObj, kIdx) => {
                if (kObj.isSpacer) {
                  return (
                    <div
                      key={`spacer-${rIdx}-${kIdx}`}
                      className="key-spacer"
                      style={{ flex: kObj.width }}
                    />
                  )
                }

                const primary = resolvePrimary(kObj.keycode)
                const ov = overrides[primary]
                const isPressed = pressedKeys.has(primary)

                let keyStatusClass = 'status-normal'
                if (ov?.disabled) keyStatusClass = 'status-disabled'
                else if (ov?.externalFile) keyStatusClass = 'status-external'
                else if (ov?.soundOverride) keyStatusClass = 'status-builtin'

                return (
                  <button
                    key={primary}
                    className={`key-tile key-w-${kObj.width.toString().replace('.', '-')} ${keyStatusClass} ${isPressed ? 'key-pressed' : ''}`}
                    style={{ flex: kObj.width }}
                    onClick={() => handleKeyClick(kObj)}
                    title={`${kObj.label} (${ov?.disabled ? 'Muted' : ov?.externalFile ? 'Custom File' : ov?.soundOverride ? `Override: ${ov.soundOverride}` : `Default: ${kObj.defaultSound || 'None'}`})`}
                  >
                    <span className="key-label">{kObj.label}</span>
                    {ov?.disabled && <span className="key-badge badge-mute">🔇</span>}
                    {ov?.soundOverride && !ov?.disabled && <span className="key-badge badge-sound">🎵</span>}
                    {ov?.externalFile && !ov?.disabled && <span className="key-badge badge-file">📁</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mode 2: Key Log Strip (Tester Mode) */}
      {activeTab === 'tester' && (
        <div className="key-log-container glass-card margin-top-md">
          <div className="key-log-header">
            <span>⚡ Live Keypress Log</span>
            <span className="text-muted text-xs">Press any physical key to test visual glow</span>
          </div>
          <div className="key-log-chips">
            {keyLog.length === 0 ? (
              <div className="text-muted text-sm" style={{ padding: '8px 0' }}>No keys pressed yet... type away on your keyboard!</div>
            ) : (
              keyLog.map(item => (
                <div key={item.id} className="key-log-chip">
                  <span className="chip-key">{item.label}</span>
                  <span className="chip-time">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Key Config Popover Modal */}
      {selectedKey && (
        <div className="modal-overlay" onClick={() => setSelectedKey(null)}>
          <div className="modal-content key-popover-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Configure Key: "{selectedKey.label}"</h3>
              <button className="modal-close-btn" onClick={() => setSelectedKey(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="info-box-sm margin-bottom-md">
                Default sound type: <strong>{selectedKey.defaultSound || 'None (Silent)'}</strong>
              </div>

              {/* Action Radio Options */}
              <div className="config-option-group">
                <label className={`config-radio-tile ${configMode === 'normal' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="configMode"
                    value="normal"
                    checked={configMode === 'normal'}
                    onChange={() => setConfigMode('normal')}
                  />
                  <div>
                    <div className="tile-title">🟢 Default Behavior</div>
                    <div className="tile-desc">Play normal sound configured in active theme</div>
                  </div>
                </label>

                <label className={`config-radio-tile ${configMode === 'disabled' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="configMode"
                    value="disabled"
                    checked={configMode === 'disabled'}
                    onChange={() => setConfigMode('disabled')}
                  />
                  <div>
                    <div className="tile-title">🔴 Disable / Mute Key</div>
                    <div className="tile-desc">No sound plays and tray icon will not flash on press</div>
                  </div>
                </label>

                <label className={`config-radio-tile ${configMode === 'builtin' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="configMode"
                    value="builtin"
                    checked={configMode === 'builtin'}
                    onChange={() => setConfigMode('builtin')}
                  />
                  <div>
                    <div className="tile-title">🟡 Built-in Sound Override</div>
                    <div className="tile-desc">Play a specific sound category from active theme</div>
                  </div>
                </label>

                {configMode === 'builtin' && (
                  <div className="sub-config-box">
                    <label className="input-label-sm">Select Override Category:</label>
                    <select
                      className="select-input"
                      value={selectedBuiltin}
                      onChange={e => setSelectedBuiltin(e.target.value)}
                    >
                      {SOUND_TYPES.map(st => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <label className={`config-radio-tile ${configMode === 'external' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="configMode"
                    value="external"
                    checked={configMode === 'external'}
                    onChange={() => setConfigMode('external')}
                  />
                  <div>
                    <div className="tile-title">🔵 External Audio File</div>
                    <div className="tile-desc">Play a custom WAV/MP3 sound file from disk</div>
                  </div>
                </label>

                {configMode === 'external' && (
                  <div className="sub-config-box">
                    <label className="input-label-sm">Audio File Path:</label>
                    <div className="flex-gap-sm">
                      <input
                        type="text"
                        className="data-dir-input"
                        value={externalPath}
                        readOnly
                        placeholder="No audio file selected..."
                      />
                      <button className="btn-secondary-sm" onClick={handleBrowseFile}>
                        Browse...
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer flex-end gap-sm">
              <button className="btn-secondary" onClick={() => setSelectedKey(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveOverride}>
                💾 Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
