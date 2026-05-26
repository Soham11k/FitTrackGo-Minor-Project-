"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { FittrackBrandLockup } from "@/components/brand/fittrack-brand-lockup"
import { EASE } from "@/lib/motion"
import { cn } from "@/lib/utils"

const HYDRATE_STEPS = ["Syncing profile", "Loading streaks", "Preparing home"] as const

/**
 * Full-screen launch hydrate — shown after auth while profile/onboarding resolves.
 */
export function LaunchHydrateScreen({
  label = "Preparing your session…",
  hint = "Loading streaks, coaching surfaces, and personalized home.",
  className,
}: {
  label?: string
  hint?: string
  className?: string
}) {
  const reduce = useReducedMotion() ?? false
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduce) return
    const timers = [
      setTimeout(() => setStep(1), 600),
      setTimeout(() => setStep(2), 1400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduce])

  const micro = HYDRATE_STEPS[Math.min(step, HYDRATE_STEPS.length - 1)]

  return (
    <CinematicStage vignette className={cn("fixed inset-0 z-50 flex min-h-dvh items-center justify-center px-6", className)}>
      <section
        role="status"
        aria-busy="true"
        aria-label={label}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <FittrackBrandLockup markSize={80} animated variant="hero" tagline={hint} />

        <p className="mt-8 text-base font-semibold text-[color:var(--surface-stage-fg)]">{label}</p>

        <div className="mt-4 flex min-h-[1.25rem] items-center justify-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={micro}
              className="text-sm text-[color:oklch(0.92_0_0/0.58)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [...EASE.cinematic] }}
            >
              {micro}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex gap-1.5" aria-hidden>
          {HYDRATE_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i <= step ? "w-7 bg-primary" : "w-2 bg-[color:var(--surface-stage-hairline)]",
              )}
            />
          ))}
        </div>
      </section>
    </CinematicStage>
  )
}
