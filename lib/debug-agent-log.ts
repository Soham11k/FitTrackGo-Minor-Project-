/**
 * Dev-only: POST NDJSON payloads to `/api/debug-session-log` (same-origin).
 * Cursor ingest on 127.0.0.1 is often blocked from the browser (CORS); this lands in `.cursor/debug-<session>.log`.
 */
export function agentDebugLog(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV === 'development') {
    console.debug('[debug-session]', payload.message ?? '', payload)
  }
  fetch('/api/debug-session-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
