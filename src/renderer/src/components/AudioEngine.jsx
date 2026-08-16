import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Howl, Howler } from 'howler'

/**
 * AudioEngine — non-visual React component that manages Howler.js sound playback.
 *
 * Exposed via ref:
 *   loadTheme(theme)   — preload all sounds for a theme
 *   play(soundType)    — play a sound by type ('typing', 'enter', etc.)
 *   setVolume(0–1)     — update master volume
 */

function buildFileUrl(basePath, filename) {
  // Convert Windows backslashes → forward slashes for file:// protocol
  return `file:///${basePath.replace(/\\/g, '/')}/${filename}`
}

const NOTE_PREFIXES = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']
function getMidiFilename(midiNumber) {
  const octave = Math.floor(midiNumber / 12) - 1
  const noteIndex = midiNumber % 12
  return `piano_${NOTE_PREFIXES[noteIndex]}${octave}.wav`
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function playSynthesizedPianoTone(midiNote, durationSec = 0.8, volume = 0.7) {
  try {
    const ctx = Howler.ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const freq = midiToFreq(midiNote)
    const dur = Math.max(0.2, Math.min(durationSec, 3.0))

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(Math.min(1, volume * 0.75), now + 0.008)
    masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.35), now + 0.25)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    masterGain.connect(ctx.destination)

    const harmonics = [
      { mult: 1, gain: 0.65 },
      { mult: 2, gain: 0.28 },
      { mult: 3, gain: 0.12 },
      { mult: 4, gain: 0.05 }
    ]

    harmonics.forEach(h => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq * h.mult, now)

      const hGain = ctx.createGain()
      hGain.gain.value = h.gain

      osc.connect(hGain)
      hGain.connect(masterGain)

      osc.start(now)
      osc.stop(now + dur + 0.05)
    })
  } catch (e) {
    console.warn('[Audio] Synthesizer error:', e)
  }
}

