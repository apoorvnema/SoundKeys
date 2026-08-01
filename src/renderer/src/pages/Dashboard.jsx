import React, { useState, useEffect, useRef, useCallback } from 'react'

const SOUND_LABELS = {
  typing:      'Typing',
  spacebar:    'Space',
  enter:       'Enter',
  backspace:   'Backspace',
  escape:      'Escape',
  tab:         'Tab',
  functionKeys:'Fn Key'
}

/** Track keypress count + WPM in the last 60 seconds */
function useKeyStats(lastKeyEvent) {
  const [total, setTotal] = useState(0)
  const [wpm, setWpm]     = useState(0)
  const timestamps = useRef([])

  useEffect(() => {
    if (!lastKeyEvent) return
    setTotal(n => n + 1)

    const now = Date.now()
    timestamps.current.push(now)
    timestamps.current = timestamps.current.filter(t => now - t < 60_000)
    setWpm(Math.round(timestamps.current.length / 5))
  }, [lastKeyEvent])

  return { total, wpm }
}

export default function Dashboard({ settings, currentTheme, lastKeyEvent, onSettingChange }) {
  const [pulsing, setPulsing]   = useState(false)
  const [ripples, setRipples]   = useState([])
  const rippleId = useRef(0)
  const { total, wpm } = useKeyStats(lastKeyEvent)

  // Animate orb on each key event
  useEffect(() => {
    if (!lastKeyEvent) return

    setPulsing(true)
    const id = ++rippleId.current
    setRipples(prev => [...prev, id])

    const t1 = setTimeout(() => setPulsing(false), 160)
    const t2 = setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 900)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [lastKeyEvent])

  const isMuted = settings?.muted
  const toggleMute = useCallback(() => {
    onSettingChange('muted', !isMuted)
  }, [isMuted, onSettingChange])

  return (
    <div className="page dashboard-page">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {currentTheme
              ? <>Theme: <span className="accent">{currentTheme.name || currentTheme.id}</span></>
              : 'No theme loaded'}
          </p>
        </div>

        <button
          className={`mute-toggle-btn ${isMuted ? 'muted' : 'active'}`}
          onClick={toggleMute}
        >
          {isMuted ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Unmute
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Mute
            </>
          )}
        </button>
      </div>

      {/* ── Orb Visualizer ─────────────────────────────── */}
      <div className="visualizer-container">
        <div className={`orb-wrapper ${pulsing ? 'pulsing' : ''} ${isMuted ? 'muted' : ''}`}>
          {/* Ripple rings spawned on each key press */}
          {ripples.map(id => (
            <div key={id} className="ripple-ring" />
          ))}

          {/* Ambient glow ring */}
          <div className="orb-glow-ring" />

          {/* Central orb */}
          <div className="pulse-orb">
            <div className="orb-inner">
              {isMuted ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>

        <div className="visualizer-status">
          {isMuted ? (
            <span className="status-text muted">Sound is muted — click to unmute</span>
          ) : lastKeyEvent ? (
            <span className="status-text active">
              {SOUND_LABELS[lastKeyEvent.soundType] || 'Key'} pressed
            </span>
          ) : (
            <span className="status-text idle">Press any key to hear sounds…</span>
          )}
        </div>
      </div>

      {/* ── Stats Bar ─────────────────────────────────── */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">{total.toLocaleString()}</div>
          <div className="stat-label">Keys Pressed</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-value">{wpm}</div>
          <div className="stat-label">WPM</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-value">
            {lastKeyEvent ? (SOUND_LABELS[lastKeyEvent.soundType] || '—') : '—'}
          </div>
          <div className="stat-label">Last Key</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className={`stat-value status-val ${isMuted ? 'muted' : 'active'}`}>
            {isMuted ? 'Muted' : 'Active'}
          </div>
          <div className="stat-label">Status</div>
        </div>
      </div>
    </div>
  )
}
