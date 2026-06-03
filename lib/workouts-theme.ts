import { CHROME_ACCENT } from "@/lib/chrome-accent"

/** Goals / workouts screens — accent from Theme Studio; fills match product mock. */
export const WORKOUTS = {
  bg: "#000000",
  black: "#000000",
  accent: CHROME_ACCENT.accent,
  accentFixed: "#ff3b30",
  accentDim: CHROME_ACCENT.accentDim,
  accentBorder: CHROME_ACCENT.accentBorder,
  card: "#1c1c1e",
  cardBorder: "rgba(255,255,255,0.06)",
  chipInactive: "#1c1c1e",
  iconWell: "#2c2c2e",
  muted: "#8e8e93",
  white: "#ffffff",
  green: "#34c759",
  advanced: "#ff9500",
  category: {
    strength: { bg: "rgba(255,59,48,0.28)", fg: "#ff3b30" },
    cardio: { bg: "rgba(255,149,0,0.28)", fg: "#ff9500" },
    yoga: { bg: "rgba(59,130,246,0.28)", fg: "#3b82f6" },
    hiit: { bg: "rgba(255,59,48,0.2)", fg: "#ff6b4a" },
    default: { bg: "#2c2c2e", fg: "#ffffff" },
  },
} as const

export function categoryIconStyle(category: string): { backgroundColor: string; color: string } {
  const key = category as keyof typeof WORKOUTS.category
  if (key in WORKOUTS.category && key !== "default") {
    const c = WORKOUTS.category[key]
    return { backgroundColor: c.bg, color: c.fg }
  }
  return { backgroundColor: WORKOUTS.category.default.bg, color: WORKOUTS.category.default.fg }
}

export function difficultyStyle(level: string): { color: string; backgroundColor: string; borderColor: string } {
  if (level === "Advanced") {
    return { color: "#ffffff", backgroundColor: WORKOUTS.advanced, borderColor: WORKOUTS.advanced }
  }
  if (level === "Intermediate") {
    return { color: "#ffffff", backgroundColor: "#ff3b30", borderColor: "#ff3b30" }
  }
  return { color: "#000000", backgroundColor: WORKOUTS.green, borderColor: WORKOUTS.green }
}
