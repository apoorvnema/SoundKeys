const { app, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

function pngToIco(pngBuffer) {
  // ICO Header (6 bytes)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type: 1 = ICO
  header.writeUInt16LE(1, 4) // Number of images = 1

  // ICO Directory Entry (16 bytes)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0)      // Width: 256px -> 0
  entry.writeUInt8(0, 1)      // Height: 256px -> 0
  entry.writeUInt8(0, 2)      // Color count (0 = >=256 colors)
  entry.writeUInt8(0, 3)      // Reserved
  entry.writeUInt16LE(1, 4)   // Color planes
  entry.writeUInt16LE(32, 6)  // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8) // Image size in bytes
  entry.writeUInt32LE(22, 12) // Image offset (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer])
}

app.whenReady().then(() => {
  const size = 256
  const buf = Buffer.alloc(size * size * 4)

  const cx = size / 2
  const cy = size / 2
  const cornerRadius = 48

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Rounded rectangle mask
      const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius))
      const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius))
      const isInside = (dx * dx + dy * dy) <= (cornerRadius * cornerRadius)

      if (isInside) {
        // Gradient from Dark Purple #1e0936 (top-left) to Deep Violet #0d031b (bottom-right)
        const t = (x + y) / (size * 2)
        const r = Math.round(147 * (1 - t) + 15 * t)
        const g = Math.round(51 * (1 - t) + 5 * t)
        const b = Math.round(234 * (1 - t) + 40 * t)

        // Draw central glowing audio/keyboard wave bars
        const waveX1 = size * 0.28, waveX2 = size * 0.38, waveX3 = size * 0.48, waveX4 = size * 0.58, waveX5 = size * 0.68, waveX6 = size * 0.78
        const barWidth = 14

        let isBar = false
        if (Math.abs(x - waveX1) < barWidth/2 && y >= size * 0.40 && y <= size * 0.60) isBar = true
        if (Math.abs(x - waveX2) < barWidth/2 && y >= size * 0.26 && y <= size * 0.74) isBar = true
        if (Math.abs(x - waveX3) < barWidth/2 && y >= size * 0.18 && y <= size * 0.82) isBar = true
        if (Math.abs(x - waveX4) < barWidth/2 && y >= size * 0.24 && y <= size * 0.76) isBar = true
        if (Math.abs(x - waveX5) < barWidth/2 && y >= size * 0.35 && y <= size * 0.65) isBar = true
        if (Math.abs(x - waveX6) < barWidth/2 && y >= size * 0.45 && y <= size * 0.55) isBar = true

        if (isBar) {
          // Vibrant Neon Green #22c55e
          buf[idx]   = 34   // R
          buf[idx+1] = 197  // G
          buf[idx+2] = 94   // B
          buf[idx+3] = 255  // Alpha
        } else {
          buf[idx]   = r
          buf[idx+1] = g
          buf[idx+2] = b
          buf[idx+3] = 255
        }
      } else {
        buf[idx]   = 0
        buf[idx+1] = 0
        buf[idx+2] = 0
        buf[idx+3] = 0
      }
    }
  }

  const img = nativeImage.createFromBitmap(buf, { width: size, height: size })
  const pngData = img.toPNG()
  const icoData = pngToIco(pngData)

  const buildDir = path.join(process.cwd(), 'build')
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }

  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngData)
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoData)

  console.log('[IconGenerator] Successfully generated valid build/icon.png and build/icon.ico')
  app.quit()
})
