#!/usr/bin/env node
/**
 * scripts/download-real-piano.js
 *
 * Downloads 85 real acoustic Salamander Grand Piano samples from the open-source
 * tonejs-instruments repository and installs them into SoundKeys store/piano/
 * and active user themes/piano/ directories.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const NOTE_PAIRS = [
  { tone: 'C',  sk: 'c' },
  { tone: 'Cs', sk: 'cs' },
  { tone: 'D',  sk: 'd' },
  { tone: 'Ds', sk: 'ds' },
  { tone: 'E',  sk: 'e' },
  { tone: 'F',  sk: 'f' },
  { tone: 'Fs', sk: 'fs' },
  { tone: 'G',  sk: 'g' },
  { tone: 'Gs', sk: 'gs' },
  { tone: 'A',  sk: 'a' },
  { tone: 'As', sk: 'as' },
  { tone: 'B',  sk: 'b' }
]

const BASE_URL = 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/piano/'

const targetDirs = [
  path.join(__dirname, '..', 'sounds', 'store', 'piano'),
  path.join(__dirname, '..', 'sounds', 'themes', 'piano')
]

// Also check AppData if active
const appData = process.env.APPDATA
if (appData) {
  const userPianoDir = path.join(appData, 'SoundKeys', 'sounds', 'themes', 'piano')
  targetDirs.push(userPianoDir)
}

function ensureDir(d) {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true })
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.tmp'
    const file = fs.createWriteStream(tmpPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(tmpPath) } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
            fs.renameSync(tmpPath, destPath)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
      })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(tmpPath) } catch (_) {}
      reject(err)
    })
  })
}

async function run() {
  console.log('🎵 Downloading Real Acoustic Grand Piano Samples...\n')

  const storeDir = targetDirs[0]
  ensureDir(storeDir)

  const downloadList = []

  // Generate 85 chromatic note definitions (C1 to C8)
  for (let oct = 1; oct <= 7; oct++) {
    for (const pair of NOTE_PAIRS) {
      const toneFileName = `${pair.tone}${oct}.wav`
      const skFileName = `piano_${pair.sk}${oct}.wav`
      downloadList.push({
        url: `${BASE_URL}${toneFileName}`,
        skFileName,
        toneFileName
      })
    }
  }

  // C8 (highest key)
  downloadList.push({
    url: `${BASE_URL}C8.wav`,
    skFileName: 'piano_c8.wav',
    toneFileName: 'C8.wav'
  })

  console.log(`Total samples to download: ${downloadList.length}`)

  // Download with concurrency limit of 5
  const CONCURRENCY = 5
  let completed = 0

  for (let i = 0; i < downloadList.length; i += CONCURRENCY) {
    const batch = downloadList.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (item) => {
        const dest = path.join(storeDir, item.skFileName)
        try {
          await downloadFile(item.url, dest)
          completed++
          process.stdout.write(`\r  [${completed}/${downloadList.length}] Saved ${item.skFileName}`)
        } catch (err) {
          console.error(`\n  ✗ Failed ${item.toneFileName}: ${err.message}`)
        }
      })
    )
  }

  console.log('\n\n🎹 Creating spacebar and enter samples...')
  // Spacebar: Warm C2/C3 tone
  const c2Source = path.join(storeDir, 'piano_c2.wav')
  const c3Source = path.join(storeDir, 'piano_c3.wav')
  const c4Source = path.join(storeDir, 'piano_c4.wav')

  if (fs.existsSync(c3Source)) {
    fs.copyFileSync(c3Source, path.join(storeDir, 'piano_space.wav'))
  }
  if (fs.existsSync(c4Source)) {
    fs.copyFileSync(c4Source, path.join(storeDir, 'piano_enter.wav'))
  }

  // Sync to other targets (e.g. sounds/themes/piano or AppData)
  for (let t = 1; t < targetDirs.length; t++) {
    const targetDir = targetDirs[t]
    if (fs.existsSync(path.dirname(targetDir))) {
      ensureDir(targetDir)
      console.log(`Syncing real piano samples to: ${targetDir}`)
      const allWavs = fs.readdirSync(storeDir).filter(f => f.endsWith('.wav') || f.endsWith('.json'))
      for (const f of allWavs) {
        fs.copyFileSync(path.join(storeDir, f), path.join(targetDir, f))
      }
    }
  }

  console.log('\n✨ Real Acoustic Piano samples successfully installed!')
}

run().catch(console.error)
