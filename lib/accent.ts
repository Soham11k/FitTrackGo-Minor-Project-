export const ACCENT_KEY = "fittrackgo_accent"

export type AccentId =
  | "athletic"
  | "volt"
  | "green"
  | "blue"
  | "purple"
  | "orange"
  | "rose"

export type ThemePreset = {
  id: AccentId
  name: string
  tagline: string
  swatch: string
  gradient: string
  ambientHue: string
}

/** Rich preset metadata for Theme Studio UI. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "athletic",
    name: "Athletic Red",
    tagline: "Midnight charge",
    swatch: "#FF4D30",
    gradient: "linear-gradient(135deg, #FF4D30 0%, #991b1b 100%)",
    ambientHue: "rgba(255,77,48,0.08)",
  },
  {
    id: "volt",
    name: "Volt",
    tagline: "Electric energy",
    swatch: "#CDFF00",
    gradient: "linear-gradient(135deg, #CDFF00 0%, #84cc16 100%)",
    ambientHue: "rgba(205,255,0,0.08)",
  },
  {
    id: "green",
    name: "Forest",
    tagline: "Trail ready",
    swatch: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
    ambientHue: "rgba(34,197,94,0.08)",
  },
  {
    id: "blue",
    name: "Ocean",
    tagline: "Cool focus",
    swatch: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    ambientHue: "rgba(59,130,246,0.08)",
  },
  {
    id: "purple",
    name: "Neon",
    tagline: "Night session",
    swatch: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)",
    ambientHue: "rgba(168,85,247,0.08)",
  },
  {
    id: "orange",
    name: "Ember",
    tagline: "Warm drive",
    swatch: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    ambientHue: "rgba(249,115,22,0.08)",
  },
  {
    id: "rose",
    name: "Pulse",
    tagline: "Heart rate high",
    swatch: "#f43f5e",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
    ambientHue: "rgba(244,63,94,0.08)",
  },
]

/** @deprecated Use THEME_PRESETS */
export const ACCENT_OPTIONS = THEME_PRESETS.map(({ id, name, swatch }) => ({
  id,
  name,
  lightHex: swatch,
}))

export const DEFAULT_ACCENT: AccentId = "athletic"

export const ACCENT_IDS: AccentId[] = THEME_PRESETS.map((p) => p.id)

export function isAccentId(value: string | null | undefined): value is AccentId {
  return !!value && ACCENT_IDS.includes(value as AccentId)
}

export function getPresetById(id: AccentId): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

export function getStoredAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT
  const stored = localStorage.getItem(ACCENT_KEY)
  if (isAccentId(stored)) return stored
  return DEFAULT_ACCENT
}

export function setStoredAccent(accent: AccentId): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACCENT_KEY, accent)
  document.documentElement.setAttribute("data-accent", accent)
}
