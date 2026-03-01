"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { getStoredAccent, setStoredAccent, type AccentId } from "@/lib/accent"

const AccentContext = createContext<{ accent: AccentId; setAccent: (a: AccentId) => void } | null>(null)

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>("green")
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
    <AccentContext.Provider value={{ accent: mounted ? accent : "green", setAccent }}>
      {children}
    </AccentContext.Provider>
  )
}

export function useAccent() {
  const ctx = useContext(AccentContext)
  if (!ctx) return { accent: "green" as AccentId, setAccent: () => {} }
  return ctx
}
