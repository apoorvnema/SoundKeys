import React, { useState } from 'react'
import { FEATURE_REGISTRY } from '../data/featureRegistry'

/**
 * FeatureLogModal — Clean technical changelog modal (no emojis).
 * Shows all 39 features grouped by release version.
 */
export default function FeatureLogModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const filtered = FEATURE_REGISTRY.filter(f =>
    (f.id + ' ' + f.name + ' ' + f.description + ' ' + f.version)
      .toLowerCase().includes(searchQuery.toLowerCase())
  )

  const featuresByVersion = {}
  filtered.forEach(f => {
    const v = f.version || 'v1.0.0'
    if (!featuresByVersion[v]) featuresByVersion[v] = []
    featuresByVersion[v].push(f)
  })

  const sortedVersions = Object.keys(featuresByVersion).sort().reverse()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content feature-log-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Feature Log &amp; Release History</h3>
            <span className="modal-subtitle-badge">{FEATURE_REGISTRY.length} Features Registered</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close Modal">
            ✕
          </button>
        </div>

        <div className="modal-search-row">
          <input
            type="text"
            className="input-text-sm search-input-clean"
            placeholder="Search feature ID, name, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="modal-body feature-log-modal-body">
          {sortedVersions.length === 0 ? (
            <div className="empty-log-state">No matching features found.</div>
          ) : (
            sortedVersions.map(ver => (
              <div key={ver} className="log-version-section">
                <div className="log-version-header">
                  <span className="version-code-badge">{ver}</span>
                  <span className="version-count-label">
                    {featuresByVersion[ver].length} Feature{featuresByVersion[ver].length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="log-features-list">
                  {featuresByVersion[ver].map(feat => (
                    <div key={feat.id} className="log-feature-item">
                      <div className="log-item-header">
                        <span className="feat-code-chip">{feat.id}</span>
                        <span className="feat-name-text">{feat.name}</span>
                        <span className="feat-status-badge">Operational</span>
                      </div>
                      <p className="log-item-desc">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
