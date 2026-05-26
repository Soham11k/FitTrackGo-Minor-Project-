"use client"

import { useEffect, useState, useCallback } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { siteConfig } from "@/lib/data"
import { FittrackBrandLockup } from "@/components/brand/fittrack-brand-lockup"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC, EASE } from "@/lib/motion"

const SPLASH_KEY = "ft-splash-seen"

const STEPS = ["Warming up", "Loading your profile", "Ready"] as const

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
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
      setStep(2)
      const id = setTimeout(safeFinish, 380)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    const timers = [
      setTimeout(() => setStep(0), 60),
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 1700),
      setTimeout(() => safeFinish(), 2400),
    ]
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [finish, reduce])

  const status = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <CinematicStage vignette className="fixed inset-0 z-50 cursor-default">
      <button
        type="button"
        className="flex h-full min-h-dvh w-full flex-col items-center justify-center px-6 outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        <motion.div
          className="flex max-w-sm flex-col items-center text-center"
          variants={CINEMATIC.heroEnter}
          initial="hidden"
          animate="show"
          role="presentation"
        >
          <FittrackBrandLockup
            markSize={96}
            variant="hero"
            animated
            tagline={step >= 1 ? siteConfig.tagline : undefined}
          />

          <div className="mt-10 flex min-h-[1.5rem] items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.p
                key={status}
                className="text-sm font-medium text-[color:oklch(0.92_0_0/0.72)]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [...EASE.cinematic] }}
              >
                {status}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-8 flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <motion.span
                key={i}
                className="h-1 rounded-full bg-primary"
                initial={false}
                animate={{
                  width: i <= step ? 28 : 8,
                  opacity: i <= step ? 1 : 0.25,
                }}
                transition={{ duration: 0.35, ease: [...EASE.cinematic] }}
              />
            ))}
          </div>

          <p
            className={`mt-10 text-typo-caption text-[color:oklch(0.92_0_0/0.4)] transition-opacity duration-500 ${
              step >= 1 ? "opacity-100" : "opacity-0"
            }`}
          >
            Tap to skip
          </p>
        </motion.div>
      </button>
    </CinematicStage>
  )
}
