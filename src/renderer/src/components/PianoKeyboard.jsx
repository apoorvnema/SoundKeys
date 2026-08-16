import React from 'react'

/**
 * PianoKeyboard — Renders spatial white/black piano keys (Synthesia style)
 * AND a visual computer keyboard layout showing mapped piano notes per keycap.
 */

// White keys & Black keys layout relative positions
const WHITE_KEYS = [
  { note: 'C3', label: 'Z', kc: 44 },
  { note: 'D3', label: 'X', kc: 45 },
  { note: 'E3', label: 'C', kc: 46 },
  { note: 'F3', label: 'V', kc: 47 },
  { note: 'G3', label: 'B', kc: 48 },
  { note: 'A3', label: 'N', kc: 49 },
  { note: 'B3', label: 'M', kc: 50 },

  { note: 'C4', label: 'A', kc: 30 },
  { note: 'D4', label: 'S', kc: 31 },
  { note: 'E4', label: 'D', kc: 32 },
  { note: 'F4', label: 'F', kc: 33 },
  { note: 'G4', label: 'G', kc: 34 },
  { note: 'A4', label: 'H', kc: 35 },
  { note: 'B4', label: 'J', kc: 36 },
  { note: 'C5', label: 'K', kc: 37 },
  { note: 'D5', label: 'L', kc: 38 }
]

const BLACK_KEYS = [
  { note: 'C#4', label: 'W', kc: 17, leftIndex: 7 },
  { note: 'D#4', label: 'E', kc: 18, leftIndex: 8 },
  { note: 'F#4', label: 'T', kc: 20, leftIndex: 10 },
  { note: 'G#4', label: 'Y', kc: 21, leftIndex: 11 },
  { note: 'A#4', label: 'U', kc: 22, leftIndex: 12 },
  { note: 'C#5', label: 'O', kc: 24, leftIndex: 14 },
  { note: 'D#5', label: 'P', kc: 25, leftIndex: 15 }
]

// Computer Keyboard Layout Mapping Rows
const COMPUTER_KEYBOARD_MAPPING = [
  // QWERTY Row
  [
    { label: 'Q', note: '', kc: 16 },
    { label: 'W', note: 'C#4', kc: 17, isBlack: true },
    { label: 'E', note: 'D#4', kc: 18, isBlack: true },
    { label: 'R', note: '', kc: 19 },
    { label: 'T', note: 'F#4', kc: 20, isBlack: true },
    { label: 'Y', note: 'G#4', kc: 21, isBlack: true },
    { label: 'U', note: 'A#4', kc: 22, isBlack: true },
    { label: 'I', note: '', kc: 23 },
    { label: 'O', note: 'C#5', kc: 24, isBlack: true },
    { label: 'P', note: 'D#5', kc: 25, isBlack: true }
  ],
  // Home Row
  [
    { label: 'A', note: 'C4', kc: 30, isWhite: true },
    { label: 'S', note: 'D4', kc: 31, isWhite: true },
    { label: 'D', note: 'E4', kc: 32, isWhite: true },
    { label: 'F', note: 'F4', kc: 33, isWhite: true },
    { label: 'G', note: 'G4', kc: 34, isWhite: true },
    { label: 'H', note: 'A4', kc: 35, isWhite: true },
    { label: 'J', note: 'B4', kc: 36, isWhite: true },
    { label: 'K', note: 'C5', kc: 37, isWhite: true },
    { label: 'L', note: 'D5', kc: 38, isWhite: true }
  ],
  // Bottom Row
  [
    { label: 'Z', note: 'C3', kc: 44, isWhite: true },
    { label: 'X', note: 'D3', kc: 45, isWhite: true },
    { label: 'C', note: 'E3', kc: 46, isWhite: true },
    { label: 'V', note: 'F3', kc: 47, isWhite: true },
    { label: 'B', note: 'G3', kc: 48, isWhite: true },
    { label: 'N', note: 'A3', kc: 49, isWhite: true },
    { label: 'M', note: 'B3', kc: 50, isWhite: true }
  ]
]

