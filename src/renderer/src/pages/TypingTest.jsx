import React, { useState, useEffect, useRef, useCallback } from 'react'
import ParagraphGeneratorModal from '../components/ParagraphGeneratorModal'
import ParagraphLibraryModal from '../components/ParagraphLibraryModal'

// ─── Built-in offline paragraph bank ─────────────────────────────────────
const OFFLINE_PARAGRAPHS = {
  easy: [
    "The sun shines bright in the clear blue sky. Birds fly high above the green trees. Cats and dogs play in the park near the lake. Kids run and laugh on the soft green grass. The air is fresh and cool in the morning.",
    "She likes to read books by the window. The old lamp gives a warm golden light. Every page turns with a soft rustle. She drinks her tea slowly while the rain falls outside. Time moves gently on quiet evenings like this.",
    "He walks to the shop every morning to buy fresh bread. The baker waves hello from behind the glass door. The smell of warm pastry fills the street. He picks a loaf and pays with coins from his coat pocket."
  ],
  medium: [
    "The history of computing spans several decades, beginning with mechanical calculators and evolving into the powerful microprocessors we rely on today. Each generation of hardware brought new possibilities, enabling software to grow more complex and capable over time.",
    "Photography has transformed the way we document human experiences. What once required a professional studio and hours of development can now be captured in an instant with a device that fits in your pocket. Yet the essence of a great photograph still lies in timing and perspective.",
    "Climate scientists monitor dozens of variables to understand weather patterns, from ocean temperatures and atmospheric pressure to solar radiation levels. The complexity of these interactions makes precise long-range forecasting one of the most challenging problems in modern science."
  ],
  hard: [
    "The epistemological implications of quantum mechanics have long confounded philosophers and physicists alike. The Copenhagen interpretation posits that physical systems do not possess definite properties prior to measurement, challenging classical notions of objective reality and determinism.",
    "Neuroplasticity refers to the brain's remarkable capacity to reorganize its synaptic architecture in response to environmental stimuli, experiential learning, or injury. This phenomenon underpins rehabilitation strategies and challenges earlier assumptions that neural circuits were immutable beyond early developmental periods.",
    "The proliferation of decentralized ledger technologies has precipitated significant discourse surrounding fiduciary responsibility, regulatory jurisdiction, and the disintermediation of traditional financial institutions, compelling legislators and economists to reconsider foundational assumptions embedded within extant monetary frameworks."
  ]
}

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   color: '#4ade80' },
  { id: 'medium', label: 'Medium', color: '#facc15' },
  { id: 'hard',   label: 'Hard',   color: '#f87171' }
]

const MODES = [
  { id: 'timed-15',  label: '15s',     seconds: 15 },
  { id: 'timed-30',  label: '30s',     seconds: 30 },
  { id: 'timed-60',  label: '60s',     seconds: 60 },
  { id: 'timed-120', label: '120s',    seconds: 120 },
  { id: 'passage',   label: 'Passage', seconds: null }
]

