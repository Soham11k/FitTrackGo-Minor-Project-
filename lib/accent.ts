export const ACCENT_KEY = "fittrackgo_accent"

export type AccentId = "volt" | "green" | "blue" | "purple" | "orange" | "rose"

export const ACCENT_OPTIONS: { id: AccentId; name: string; lightHex: string }[] = [
  { id: "volt", name: "Volt", lightHex: "#CDFF00" },
  { id: "green", name: "Green", lightHex: "#22c55e" },
  { id: "blue", name: "Blue", lightHex: "#3b82f6" },
  { id: "purple", name: "Purple", lightHex: "#a855f7" },
  { id: "orange", name: "Orange", lightHex: "#f97316" },
  { id: "rose", name: "Rose", lightHex: "#f43f5e" },
]

export function getStoredAccent(): AccentId {
  if (typeof window === "undefined") return "volt"
  const stored = localStorage.getItem(ACCENT_KEY)
  if (stored && ACCENT_OPTIONS.some((o) => o.id === stored)) return stored as AccentId
  return "volt"
}

export function setStoredAccent(accent: AccentId): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACCENT_KEY, accent)
  document.documentElement.setAttribute("data-accent", accent)
}
