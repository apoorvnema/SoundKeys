import React, { useState, useEffect } from 'react'

export default function ThemeCreatorModal({ isOpen, onClose, onCreated, editingTheme }) {
  const [name, setName]               = useState('')
  const [author, setAuthor]           = useState('Apoorv Nema')
  const [description, setDescription] = useState('')
  const [filesMap, setFilesMap]       = useState({})
  const [typingSlots, setTypingSlots] = useState(['typing_1'])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (editingTheme) {
      setName(editingTheme.name || '')
      setAuthor(editingTheme.author || 'Apoorv Nema')
      setDescription(editingTheme.description || '')

      if (Array.isArray(editingTheme.typing) && editingTheme.typing.length > 0) {
        setTypingSlots(editingTheme.typing.map((_, i) => `typing_${i + 1}`))
      } else {
        setTypingSlots(['typing_1'])
      }
    } else {
      setName('')
      setAuthor('Apoorv Nema')
      setDescription('')
      setFilesMap({})
      setTypingSlots(['typing_1'])
    }
  }, [editingTheme, isOpen])

  if (!isOpen) return null

  const handleFileChange = (key, event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      setFilesMap(prev => ({
        ...prev,
        [key]: Array.from(new Uint8Array(e.target.result))
      }))
    }
    reader.readAsArrayBuffer(file)
  }

  const addTypingSlot = () => {
    const nextKey = `typing_${typingSlots.length + 1}`
    setTypingSlots(prev => [...prev, nextKey])
  }

  const removeTypingSlot = (slotKey) => {
    if (typingSlots.length <= 1) return
    setTypingSlots(prev => prev.filter(s => s !== slotKey))
    setFilesMap(prev => {
      const copy = { ...prev }
      delete copy[slotKey]
      return copy
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('Please enter a theme name')
    if (!editingTheme && Object.keys(filesMap).length === 0) {
      return alert('Please upload at least one audio file')
    }

    setIsSubmitting(true)
    try {
      let updatedThemes
      if (editingTheme) {
        updatedThemes = await window.soundkeys?.updateTheme(editingTheme.id, {
          name,
          author,
          description,
          filesMap
        })
      } else {
        updatedThemes = await window.soundkeys?.createTheme({
          name,
          author,
          description,
          filesMap
        })
      }

      if (updatedThemes) {
        onCreated(updatedThemes)
        onClose()
      }
    } catch (err) {
      console.error('Failed to save theme:', err)
      alert('Failed to save theme. Please check your files.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEditing = Boolean(editingTheme)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? `Edit Theme: ${editingTheme.name || editingTheme.id}` : 'Create New Sound Theme'}</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Theme Name *</label>
            <input
              type="text"
              placeholder="e.g. Cyberpunk Mechanical"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Author</label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
              />
            </div>
            <div className="form-group flex-2">
              <label>Description</label>
              <input
                type="text"
                placeholder="Short description"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="form-section-header">
            <div className="form-section-label">Typing Sounds (Random Selection Pool)</div>
            <p className="form-section-subtitle">
              Add any number of typing audio files (e.g. keyboard1, keyboard2, keyboard3). Plays randomly on each keypress, just like OperaGX.
            </p>
          </div>

          <div className="typing-slots-list">
            {typingSlots.map((slotKey, index) => {
              const existingFile = isEditing && Array.isArray(editingTheme?.typing) ? editingTheme.typing[index] : null
              return (
                <div key={slotKey} className="sound-file-item typing-slot-row">
                  <div className="sound-file-info-col">
                    <span className="sound-key-label">Typing Sound #{index + 1} {index === 0 && !isEditing ? '*' : ''}</span>
                    {existingFile && (
                      <span className="existing-file-tag" title="Existing saved sound file">
                        🎵 Saved: {existingFile}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".wav,.mp3,.ogg"
                    onChange={e => handleFileChange(slotKey, e)}
                    required={!isEditing && index === 0}
                  />
                  {typingSlots.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => removeTypingSlot(slotKey)}
                      title="Remove sound slot"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              className="btn-add-slot"
              onClick={addTypingSlot}
            >
              + Add Another Typing Sound
            </button>
          </div>

          <div className="form-section-header margin-top-md">
            <div className="form-section-label">Special Keys Audio (Optional)</div>
          </div>

          <div className="sound-file-grid">
            {[
              { key: 'spacebar', label: 'Spacebar' },
              { key: 'enter', label: 'Enter Key' },
              { key: 'backspace', label: 'Backspace' },
              { key: 'escape', label: 'Escape' },
              { key: 'tab', label: 'Tab' },
              { key: 'functionKeys', label: 'Function Keys' }
            ].map(item => {
              const existingFile = isEditing ? editingTheme?.[item.key] : null
              return (
                <div key={item.key} className="sound-file-item">
                  <span className="sound-key-label">{item.label}</span>
                  {existingFile && (
                    <span className="existing-file-tag">
                      🎵 Saved: {existingFile}
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".wav,.mp3,.ogg"
                    onChange={e => handleFileChange(item.key, e)}
                  />
                </div>
              )
            })}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Save & Activate Theme')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