// ─── Confetti Component ───────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 3,
      d: Math.random() * 120 + 10,
      color: ['#80defe', '#a78bfa', '#4ade80', '#facc15', '#f87171', '#38bdf8'][Math.floor(Math.random() * 6)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05,
      tiltAngle: 0
    }))
    let angle = 0
    let animId
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      angle += 0.01
      particles.forEach(p => {
        p.tiltAngle += p.tiltAngleIncremental
        p.y += (Math.cos(angle + p.d) + 1 + p.r / 2) * 1.5
        p.tilt = Math.sin(p.tiltAngle - p.d / 3) * 12
        ctx.beginPath()
        ctx.lineWidth = p.r / 2
        ctx.strokeStyle = p.color
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y)
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4)
        ctx.stroke()
        if (p.y > canvas.height) { p.x = Math.random() * canvas.width; p.y = -10 }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={canvasRef} className="confetti-canvas" />
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function TypingTest() {
  const [difficulty, setDifficulty]       = useState('medium')
  const [mode, setMode]                   = useState('timed-60')
  const [paragraph, setParagraph]         = useState('')
  const [paragraphMeta, setParagraphMeta] = useState({ category: 'General', source: 'built-in' })

  const [status, setStatus]               = useState('idle') // idle | running | finished
  const [typed, setTyped]                 = useState('')
  const [timeLeft, setTimeLeft]           = useState(60)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [wpm, setWpm]                     = useState(0)
  const [accuracy, setAccuracy]           = useState(100)
  const [personalBest, setPersonalBest]   = useState(0)
  const [lastResult, setLastResult]       = useState(null)
  const [isNewPB, setIsNewPB]             = useState(false)

  const [showGenModal, setShowGenModal]   = useState(false)
  const [showLibModal, setShowLibModal]   = useState(false)
  const [showCustom, setShowCustom]       = useState(false)
  const [customText, setCustomText]       = useState('')
  const [statusMsg, setStatusMsg]         = useState('')

  const inputRef      = useRef(null)
  const timerRef      = useRef(null)
  const typedRef      = useRef('')
  const startTimeRef  = useRef(null)
  const paragraphRef  = useRef('')
  const scrollRef     = useRef(null)

  // Keep ref updated
  useEffect(() => {
    paragraphRef.current = paragraph
  }, [paragraph])

  // Load PB & random paragraph on mount / difficulty change
  useEffect(() => {
    loadPersonalBest()
    loadRandomParagraph()
  }, [difficulty])

  useEffect(() => {
    const selectedMode = MODES.find(m => m.id === mode)
    if (selectedMode?.seconds) setTimeLeft(selectedMode.seconds)
  }, [mode])

  async function loadPersonalBest() {
    try {
      if (typeof window.soundkeys?.getTypingPersonalBest === 'function') {
        const pb = await window.soundkeys.getTypingPersonalBest()
        setPersonalBest(pb || 0)
      }
    } catch (err) {
      console.warn('[TypingTest] Failed to load personal best:', err)
    }
  }

  function loadRandomParagraph() {
    const pool = OFFLINE_PARAGRAPHS[difficulty] || OFFLINE_PARAGRAPHS.medium
    const text = pool[Math.floor(Math.random() * pool.length)]
    setParagraph(text)
    paragraphRef.current = text
    setParagraphMeta({ category: 'General', source: 'built-in' })
    resetTest(text)
  }

  function resetTest(text) {
    clearInterval(timerRef.current)
    typedRef.current = ''
    startTimeRef.current = null
    setTyped('')
    setStatus('idle')
    setWpm(0)
    setAccuracy(100)
    setLastResult(null)
    setIsNewPB(false)
    setElapsedSeconds(0)
    const selectedMode = MODES.find(m => m.id === mode)
    setTimeLeft(selectedMode?.seconds ?? 60)
    if (text !== undefined) {
      setParagraph(text)
      paragraphRef.current = text
    }
  }

  // ─── Calculate WPM & Accuracy ──────────────────────────────────────
  const calcStats = useCallback((typedStr, durSeconds) => {
    const target = paragraphRef.current || ''
    let correct = 0
    for (let i = 0; i < typedStr.length; i++) {
      if (typedStr[i] === target[i]) correct++
    }
    const minutes = Math.max(durSeconds, 1) / 60
    const words = correct / 5
    const liveWpm = Math.round(words / minutes)
    const acc = typedStr.length > 0 ? Math.round((correct / typedStr.length) * 100) : 100
    return { wpm: liveWpm, accuracy: acc, charsCorrect: correct }
  }, [])

  // ─── Finish Test ───────────────────────────────────────────────────
  const finishTest = useCallback(async (finalTyped) => {
    clearInterval(timerRef.current)
    setStatus('finished')

    const typedStr = finalTyped ?? typedRef.current
    const now = Date.now()
    const start = startTimeRef.current || now
    const durSeconds = Math.max((now - start) / 1000, 1)

    const stats = calcStats(typedStr, durSeconds)
    const selectedMode = MODES.find(m => m.id === mode)

    const result = {
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      charsCorrect: stats.charsCorrect,
      charsTotal: paragraphRef.current.length,
      durationSeconds: Math.round(durSeconds),
      mode,
      difficulty,
      category: paragraphMeta.category,
      paragraphSnippet: paragraphRef.current.substring(0, 80)
    }


    setWpm(result.wpm)
    setAccuracy(result.accuracy)
    setLastResult(result)

    // Log session to SQLite safely
    try {
      if (typeof window.soundkeys?.logTypingSession === 'function') {
        const logRes = await window.soundkeys.logTypingSession(result)
        if (logRes?.isPersonalBest) {
          setIsNewPB(true)
          setPersonalBest(result.wpm)
        }
      }
    } catch (err) {
      console.warn('[TypingTest] Failed to log typing session:', err)
    }
  }, [mode, difficulty, paragraphMeta, calcStats])


  // ─── Start Timer ────────────────────────────────────────────────────
  const startTestManually = useCallback(() => {
    if (status === 'running') return
    setStatus('running')
    startTimeRef.current = Date.now()

    const selectedMode = MODES.find(m => m.id === mode)
    const isTimedMode = selectedMode?.seconds != null

    clearInterval(timerRef.current)

    if (isTimedMode) {
      let remaining = selectedMode.seconds
      timerRef.current = setInterval(() => {
        remaining -= 1
        setTimeLeft(remaining)
        setElapsedSeconds(s => s + 1)

        // Calculate live stats
        const now = Date.now()
        const dur = (now - startTimeRef.current) / 1000
        const stats = calcStats(typedRef.current, dur)
        setWpm(stats.wpm)
        setAccuracy(stats.accuracy)

        if (remaining <= 0) {
          finishTest(typedRef.current)
        }
      }, 1000)
    } else {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1)
        const now = Date.now()
        const dur = (now - startTimeRef.current) / 1000
        const stats = calcStats(typedRef.current, dur)
        setWpm(stats.wpm)
        setAccuracy(stats.accuracy)
      }, 1000)
    }

    setTimeout(() => inputRef.current?.focus(), 50)
  }, [status, mode, calcStats, finishTest])

  // ─── Handle Input ───────────────────────────────────────────────────
  const handleInput = useCallback((e) => {
    const val = e.target.value
    if (status === 'finished') return

    if (status === 'idle') {
      startTestManually()
    }

    typedRef.current = val
    setTyped(val)

    const now = Date.now()
    const start = startTimeRef.current || now
    const dur = Math.max((now - start) / 1000, 0.5)
    const stats = calcStats(val, dur)
    setWpm(stats.wpm)
    setAccuracy(stats.accuracy)

    // Passage mode: auto-finish when full paragraph is typed
    const selectedMode = MODES.find(m => m.id === mode)
    if (selectedMode?.seconds == null && val.length >= paragraphRef.current.length) {
      finishTest(val)
    }
  }, [status, mode, startTestManually, calcStats, finishTest])

  // ─── Render Chars ──────────────────────────────────────────────────
  function renderChars() {
    const target = paragraph
    return target.split('').map((ch, i) => {
      let cls = 'char-untyped'
      if (i < typed.length) {
        cls = typed[i] === ch ? 'char-correct' : 'char-incorrect'
      } else if (i === typed.length) {
        cls = 'char-cursor'
      }
      return (
        <span key={i} className={cls} data-char={ch}>
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      )
    })
  }

  const selectedMode = MODES.find(m => m.id === mode)
  const isTimedMode  = selectedMode?.seconds != null
  const progressPct  = paragraph.length > 0 ? Math.min((typed.length / paragraph.length) * 100, 100) : 0
  const modeLabel    = mode === 'passage' ? 'Passage' : `${selectedMode?.label} Timed`

  async function handleSaveParagraph() {
    try {
      if (typeof window.soundkeys?.saveParagraph === 'function') {
        await window.soundkeys.saveParagraph({ text: paragraph, category: paragraphMeta.category, source: paragraphMeta.source })
        setStatusMsg('✅ Paragraph saved to library!')
        setTimeout(() => setStatusMsg(''), 2500)
      }
    } catch (err) {
      console.warn('[TypingTest] Failed to save paragraph:', err)
    }
  }

  function handleCustomSubmit() {
    if (!customText.trim()) return
    setParagraph(customText.trim())
    paragraphRef.current = customText.trim()
    setParagraphMeta({ category: 'Custom', source: 'user' })
    setShowCustom(false)
    resetTest(customText.trim())
  }

  return (
    <div className="page typing-test-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Typing Test</h1>
          <p className="page-subtitle">Measure your speed. Beat your best.</p>
        </div>
        <div className="typing-pb-badge">
          <span className="pb-icon">🏆</span>
          <div>
            <div className="pb-label">Personal Best</div>
            <div className="pb-value">{personalBest} <span className="pb-unit">WPM</span></div>
          </div>
        </div>
      </div>

      {/* ── Sleek Compact Horizontal Config Bar ─────────────────── */}
      <div className="typing-horizontal-config-bar">
        {/* Difficulty Selector Pills */}
        <div className="config-pill-group">
          <span className="config-group-title">Difficulty:</span>
          <div className="config-pills">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`config-pill-btn ${difficulty === d.id ? 'active' : ''}`}
                onClick={() => { setDifficulty(d.id); resetTest() }}
              >
                <span className="pill-dot" style={{ background: d.color }} />
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="config-divider" />

        {/* Mode Selector Pills */}
        <div className="config-pill-group">
          <span className="config-group-title">Mode:</span>
          <div className="config-pills">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`config-pill-btn ${mode === m.id ? 'active' : ''}`}
                onClick={() => { setMode(m.id); resetTest() }}
              >
                {m.seconds ? m.label : 'Passage'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Stats Bar ─────────────────────────────────────── */}
      <div className="typing-stats-bar">
        <div className="typing-stat">
          <div className="typing-stat-value">{wpm}</div>
          <div className="typing-stat-label">WPM</div>
        </div>
        <div className="typing-stat">
          <div className="typing-stat-value">{accuracy}<span style={{ fontSize: '0.6em' }}>%</span></div>
          <div className="typing-stat-label">Accuracy</div>
        </div>
        <div className="typing-stat timer-stat">
          <div className={`typing-stat-value ${isTimedMode && timeLeft <= 10 && status === 'running' ? 'timer-urgent' : ''}`}>
            {isTimedMode ? timeLeft : elapsedSeconds}
          </div>
          <div className="typing-stat-label">{isTimedMode ? 'Seconds Left' : 'Elapsed (s)'}</div>
        </div>
        <div className="typing-stat">
          <div className="typing-stat-value">{typed.length}<span style={{ fontSize: '0.6em' }}>/{paragraph.length}</span></div>
          <div className="typing-stat-label">Characters</div>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────── */}
      <div className="typing-progress-bar">
        <div className="typing-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Paragraph Source & Mouse Action Controls ──────────── */}
      <div className="typing-source-controls">
        {status === 'idle' && (
          <button className="typing-source-btn start-mouse-btn" onClick={startTestManually}>
            ▶ Start Test
          </button>
        )}
        {status === 'running' && (
          <button className="typing-source-btn stop-mouse-btn" onClick={() => finishTest()}>
            ⏹ Stop &amp; Finish
          </button>
        )}
        <button className="typing-source-btn" onClick={() => resetTest()}>
          🔄 Reset
        </button>
        <button className="typing-source-btn ai-btn" onClick={() => setShowGenModal(true)} disabled={status === 'running'}>
          ✨ AI Generate
        </button>
        <button className="typing-source-btn lib-btn" onClick={() => setShowLibModal(true)} disabled={status === 'running'}>
          📚 Library
        </button>
        <button className="typing-source-btn custom-btn" onClick={() => setShowCustom(!showCustom)} disabled={status === 'running'}>
          📝 Custom
        </button>
        <button className="typing-source-btn refresh-btn" onClick={() => loadRandomParagraph()} disabled={status === 'running'}>
          🔀 Random
        </button>
      </div>

      {/* Custom text input */}
      {showCustom && (
        <div className="typing-custom-input">
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Paste or type your own paragraph here..."
            className="custom-paragraph-textarea"
            rows={4}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="typing-source-btn ai-btn" onClick={handleCustomSubmit}>Use This</button>
            <button className="typing-source-btn" onClick={() => setShowCustom(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Typing Area (Crisp & Readable text behind) ──────────── */}
      {status !== 'finished' && (
        <div
          className={`typing-area ${status === 'idle' ? 'typing-idle' : 'typing-active'}`}
          onClick={() => inputRef.current?.focus()}
        >
          {status === 'idle' && (
            <div className="typing-idle-banner" onClick={startTestManually}>
              <span className="banner-icon">⌨️</span>
              <span>Click <strong>▶ Start Test</strong> or type any key to begin</span>
            </div>
          )}
          <div className="typing-chars" ref={scrollRef}>
            {renderChars()}
          </div>
          <input
            ref={inputRef}
            className="typing-hidden-input"
            value={typed}
            onChange={handleInput}
            disabled={status === 'finished'}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      {/* ── Result Screen ──────────────────────────────────────── */}
      {status === 'finished' && lastResult && (
        <div className="typing-result-screen">
          {isNewPB && <Confetti />}

          <div className="result-header">
            {isNewPB
              ? <><span className="result-trophy">🎉</span><h2 className="result-title pb-title">Personal Best Smashed!</h2></>
              : personalBest === 0
              ? <><span className="result-trophy">✅</span><h2 className="result-title">Baseline Established!</h2></>
              : <><span className="result-trophy">⌨️</span><h2 className="result-title">Test Complete!</h2></>
            }
            {isNewPB && <p className="result-subtitle neon-text">You beat your previous record!</p>}
          </div>

          <div className="result-stats-grid">
            <div className="result-stat-card wpm-card">
              <div className="result-stat-num">{lastResult.wpm}</div>
              <div className="result-stat-label">WPM</div>
            </div>
            <div className="result-stat-card">
              <div className="result-stat-num">{lastResult.accuracy}<span style={{ fontSize: '0.5em' }}>%</span></div>
              <div className="result-stat-label">Accuracy</div>
            </div>
            <div className="result-stat-card">
              <div className="result-stat-num">{lastResult.charsCorrect}<span style={{ fontSize: '0.5em' }}>/{lastResult.charsTotal}</span></div>
              <div className="result-stat-label">Correct Chars</div>
            </div>
            <div className="result-stat-card">
              <div className="result-stat-num">{lastResult.durationSeconds}<span style={{ fontSize: '0.5em' }}>s</span></div>
              <div className="result-stat-label">Duration</div>
            </div>
          </div>

          <div className="result-meta-row">
            <span className="result-badge difficulty-badge" data-diff={lastResult.difficulty}>{lastResult.difficulty}</span>
            <span className="result-badge mode-badge">{modeLabel}</span>
            <span className="result-badge category-badge">{lastResult.category}</span>
            {isNewPB && <span className="result-badge pb-badge">🏆 New Record</span>}
          </div>

          {statusMsg && <p className="status-msg success">{statusMsg}</p>}

          <div className="result-actions">
            <button className="result-btn primary-btn" onClick={() => resetTest(paragraph)}>
              {isNewPB ? '🔄 Beat This Score' : '🔄 Try Again'}
            </button>
            <button className="result-btn" onClick={() => loadRandomParagraph()}>
              🔀 New Paragraph
            </button>
            <button className="result-btn save-para-btn" onClick={handleSaveParagraph}>
              💾 Save Paragraph
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {showGenModal && (
        <ParagraphGeneratorModal
          difficulty={difficulty}
          onClose={() => setShowGenModal(false)}
          onUse={(text, meta) => {
            setParagraph(text)
            paragraphRef.current = text
            setParagraphMeta(meta)
            setShowGenModal(false)
            resetTest(text)
          }}
        />
      )}

      {showLibModal && (
        <ParagraphLibraryModal
          onClose={() => setShowLibModal(false)}
          onUse={(text, meta) => {
            setParagraph(text)
            paragraphRef.current = text
            setParagraphMeta(meta)
            setShowLibModal(false)
            resetTest(text)
          }}
        />
      )}
    </div>
  )
}
