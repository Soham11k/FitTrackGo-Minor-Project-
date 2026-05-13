"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { siteConfig } from "@/lib/data"
import { StatDisplay } from "@/components/ui/stat-display"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC, EASE } from "@/lib/motion"

const SPLASH_KEY = "ft-splash-seen"

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)
  const reduce = useReducedMotion() ?? false

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
      setPhase(4)
      const id = setTimeout(safeFinish, 500)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 520),
      setTimeout(() => setPhase(3), 980),
      setTimeout(() => setPhase(4), 1680),
      setTimeout(() => safeFinish(), 2500),
    ]
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [finish, reduce])

  const progressPct = phase >= 4 ? 100 : phase >= 1 ? Math.min(100, 16 + phase * 24) : 0

  const content = (
    <div className="relative flex max-w-lg flex-col items-center justify-center px-6 text-center" role="presentation">
      <motion.div
        className="relative w-full"
        variants={CINEMATIC.heroEnter}
        initial="hidden"
        animate={phase >= 1 ? "show" : "hidden"}
      >
        <p className="text-eyebrow-mega mb-4 text-[color:oklch(1_0_0/0.55)]">FITTRACK</p>
        <StatDisplay
          value={
            <>
              GO<span className="text-primary">.</span>
            </>
          }
          tone="stage"
          size="lg"
          secondary={phase >= 3 ? siteConfig.tagline : undefined}
        />
      </motion.div>

      <motion.div
        className="relative mx-auto mt-12 h-[3px] w-56 overflow-hidden bg-[color:var(--surface-stage-hairline)] sm:w-80"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
        aria-busy={phase < 4}
        aria-label="Launch progress"
        initial={{ opacity: reduce ? 1 : 0.35 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [...EASE.cinematic] }}
      >
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 1.1, ease: [...EASE.cinematic] }}
        />
      </motion.div>

      <p
        className={`mt-6 text-center text-typo-eyebrow uppercase tracking-[0.28em] text-[color:oklch(0.92_0_0/0.55)] transition-opacity duration-500 ${
          phase >= 3 ? "opacity-100" : "opacity-0"
        }`}
      >
        Tap or Enter to skip
      </p>
    </div>
  )

  return (
    <CinematicStage vignette className="fixed inset-0 z-50 cursor-default">
      <button
        type="button"
        className="flex h-full min-h-dvh w-full flex-col cursor-pointer items-center justify-center px-6 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        aria-label="Splash screen. Press Enter or tap to skip."
        onClick={() => finish()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            finish()
          }
        }}
      >
        {content}
      </button>
    </CinematicStage>
  )
}
