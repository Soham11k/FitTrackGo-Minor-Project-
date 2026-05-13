import { execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync } from "fs"
import { join } from "path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Dev-only: merges next.config.logging via standalone Node subprocess (avoids Turbopack
 * bundling `next/dist/server/config` into App Routes). Appends NDJSON session line.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const scriptPath = join(process.cwd(), "scripts", "print-next-logging.mjs")
    const raw = execFileSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 256 * 1024,
    }).trim()
    const merged = JSON.parse(raw) as {
      resolvedLogging: unknown
      browserToTerminalRaw: unknown
      browserToTerminalTruthy: boolean
    }
    const snapshot = {
      sessionId: "35ceb6",
      runId: "server-terminal-snapshot",
      hypothesisId: "H-SERVER",
      message: "Subprocess loadConfig (NODE)",
      timestamp: Date.now(),
      resolvedLogging: merged.resolvedLogging,
      browserToTerminalRaw: merged.browserToTerminalRaw,
      browserToTerminalTruthy: merged.browserToTerminalTruthy,
    }

    const dir = join(process.cwd(), ".cursor")
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, "debug-35ceb6.log"), JSON.stringify(snapshot) + "\n")

    const INGEST =
      "http://127.0.0.1:7748/ingest/161603a8-14bf-4a89-9ce4-d19109585b54"
    fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "35ceb6",
      },
      body: JSON.stringify(snapshot),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message ?? e) },
      { status: 500 }
    )
  }
}
