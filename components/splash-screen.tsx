"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => onComplete(), 2800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute h-32 w-32 rounded-full border border-primary/20 transition-all duration-1000 ${
            phase >= 1 ? "scale-150 opacity-0" : "scale-100 opacity-100"
          }`}
        />
        <div
          className={`absolute h-32 w-32 rounded-full border border-primary/30 transition-all duration-1000 delay-200 ${
            phase >= 2 ? "scale-200 opacity-0" : "scale-100 opacity-100"
          }`}
        />

        {/* Logo icon */}
        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary transition-all duration-700 ${
            phase >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <Activity className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>

      {/* App name */}
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

      {/* Tagline */}
      <p
        className={`mt-3 text-sm tracking-widest uppercase text-muted-foreground transition-all duration-700 ${
          phase >= 3 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        Move. Track. Conquer.
      </p>

      {/* Loading bar */}
      <div className="mt-12 h-0.5 w-48 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full bg-primary transition-all duration-[1800ms] ease-out ${
            phase >= 1 ? "w-full" : "w-0"
          }`}
        />
      </div>
    </div>
  )
}
