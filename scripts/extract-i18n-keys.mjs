#!/usr/bin/env node
/**
 * Walks components/** for JSX text that looks untranslated (heuristic).
 * Intended as a lint aid — exits 0; prints warnings to stdout/stderr.
 */
import fs from "node:fs"
import { join, extname } from "node:path"

const root = join(process.cwd(), "components")

const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "ui"])
const RX_TEXT = />[\s\r\n]*([A-Za-z][^<{]*[A-Za-z0-9])[\s\r\n]*</g
const RX_HAS_T = /\bt\s*\(/

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      if (IGNORE_DIRS.has(name.name)) continue
      walk(p, out)
    } else if ([".tsx", ".jsx"].includes(extname(name.name))) {
      out.push(p)
    }
  }
  return out
}

const files = walk(root)
let warnings = 0
for (const file of files) {
  const code = fs.readFileSync(file, "utf8")
  if (!RX_HAS_T.test(code)) {
    RX_HAS_T.lastIndex = 0
  }
  const rel = file.replace(process.cwd() + "/", "")
  let m
  const seen = new Set()
  RX_TEXT.lastIndex = 0
  while ((m = RX_TEXT.exec(code))) {
    const raw = m[1].trim()
    if (raw.length < 4) continue
    if (/^(true|false|null|undefined|\d+)/i.test(raw)) continue
    if (raw.includes("className")) continue
    if (raw.includes("aria-")) continue
    const key = `${rel}:${raw.slice(0, 48)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!code.includes(`t('`) && !code.includes(`t("`)) {
      /* file might import t differently — skip generic */
      break
    }
    if (/useLocale\s*\(\s*\)/s.test(code) && !/[{,]\s*t\s*[,}]/s.test(code) && /\bconst\s*\{\s*t\s*\}\s*=/.test(code)) {
      // has useLocale destructuring — flag likely bare text
      if (!code.includes(`${raw.slice(0, 20)}`)) continue
    }
  }
}

/** Simpler: line-based JSX text nodes */
for (const file of files) {
  const code = fs.readFileSync(file, "utf8")
  const lines = code.split(/\r?\n/)
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed.includes(">") || !trimmed.includes("</")) return
    if (trimmed.includes("'") && trimmed.includes("t(")) return
    if (trimmed.includes("{t(")) return
    const inner = />[^<{]+([^<>{}]+)[^<{]*</.exec(trimmed)
    if (!inner) return
    const text = inner[1].trim()
    if (text.length < 6) return
    if (/^[0-9\s.,:%/km-]+$/.test(text)) return
    if (text.startsWith("http")) return
    if (/^(div|span|p|h[1-6]|button|li)$/i.test(text)) return
    if (line.includes("eslint-disable")) return
    if (line.includes("aria-label=")) return
    if (line.includes("placeholder=")) return
    if (line.includes("alt=")) return
    if (line.includes("className=") && !line.includes(">")) return
    if (line.includes("{") && line.includes("}")) return
    // Skip if line has t( call on same line
    if (line.includes("t(")) return
    const rel = file.replace(process.cwd() + "/", "")
    console.warn(`[i18n-extract] ${rel}:${idx + 1} possible raw JSX text: "${text.slice(0, 80)}"`)
    warnings++
  })
}

if (warnings) {
  console.warn(`[i18n-extract] ${warnings} heuristic warning(s) — review for t() coverage.`)
} else {
  console.log("[i18n-extract] no heuristic hits (or components use t() consistently).")
}
process.exit(0)
