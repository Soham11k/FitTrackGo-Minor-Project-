"use client"

/** Require user to be in the center of the screen for recognition. */

export interface LandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

const CENTER_MARGIN_X = 0.28
const CENTER_MARGIN_Y = 0.25

export function isInCenter(landmarks: LandmarkPoint[]): boolean {
  if (!landmarks || landmarks.length < 25) return false
  const nose = landmarks[0]
  const lHip = landmarks[23]
  const rHip = landmarks[24]
  if (!nose || !lHip || !rHip) return false
  const cx = (nose.x + (lHip.x + rHip.x) / 2) / 2
  const cy = (nose.y + (lHip.y + rHip.y) / 2) / 2
  return (
    cx >= CENTER_MARGIN_X && cx <= 1 - CENTER_MARGIN_X &&
    cy >= CENTER_MARGIN_Y && cy <= 1 - CENTER_MARGIN_Y
  )
}
