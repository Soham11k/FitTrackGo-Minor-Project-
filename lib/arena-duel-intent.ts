/**
 * Pending Arena movement label — consumed when ArenaHub mounts after coach recap "Duel" CTA.
 */
let duelExercisePick: string | null = null

export function setArenaDuelExerciseLabel(label: string) {
  duelExercisePick = label.trim()
}

export function consumeArenaDuelExerciseLabel(): string | null {
  const v = duelExercisePick
  duelExercisePick = null
  return v || null
}