const AudioEngine = forwardRef((props, ref) => {
  const soundsRef  = useRef({})     // { soundType: Howl | Howl[] }
  const keyMapSoundsRef = useRef({}) // { filename: Howl }
  const externalCacheRef = useRef({}) // { filePath: Howl }
  const volumeRef  = useRef(0.7)
  const octaveOffsetRef = useRef(0)
  const themeIdRef = useRef(null)
  const themeRef   = useRef(null)

  function unloadAll() {
    for (const s of Object.values(soundsRef.current)) {
      if (Array.isArray(s)) s.forEach(h => h.unload())
      else s?.unload()
    }
    soundsRef.current = {}

    for (const h of Object.values(keyMapSoundsRef.current)) {
      h?.unload()
    }
    keyMapSoundsRef.current = {}

    for (const h of Object.values(externalCacheRef.current)) {
      h?.unload()
    }
    externalCacheRef.current = {}
  }

  function loadTheme(theme) {
    if (!theme) return
    if (themeIdRef.current === theme.id && Object.keys(soundsRef.current).length > 0) return

    unloadAll()
    themeIdRef.current = theme.id
    themeRef.current = theme
    const vol = volumeRef.current

    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume().catch(() => {})
    }

    function makeHowl(filename) {
      return new Howl({
        src: [buildFileUrl(theme.basePath, filename)],
        preload: true,
        volume: vol,
        html5: false,   // Web Audio API — lower latency than HTML5 audio
        onloaderror: (id, err) => {
          console.warn(`[Audio] Load error for ${filename}:`, err)
        }
      })
    }

    // Typing pool
    if (Array.isArray(theme.typing)) {
      soundsRef.current.typing = theme.typing.map(f => makeHowl(f))
    } else if (theme.typing) {
      soundsRef.current.typing = [makeHowl(theme.typing)]
    }

    // Single-sound event types
    const SINGLE_TYPES = ['spacebar', 'enter', 'backspace', 'escape', 'tab', 'functionKeys']
    for (const key of SINGLE_TYPES) {
      if (theme[key]) soundsRef.current[key] = makeHowl(theme[key])
    }

    // Per-key mapping files preload
    if (theme.perKeyMapping) {
      const allFiles = new Set()
      const maps = [theme.keyMapPianoFeel, theme.keyMapScale, theme.keyMap]
      maps.forEach(m => {
        if (m && typeof m === 'object') {
          Object.values(m).forEach(f => f && allFiles.add(f))
        }
      })

      // Preload the full chromatic piano range: C1 (24) to C8 (108)
      for (let m = 24; m <= 108; m++) {
        allFiles.add(getMidiFilename(m))
      }

      allFiles.forEach(filename => {
        if (filename && !keyMapSoundsRef.current[filename]) {
          keyMapSoundsRef.current[filename] = makeHowl(filename)
        }
      })
    }

    console.log(`[Audio] Loaded theme: ${theme.name || theme.id}`)
  }

  function playMidiNote(midiNote, durationSec = 0.8, volumeScale = 1.0) {
    const vol = volumeRef.current * volumeScale
    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume().catch(() => {})
    }

    const currentTheme = themeRef.current
    const filename = getMidiFilename(midiNote)

    if (currentTheme?.perKeyMapping && keyMapSoundsRef.current[filename]) {
      try {
        const howl = keyMapSoundsRef.current[filename]
        howl.volume(vol)
        howl.play()
        return
      } catch (e) {
        console.warn('[Audio] Failed to play cached piano howl:', e)
      }
    }

    // If file exists in theme directory but not yet in cache
    if (currentTheme?.perKeyMapping && currentTheme.basePath) {
      try {
        const newHowl = new Howl({
          src: [buildFileUrl(currentTheme.basePath, filename)],
          preload: true,
          volume: vol,
          html5: false
        })
        keyMapSoundsRef.current[filename] = newHowl
        newHowl.play()
        return
      } catch (e) {
        // Fall through to synthesizer
      }
    }

    // Web Audio Synthesizer Fallback
    playSynthesizedPianoTone(midiNote, durationSec, vol)
  }

  function setOctaveOffset(offset) {
    octaveOffsetRef.current = Number(offset) || 0
  }

  function play(soundType, externalFile, keycode, customFilename, isHotkeyBinding) {
    const vol = volumeRef.current
    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume().catch(() => {})
    }

    if (externalFile) {
      try {
        if (!externalCacheRef.current[externalFile]) {
          const fileUrl = externalFile.startsWith('file://') ? externalFile : `file:///${externalFile.replace(/\\/g, '/')}`
          externalCacheRef.current[externalFile] = new Howl({
            src: [fileUrl],
            preload: true,
            volume: vol,
            html5: false,
            onloaderror: (id, err) => {
              console.warn(`[Audio] Load error for external audio file ${externalFile}:`, err)
            }
          })
        }
        const externalHowl = externalCacheRef.current[externalFile]
        externalHowl.volume(vol)
        externalHowl.play()
      } catch (e) {
        console.warn(`[Audio] External sound playback error:`, e)
      }
      return
    }

    const currentTheme = themeRef.current

    // Check if per-key mapping applies (skip for custom hotkey bindings)
    if (currentTheme?.perKeyMapping && keycode && !isHotkeyBinding) {
      const kcStr = String(keycode)
      const offset = octaveOffsetRef.current || 0

      // If octave offset is active, resolve shifted note
      if (offset !== 0) {
        const BASE_KEYCODE_TO_MIDI = {
          44: 48, 45: 50, 46: 52, 47: 53, 48: 55, 49: 57, 50: 59,
          30: 60, 31: 62, 32: 64, 33: 65, 34: 67, 35: 69, 36: 71, 37: 72, 38: 74,
          17: 61, 18: 63, 20: 66, 21: 68, 22: 70, 24: 73, 25: 75
        }
        const baseMidi = BASE_KEYCODE_TO_MIDI[keycode]
        if (baseMidi) {
          playMidiNote(baseMidi + offset * 12)
          return
        }
      }

      const filename = customFilename ||
        currentTheme.keyMapPianoFeel?.[kcStr] ||
        currentTheme.keyMapScale?.[kcStr] ||
        currentTheme.keyMap?.[kcStr]

      if (filename && keyMapSoundsRef.current[filename]) {
        keyMapSoundsRef.current[filename].play()
        return
      }
    }

    const sounds = soundsRef.current

    if (soundType === 'typing' || !sounds[soundType]) {
      const pool = sounds.typing
      if (pool?.length > 0) {
        pool[Math.floor(Math.random() * pool.length)].play()
      }
    } else {
      sounds[soundType]?.play()
    }
  }

  function setVolume(vol) {
    volumeRef.current = vol
    for (const s of Object.values(soundsRef.current)) {
      if (Array.isArray(s)) s.forEach(h => h.volume(vol))
      else s?.volume(vol)
    }
    for (const h of Object.values(keyMapSoundsRef.current)) {
      h?.volume(vol)
    }
    for (const h of Object.values(externalCacheRef.current)) {
      h?.volume(vol)
    }
  }

  useImperativeHandle(ref, () => ({ loadTheme, play, playMidiNote, setOctaveOffset, setVolume }))

  return null // purely functional, no DOM output
})

AudioEngine.displayName = 'AudioEngine'
export default AudioEngine
