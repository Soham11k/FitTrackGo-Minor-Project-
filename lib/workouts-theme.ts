import { CHROME_ACCENT } from "@/lib/chrome-accent"

/** Premium workouts / goals screens — accent follows Theme Studio via CSS vars. */
export const WORKOUTS = {
  bg: "#000000",
  black: "#000000",
  accent: CHROME_ACCENT.accent,
  accentDim: CHROME_ACCENT.accentDim,
  accentBorder: CHROME_ACCENT.accentBorder,
  accentBanner: "rgba(255,59,48,0.08)",
  card: "#1c1c1e",
  cardBorder: "rgba(255,255,255,0.06)",
  chipInactive: "#1c1c1e",
  iconWell: "#2c2c2e",
  muted: "#8e8e93",
  white: "#ffffff",
  green: "#34c759",
  intermediate: "#ff6b4a",
  beginner: "#34c759",
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
    backgroundColor: "rgba(52,199,89,0.12)",
    borderColor: "rgba(52,199,89,0.35)",
  }
}
