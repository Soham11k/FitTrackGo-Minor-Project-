/**
 * Central Lottie asset registry.
 * All screens import from here instead of requiring JSON files directly.
 * Keys map to filenames under public/lottie/.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = (file: string) => require(`@/public/lottie/${file}`)

export const LOTTIE = {
  run:          () => load("run-figure.json"),
  strength:     () => load("weightlifter.json"),
  dumbbell:     () => load("dumbbell-spin.json"),
  calories:     () => load("flame-calories.json"),
  heart:        () => load("heart-pulse.json"),
  trophy:       () => load("trophy-burst.json"),
  success:      () => load("success-checkmark.json"),
} as const

export type LottieKey = keyof typeof LOTTIE

/** Maps exercise category label → lottie key */
export function categoryToLottieKey(category: string): LottieKey {
  const map: Record<string, LottieKey> = {
    strength: "strength",
    cardio:   "run",
    mobility: "dumbbell",
    recovery: "heart",
  }
  return map[category.toLowerCase()] ?? "dumbbell"
}
