const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100
const DURATION_SEC = 1.2
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC)

const NOTE_NAMES = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']

function getMidiNoteName(midiNumber) {
  const octave = Math.floor(midiNumber / 12) - 1
  const noteIndex = midiNumber % 12
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function generatePianoSample(freq) {
  const buffer = Buffer.alloc(44 + NUM_SAMPLES * 2)

  // Write WAV Header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + NUM_SAMPLES * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20)  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22)  // NumChannels (1 = mono)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28) // ByteRate
  buffer.writeUInt16LE(2, 32)  // BlockAlign
  buffer.writeUInt16LE(16, 34) // BitsPerSample
  buffer.write('data', 36)
  buffer.writeUInt32LE(NUM_SAMPLES * 2, 40)

  // Synthesize PCM samples (sine fundamental + harmonics + ADSR envelope)
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE

    // Envelope
    let env = 0
    const attack = 0.008 // 8ms
    const decay = 0.25   // decay to sustain
    const sustain = 0.35
    if (t < attack) {
      env = t / attack
    } else {
      const decayProgress = Math.min((t - attack) / decay, 1)
      env = 1 - (1 - sustain) * decayProgress
      // Exponential tail release
      const releaseStart = 0.4
      if (t > releaseStart) {
        env *= Math.exp(-6 * (t - releaseStart))
      }
    }

    // Harmonic synthesis for piano-like timbre
    const fundamental = Math.sin(2 * Math.PI * freq * t)
    const h2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t)
    const h3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t)
    const h4 = 0.12 * Math.sin(2 * Math.PI * freq * 4 * t)
    const h5 = 0.06 * Math.sin(2 * Math.PI * freq * 5 * t)

    const rawSignal = (fundamental + h2 + h3 + h4 + h5) / 1.93
    const sampleVal = Math.max(-1, Math.min(1, rawSignal * env))

    // 16-bit signed PCM integer
    const pcm16 = Math.floor(sampleVal * 32767)
    buffer.writeInt16LE(pcm16, 44 + i * 2)
  }

  return buffer
}

function main() {
  const outputDir = path.join(__dirname, '..', 'sounds', 'store', 'piano')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log(`Generating Piano WAV samples in ${outputDir}...`)

  // Generate MIDI notes 48 (C3) to 96 (C7) - 49 chromatic notes
  for (let midi = 48; midi <= 96; midi++) {
    const name = getMidiNoteName(midi)
    const freq = midiToFreq(midi)
    const wavBuffer = generatePianoSample(freq)
    const fileName = `piano_${name}.wav`
    fs.writeFileSync(path.join(outputDir, fileName), wavBuffer)
  }

  // Also write helper preview and fallback WAVs
  const c4Wav = generatePianoSample(midiToFreq(60))
  fs.writeFileSync(path.join(outputDir, 'piano_c4.wav'), c4Wav)
  fs.writeFileSync(path.join(outputDir, 'piano_space.wav'), c4Wav)
  fs.writeFileSync(path.join(outputDir, 'piano_enter.wav'), c4Wav)

  console.log('Successfully generated piano WAV files!')
}

main()
