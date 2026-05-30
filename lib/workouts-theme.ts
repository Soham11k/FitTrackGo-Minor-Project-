/** Premium workouts / exercises screens — red accent on pure black (matches product mock). */
export const WORKOUTS = {
  bg: "#000000",
  black: "#000000",
  accent: "#ff3b30",
  accentDim: "rgba(255,59,48,0.14)",
  accentBorder: "rgba(255,59,48,0.35)",
  accentBanner: "#2a1210",
  card: "#1c1c1e",
  cardBorder: "rgba(255,255,255,0.06)",
  chipInactive: "#1c1c1e",
  iconWell: "#2c2c2e",
  muted: "#8e8e93",
  white: "#ffffff",
  green: "#34c759",
  intermediate: "#ff6b4a",
  beginner: "#a1a1aa",
} as const

export function difficultyStyle(level: string): { color: string; backgroundColor: string; borderColor: string } {
  if (level === "Advanced") {
    return {
      color: WORKOUTS.accent,
      backgroundColor: WORKOUTS.accentDim,
      borderColor: WORKOUTS.accentBorder,
    }
  }
  if (level === "Intermediate") {
    return {
      color: WORKOUTS.intermediate,
      backgroundColor: "rgba(255,107,74,0.12)",
      borderColor: "rgba(255,107,74,0.35)",
    }
  }
  return {
    color: WORKOUTS.beginner,
    backgroundColor: "rgba(161,161,170,0.12)",
    borderColor: "rgba(161,161,170,0.25)",
  }
}
