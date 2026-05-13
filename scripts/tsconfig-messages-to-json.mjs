/**
 * Parses lib/translations.ts locale sections into flat JSON (handles '', "", and continuation lines).
 * Run from repo root: node scripts/tsconfig-messages-to-json.mjs
 */
import fs from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

function parseQuotedString(str, idx) {
  const q = str[idx]
  if (q !== "'" && q !== '"') return null
  let i = idx + 1
  let out = ""
  while (i < str.length) {
    const c = str[i]
    if (c === "\\") {
      out += str[i + 1] ?? "\\"
      i += 2
      continue
    }
    if (c === q) {
      return { value: out, end: i + 1 }
    }
    out += c
    i++
  }
  throw new Error("Unterminated string at " + idx)
}

function extractBlock(content, locale) {
  const startNeedle = `\n  ${locale}: {`
  const start = content.indexOf(startNeedle)
  if (start === -1) throw new Error("Missing locale " + locale)
  let i = content.indexOf("{", start)
  let depth = 0
  const startBrace = i
  for (; i < content.length; i++) {
    if (content[i] === "{") depth++
    else if (content[i] === "}") {
      depth--
      if (depth === 0) return content.slice(startBrace + 1, i)
    }
  }
  throw new Error("No end brace")
}

function parseLocaleBody(body) {
  const obj = {}
  const lines = body.split(/\r?\n/)
  let pendingKey = null
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/^\/\/.*$/, "")
    if (!line) continue
    if (pendingKey) {
      const first = line[0]
      if (first !== "'" && first !== '"') continue
      const parsed = parseQuotedString(line, 0)
      if (!parsed || line[parsed.end] !== "," && line.slice(parsed.end).trim() !== "")
        throw new Error("Bad continuation for " + pendingKey + ": " + line)
      obj[pendingKey] = parsed.value
      pendingKey = null
      continue
    }
    const mk = /^'([^']+)':/.exec(line)
    if (!mk) continue
    const key = mk[1]
    const rest = line.slice(mk[0].length).trim()
    if (rest === "" || rest === ",") {
      pendingKey = key
      continue
    }
    const pv = parseQuotedString(rest, 0)
    if (!pv) throw new Error("No value for " + key + " in " + line)
    obj[key] = pv.value
    const after = rest.slice(pv.end).trim().replace(/^,?$/, "")
    if (after) throw new Error("Trailing junk for " + key + ": " + after)
  }
  if (pendingKey) throw new Error("Incomplete key " + pendingKey)
  return obj
}

const src = fs.readFileSync(join(root, "lib", "translations.ts"), "utf8")

for (const loc of ["en", "es", "fr", "de", "hi"]) {
  const block = extractBlock(src, loc)
  const parsed = parseLocaleBody(block)
  fs.mkdirSync(join(root, "messages"), { recursive: true })
  fs.writeFileSync(join(root, "messages", `${loc}.json`), JSON.stringify(parsed, null, 2) + "\n")
  console.log(loc, Object.keys(parsed).length)
}