export default function PianoKeyboard({
  activeKeycodes = new Set(),
  layoutMode = 'piano',
  showComputerKeyboard = true
}) {
  if (layoutMode === 'scale') {
    // Linear scale mode grid
    const scaleKeys = [
      { label: '1', note: 'C3', kc: 2 }, { label: '2', note: 'D3', kc: 3 }, { label: '3', note: 'E3', kc: 4 },
      { label: '4', note: 'F3', kc: 5 }, { label: '5', note: 'G3', kc: 6 }, { label: '6', note: 'A3', kc: 7 },
      { label: '7', note: 'B3', kc: 8 }, { label: '8', note: 'C4', kc: 9 }, { label: '9', note: 'D4', kc: 10 },
      { label: '0', note: 'E4', kc: 11 }, { label: 'Q', note: 'F4', kc: 16 }, { label: 'W', note: 'G4', kc: 17 },
      { label: 'E', note: 'A4', kc: 18 }, { label: 'R', note: 'B4', kc: 19 }, { label: 'T', note: 'C5', kc: 20 },
      { label: 'Y', note: 'D5', kc: 21 }, { label: 'U', note: 'E5', kc: 22 }, { label: 'I', note: 'F5', kc: 23 },
      { label: 'O', note: 'G5', kc: 24 }, { label: 'P', note: 'A5', kc: 25 }, { label: 'A', note: 'B5', kc: 30 },
      { label: 'S', note: 'C6', kc: 31 }, { label: 'D', note: 'D6', kc: 32 }, { label: 'F', note: 'E6', kc: 33 }
    ]

    return (
      <div className="piano-view-wrapper">
        <div className="piano-keyboard scale-mode">
          {scaleKeys.map(k => {
            const isActive = activeKeycodes.has(k.kc)
            return (
              <div key={k.kc} className={`scale-key ${isActive ? 'active' : ''}`}>
                <span className="key-label">{k.label}</span>
                <span className="note-name">{k.note}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Piano mode (Computer Keyboard Mapping + Spatial Piano Keys)
  return (
    <div className="piano-view-wrapper">
      {/* 1. Mapped Computer Keyboard Layout Visualizer */}
      {showComputerKeyboard && (
        <div className="computer-keyboard-map-card">
          <div className="kbd-map-title">Keyboard Mapped Piano Layout</div>
          <div className="computer-kbd-rows">
            {COMPUTER_KEYBOARD_MAPPING.map((row, rowIdx) => (
              <div key={rowIdx} className={`computer-kbd-row row-${rowIdx}`}>
                {row.map(k => {
                  const isActive = activeKeycodes.has(k.kc)
                  return (
                    <div
                      key={k.kc}
                      className={`computer-key-cap ${k.isBlack ? 'is-black-mapped' : k.isWhite ? 'is-white-mapped' : ''} ${isActive ? 'active' : ''}`}
                    >
                      <span className="cap-label">{k.label}</span>
                      {k.note && <span className="cap-note">{k.note}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Spatial Piano Keys Visualizer */}
      <div className="piano-keyboard-container">
        <div className="piano-keyboard spatial-mode">
          {/* Render White Keys */}
          {WHITE_KEYS.map((k) => {
            const isActive = activeKeycodes.has(k.kc)
            return (
              <div
                key={k.note}
                className={`piano-key white-key ${isActive ? 'active' : ''}`}
              >
                <span className="key-label">{k.label}</span>
                <span className="note-name">{k.note}</span>
              </div>
            )
          })}

          {/* Render Black Keys overlay */}
          {BLACK_KEYS.map((k) => {
            const isActive = activeKeycodes.has(k.kc)
            const leftPercent = (k.leftIndex + 0.65) * (100 / WHITE_KEYS.length)
            return (
              <div
                key={k.note}
                className={`piano-key black-key ${isActive ? 'active' : ''}`}
                style={{ left: `${leftPercent}%`, width: `${(100 / WHITE_KEYS.length) * 0.7}%` }}
              >
                <span className="key-label">{k.label}</span>
                <span className="note-name">{k.note}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
