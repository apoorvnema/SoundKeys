import React, { useState } from 'react'

export default function ThemeCreatorModal({ isOpen, onClose, onCreated }) {
  const [name, setName]               = useState('')
  const [author, setAuthor]           = useState('Apoorv Nema')
  const [description, setDescription] = useState('')
  const [filesMap, setFilesMap]       = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('Please enter a theme name')
    if (Object.keys(filesMap).length === 0) return alert('Please upload at least one audio file')

    setIsSubmitting(true)
    try {
      const updatedThemes = await window.soundkeys?.createTheme({
        name,
        author,
        description,
        filesMap
      })
      if (updatedThemes) {
        onCreated(updatedThemes)
        onClose()
      }
    } catch (err) {
      console.error('Failed to create theme:', err)
      alert('Failed to create theme. Please check your files.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Sound Theme</h2>
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

          <div className="form-section-label">Sound Mapping (WAV Files)</div>

          <div className="sound-file-grid">
            <div className="sound-file-item">
              <span className="sound-key-label">Typing Sound (Main) *</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('typing_1', e)}
                required
              />
            </div>

            <div className="sound-file-item">
              <span className="sound-key-label">Spacebar</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('spacebar', e)}
              />
            </div>

            <div className="sound-file-item">
              <span className="sound-key-label">Enter Key</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('enter', e)}
              />
            </div>

            <div className="sound-file-item">
              <span className="sound-key-label">Backspace</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('backspace', e)}
              />
            </div>

            <div className="sound-file-item">
              <span className="sound-key-label">Escape</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('escape', e)}
              />
            </div>

            <div className="sound-file-item">
              <span className="sound-key-label">Tab</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={e => handleFileChange('tab', e)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Save & Activate Theme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
