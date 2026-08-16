import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import SynthesiaPiano, { BASE_KEYCODE_TO_MIDI, HAND_COLORS, getMidiNoteName } from '../components/SynthesiaPiano'

/**
 * PianoPractice — Full Synthesia-style MIDI practice page.
 *
 * Modes:
 *   freestyle  — Play freely on keyboard, mouse click, or MIDI device with octave control
 *   waterfall  — Notes fall continuously with audio playback, play along mode
 *   practice   — Waterfall pauses at each cluster, waits for correct notes
 *
 * Features:
 *   - Click-to-play with no scroll-on-click bug
 *   - Smart Left/Right hand detection & coloring: Yellow (Left Hand) & Blue (Right Hand)
 *   - A-B Loop mode for both Waterfall & Practice sections
 *   - Practice mode prominent chord note display with out-of-range auto-play
 *   - Fullscreen toggle
 *   - Play-along audio engine
 */

const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
function midiToName(n) {
  return NOTE_NAMES_SHARP[n % 12] + (Math.floor(n / 12) - 1)
}

// Group notes into clusters (notes within 80ms are one chord cluster)
function buildClusters(notes, windowMs = 80) {
  if (!notes || notes.length === 0) return []
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs)
  const clusters = []
  let group = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMs - group[0].startMs <= windowMs) {
      group.push(sorted[i])
    } else {
      clusters.push(group)
    }
    group = [sorted[i]]
  }
  clusters.push(group)
  return clusters
}

