"use client"

import { useEffect, useState, useCallback } from "react"
import { Activity } from "lucide-react"
import { siteConfig } from "@/lib/data"

const SPLASH_KEY = "ft-splash-seen"

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1")
    } catch {
      /* private mode */
    }
    onComplete()
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    const safeFinish = () => {
      if (!cancelled) finish()
    }

    let reduce = false
    try {
      reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    } catch {
      reduce = false
    }
    if (reduce) {
      safeFinish()
      return () => {
        cancelled = true
      }
    }

    let seen = false
    try {
      seen = sessionStorage.getItem(SPLASH_KEY) === "1"
    } catch {
      seen = false
    }

    if (seen) {
      setPhase(2)
      const id = setTimeout(safeFinish, 600)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => safeFinish(), 2800),
    ]
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [finish])

  const progressPct = phase >= 4 ? 100 : phase >= 1 ? Math.min(100, 20 + phase * 22) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6"
      role="button"
      tabIndex={0}
      onClick={() => finish()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          finish()
        }
      }}
      aria-label="Splash screen. Press Enter or tap to skip."
    >
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute h-32 w-32 rounded-full border border-primary/20 transition-all duration-1000 ${
              phase >= 1 ? "scale-150 opacity-0" : "scale-100 opacity-100"
            }`}
            aria-hidden
          />
          <div
            className={`absolute h-32 w-32 rounded-full border border-primary/30 transition-all duration-1000 delay-200 ${
              phase >= 2 ? "scale-200 opacity-0" : "scale-100 opacity-100"
            }`}
            aria-hidden
          />

          <div
            className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary transition-all duration-700 ${
              phase >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <Activity className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} aria-hidden />
          </div>
        </div>

        <div className="mt-8 overflow-hidden">
          <h1
            className={`text-4xl font-bold tracking-tight text-foreground transition-all duration-700 ${
              phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            FitTrack<span className="text-primary">Go</span>
          </h1>
        </div>

        <p
          className={`mt-3 text-sm tracking-widest uppercase text-muted-foreground transition-all duration-700 ${
            phase >= 3 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {siteConfig.tagline}
        </p>

        <div
          className="mt-12 h-0.5 w-48 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-busy={phase < 4}
          aria-label="Launch progress"
        >
          <div
            className={`h-full rounded-full bg-primary transition-all duration-[1800ms] ease-out ${
              phase >= 1 ? "w-full" : "w-0"
            }`}
          />
        </div>
        <p className="mt-6 text-center text-typo-eyebrow text-muted-foreground/80 uppercase tracking-[0.2em]">
          Tap or press Enter to skip
        </p>
      </div>
    </div>
  )
}
