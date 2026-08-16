import React, { useState, useEffect } from 'react'

/**
 * HotkeyBindingsPanel — Component for creating & managing custom key combination sound bindings.
 */

function ComboRecorder({ value, onChange }) {
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

    const newCombo = [...modifiers, key].join('+')
    onChange(newCombo)
    setIsRecording(false)
  }

  return (
    <div className="combo-recorder">
      {isRecording ? (
        <input
          type="text"
          className="hotkey-input recording"
          value="Press keys... (Esc to cancel)"
          onKeyDown={handleKeyDown}
          autoFocus
          onBlur={() => setIsRecording(false)}
          readOnly
        />
      ) : (
        <div className="combo-display">
          <kbd className="hotkey-badge">{value || 'Click to Record'}</kbd>
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => setIsRecording(true)}
          >
            {value ? 'Re-record' : 'Record Combo'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function HotkeyBindingsPanel() {
  const [bindings, setBindings] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Form states
  const [combo, setCombo]             = useState('')
  const [label, setLabel]             = useState('')
  const [soundType, setSoundType]     = useState('typing')
  const [externalFile, setExternalFile] = useState('')
  const [errorMsg, setErrorMsg]       = useState('')

  useEffect(() => {
    async function loadBindings() {
      if (window.soundkeys?.getHotkeyBindings) {
        const list = await window.soundkeys.getHotkeyBindings()
        setBindings(list || [])
      }
    }
    loadBindings()
  }, [])

  const resetForm = () => {
    setCombo('')
    setLabel('')
    setSoundType('typing')
    setExternalFile('')
    setErrorMsg('')
    setEditingId(null)
    setIsFormOpen(false)
  }

  const handlePickExternalFile = async () => {
    if (window.soundkeys?.pickOverrideFile) {
      const file = await window.soundkeys.pickOverrideFile()
      if (file) setExternalFile(file)
    }
  }

  const handleSave = async () => {
    if (!combo) {
      setErrorMsg('Please record a key combination.')
      return
    }

    // Validate combo with main process
    if (window.soundkeys?.testHotkeyCombo) {
      const testRes = await window.soundkeys.testHotkeyCombo(combo)
      if (!testRes.valid) {
        setErrorMsg(testRes.error || 'Invalid key combination.')
        return
      }
    }

    if (soundType === '__external__' && !externalFile) {
      setErrorMsg('Please select an external audio file.')
      return
    }

    const newBinding = {
      id: editingId || Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      combo,
      label: label || combo,
      soundType: soundType === '__external__' ? 'typing' : soundType,
      externalFile: soundType === '__external__' ? externalFile : null
    }

    let updated = []
    if (editingId) {
      updated = bindings.map(b => (b.id === editingId ? newBinding : b))
    } else {
      updated = [...bindings, newBinding]
    }

    setBindings(updated)
    if (window.soundkeys?.setHotkeyBindings) {
      await window.soundkeys.setHotkeyBindings(updated)
    }

    resetForm()
  }

  const handleEdit = (b) => {
    setEditingId(b.id)
    setCombo(b.combo)
    setLabel(b.label || b.combo)
    if (b.externalFile) {
      setSoundType('__external__')
      setExternalFile(b.externalFile)
    } else {
      setSoundType(b.soundType || 'typing')
      setExternalFile('')
    }
    setErrorMsg('')
    setIsFormOpen(true)
  }

  const handleDelete = async (id) => {
    const updated = bindings.filter(b => b.id !== id)
    setBindings(updated)
    if (window.soundkeys?.setHotkeyBindings) {
      await window.soundkeys.setHotkeyBindings(updated)
    }
  }

  return (
    <div className="hotkey-bindings-panel">
      <div className="panel-header-row">
        <div>
          <h4 className="panel-subtitle">Custom Hotkey Audio Bindings</h4>
          <p className="panel-desc">
            Assign custom sound clips to key shortcuts (e.g. <code>Ctrl+C</code>, <code>Ctrl+Shift+Alt+Q+S</code>).
            Matching shortcuts suppress standard keypress sound.
          </p>
        </div>
        {!isFormOpen && (
          <button className="btn-primary-sm" onClick={() => setIsFormOpen(true)}>
            ＋ Add Binding
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="binding-editor-card">
          <h5 className="editor-title">{editingId ? 'Edit Binding' : 'New Hotkey Binding'}</h5>

          {errorMsg && <div className="binding-error-alert">⚠️ {errorMsg}</div>}

          <div className="editor-grid">
            <div className="form-group">
              <label>Key Combination</label>
              <ComboRecorder value={combo} onChange={setCombo} />
            </div>

            <div className="form-group">
              <label>Label (Optional Name)</label>
              <input
                type="text"
                className="input-text-sm"
                placeholder="e.g. Copy Sound"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Sound Type / Clip</label>
              <select
                className="select-sm"
                value={soundType}
                onChange={e => setSoundType(e.target.value)}
              >
                <option value="typing">Default Typing Sound</option>
                <option value="enter">Enter Sound</option>
                <option value="spacebar">Spacebar Sound</option>
                <option value="backspace">Backspace Sound</option>
                <option value="escape">Escape Sound</option>
                <option value="tab">Tab Sound</option>
                <option value="__external__">📁 Custom Audio File...</option>
              </select>
            </div>

            {soundType === '__external__' && (
              <div className="form-group full-width">
                <label>Audio File</label>
                <div className="file-picker-row">
                  <input
                    type="text"
                    className="input-text-sm readonly"
                    value={externalFile || 'No file selected'}
                    readOnly
                  />
                  <button className="btn-secondary-sm" onClick={handlePickExternalFile}>
                    Browse...
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="editor-actions">
            <button className="btn-secondary-sm" onClick={resetForm}>
              Cancel
            </button>
            <button className="btn-primary-sm" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Create Binding'}
            </button>
          </div>
        </div>
      )}

      <div className="bindings-list">
        {bindings.length === 0 ? (
          <div className="empty-bindings-state">
            No hotkey sound bindings configured yet. Click "Add Binding" to set custom audio on key shortcuts.
          </div>
        ) : (
          bindings.map(b => (
            <div key={b.id} className="binding-card-row">
              <div className="binding-left">
                <kbd className="hotkey-badge">{b.combo}</kbd>
                <span className="binding-label">{b.label}</span>
                <span className="binding-sound-tag">
                  🔊 {b.externalFile ? b.externalFile.split('\\').pop().split('/').pop() : b.soundType}
                </span>
              </div>
              <div className="binding-actions">
                <button className="btn-icon-sm" onClick={() => handleEdit(b)} title="Edit Binding">
                  ✏️
                </button>
                <button className="btn-icon-sm danger" onClick={() => handleDelete(b.id)} title="Delete Binding">
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
