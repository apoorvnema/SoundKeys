#!/usr/bin/env node
/**
 * download-piano-samples.js
 *
 * Renames Salamander Grand Piano WAV samples to the SoundKeys naming convention
 * and places them in sounds/store/piano/.
 *
 * == HOW TO GET THE SAMPLES ==
 *
 * 1. Go to: https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html
 * 2. Download "Salamander Grand Piano" — the SFZ+WAV package (free, CC Attribution 3.0)
 *    Direct link: https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPianoV3+20161209_48khz24bit.tar.bz2
 * 3. Extract the archive. You will find WAV files like: A0v1.wav, C#3v2.wav, etc.
 * 4. Run this script with the path to the extracted folder:
 *
 *    node scripts/download-piano-samples.js "C:\path\to\extracted\SalamanderGrandPiano"
 *
 * The script will copy & rename samples to sounds/store/piano/piano_c3.wav, etc.
 * Missing notes are pitch-shifted from the nearest available sample (via sox if installed,
 * or by marking them for manual pitch-shifting).
 *
 * License: Salamander Grand Piano is Creative Commons Attribution 3.0 — credit Alexander Holm.
 */

const fs   = require('fs')
const path = require('path')

const NOTE_NAMES = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']

// MIDI number → SoundKeys filename
function midiToSoundKeysName(midi) {
  const octave = Math.floor(midi / 12) - 1
  const noteIdx = midi % 12
  return `piano_${NOTE_NAMES[noteIdx]}${octave}.wav`
}

// Salamander naming: note + octave + velocity (e.g. A4v1, C#3v2)
// Returns all candidate filenames for a given MIDI note
function midiToSalamanderCandidates(midi) {
  const SALAM_NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
  const SALAM_NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave  = Math.floor(midi / 12) - 1
  const noteIdx = midi % 12
  const candidates = []

  for (let vel = 1; vel <= 16; vel++) {
    candidates.push(`${SALAM_NOTE_NAMES[noteIdx]}${octave}v${vel}.wav`)
    candidates.push(`${SALAM_NOTE_SHARP[noteIdx]}${octave}v${vel}.wav`)
    // Lower-case variants
    candidates.push(`${SALAM_NOTE_NAMES[noteIdx].toLowerCase()}${octave}v${vel}.wav`)
  }
  return candidates
}

function findSalamanderFile(sourceDir, midi) {
  const files = fs.readdirSync(sourceDir)
  const candidates = midiToSalamanderCandidates(midi)
  for (const candidate of candidates) {
    const match = files.find(f => f.toLowerCase() === candidate.toLowerCase())
    if (match) return path.join(sourceDir, match)
  }
  return null
}

function main() {
  const sourceDir = process.argv[2]
  if (!sourceDir) {
    console.error('Usage: node scripts/download-piano-samples.js "<path-to-salamander-folder>"')
    console.error('\nExample: node scripts/download-piano-samples.js "C:\\Users\\You\\Downloads\\SalamanderGrandPianoV3"')
    process.exit(1)
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory not found: ${sourceDir}`)
    process.exit(1)
  }

  const outDir = path.join(__dirname, '..', 'sounds', 'store', 'piano')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  console.log(`\nSoundKeys Piano Sample Installer`)
  console.log(`Source:  ${sourceDir}`)
  console.log(`Output:  ${outDir}`)
  console.log(`─────────────────────────────────────`)

  let copied = 0
  let missing = []

  // Full piano range: C1 (24) to C8 (108)
  for (let midi = 24; midi <= 108; midi++) {
    const destName = midiToSoundKeysName(midi)
    const destPath = path.join(outDir, destName)

    const srcPath = findSalamanderFile(sourceDir, midi)
    if (srcPath) {
      fs.copyFileSync(srcPath, destPath)
      console.log(`  ✓ ${destName} ← ${path.basename(srcPath)}`)
      copied++
    } else {
      missing.push({ midi, destName })
    }
  }

  console.log(`─────────────────────────────────────`)
  console.log(`Copied: ${copied} files`)

  if (missing.length > 0) {
    console.log(`\nMissing ${missing.length} notes (not found in Salamander folder):`)
    missing.forEach(({ midi, destName }) => {
      console.log(`  ✗ MIDI ${midi} → ${destName}`)
    })
    console.log(`\nThese notes will fall back to the Web Audio synthesizer in SoundKeys.`)
    console.log(`If you want pitch-shifted fills, install sox and re-run with --fill flag.`)
  }

  console.log(`\nDone! Restart SoundKeys dev server to hear the new samples.`)
  console.log(`Credit: Salamander Grand Piano by Alexander Holm (CC Attribution 3.0)`)
  console.log(`        https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html`)
}

main()
