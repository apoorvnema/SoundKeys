import React, { useState } from 'react'

const CATEGORIES = [
  { id: 'General Knowledge', icon: '🌍', label: 'General' },
  { id: 'Technology',        icon: '💻', label: 'Technology' },
  { id: 'Science',           icon: '🔬', label: 'Science' },
  { id: 'Literature',        icon: '📚', label: 'Literature' },
  { id: 'Sports',            icon: '🏆', label: 'Sports' },
  { id: 'Music',             icon: '🎵', label: 'Music' },
  { id: 'Philosophy',        icon: '🧠', label: 'Philosophy' },
  { id: 'Nature',            icon: '🌿', label: 'Nature' },
  { id: 'History',           icon: '🏛️', label: 'History' },
  { id: 'Fun Facts',         icon: '😄', label: 'Fun Facts' },
  { id: 'Business',          icon: '💼', label: 'Business' },
  { id: 'Space',             icon: '🚀', label: 'Space' }
]

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   desc: 'Simple words, short sentences' },
  { id: 'medium', label: 'Medium', desc: 'Everyday vocabulary' },
  { id: 'hard',   label: 'Hard',   desc: 'Complex & technical' }
]

export default function ParagraphGeneratorModal({ difficulty: defaultDifficulty, onClose, onUse }) {
  const [tab, setTab]                 = useState('category') // 'category' | 'prompt'
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [customPrompt, setCustomPrompt]         = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState(defaultDifficulty || 'medium')
  const [loading, setLoading]         = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  async function handleGenerate() {
    if (tab === 'category' && !selectedCategory) return
    if (tab === 'prompt' && !customPrompt.trim()) return

    setLoading(true)
    setError('')
    setGeneratedText('')

    const res = await window.soundkeys?.geminiGenerate({
      category: tab === 'category' ? selectedCategory : null,
      prompt:   tab === 'prompt'   ? customPrompt.trim() : null,
      difficulty: selectedDifficulty
    })

    setLoading(false)
    if (res?.success) {
      setGeneratedText(res.text)
    } else {
      setError(res?.error || 'Failed to generate paragraph.')
    }
  }

  async function handleSaveAndUse() {
    setSaving(true)
    const meta = {
      category: tab === 'category' ? selectedCategory : 'Custom Prompt',
      source: 'gemini'
    }
    await window.soundkeys?.saveParagraph({ text: generatedText, ...meta })
    setSaved(true)
    setSaving(false)
    setTimeout(() => onUse(generatedText, meta), 400)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel generator-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">✨ AI Paragraph Generator</h2>
            <p className="modal-subtitle">Generate a typing test paragraph using Gemini AI</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'category' ? 'active' : ''}`} onClick={() => setTab('category')}>
            Category
          </button>
          <button className={`modal-tab ${tab === 'prompt' ? 'active' : ''}`} onClick={() => setTab('prompt')}>
            Custom Prompt
          </button>
        </div>

        {/* Category grid */}
        {tab === 'category' && (
          <div className="category-grid">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`category-chip ${selectedCategory === c.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                <span className="cat-icon">{c.icon}</span>
                <span className="cat-label">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Custom prompt input */}
        {tab === 'prompt' && (
          <div className="custom-prompt-area">
            <textarea
              className="custom-paragraph-textarea"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="e.g. Write a paragraph about deep sea exploration..."
              rows={3}
            />
          </div>
        )}

        {/* Difficulty selector */}
        <div className="modal-difficulty-row">
          <span className="modal-section-label">Difficulty:</span>
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              className={`diff-chip ${selectedDifficulty === d.id ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(d.id)}
              title={d.desc}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button
          className="typing-source-btn ai-btn generate-main-btn"
          onClick={handleGenerate}
          disabled={loading || (tab === 'category' && !selectedCategory) || (tab === 'prompt' && !customPrompt.trim())}
        >
          {loading ? <span className="spinner-inline" /> : '✨ Generate Paragraph'}
        </button>

        {/* Error */}
        {error && (
          <div className="generator-error">
            ⚠️ {error}
            {error.includes('API key') && (
              <span> Add your key in <strong>Settings → AI & Typing Test</strong>.</span>
            )}
          </div>
        )}

        {/* Generated preview */}
        {generatedText && (
          <div className="generated-preview">
            <div className="preview-label">Generated Paragraph</div>
            <div className="preview-text">{generatedText}</div>
            <div className="preview-actions">
              <button className="typing-source-btn ai-btn" onClick={() => onUse(generatedText, { category: selectedCategory || 'Custom Prompt', source: 'gemini' })}>
                ▶ Use This
              </button>
              <button className="typing-source-btn" onClick={handleGenerate} disabled={loading}>
                🔄 Regenerate
              </button>
              <button className="typing-source-btn save-para-btn" onClick={handleSaveAndUse} disabled={saving || saved}>
                {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save & Use'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
