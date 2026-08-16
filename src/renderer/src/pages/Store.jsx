import React, { useState, useEffect, useCallback } from 'react'
import ThemeCreatorModal from '../components/ThemeCreatorModal'

/**
 * Store — Dedicated Sound Pack & Theme Store page.
 *
 * Tab 1: Browse (Store packs)
 * Tab 2: My Themes (Installed & Custom Themes manager)
 */

function ThemeCard({ theme, isActive, onSelect, onEdit, onDelete }) {
  const wavCount = Object.values(theme).filter(
    v => typeof v === 'string' && v.toLowerCase().endsWith('.wav')
  ).length + (Array.isArray(theme.typing) ? theme.typing.length - 1 : 0)

  const isDefault = theme.id === 'default'

  return (
    <div className={`theme-card ${isActive ? 'active' : ''}`}>
      <div className="theme-card-main" onClick={() => onSelect(theme.id)}>
        <div className="theme-card-icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            {theme.perKeyMapping ? (
              <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM6 12v6M9 12v6M12 12v6M15 12v6M18 12v6M6 4v8M9 4v8M12 4v8M15 4v8M18 4v8" stroke="currentColor" strokeWidth="1.5"/>
            ) : (
              <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            )}
          </svg>
        </div>
        <div className="theme-card-body">
          <div className="theme-card-name-row">
            <span className="theme-card-name">{theme.name || theme.id}</span>
            {isDefault && <span className="builtin-badge">Built-in</span>}
            {theme.perKeyMapping && <span className="perkey-badge">Per-Key Piano</span>}
          </div>
          <div className="theme-card-meta">
            {wavCount > 0 ? `${wavCount} sound${wavCount !== 1 ? 's' : ''}` : 'Custom Sound Pack'}
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
          {onEdit && (
            <button
              className="btn-theme-action"
              onClick={(e) => { e.stopPropagation(); onEdit(theme) }}
              title="Edit theme config & sounds"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              className="btn-theme-action danger"
              onClick={(e) => { e.stopPropagation(); onDelete(theme) }}
              title="Delete custom theme"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Store({ themes, currentTheme, onThemeSwitch, onThemesUpdated }) {
  const [activeTab, setActiveTab]         = useState('browse')
  const [storePacks, setStorePacks]       = useState([])
  const [searchQuery, setSearchQuery]     = useState('')
  const [selectedTag, setSelectedTag]     = useState('all')

  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [editingTheme, setEditingTheme]   = useState(null)
  const [statusMsg, setStatusMsg]         = useState('')

  const loadStorePacks = useCallback(async () => {
    if (window.soundkeys?.listStorePacks) {
      const packs = await window.soundkeys.listStorePacks()
      setStorePacks(packs || [])
    }
  }, [])

  useEffect(() => {
    loadStorePacks()
  }, [loadStorePacks, themes])

  const handleInstallPack = async (packId) => {
    setStatusMsg(`Installing ${packId}...`)
    if (window.soundkeys?.installStorePack) {
      const res = await window.soundkeys.installStorePack(packId)
      if (res.success) {
        setStatusMsg(`Successfully installed ${packId}!`)
        if (res.themes) onThemesUpdated(res.themes)
        await loadStorePacks()

        if (confirm(`Pack installed successfully! Do you want to switch to this theme now?`)) {
          onThemeSwitch(packId)
        }
      } else {
        setStatusMsg(`Installation error: ${res.error || 'Failed'}`)
      }
    }
    setTimeout(() => setStatusMsg(''), 4000)
  }

  const handleUninstallPack = async (packId) => {
    if (confirm(`Are you sure you want to uninstall sound pack "${packId}"?`)) {
      if (window.soundkeys?.uninstallStorePack) {
        const res = await window.soundkeys.uninstallStorePack(packId)
        if (res.themes) onThemesUpdated(res.themes)
        await loadStorePacks()
      }
    }
  }

  const handlePreviewPack = async (packId) => {
    if (window.soundkeys?.previewStorePack) {
      const soundFile = await window.soundkeys.previewStorePack(packId)
      if (soundFile) {
        const audio = new Audio(`file:///${soundFile.replace(/\\/g, '/')}`)
        audio.play().catch(e => console.warn('Preview playback failed:', e))
      }
    }
  }

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

  // Filter store packs
  const tagsList = ['all', 'music', 'piano', 'retro', 'mechanical']
  const filteredPacks = storePacks.filter(pack => {
    const matchesSearch = (pack.name + ' ' + pack.description + ' ' + pack.author)
      .toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTag = selectedTag === 'all' || pack.tags?.includes(selectedTag)
    return matchesSearch && matchesTag
  })

  return (
    <div className="page store-page">
      <header className="page-header">
        <div>
          <div className="header-title-row">
            <h2 className="page-title">Sound Pack Store</h2>
            <span className="store-badge">Local Store · v3.3.0</span>
          </div>
          <p className="page-subtitle">
            Browse, install, and manage audio themes for SoundKeys
          </p>
        </div>

        <div className="store-tab-switcher">
          <button
            className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Store ({storePacks.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            My Themes ({themes.length})
          </button>
        </div>
      </header>

      {statusMsg && <div className="store-toast-banner">{statusMsg}</div>}

      {activeTab === 'browse' ? (
        <section className="store-browse-section">
          <div className="store-filter-bar">
            <div className="tag-pills">
              {tagsList.map(tag => (
                <button
                  key={tag}
                  className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="store-search-input"
              placeholder="Search sound packs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="store-packs-grid">
            {filteredPacks.length === 0 ? (
              <div className="empty-store-state">
                No sound packs match your search query or tag filter.
              </div>
            ) : (
              filteredPacks.map(pack => {
                const isActiveTheme = currentTheme?.id === pack.id
                return (
                  <div key={pack.id} className={`store-pack-card ${pack.installed ? 'installed' : ''} ${isActiveTheme ? 'active' : ''}`}>
                    <div className="pack-card-header">
                      <div className="pack-card-icon-box">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          {pack.perKeyMapping ? (
                            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM6 12v6M9 12v6M12 12v6M15 12v6M18 12v6M6 4v8M9 4v8M12 4v8M15 4v8M18 4v8" stroke="currentColor" strokeWidth="1.5"/>
                          ) : (
                            <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          )}
                        </svg>
                      </div>
                      <div className="pack-header-text">
                        <h4 className="pack-name">{pack.name}</h4>
                        <span className="pack-author">By {pack.author || 'SoundKeys'}</span>
                      </div>
                      {isActiveTheme && <span className="active-theme-chip">Active</span>}
                    </div>

                    <p className="pack-desc">{pack.description}</p>

                    <div className="pack-tags-row">
                      {pack.tags?.map(t => (
                        <span key={t} className="pack-tag-chip">#{t}</span>
                      ))}
                    </div>

                    <div className="pack-card-footer">
                      <button
                        className="btn-preview-sm"
                        onClick={() => handlePreviewPack(pack.id)}
                        title="Preview audio clip"
                      >
                        Preview
                      </button>

                      {pack.installed ? (
                        <div className="installed-btn-group">
                          {!isActiveTheme && (
                            <button
                              className="btn-primary-sm"
                              onClick={() => onThemeSwitch(pack.id)}
                            >
                              Activate
                            </button>
                          )}
                          <button
                            className="btn-secondary-sm danger"
                            onClick={() => handleUninstallPack(pack.id)}
                          >
                            Uninstall
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-primary-sm"
                          onClick={() => handleInstallPack(pack.id)}
                        >
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      ) : (
        <section className="my-themes-section">
          <div className="my-themes-header">
            <h3>Installed Themes ({themes.length})</h3>
            <button className="btn-primary-sm" onClick={() => { setEditingTheme(null); setIsCreatorOpen(true) }}>
              + Create Custom Theme
            </button>
          </div>

          <div className="themes-grid">
            {themes.map(t => (
              <ThemeCard
                key={t.id}
                theme={t}
                isActive={currentTheme?.id === t.id}
                onSelect={onThemeSwitch}
                onEdit={handleEditTheme}
                onDelete={handleDeleteTheme}
              />
            ))}
          </div>
        </section>
      )}

      {/* Custom Theme Creator / Editor Modal */}
      <ThemeCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => { setIsCreatorOpen(false); setEditingTheme(null) }}
        editingTheme={editingTheme}
        onCreated={(res) => {
          if (res?.themes) onThemesUpdated(res.themes)
          setIsCreatorOpen(false)
          setEditingTheme(null)
        }}
      />
    </div>
  )
}
