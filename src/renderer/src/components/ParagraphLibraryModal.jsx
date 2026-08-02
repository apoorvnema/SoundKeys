import React, { useState, useEffect } from 'react'

export default function ParagraphLibraryModal({ onClose, onUse }) {
  const [paragraphs, setParagraphs] = useState([])
  const [loading, setLoading]       = useState(true)
  const [statusMsg, setStatusMsg]   = useState('')

  useEffect(() => {
    loadParagraphs()
  }, [])

  async function loadParagraphs() {
    setLoading(true)
    try {
      if (typeof window.soundkeys?.getParagraphs === 'function') {
        const list = await window.soundkeys.getParagraphs()
        setParagraphs((list || []).slice().reverse())
      }
    } catch (err) {
      console.warn(err)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    try {
      if (typeof window.soundkeys?.deleteParagraph === 'function') {
        await window.soundkeys.deleteParagraph(id)
        setParagraphs(prev => prev.filter(p => p.id !== id))
        setStatusMsg('🗑️ Deleted')
        setTimeout(() => setStatusMsg(''), 2000)
      }
    } catch (err) {
      console.warn(err)
    }
  }

  async function handleExport() {
    try {
      if (typeof window.soundkeys?.exportParagraphs === 'function') {
        const ok = await window.soundkeys.exportParagraphs()
        setStatusMsg(ok ? '📤 Exported!' : '❌ Export cancelled')
        setTimeout(() => setStatusMsg(''), 2500)
      }
    } catch (err) {
      console.warn(err)
    }
  }

  async function handleImport() {
    try {
      if (typeof window.soundkeys?.importParagraphs === 'function') {
        const res = await window.soundkeys.importParagraphs()
        if (res?.success) {
          setStatusMsg(`📥 Imported ${res.imported} paragraph${res.imported !== 1 ? 's' : ''}`)
          loadParagraphs()
        } else {
          setStatusMsg(res?.error || '❌ Import cancelled')
        }
        setTimeout(() => setStatusMsg(''), 2500)
      }
    } catch (err) {
      console.warn(err)
    }
  }

  function handleUse(p) {
    try {
      if (typeof window.soundkeys?.useParagraph === 'function') {
        window.soundkeys.useParagraph(p.id)
      }
    } catch (_) {}
    onUse(p.text, { category: p.category, source: p.source })
  }


  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel library-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">📚 Paragraph Library</h2>
            <p className="modal-subtitle">Your saved typing test paragraphs</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Toolbar */}
        <div className="library-toolbar">
          <button className="typing-source-btn lib-btn" onClick={handleImport}>📥 Import</button>
          <button className="typing-source-btn" onClick={handleExport}>📤 Export All</button>
          {statusMsg && <span className="library-status">{statusMsg}</span>}
        </div>

        {/* List */}
        <div className="library-list">
          {loading ? (
            <div className="library-empty"><span className="spinner-inline" /> Loading...</div>
          ) : paragraphs.length === 0 ? (
            <div className="library-empty">
              <p>No saved paragraphs yet.</p>
              <p className="dim-text">Use "AI Generate" or finish a test and save the paragraph.</p>
            </div>
          ) : (
            paragraphs.map(p => (
              <div key={p.id} className="library-item">
                <div className="library-item-meta">
                  <span className="result-badge category-badge">{p.category}</span>
                  <span className="result-badge">{p.source}</span>
                  <span className="dim-text" style={{ fontSize: '0.75rem' }}>
                    {new Date(p.savedAt).toLocaleDateString()} · Used {p.timesUsed || 0}×
                  </span>
                </div>
                <p className="library-item-preview">{p.text.substring(0, 120)}{p.text.length > 120 ? '…' : ''}</p>
                <div className="library-item-actions">
                  <button className="typing-source-btn ai-btn" onClick={() => handleUse(p)}>▶ Use</button>
                  <button className="typing-source-btn delete-btn" onClick={() => handleDelete(p.id)}>🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
