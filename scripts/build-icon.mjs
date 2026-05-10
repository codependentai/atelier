import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'build')
const sourceSvg = path.join(buildDir, 'icon.svg')
const sizes = [16, 24, 32, 48, 64, 128, 256]

const svg = await fs.readFile(sourceSvg)

const pngBuffers = await Promise.all(
  sizes.map(async (size) => {
    const buffer = await sharp(svg).resize(size, size).png().toBuffer()
    await fs.writeFile(path.join(buildDir, `icon-${size}.png`), buffer)
    return buffer
  }),
)

await fs.writeFile(path.join(buildDir, 'icon.png'), pngBuffers[pngBuffers.length - 1])

const ico = await pngToIco(pngBuffers)
await fs.writeFile(path.join(buildDir, 'icon.ico'), ico)

console.log('Wrote build/icon.ico (', ico.length, 'bytes ) and build/icon.png + size variants.')
