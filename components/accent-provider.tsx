"use client"

import { createContext, useContext, useEffect, useState } from "react"
import {
  DEFAULT_ACCENT,
  getPresetById,
  getStoredAccent,
  setStoredAccent,
  type AccentId,
} from "@/lib/accent"

const AccentContext = createContext<{
  accent: AccentId
  setAccent: (a: AccentId) => void
} | null>(null)

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredAccent()
    setAccentState(stored)
    document.documentElement.setAttribute("data-accent", stored)
    setMounted(true)
  }, [])

  const setAccent = (value: AccentId) => {
    setAccentState(value)
    setStoredAccent(value)
  }

  return (
    <AccentContext.Provider value={{ accent: mounted ? accent : DEFAULT_ACCENT, setAccent }}>
      {children}
    </AccentContext.Provider>
  )
}

export function useAccent() {
  const ctx = useContext(AccentContext)
  if (!ctx) {
    return { accent: DEFAULT_ACCENT as AccentId, setAccent: () => {} }
  }
  return ctx
}

export function useActivePreset() {
  const { accent } = useAccent()
  return getPresetById(accent)
}
