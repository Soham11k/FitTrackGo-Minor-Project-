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
const ACCENT2 = '#0ea5e9'
const FRAME = 'rgba(255,255,255,0.12)'

function ogSvg(width, height, titleText) {
  const iconInner = iconSvg(108).trim().replace(/^<\?xml[^?]*\?>\s*/i, "").replace(/^<svg[^>]+>/, "").replace(/<\/svg>\s*$/, "")
  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${BG}"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${FRAME}" stroke-width="4"/>
    <svg x="${(width - 108) / 2}" y="118" width="108" height="108" viewBox="0 0 80 80">${iconInner}</svg>
    <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" fill="${FG}" font-family="system-ui, sans-serif" font-size="88" font-weight="800">${titleText}</text>
    <text x="${width / 2}" y="${height / 2 + 88}" text-anchor="middle" fill="${ACCENT}" font-family="system-ui, sans-serif" font-size="30" font-weight="600">Track runs · Coach · Arena</text>
  </svg>`
}

const PULSE_PATH =
  "M 18 52 L 18 28 L 34 28 L 34 36 L 26 36 L 26 40 L 38 40 L 44 24 L 50 48 L 56 32 L 62 52"

/** Square app icon — pulse glyph (matches components/fittrack-logo-mark.tsx). */
function iconSvg(size, _fg = FG, accent = ACCENT, accent2 = ACCENT2, bg = BG) {
  const sw = Math.max(1, size / 80)
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="68" height="68" rx="18" fill="${bg}" stroke="rgba(0,0,0,0.08)" stroke-width="${sw}"/>
    <defs>
      <linearGradient id="g" x1="14" y1="54" x2="66" y2="22" gradientUnits="userSpaceOnUse">
        <stop stop-color="${accent}"/>
        <stop offset="1" stop-color="${accent2}"/>
      </linearGradient>
    </defs>
    <path d="${PULSE_PATH}" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="62" cy="52" r="4" fill="${accent}"/>
  </svg>`
}

/** Safari pinned tab — simplified pulse on black. */
function safariPinnedSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="68" height="68" rx="18" fill="#000"/>
  <path d="${PULSE_PATH}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="62" cy="52" r="4" fill="#fff"/>
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
