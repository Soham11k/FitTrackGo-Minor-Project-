/**
 * Single source of truth for the orange-on-black + cream-card design system.
 * Previously duplicated across HOME (home-screen.tsx) and LOGIN (login-screen.tsx).
 * All screens now import from here.
 */
export const CHROME = {
  // Core surfaces
  black:      "#0d0d0d",
  focusBg:    "#161616",
  cardBg:     "#1a1a1c",
  panelBg:    "#111113",

  // Brand accent
  orange:     "#f97316",
  orangeDim:  "rgba(249,115,22,0.18)",
  orangeGlow: "rgba(249,115,22,0.35)",

  /** Home dashboard accent (product mock). */
  athleticRed:       "#FF4D30",
  athleticRedDim:    "rgba(255,77,48,0.16)",
  athleticRedBorder: "rgba(255,77,48,0.35)",
  homeBlack:         "#000000",
  homeCard:          "#121212",

  /** Home dashboard typography (matches product mock). */
  homeDisplayFont: "var(--font-display), var(--font-heading), ui-sans-serif, system-ui, sans-serif",
  homeLabelFont:   "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
  homeBodyFont:    "var(--font-inter), ui-sans-serif, system-ui, sans-serif",

  // Data-card surfaces (cream)
  cream:      "#f3f2ec",
  card:       "#ffffff",
  cardBorder: "#ebe8e0",
  sheet:      "#fafaf8",

  // Typography
  text:       "#111111",
  white:      "#ffffff",
  muted:      "#a3a3a3",
  mutedDark:  "#737373",
  tagline:    "rgba(255,255,255,0.38)",

  // UI edges
  border:     "rgba(255,255,255,0.08)",
  divider:    "#262628",

  // Status
  gpsGreen:   "#22c55e",
  hrRed:      "#e11d48",
  teal:       "#0d9488",
  amber:      "#f59e0b",

  /** Per-category accent colors used in Train, Coach, and Arena. */
  category: {
    strength:  "#f97316",   // orange
    cardio:    "#e11d48",   // red
    mobility:  "#0d9488",   // teal
    recovery:  "#8b5cf6",   // violet
    all:       "#a3a3a3",   // muted
  },
} as const

/** ECG path data — same shape used everywhere */
export const ECG_PATH = "M2 16 L8 16 L11 8 L16 24 L20 12 L24 16 L30 16"

/** Category display name → accent color */
export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    strength: CHROME.category.strength,
    cardio:   CHROME.category.cardio,
    mobility: CHROME.category.mobility,
    recovery: CHROME.category.recovery,
  }
  return map[cat.toLowerCase()] ?? CHROME.category.all
}
