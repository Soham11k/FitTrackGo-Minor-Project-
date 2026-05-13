#!/usr/bin/env node
/** Print merged next.config logging (NODE, outside Turbopack). Used by /api/debug-terminal-snapshot */
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js"
import lcImport from "next/dist/server/config.js"

const loadConfig = typeof lcImport === "function" ? lcImport : lcImport.default
const cfg = await loadConfig(PHASE_DEVELOPMENT_SERVER, process.cwd(), {})
let bt
if (cfg.logging && typeof cfg.logging === "object" && "browserToTerminal" in cfg.logging) {
  bt = cfg.logging.browserToTerminal
}
process.stdout.write(
  JSON.stringify({
    resolvedLogging: cfg.logging === false ? false : cfg.logging ?? null,
    browserToTerminalRaw: bt ?? null,
    browserToTerminalTruthy: !!(cfg.logging && bt),
  }) + "\n"
)
