import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

const INGEST =
  'http://127.0.0.1:7748/ingest/161603a8-14bf-4a89-9ce4-d19109585b54'

function safeSessionId(raw: unknown): string {
  if (typeof raw !== 'string') return 'b497f1'
  const s = raw.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
  return s.length > 0 ? s : 'b497f1'
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const sessionId = safeSessionId(
    typeof body === 'object' && body !== null && 'sessionId' in body
      ? (body as { sessionId?: unknown }).sessionId
      : undefined
  )
  const DEBUG_LOG_FILE = `debug-${sessionId}.log`

  const dir = join(process.cwd(), '.cursor')
  try {
    mkdirSync(dir, { recursive: true })
    const line = JSON.stringify(body) + '\n'
    appendFileSync(join(dir, DEBUG_LOG_FILE), line)
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  fetch(INGEST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': sessionId,
    },
    body: JSON.stringify(
             typeof body === 'object' && body !== null
               ? { ...body, sessionId }
               : { sessionId, body }
           ),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