// ── MIDI Device Panel ──────────────────────────────────────────────────────
function MidiDevicePanel({ devices, selectedId, onSelect, connected }) {
  return (
    <div className="midi-device-panel">
      <div className="midi-panel-header">
        <span className={`midi-status-dot ${connected ? 'connected' : 'disconnected'}`} />
        <span className="midi-panel-label">MIDI Device</span>
        {connected && <span className="midi-connected-badge">Connected</span>}
      </div>
      {devices.length === 0 ? (
        <p className="midi-no-device">No MIDI inputs detected. Connect a MIDI keyboard and refresh.</p>
      ) : (
        <div className="midi-device-list">
          {devices.map(d => (
            <button
              key={d.id}
              className={`midi-device-btn ${selectedId === d.id ? 'active' : ''}`}
              onClick={() => onSelect(d.id)}
            >
              <span className="device-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM6 12v6M9 12v6M12 12v6M15 12v6M18 12v6M6 4v8M9 4v8M12 4v8M15 4v8M18 4v8" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Practice Note Display — shows pending chord prominently ────────────────
function PracticeNoteDisplay({ pendingNotes, pressedNotes, autoSatisfiedNotes = new Set(), clusterIdx, totalClusters }) {
  if (pendingNotes.size === 0) return null

  const noteArray = [...pendingNotes].sort((a, b) => a - b)
  const isChord = noteArray.length > 1
  const allHit = noteArray.every(n => pressedNotes.has(n) || autoSatisfiedNotes.has(n))

  return (
    <div className={`practice-note-display ${allHit ? 'all-hit' : ''}`}>
      <div className="practice-note-display-inner">
        <div className="practice-note-header">
          <span className="practice-cluster-counter">
            Cluster {clusterIdx + 1} <span className="practice-cluster-total">/ {totalClusters}</span>
          </span>
          <span className="practice-chord-label">
            {isChord ? `Chord — ${noteArray.length} notes` : 'Single Note'}
          </span>
        </div>

        <div className="practice-note-pills">
          {noteArray.map(n => {
            const hit = pressedNotes.has(n)
            const auto = autoSatisfiedNotes.has(n)
            const hand = n < 60 ? 'left' : 'right'

            return (
              <div
                key={n}
                className={`practice-note-pill ${hand} ${hit || auto ? 'hit' : ''} ${auto ? 'auto-played' : ''}`}
                title={auto ? 'Out of keyboard range — auto-played' : `Hand: ${hand}`}
              >
                <span className="practice-pill-name">{midiToName(n)}</span>
                {auto ? (
                  <span className="practice-pill-auto-tag">AUTO</span>
                ) : (
                  hit && <span className="practice-pill-check">✓</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="practice-progress-track">
          <div
            className="practice-progress-fill"
            style={{ width: `${totalClusters > 0 ? ((clusterIdx) / totalClusters) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Waterfall Canvas ───────────────────────────────────────────────────────
function WaterfallCanvas({
  midiSong, currentTimeMs, visibleWindowMs,
  startMidi, endMidi, practiceMode, pendingClusterNotes,
  handFilter,
}) {
  if (!midiSong) return (
    <div className="waterfall-canvas-empty">
      <div className="waterfall-empty-text">Load a MIDI file to see the note waterfall</div>
    </div>
  )

  const visibleNotes = midiSong.notes.filter(n =>
    n.startMs + n.durationMs >= currentTimeMs - 200 &&
    n.startMs <= currentTimeMs + visibleWindowMs
  )

  return (
    <div className="waterfall-canvas">
      {/* Hit line */}
      <div className="waterfall-hit-line" />

      {visibleNotes.map((note, idx) => {
        const noteRange = Math.max(1, endMidi - startMidi)
        const lanePos = (note.noteNumber - startMidi) / noteRange

        const distAhead = note.startMs - currentTimeMs
        const topPct = ((visibleWindowMs - distAhead) / visibleWindowMs) * 100
        const heightPct = Math.max(1.5, (note.durationMs / visibleWindowMs) * 100)

        // Hand assignment: 'left' (Yellow) vs 'right' (Blue)
        const isLeftHand = note.hand === 'left' || (!note.hand && note.noteNumber < 60)
        const noteHand = isLeftHand ? 'left' : 'right'
        const handColor = isLeftHand ? '#fbbf24' : '#06b6d4'

        const isActive = distAhead <= 0 && distAhead > -note.durationMs
        const isPending = practiceMode && pendingClusterNotes?.has(note.noteNumber) && distAhead >= -100

        // Determine if this note matches the hand filter
        const isFiltered = handFilter !== 'both' && noteHand !== handFilter

        return (
          <div
            key={`${note.startMs}_${note.noteNumber}_${idx}`}
            className={`falling-note hand-${noteHand} ${isActive ? 'note-active' : ''} ${isPending ? 'note-pending' : ''} ${isFiltered ? 'note-filtered' : ''}`}
            style={{
              left: `${Math.max(0, Math.min(99, lanePos * 100))}%`,
              width: `${Math.max(1.2, (1 / noteRange) * 100)}%`,
              top: `${Math.max(0, topPct - heightPct)}%`,
              height: `${heightPct}%`,
              background: isFiltered
                ? 'rgba(255,255,255,0.08)'
                : isPending
                ? 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)'
                : isLeftHand
                ? 'linear-gradient(180deg, #fde047 0%, #f59e0b 100%)'  // Yellow for Left
                : 'linear-gradient(180deg, #38bdf8 0%, #06b6d4 100%)', // Blue for Right
              boxShadow: isActive && !isFiltered ? `0 0 14px ${handColor}` : 'none',
              opacity: isFiltered ? 0.12 : 1,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Main PianoPractice Page ────────────────────────────────────────────────
export default function PianoPractice({ currentTheme, onThemeSwitch, audioRef }) {
  // Mode
  const [mode, setMode] = useState('freestyle') // 'freestyle' | 'waterfall' | 'practice'

  // Octave Shift Control (-2 to +2)
  const [octaveOffset, setOctaveOffset]         = useState(0)

  // Hand filter: 'both' | 'right' | 'left'
  const [handFilter, setHandFilter]             = useState('both')

  // A-B Looping State
  const [loopA, setLoopA]                       = useState(null)
  const [loopB, setLoopB]                       = useState(null)
  const [isLooping, setIsLooping]               = useState(false)

  // Notes active (union of keyboard + mouse click + MIDI device)
  const [activeKeycodes, setActiveKeycodes]     = useState(new Set())
  const [activeMidiNotes, setActiveMidiNotes]   = useState(new Set()) // from MIDI device or mouse clicks
  const [channelNotes, setChannelNotes]         = useState({})        // note->channel map

  // Waterfall song audio
  const [isSongAudioEnabled, setIsSongAudioEnabled] = useState(true)
  const [waterfallActiveNotes, setWaterfallActiveNotes] = useState(new Set())
  const [waterfallHandMap, setWaterfallHandMap] = useState({})
  const playedNotesRef = useRef(new Set())
  const prevTimeRef    = useRef(0)

  // MIDI device
  const [midiDevices, setMidiDevices]           = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [midiConnected, setMidiConnected]       = useState(false)
  const midiAccessRef = useRef(null)
  const midiInputRef  = useRef(null)

  // MIDI file
  const [midiSong, setMidiSong]                 = useState(null)
  const [statusMsg, setStatusMsg]               = useState('')

  // Playback
  const [isPlaying, setIsPlaying]               = useState(false)
  const [currentTimeMs, setCurrentTimeMs]       = useState(0)
  const [playbackSpeed, setPlaybackSpeed]       = useState(1.0)

  // Practice mode
  const [clusters, setClusters]                 = useState([])
  const [clusterIdx, setClusterIdx]             = useState(0)
  const [pendingNotes, setPendingNotes]         = useState(new Set())
  const [autoSatisfiedNotes, setAutoSatisfiedNotes] = useState(new Set())

  // Scroll control: only set this when practice cluster advances, NOT on click
  const [scrollToCenterMidi, setScrollToCenterMidi] = useState(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen]         = useState(false)
  const pageRef                                  = useRef(null)

  const animFrameRef    = useRef(null)
  const lastTickRef     = useRef(null)

  const VISIBLE_WINDOW_MS = 3000

  // ── Synchronize octave offset to AudioEngine ──
  useEffect(() => {
    audioRef?.current?.setOctaveOffset?.(octaveOffset)
  }, [octaveOffset, audioRef])

  // ── Reachable MIDI keys based on computer keyboard + octave offset ──
  const reachableMidiSet = useMemo(() => {
    const set = new Set()
    const shift = octaveOffset * 12
    Object.values(BASE_KEYCODE_TO_MIDI).forEach(baseMidi => {
      set.add(baseMidi + shift)
    })
    return set
  }, [octaveOffset])

  // ── Piano range based on MIDI connection and octave offset ──
  const startMidi = midiConnected ? 24 : Math.max(12, 36 + Math.min(0, octaveOffset * 12))
  const endMidi   = midiConnected ? 108 : Math.min(120, 84 + Math.max(0, octaveOffset * 12))

  // ── All active MIDI notes (keyboard with octave shift + MIDI device / click) ──
  const allActiveMidiNotes = useMemo(() => {
    const combined = new Set(activeMidiNotes)
    const shift = octaveOffset * 12
    activeKeycodes.forEach(kc => {
      const baseMidi = BASE_KEYCODE_TO_MIDI[kc]
      if (baseMidi !== undefined) combined.add(baseMidi + shift)
    })
    return combined
  }, [activeMidiNotes, activeKeycodes, octaveOffset])

  // ── Union of user active notes + waterfall active notes for piano visualizer ──
  const visualActiveMidiNotes = useMemo(() => {
    const union = new Set(allActiveMidiNotes)
    waterfallActiveNotes.forEach(n => union.add(n))
    return union
  }, [allActiveMidiNotes, waterfallActiveNotes])

  // ── Fullscreen handling ──
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      pageRef.current?.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  // ── Web MIDI Access ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return

    navigator.requestMIDIAccess({ sysex: false }).then(access => {
      midiAccessRef.current = access
      refreshMidiDevices(access)
      access.onstatechange = () => refreshMidiDevices(access)
    }).catch(err => {
      console.warn('[MIDI] Access denied:', err)
    })

    return () => {
      if (midiInputRef.current) {
        midiInputRef.current.onmidimessage = null
      }
    }
  }, [])

  function refreshMidiDevices(access) {
    const inputs = []
    access.inputs.forEach(input => {
      inputs.push({ id: input.id, name: input.name })
    })
    setMidiDevices(inputs)
    if (inputs.length === 0) {
      setMidiConnected(false)
      setSelectedDeviceId(null)
    }
  }

  // ── Connect to selected MIDI device ──
  useEffect(() => {
    if (!midiAccessRef.current || !selectedDeviceId) return

    if (midiInputRef.current) {
      midiInputRef.current.onmidimessage = null
    }

    const input = midiAccessRef.current.inputs.get(selectedDeviceId)
    if (!input) return

    midiInputRef.current = input
    setMidiConnected(true)

    input.onmidimessage = (event) => {
      const [status, note, velocity] = event.data
      const type = status & 0xf0
      const channel = status & 0x0f

      if (type === 0x90 && velocity > 0) {
        setActiveMidiNotes(prev => {
          const next = new Set(prev)
          next.add(note)
          return next
        })
        setChannelNotes(prev => ({ ...prev, [note]: channel }))
        audioRef?.current?.playMidiNote(note, 0.8, velocity / 127)
      } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        setActiveMidiNotes(prev => {
          const next = new Set(prev)
          next.delete(note)
          return next
        })
      }
    }
  }, [selectedDeviceId, audioRef])

  // ── Keyboard event listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!window.soundkeys) return

    const unsubDown = window.soundkeys.onKeyLayoutDown(({ keycode }) => {
      setActiveKeycodes(prev => {
        const next = new Set(prev)
        next.add(keycode)
        return next
      })
    })

    const unsubUp = window.soundkeys.onKeyLayoutUp(({ keycode }) => {
      setActiveKeycodes(prev => {
        const next = new Set(prev)
        next.delete(keycode)
        return next
      })
    })

    return () => { unsubDown?.(); unsubUp?.() }
  }, [])

  // ── Click / Touch Piano Key Handlers ──────────────────────────────────
  const handleNoteDown = useCallback((midiNote) => {
    setActiveMidiNotes(prev => {
      const next = new Set(prev)
      next.add(midiNote)
      return next
    })
    audioRef?.current?.playMidiNote(midiNote, 0.8)
  }, [audioRef])

  const handleNoteUp = useCallback((midiNote) => {
    setActiveMidiNotes(prev => {
      const next = new Set(prev)
      next.delete(midiNote)
      return next
    })
  }, [])

  // ── Practice Mode: Prepare cluster & auto-play out-of-range notes ──────
  const setupPracticeCluster = useCallback((targetIndex) => {
    if (!clusters || clusters.length === 0) return

    // If loop is active, clamp target index within loop range
    let idx = targetIndex
    if (isLooping && loopA !== null && loopB !== null) {
      const inRangeIndices = []
      clusters.forEach((c, i) => {
        const start = c[0].startMs
        if (start >= loopA && start <= loopB) inRangeIndices.push(i)
      })

      if (inRangeIndices.length > 0) {
        if (!inRangeIndices.includes(idx)) {
          idx = inRangeIndices[0]
        }
      }
    }

    if (idx >= clusters.length) {
      if (isLooping && loopA !== null && loopB !== null) {
        // Wrap around loop
        const firstLoopIdx = clusters.findIndex(c => c[0].startMs >= loopA)
        idx = firstLoopIdx !== -1 ? firstLoopIdx : 0
      } else {
        setIsPlaying(false)
        setStatusMsg('Song complete! Great job!')
        setPendingNotes(new Set())
        setAutoSatisfiedNotes(new Set())
        setScrollToCenterMidi(null)
        return
      }
    }

    const nextCluster = clusters[idx]
    setClusterIdx(idx)
    setCurrentTimeMs(Math.max(0, nextCluster[0].startMs - 500))

    const clusterNoteNumbers = nextCluster.map(n => n.noteNumber)
    const nextPending = new Set(clusterNoteNumbers)
    setPendingNotes(nextPending)

    // Check for out-of-range notes and auto-play them
    const autoSatisfied = new Set()
    clusterNoteNumbers.forEach(n => {
      // If note cannot be played by current keyboard or MIDI input
      if (!reachableMidiSet.has(n) && !midiConnected) {
        autoSatisfied.add(n)
        // Auto-play the audio for the out-of-reach note!
        audioRef?.current?.playMidiNote(n, 0.85)
      }
    })
    setAutoSatisfiedNotes(autoSatisfied)

    // Center piano around reachable notes or lowest note
    const reachableNotes = clusterNoteNumbers.filter(n => reachableMidiSet.has(n))
    const centerNote = reachableNotes.length > 0 ? Math.min(...reachableNotes) : Math.min(...clusterNoteNumbers)
    setScrollToCenterMidi(centerNote)
  }, [clusters, isLooping, loopA, loopB, reachableMidiSet, midiConnected, audioRef])

  // ── Practice mode: check if pending notes are satisfied ──────────────
  useEffect(() => {
    if (mode !== 'practice' || pendingNotes.size === 0) return

    // All notes must be pressed by user OR auto-satisfied
    const allPlayed = [...pendingNotes].every(n => allActiveMidiNotes.has(n) || autoSatisfiedNotes.has(n))

    if (allPlayed) {
      // Advance to next cluster
      const nextIdx = clusterIdx + 1
      setupPracticeCluster(nextIdx)
    }
  }, [allActiveMidiNotes, pendingNotes, autoSatisfiedNotes, mode, clusterIdx, setupPracticeCluster])

  // ── MIDI File Loader ──────────────────────────────────────────────────
  const handleLoadMidi = async () => {
    if (!window.soundkeys?.loadMidiFile) return
    setStatusMsg('Loading MIDI file...')
    const res = await window.soundkeys.loadMidiFile()
    if (res?.success) {
      setMidiSong(res)
      setCurrentTimeMs(0)
      setIsPlaying(false)
      setLoopA(null)
      setLoopB(null)
      setIsLooping(false)
      playedNotesRef.current.clear()
      prevTimeRef.current = 0
      const built = buildClusters(res.notes)
      setClusters(built)
      setClusterIdx(0)
      setStatusMsg(`Loaded: ${res.notes.length} notes · ${Math.round(res.durationMs/1000)}s · ${res.bpm} BPM · ${built.length} clusters`)
    } else if (!res?.cancelled) {
      setStatusMsg(`MIDI Error: ${res?.error || 'Failed to parse file'}`)
    } else {
      setStatusMsg('')
    }
  }

  // ── Waterfall animation loop with A-B Loop Wrapping ───────────────────
  const tick = useCallback(() => {
    if (!isPlaying || !midiSong) return

    const now = performance.now()
    if (lastTickRef.current !== null) {
      const delta = (now - lastTickRef.current) * playbackSpeed
      setCurrentTimeMs(prev => {
        let next = prev + delta

        // Check A-B loop wrap
        if (isLooping && loopB !== null && loopA !== null && next >= loopB) {
          next = loopA
          // Reset notes played within the loop
          playedNotesRef.current.clear()
          prevTimeRef.current = loopA
          return next
        }

        if (next >= midiSong.durationMs) {
          if (isLooping && loopA !== null) {
            next = loopA
            playedNotesRef.current.clear()
            prevTimeRef.current = loopA
            return next
          }
          setIsPlaying(false)
          return midiSong.durationMs
        }
        return next
      })
    }
    lastTickRef.current = now
    animFrameRef.current = requestAnimationFrame(tick)
  }, [isPlaying, midiSong, playbackSpeed, isLooping, loopA, loopB])

  useEffect(() => {
    if (isPlaying && mode !== 'practice') {
      lastTickRef.current = performance.now()
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      lastTickRef.current = null
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying, tick, mode])

  // ── Synchronized Waterfall Audio Playback (Play-Along Engine) ──────────
  useEffect(() => {
    if (!isPlaying || !midiSong || !isSongAudioEnabled || mode === 'practice') return

    const cur = currentTimeMs
    const prev = prevTimeRef.current
    prevTimeRef.current = cur

    const startingNotes = midiSong.notes.filter(n => {
      if (n.startMs < prev - 12 || n.startMs > cur + 12) return false
      if (playedNotesRef.current.has(`${n.startMs}_${n.noteNumber}`)) return false

      // Hand filter
      const isLeftHand = n.hand === 'left' || (!n.hand && n.noteNumber < 60)
      const noteHand = isLeftHand ? 'left' : 'right'
      if (handFilter !== 'both' && noteHand !== handFilter) return false

      return true
    })

    if (startingNotes.length > 0) {
      const newActive = []
      const newHandMap = {}

      startingNotes.forEach(n => {
        playedNotesRef.current.add(`${n.startMs}_${n.noteNumber}`)
        const durSec = Math.max(0.18, (n.durationMs || 400) / 1000)
        audioRef?.current?.playMidiNote(n.noteNumber, durSec, 0.85)
        newActive.push(n.noteNumber)

        const hand = (n.hand === 'left' || (!n.hand && n.noteNumber < 60)) ? 'left' : 'right'
        newHandMap[n.noteNumber] = hand

        setTimeout(() => {
          setWaterfallActiveNotes(p => {
            const next = new Set(p)
            next.delete(n.noteNumber)
            return next
          })
        }, Math.max(100, Math.min(n.durationMs || 300, 1200)))
      })

      setWaterfallActiveNotes(p => {
        const next = new Set(p)
        newActive.forEach(m => next.add(m))
        return next
      })

      setWaterfallHandMap(p => ({ ...p, ...newHandMap }))
    }
  }, [currentTimeMs, isPlaying, midiSong, isSongAudioEnabled, mode, audioRef, handFilter])

  const handlePlay = () => {
    if (!midiSong) return

    if (mode === 'practice') {
      let startIdx = 0
      if (isLooping && loopA !== null) {
        const found = clusters.findIndex(c => c[0].startMs >= loopA)
        if (found !== -1) startIdx = found
      }
      setupPracticeCluster(startIdx)
      setIsPlaying(true)
      setStatusMsg(`Practice mode: play the highlighted notes`)
    } else {
      if (currentTimeMs >= midiSong.durationMs || (isLooping && loopB !== null && currentTimeMs >= loopB)) {
        setCurrentTimeMs(isLooping && loopA !== null ? loopA : 0)
        playedNotesRef.current.clear()
        prevTimeRef.current = isLooping && loopA !== null ? loopA : 0
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleRestart = () => {
    const restartTime = isLooping && loopA !== null ? loopA : 0
    setCurrentTimeMs(restartTime)
    setIsPlaying(false)
    if (mode === 'practice') {
      setupPracticeCluster(0)
    } else {
      setPendingNotes(new Set())
      setAutoSatisfiedNotes(new Set())
      setScrollToCenterMidi(null)
    }
    playedNotesRef.current.clear()
    prevTimeRef.current = restartTime
    setStatusMsg('')
  }

  // ── A-B Loop Handlers ──
  const handleSetA = () => {
    const pos = Math.floor(currentTimeMs)
    setLoopA(pos)
    if (loopB !== null && loopB <= pos) {
      setLoopB(Math.min(midiSong?.durationMs || pos + 5000, pos + 5000))
    }
    setIsLooping(true)
  }

  const handleSetB = () => {
    const pos = Math.floor(currentTimeMs)
    if (loopA !== null && pos <= loopA) {
      setLoopB(loopA + 2000)
    } else {
      setLoopB(pos)
    }
    setIsLooping(true)
  }

  const handleToggleLoop = () => {
    if (!isLooping && (loopA === null || loopB === null)) {
      // Default loop window around current time: 0 to 10s
      setLoopA(Math.max(0, Math.floor(currentTimeMs)))
      setLoopB(Math.min(midiSong?.durationMs || 10000, Math.floor(currentTimeMs) + 8000))
    }
    setIsLooping(!isLooping)
  }

  const handleClearLoop = () => {
    setLoopA(null)
    setLoopB(null)
    setIsLooping(false)
  }

  // Interactive seek on progress bar
  const handleProgressBarClick = (e) => {
    if (!midiSong) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, clickX / rect.width))
    const seekMs = Math.round(pct * midiSong.durationMs)
    setCurrentTimeMs(seekMs)
    prevTimeRef.current = seekMs
    playedNotesRef.current.clear()
  }

  const isPianoActive = currentTheme?.id === 'piano' || currentTheme?.perKeyMapping

  // ── Fallback: Piano theme not active ─────────────────────────────────
  if (!isPianoActive) {
    return (
      <div className="page piano-practice-page">
        <div className="piano-fallback-card">
          <div className="fallback-icon-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM6 12v6M9 12v6M12 12v6M15 12v6M18 12v6M6 4v8M9 4v8M12 4v8M15 4v8M18 4v8" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <h3>Piano Practice Mode</h3>
          <p>Piano Practice requires the <strong>Piano Theme</strong> to map your keyboard keys to piano notes.</p>
          <button className="btn-primary-lg" onClick={() => onThemeSwitch?.('piano')}>
            Activate Piano Theme
          </button>
        </div>
      </div>
    )
  }

  const pendingClusterNotes = mode === 'practice' ? pendingNotes : null

  // Octave display label helper
  const octaveLabel = octaveOffset === 0
    ? 'C3 – C5 (Default)'
    : octaveOffset > 0
    ? `+${octaveOffset} Oct (C${3 + octaveOffset} – C${5 + octaveOffset})`
    : `${octaveOffset} Oct (C${3 + octaveOffset} – C${5 + octaveOffset})`

  // Hand filter display helper
  const handFilterOptions = [
    { id: 'both',  label: '🎹 Both Hands' },
    { id: 'right', label: '♪ Right Hand (Blue)' },
    { id: 'left',  label: '♩ Left Hand (Yellow)' },
  ]

  // Octave stepper shared
  const OctavePill = () => (
    <div className="octave-control-pill">
      <span className="hud-label">Octave:</span>
      <button
        className="octave-step-btn"
        onClick={() => setOctaveOffset(prev => Math.max(-2, prev - 1))}
        disabled={octaveOffset <= -2}
        title="Shift 1 Octave Down"
      >
        −
      </button>
      <span className="octave-readout">{octaveLabel}</span>
      <button
        className="octave-step-btn"
        onClick={() => setOctaveOffset(prev => Math.min(2, prev + 1))}
        disabled={octaveOffset >= 2}
        title="Shift 1 Octave Up"
      >
        +
      </button>
      {octaveOffset !== 0 && (
        <button
          className="octave-reset-btn"
          onClick={() => setOctaveOffset(0)}
          title="Reset to default octave"
        >
          Reset
        </button>
      )}
    </div>
  )

  const songDuration = midiSong?.durationMs || 1

  return (
    <div className="page piano-practice-page" ref={pageRef}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="piano-page-header">
        <div className="piano-header-left">
          <div className="header-title-row">
            <h2 className="page-title">Piano Practice</h2>
            <span className="practice-badge">Synthesia &amp; Play-Along</span>
            {midiConnected && <span className="midi-active-badge">MIDI Connected</span>}
            {isLooping && <span className="loop-active-badge">🔁 A-B Loop ON</span>}
          </div>
          <p className="page-subtitle">
            {mode === 'freestyle' && 'Play freely — click keys, type on keyboard, or connect MIDI device'}
            {mode === 'waterfall' && 'Notes fall with audio — listen, watch, and play along with Blue (Right Hand) & Yellow (Left Hand)'}
            {mode === 'practice' && 'Waterfall pauses at chords — out-of-reach keys auto-play so you can practice smoothly'}
          </p>
        </div>

        <div className="piano-header-right">
          {/* Mode selector */}
          <div className="piano-mode-selector">
            {[
              { id: 'freestyle', label: 'Freestyle', icon: '♪' },
              { id: 'waterfall', label: 'Waterfall', icon: '↓' },
              { id: 'practice', label: 'Practice',  icon: '◎' },
            ].map(m => (
              <button
                key={m.id}
                className={`piano-mode-btn ${mode === m.id ? 'active' : ''}`}
                onClick={() => { setMode(m.id); setIsPlaying(false) }}
              >
                <span className="mode-icon">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Fullscreen Toggle */}
          <button
            className={`fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
            )}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </header>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      {statusMsg && <div className="practice-toast">{statusMsg}</div>}

      {/* ── MIDI Device Panel ───────────────────────────────────────── */}
      <MidiDevicePanel
        devices={midiDevices}
        selectedId={selectedDeviceId}
        onSelect={setSelectedDeviceId}
        connected={midiConnected}
      />

      {/* ── Main Content ────────────────────────────────────────────── */}
      {mode === 'freestyle' ? (

        /* ──────── FREESTYLE ──────── */
        <section className="freestyle-section">
          <div className="freestyle-hud">
            <div className="hud-chip">
              <span className="hud-label">Active Notes:</span>
              <span className="hud-val">{allActiveMidiNotes.size}</span>
            </div>
            <div className="hud-chip">
              <span className="hud-label">Source:</span>
              <span className="hud-val">{midiConnected ? 'MIDI + Keyboard + Click' : 'Keyboard + Click'}</span>
            </div>

            <OctavePill />

            <div className="hud-chip hint-chip">
              <span className="hud-hint">💡 Keys: Yellow = Left Hand (&lt;C4), Blue = Right Hand (≥C4)</span>
            </div>
          </div>

          <SynthesiaPiano
            activeMidiNotes={allActiveMidiNotes}
            channelNotes={channelNotes}
            noteHands={waterfallHandMap}
            midiConnected={midiConnected}
            showLabels={true}
            octaveOffset={octaveOffset}
            onNoteDown={handleNoteDown}
            onNoteUp={handleNoteUp}
            scrollToCenterMidi={null}
          />
        </section>

      ) : (

        /* ──────── WATERFALL / PRACTICE ──────── */
        <section className="waterfall-section">

          {/* Toolbar */}
          <div className="waterfall-toolbar">
            <button className="btn-primary-sm" onClick={handleLoadMidi}>
              Load MIDI File…
            </button>

            <OctavePill />

            {/* Hand Filter Selector */}
            <div className="hand-filter-selector">
              {handFilterOptions.map(opt => (
                <button
                  key={opt.id}
                  className={`hand-filter-btn ${handFilter === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    setHandFilter(opt.id)
                    playedNotesRef.current.clear()
                  }}
                  title={`Filter: ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* A-B Loop Controls */}
            {midiSong && (
              <div className="loop-controls-group">
                <button
                  className="loop-btn marker-btn"
                  onClick={handleSetA}
                  title="Set Loop Start Point A"
                >
                  Set [A] {loopA !== null && <span className="loop-time-tag">{Math.floor(loopA/1000)}s</span>}
                </button>
                <button
                  className="loop-btn marker-btn"
                  onClick={handleSetB}
                  title="Set Loop End Point B"
                >
                  Set [B] {loopB !== null && <span className="loop-time-tag">{Math.floor(loopB/1000)}s</span>}
                </button>
                <button
                  className={`loop-btn toggle-btn ${isLooping ? 'active' : ''}`}
                  onClick={handleToggleLoop}
                  title="Toggle A-B Loop Mode"
                >
                  <span>{isLooping ? '🔁 Loop A-B ON' : '🔁 Loop A-B OFF'}</span>
                </button>
                {(loopA !== null || loopB !== null) && (
                  <button
                    className="loop-btn clear-btn"
                    onClick={handleClearLoop}
                    title="Clear A-B Loop Points"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            )}

            {midiSong && (
              <div className="transport-controls">
                <button className="btn-transport" onClick={handlePlay} disabled={!midiSong}>
                  {mode === 'practice' && !isPlaying ? (
                    <><span>▶</span> Start Practice</>
                  ) : isPlaying ? (
                    <><span>⏸</span> Pause</>
                  ) : (
                    <><span>▶</span> Play Along</>
                  )}
                </button>
                <button className="btn-transport secondary" onClick={handleRestart}>
                  <span>↩</span> Restart
                </button>

                {/* Song Audio Toggle */}
                {mode === 'waterfall' && (
                  <button
                    className={`song-audio-btn ${isSongAudioEnabled ? 'active' : 'muted'}`}
                    onClick={() => setIsSongAudioEnabled(!isSongAudioEnabled)}
                    title={isSongAudioEnabled ? 'Song Audio is Playing' : 'Song Audio is Muted'}
                  >
                    <span>{isSongAudioEnabled ? '🔊 Song Audio ON' : '🔇 Song Audio OFF'}</span>
                  </button>
                )}

                {mode === 'waterfall' && (
                  <div className="speed-selector">
                    <span className="speed-label">Speed:</span>
                    {[0.5, 0.75, 1.0, 1.5, 2.0].map(s => (
                      <button
                        key={s}
                        className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
                        onClick={() => setPlaybackSpeed(s)}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}

                {/* Progress Bar with A-B Markers */}
                <div className="song-progress-row">
                  <div
                    className="song-progress-bar clickable"
                    onClick={handleProgressBarClick}
                    title="Click to seek"
                  >
                    {/* Active A-B Loop Stripe */}
                    {isLooping && loopA !== null && loopB !== null && (
                      <div
                        className="song-progress-loop-region"
                        style={{
                          left: `${(loopA / songDuration) * 100}%`,
                          width: `${Math.max(1, ((loopB - loopA) / songDuration) * 100)}%`
                        }}
                      />
                    )}

                    {/* Progress Fill */}
                    <div
                      className="song-progress-fill"
                      style={{ width: `${(currentTimeMs / songDuration) * 100}%` }}
                    />

                    {/* Marker A */}
                    {loopA !== null && (
                      <div
                        className="loop-marker-pin marker-a"
                        style={{ left: `${(loopA / songDuration) * 100}%` }}
                        title={`Loop Point A: ${Math.floor(loopA/1000)}s`}
                      >
                        A
                      </div>
                    )}

                    {/* Marker B */}
                    {loopB !== null && (
                      <div
                        className="loop-marker-pin marker-b"
                        style={{ left: `${(loopB / songDuration) * 100}%` }}
                        title={`Loop Point B: ${Math.floor(loopB/1000)}s`}
                      >
                        B
                      </div>
                    )}
                  </div>

                  <span className="song-time">
                    {Math.floor(currentTimeMs / 1000)}s / {Math.floor(songDuration / 1000)}s
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Practice Note Display — prominent chord panel */}
          {mode === 'practice' && pendingNotes.size > 0 && (
            <PracticeNoteDisplay
              pendingNotes={pendingNotes}
              pressedNotes={allActiveMidiNotes}
              autoSatisfiedNotes={autoSatisfiedNotes}
              clusterIdx={clusterIdx}
              totalClusters={clusters.length}
            />
          )}

          {/* Waterfall + Piano stacked */}
          <div className="waterfall-piano-stack">
            <WaterfallCanvas
              midiSong={midiSong}
              currentTimeMs={currentTimeMs}
              visibleWindowMs={VISIBLE_WINDOW_MS}
              startMidi={startMidi}
              endMidi={endMidi}
              practiceMode={mode === 'practice'}
              pendingClusterNotes={pendingClusterNotes}
              handFilter={handFilter}
            />

            {/* Hit line decorative spacer */}
            <div className="waterfall-hit-connector" />

            <SynthesiaPiano
              activeMidiNotes={visualActiveMidiNotes}
              pendingNotes={mode === 'practice' ? pendingNotes : new Set()}
              channelNotes={channelNotes}
              noteHands={waterfallHandMap}
              midiConnected={midiConnected}
              showLabels={true}
              octaveOffset={octaveOffset}
              onNoteDown={handleNoteDown}
              onNoteUp={handleNoteUp}
              scrollToCenterMidi={scrollToCenterMidi}
            />
          </div>
        </section>
      )}
    </div>
  )
}
