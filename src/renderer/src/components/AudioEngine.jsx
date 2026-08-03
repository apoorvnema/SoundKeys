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

const AudioEngine = forwardRef((props, ref) => {
  const soundsRef  = useRef({})     // { soundType: Howl | Howl[] }
  const externalCacheRef = useRef({}) // { filePath: Howl }
  const volumeRef  = useRef(0.7)
  const themeIdRef = useRef(null)

  function unloadAll() {
    for (const s of Object.values(soundsRef.current)) {
      if (Array.isArray(s)) s.forEach(h => h.unload())
      else s?.unload()
    }
    soundsRef.current = {}

    for (const h of Object.values(externalCacheRef.current)) {
      h?.unload()
    }
    externalCacheRef.current = {}
  }

  function loadTheme(theme) {
    if (!theme) return
    // Skip reload if same theme already loaded
    if (themeIdRef.current === theme.id && Object.keys(soundsRef.current).length > 0) return

    unloadAll()
    themeIdRef.current = theme.id
    const vol = volumeRef.current

    // Ensure Howler AudioContext is running (autoplay policy)
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

    // Typing: array of sounds → random pick on each play
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

    console.log(`[Audio] Loaded theme: ${theme.name || theme.id}`)
  }

  function play(soundType, externalFile) {
    const vol = volumeRef.current
    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume().catch(() => {})
    }

    if (soundType === '__external__' && externalFile) {
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

    const sounds = soundsRef.current

    if (soundType === 'typing' || !sounds[soundType]) {
      // Random typing sound (or fallback)
      const pool = sounds.typing
      if (pool?.length > 0) {
        pool[Math.floor(Math.random() * pool.length)].play()
      }
    } else {
      sounds[soundType].play()
    }
  }

  function setVolume(vol) {
    volumeRef.current = vol
    for (const s of Object.values(soundsRef.current)) {
      if (Array.isArray(s)) s.forEach(h => h.volume(vol))
      else s?.volume(vol)
    }
    for (const h of Object.values(externalCacheRef.current)) {
      h?.volume(vol)
    }
  }

  useImperativeHandle(ref, () => ({ loadTheme, play, setVolume }))

  return null // purely functional, no DOM output
})

AudioEngine.displayName = 'AudioEngine'
export default AudioEngine
