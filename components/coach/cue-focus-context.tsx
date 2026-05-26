"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { FormBreakdown } from "@/lib/form-analysis"
import {
  cueKey,
  resolveHighlight,
  type HighlightKind,
  type HighlightSpec,
} from "@/lib/coach-vision/cue-resolver"
import { toast } from "sonner"

type CueFocusContextValue = {
  exerciseId: string
  breakdown: FormBreakdown[]
  focusedKey: string | null
  highlight: HighlightSpec | null
  setFocusedCue: (text: string, kind: HighlightKind) => void
  toggleCue: (text: string, kind: HighlightKind) => void
  clearFocus: () => void
  isCueFocused: (text: string, kind: HighlightKind) => boolean
}

const CueFocusContext = createContext<CueFocusContextValue | null>(null)

export function CueFocusProvider({
  exerciseId,
  breakdown = [],
  onHighlightChange,
  children,
}: {
  exerciseId: string
  breakdown?: FormBreakdown[]
  /** Notifies canvas owners (live coach, replay) when focus highlight changes. */
  onHighlightChange?: (spec: HighlightSpec | null) => void
  children: ReactNode
}) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<HighlightSpec | null>(null)

  const applyHighlight = useCallback(
    (spec: HighlightSpec | null, key: string | null) => {
      setFocusedKey(key)
      setHighlight(spec)
      onHighlightChange?.(spec)
    },
    [onHighlightChange],
  )

  const clearFocus = useCallback(() => {
    applyHighlight(null, null)
  }, [applyHighlight])

  const setFocusedCue = useCallback(
    (text: string, kind: HighlightKind) => {
      const key = cueKey(text, kind)
      const spec = resolveHighlight(text, kind, exerciseId, breakdown)
      if (!spec?.segmentPairs.length) {
        toast.message("Can't map this cue to the body from this angle — try another view.")
        clearFocus()
        return
      }
      applyHighlight(spec, key)
    },
    [exerciseId, breakdown, clearFocus, applyHighlight],
  )

  const toggleCue = useCallback(
    (text: string, kind: HighlightKind) => {
      const key = cueKey(text, kind)
      if (focusedKey === key) {
        clearFocus()
        return
      }
      setFocusedCue(text, kind)
    },
    [focusedKey, clearFocus, setFocusedCue],
  )

  const isCueFocused = useCallback(
    (text: string, kind: HighlightKind) => focusedKey === cueKey(text, kind),
    [focusedKey],
  )

  const value = useMemo(
    () => ({
      exerciseId,
      breakdown,
      focusedKey,
      highlight,
      setFocusedCue,
      toggleCue,
      clearFocus,
      isCueFocused,
    }),
    [
      exerciseId,
      breakdown,
      focusedKey,
      highlight,
      setFocusedCue,
      toggleCue,
      clearFocus,
      isCueFocused,
    ],
  )

  return <CueFocusContext.Provider value={value}>{children}</CueFocusContext.Provider>
}

export function useCueFocus(): CueFocusContextValue {
  const ctx = useContext(CueFocusContext)
  if (!ctx) {
    throw new Error("useCueFocus must be used within CueFocusProvider")
  }
  return ctx
}

/** Optional hook when provider may be absent. */
export function useCueFocusOptional(): CueFocusContextValue | null {
  return useContext(CueFocusContext)
}
