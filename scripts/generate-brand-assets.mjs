#!/usr/bin/env node
/**
 * Generates PNG brand assets under public/brand/ from shared colors (aligned with CSS tokens).
 * Run: node scripts/generate-brand-assets.mjs
 */

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'brand')

const BG = '#121212'
const FG = '#fafafa'
const ACCENT = '#22c55e'
const FRAME = 'rgba(255,255,255,0.12)'

function ogSvg(width, height, titleText) {
  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${BG}"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${FRAME}" stroke-width="4"/>
    <text x="${width / 2}" y="${height / 2 - 40}" text-anchor="middle" fill="${FG}" font-family="system-ui, sans-serif" font-size="96" font-weight="800">${titleText}</text>
    <text x="${width / 2}" y="${height / 2 + 50}" text-anchor="middle" fill="${ACCENT}" font-family="system-ui, sans-serif" font-size="36" font-weight="600">Track runs · Coach · Arena</text>
  </svg>`
}

/** Square app icon SVG (filled stage + FG monogram FG). */
function iconSvg(size, fg = FG, accent = ACCENT, bg = BG) {
  const r = Math.round(size * 0.18)
  return `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" rx="${r}" fill="${bg}"/>
    <rect x="${size * 0.06}" y="${size * 0.06}" width="${size * 0.88}" height="${size * 0.88}" rx="${r * 0.8}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${Math.max(2, size / 96)}"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="system-ui, sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="800">F</text>
    <circle cx="${size * 0.78}" cy="${size * 0.22}" r="${size * 0.08}" fill="${accent}"/>
  </svg>`
}

/** Safari pinned tab style (transparent bg, monochrome). */
function safariPinnedSvg() {
  const size = 64
  const r = 12
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="48" height="48" rx="${r}" fill="#000"/>
  <text x="32" y="36" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="28" font-weight="800">F</text>
</svg>`
}

async function writePng(filename, svgBufferOrString) {
  const buf = Buffer.isBuffer(svgBufferOrString)
    ? svgBufferOrString
    : Buffer.from(svgBufferOrString.trim())
  const name = filename.endsWith('.png') ? filename : `${filename}.png`
  const path = join(OUT, name)
  await sharp(buf).png({ compressionLevel: 9 }).toFile(path)
  console.log('wrote', path)
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  await writePng('opengraph.png', Buffer.from(ogSvg(1200, 630, 'FitTrack Go')))
  await writePng('icon-maskable-1024.png', Buffer.from(iconSvg(1024)))
  await writePng('icon-192.png', Buffer.from(iconSvg(192)))
  await writePng('icon-512.png', Buffer.from(iconSvg(512)))
  await writePng('apple-touch-icon-180.png', Buffer.from(iconSvg(180)))

  /** Smaller monochrome icon for safari-pinned-tab */
  writeFileSync(join(OUT, 'safari-pinned-tab.svg'), safariPinnedSvg().trim())
  console.log('wrote', join(OUT, 'safari-pinned-tab.svg'))

  const src256 = join(OUT, '_icon-src-256.png')
  await sharp(Buffer.from(iconSvg(256))).resize(256, 256).png().toFile(src256)
  const icoBuf = await pngToIco(src256)
  writeFileSync(join(OUT, 'favicon.ico'), icoBuf)
  writeFileSync(join(ROOT, 'public', 'favicon.ico'), icoBuf)
  console.log('wrote', join(OUT, 'favicon.ico'), 'and', join(ROOT, 'public', 'favicon.ico'))

  try {
    unlinkSync(src256)
  } catch {
    /* ignore cleanup */
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
