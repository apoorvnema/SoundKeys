import React, { useRef, useEffect, useMemo, useCallback } from 'react'

/**
 * SynthesiaPiano — Full-width proportional piano keyboard (Synthesia style)
 *
 * Props:
 *   activeMidiNotes   Set<number>   — currently pressed MIDI note numbers
 *   pendingNotes      Set<number>   — notes user MUST press (practice mode, shown in yellow)
 *   highlightedNotes  Set<number>   — MIDI notes lit up from waterfall "now playing"
 *   channelNotes      Object        — { midiNote: channelIdx } for coloring active notes by channel
 *   midiConnected     boolean       — if true, show wider range (C1-C8)
 *   showLabels        boolean       — show key labels
 *   octaveOffset      number        — shift keyboard mappings by N octaves (-3 to +3)
 *   onNoteDown        function      — (midiNote) => void callback on key press/click
 *   onNoteUp          function      — (midiNote) => void callback on key release
 *   scrollToCenterMidi number|null  — when set, scroll to center this MIDI note (practice advance only)
 */

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export const isBlack = (noteNum) => [1,3,6,8,10].includes(noteNum % 12)
export const isWhite = (noteNum) => !isBlack(noteNum)

export function getMidiNoteName(midiNumber) {
  const oct = Math.floor(midiNumber / 12) - 1
  const nameIdx = midiNumber % 12
  return `${NOTE_NAMES[nameIdx]}${oct}`
}

export function buildKeyRange(startMidi, endMidi) {
  const keys = []
  for (let n = startMidi; n <= endMidi; n++) {
    const oct = Math.floor(n / 12) - 1
    const nameIdx = n % 12
    keys.push({
      midi: n,
      name: NOTE_NAMES[nameIdx] + oct,
      noteName: NOTE_NAMES[nameIdx],
      octave: oct,
      black: isBlack(n),
    })
  }
  return keys
}

// Base uiohook scan code => MIDI note number (piano-feel layout at Octave 0 offset)
export const BASE_KEYCODE_TO_MIDI = {
  44: 48, // Z => C3
  45: 50, // X => D3
  46: 52, // C => E3
  47: 53, // V => F3
  48: 55, // B => G3
  49: 57, // N => A3
  50: 59, // M => B3
  30: 60, // A => C4
  31: 62, // S => D4
  32: 64, // D => E4
  33: 65, // F => F4
  34: 67, // G => G4
  35: 69, // H => A4
  36: 71, // J => B4
  37: 72, // K => C5
  38: 74, // L => D5
  17: 61, // W => C#4
  18: 63, // E => D#4
  20: 66, // T => F#4
  21: 68, // Y => G#4
  22: 70, // U => A#4
  24: 73, // O => C#5
  25: 75, // P => D#5
}

// Backward compatibility export
export const KEYCODE_TO_MIDI = BASE_KEYCODE_TO_MIDI

export const KEYCODE_TO_CHAR = {
  44:'Z', 45:'X', 46:'C', 47:'V', 48:'B', 49:'N', 50:'M',
  30:'A', 31:'S', 32:'D', 33:'F', 34:'G', 35:'H', 36:'J', 37:'K', 38:'L',
  17:'W', 18:'E', 20:'T', 21:'Y', 22:'U', 24:'O', 25:'P'
}

export const HAND_COLORS = {
  left: '#fbbf24',   // Amber / Yellow for Left Hand
  right: '#06b6d4',  // Cyan / Blue for Right Hand
}

const CHANNEL_COLORS = [
  '#06b6d4', // Blue/Cyan (Right hand)
  '#fbbf24', // Amber/Yellow (Left hand)
  '#9333ea', // purple
  '#22c55e', // green
  '#f43f5e', // rose
  '#818cf8', // indigo
]

