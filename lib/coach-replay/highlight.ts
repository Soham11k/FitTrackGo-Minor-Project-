/**
 * Highlight-reel utilities. We don't actually re-encode the WebM (that would
 * require ffmpeg or MediaSource trickery). Instead, we expose timestamp
 * windows the player can seek to and loop, plus an export helper that
 * returns the original blob with a `startMs`/`endMs` hint.
 */

export interface HighlightSegment {
  /** 0-based rep index that the segment is centered on. */
  repIndex: number
  startMs: number
  endMs: number
}

const DEFAULT_DURATION_MS = 6_000

/**
 * Compute a highlight-segment around the given rep index. The window is
 * `DEFAULT_DURATION_MS` long, centered on the rep marker, clamped to the
 * clip duration.
 */
export function buildHighlightSegment(
  repMarkersMs: number[],
  highlightRepIndex: number,
  clipDurationMs: number,
  windowMs: number = DEFAULT_DURATION_MS
): HighlightSegment | null {
  if (!Array.isArray(repMarkersMs) || repMarkersMs.length === 0) return null
  const safeIdx = Math.max(0, Math.min(repMarkersMs.length - 1, highlightRepIndex))
  const center = repMarkersMs[safeIdx] ?? 0
  const half = Math.floor(windowMs / 2)
  let startMs = Math.max(0, center - half)
  let endMs = Math.min(clipDurationMs, center + half)
  // If clipped at one end, shift the other end to keep the window length.
  if (endMs - startMs < windowMs) {
    if (startMs === 0) endMs = Math.min(clipDurationMs, windowMs)
    else if (endMs === clipDurationMs) startMs = Math.max(0, clipDurationMs - windowMs)
  }
  return { repIndex: safeIdx, startMs, endMs }
}
