/**
 * Map normalized pose landmarks (0–1 in source video space) onto a displayed
 * video element that uses CSS object-fit contain/cover.
 */

export type ObjectFitMode = "contain" | "cover"

export interface ContentRect {
  x: number
  y: number
  w: number
  h: number
}

/** Pixel rect where the video pixels are actually painted inside the element box. */
export function getObjectFitContentRect(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
  fit: ObjectFitMode = "contain",
): ContentRect {
  if (containerW <= 0 || containerH <= 0 || mediaW <= 0 || mediaH <= 0) {
    return { x: 0, y: 0, w: Math.max(0, containerW), h: Math.max(0, containerH) }
  }

  const mediaAspect = mediaW / mediaH
  const containerAspect = containerW / containerH

  if (fit === "contain") {
    if (mediaAspect > containerAspect) {
      const w = containerW
      const h = containerW / mediaAspect
      return { x: 0, y: (containerH - h) / 2, w, h }
    }
    const h = containerH
    const w = containerH * mediaAspect
    return { x: (containerW - w) / 2, y: 0, w, h }
  }

  // cover — fills container, crops overflow
  if (mediaAspect > containerAspect) {
    const h = containerH
    const w = containerH * mediaAspect
    return { x: (containerW - w) / 2, y: 0, w, h }
  }
  const w = containerW
  const h = containerW / mediaAspect
  return { x: 0, y: (containerH - h) / 2, w, h }
}