export default function SynthesiaPiano({
  activeMidiNotes = new Set(),
  pendingNotes = new Set(),
  channelNotes = {},
  noteHands = {},
  midiConnected = false,
  showLabels = true,
  highlightedNotes = new Set(),
  octaveOffset = 0,
  onNoteDown = null,
  onNoteUp = null,
  scrollToCenterMidi = null,  // controlled scroll: only fires on practice cluster advance
}) {
  const containerRef = useRef(null)
  const isPointerDownRef = useRef(false)

  // Dynamic reverse map for currently displayed octave
  const midiToKeyLabel = useMemo(() => {
    const map = {}
    const shift = (Number(octaveOffset) || 0) * 12
    Object.entries(BASE_KEYCODE_TO_MIDI).forEach(([kc, baseMidi]) => {
      const shiftedMidi = baseMidi + shift
      const char = KEYCODE_TO_CHAR[kc]
      if (char) {
        map[shiftedMidi] = char
      }
    })
    return map
  }, [octaveOffset])

  // Range: C2(36) to C6(84) for keyboard, C1(24) to C8(108) for MIDI device
  const startMidi = midiConnected ? 24 : Math.max(12, 36 + Math.min(0, octaveOffset * 12))
  const endMidi   = midiConnected ? 108 : Math.min(120, 84 + Math.max(0, octaveOffset * 12))
  const allKeys   = useMemo(() => buildKeyRange(startMidi, endMidi), [startMidi, endMidi])
  const whiteKeys = useMemo(() => allKeys.filter(k => !k.black), [allKeys])

  // Controlled scroll: only fires when scrollToCenterMidi changes externally (practice cluster advance).
  // NEVER fires on user click — that auto-scroll has been removed.
  useEffect(() => {
    if (scrollToCenterMidi == null || !containerRef.current) return
    const whiteIdx = whiteKeys.findIndex(k => k.midi >= scrollToCenterMidi)
    if (whiteIdx === -1) return
    const container = containerRef.current
    const keyWidth = container.scrollWidth / whiteKeys.length
    const scrollX = whiteIdx * keyWidth - container.clientWidth / 2
    container.scrollTo({ left: Math.max(0, scrollX), behavior: 'smooth' })
  }, [scrollToCenterMidi, whiteKeys])

  // Interactive Key Press handlers — preventDefault blocks any browser scroll
  const handleKeyPointerDown = useCallback((midi, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.button !== undefined && e.button !== 0) return // Left click only
    isPointerDownRef.current = true
    onNoteDown?.(midi)
  }, [onNoteDown])

  const handleKeyPointerUp = useCallback((midi, e) => {
    e.preventDefault()
    isPointerDownRef.current = false
    onNoteUp?.(midi)
  }, [onNoteUp])

  const handleKeyPointerEnter = useCallback((midi, e) => {
    e.preventDefault()
    if (isPointerDownRef.current || (e.buttons === 1)) {
      onNoteDown?.(midi)
    }
  }, [onNoteDown])

  const handleKeyPointerLeave = useCallback((midi, e) => {
    e.preventDefault()
    if (isPointerDownRef.current || (e.buttons === 1)) {
      onNoteUp?.(midi)
    }
  }, [onNoteUp])

  // Helper to determine key color based on explicit hand or note pitch
  const getKeyColor = useCallback((midi) => {
    const hand = noteHands[midi]
    if (hand === 'left') return HAND_COLORS.left
    if (hand === 'right') return HAND_COLORS.right
    // If channel is present
    const chan = channelNotes[midi]
    if (chan !== undefined) {
      if (chan === 0) return HAND_COLORS.right
      if (chan === 1) return HAND_COLORS.left
      return CHANNEL_COLORS[chan % CHANNEL_COLORS.length]
    }
    // Default pitch split: < 60 is Yellow (left), >= 60 is Blue (right)
    return midi < 60 ? HAND_COLORS.left : HAND_COLORS.right
  }, [noteHands, channelNotes])

  // Global mouseup safety listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isPointerDownRef.current = false
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('touchend', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('touchend', handleGlobalMouseUp)
    }
  }, [])

  const wkCount = whiteKeys.length
  const whiteW = `${100 / wkCount}%`

  return (
    <div className="synthesia-piano-wrapper">
      <div className="synthesia-piano-scroll" ref={containerRef}>
        <div className="synthesia-piano" style={{ minWidth: `${Math.max(wkCount * 38, 700)}px` }}>
          {/* White Keys */}
          {whiteKeys.map((k, idx) => {
            const isActive = activeMidiNotes.has(k.midi) || highlightedNotes.has(k.midi)
            const isPending = pendingNotes.has(k.midi)
            const activeColor = getKeyColor(k.midi)
            const keyChar = midiToKeyLabel[k.midi]

            return (
              <div
                key={k.midi}
                className={`synth-white-key ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
                style={{
                  left: `${(idx / wkCount) * 100}%`,
                  width: whiteW,
                  '--key-color': activeColor,
                }}
                data-note={k.name}
                data-midi={k.midi}
                onPointerDown={(e) => handleKeyPointerDown(k.midi, e)}
                onPointerUp={(e) => handleKeyPointerUp(k.midi, e)}
                onPointerEnter={(e) => handleKeyPointerEnter(k.midi, e)}
                onPointerLeave={(e) => handleKeyPointerLeave(k.midi, e)}
                onPointerCancel={(e) => handleKeyPointerUp(k.midi, e)}
              >
                {showLabels && (
                  <div className="synth-key-labels">
                    <span className="synth-note-badge">{k.name}</span>
                    {keyChar ? (
                      <span className="synth-key-char-badge">{keyChar}</span>
                    ) : (
                      <span className="synth-key-char-placeholder" />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Black Keys */}
          {allKeys.filter(k => k.black).map((k) => {
            const prevWhiteIdx = whiteKeys.filter(w => w.midi < k.midi).length - 1
            if (prevWhiteIdx < 0) return null

            const leftPct = ((prevWhiteIdx + 0.72) / wkCount) * 100
            const widthPct = (0.62 / wkCount) * 100

            const isActive = activeMidiNotes.has(k.midi) || highlightedNotes.has(k.midi)
            const isPending = pendingNotes.has(k.midi)
            const activeColor = getKeyColor(k.midi)
            const keyChar = midiToKeyLabel[k.midi]

            return (
              <div
                key={k.midi}
                className={`synth-black-key ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  '--key-color': activeColor,
                }}
                data-note={k.name}
                data-midi={k.midi}
                onPointerDown={(e) => handleKeyPointerDown(k.midi, e)}
                onPointerUp={(e) => handleKeyPointerUp(k.midi, e)}
                onPointerEnter={(e) => handleKeyPointerEnter(k.midi, e)}
                onPointerLeave={(e) => handleKeyPointerLeave(k.midi, e)}
                onPointerCancel={(e) => handleKeyPointerUp(k.midi, e)}
              >
                {showLabels && (
                  <div className="synth-black-key-labels">
                    <span className="synth-black-note-badge">{k.name}</span>
                    {keyChar && (
                      <span className="synth-black-char-badge">{keyChar}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { CHANNEL_COLORS }
