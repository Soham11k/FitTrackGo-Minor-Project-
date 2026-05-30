"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { siteConfig } from "@/lib/data"
import { CINEMATIC, EASE } from "@/lib/motion"
import { ParticleBurst } from "@/components/animated/ParticleBurst"

const SPLASH_KEY = "ft-splash-seen"
const STEPS = ["Warming up", "Loading your profile", "Ready"] as const

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [burst, setBurst] = useState(false)
  const [wordmarkDone, setWordmarkDone] = useState(false)
  const reduce = useReducedMotion() ?? false
  const finished = useRef(false)

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    try { sessionStorage.setItem(SPLASH_KEY, "1") } catch { /* private mode */ }
    onComplete()
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    const safe = () => { if (!cancelled) finish() }

    if (reduce) { safe(); return () => { cancelled = true } }

    let seen = false
    try { seen = sessionStorage.getItem(SPLASH_KEY) === "1" } catch {}

    if (seen) {
      setStep(2)
      const id = setTimeout(safe, 380)
      return () => { cancelled = true; clearTimeout(id) }
    }

    const timers = [
      setTimeout(() => setStep(0), 60),
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 1700),
      // trigger particle burst just before finish
      setTimeout(() => { if (!cancelled) setBurst(true) }, 2000),
      setTimeout(safe, 2600),
    ]
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [finish, reduce])

  const status = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black cursor-default overflow-hidden">
      {/* Background radial glow */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(249,115,22,0.12) 0%, transparent 70%)"
        }}
      />

      {/* Particle burst centered */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ParticleBurst trigger={burst} count={80} size={400} />
      </div>

      <button
        type="button"
        className="relative z-10 flex flex-col items-center text-center outline-none focus-visible:ring-2 focus-visible:ring-primary px-6"
        aria-label="Splash screen. Tap to skip."
        onClick={() => finish()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish() }
        }}
      >
        <motion.div
          className="flex flex-col items-center gap-6"
          variants={CINEMATIC.heroEnter}
          initial="hidden"
          animate="show"
          role="presentation"
        >
          {/* Large ECG-style heartbeat SVG — draws stroke-by-stroke */}
          <div className="relative flex items-center justify-center">
            <svg
              width="240"
              height="100"
              viewBox="0 0 240 100"
              fill="none"
              aria-hidden
              className="drop-shadow-[0_0_20px_oklch(#f97316/0.6)]"
            >
              {/* Background dim track */}
              <path
                d="M0,50 L52,50 L70,12 L92,88 L110,50 L132,22 L150,50 L240,50"
                stroke="rgba(249,115,22,0.12)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Animated drawing path */}
              <motion.path
                d="M0,50 L52,50 L70,12 L92,88 L110,50 L132,22 L150,50 L240,50"
                stroke="#f97316"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: [...EASE.cinematic] }}
                onAnimationComplete={() => setWordmarkDone(true)}
              />
              {/* Moving pulse dot */}
              {!reduce && (
                <motion.circle
                  cx="150" cy="50" r="5"
                  fill="#f97316"
                  animate={{
                    cx: [0, 52, 70, 92, 110, 132, 150, 240],
                    cy: [50, 50, 12, 88, 50, 22, 50, 50],
                    opacity: [0, 1, 1, 1, 1, 1, 1, 0],
                  }}
                  transition={{ duration: 1.1, ease: "linear", times: [0, 0.22, 0.29, 0.38, 0.46, 0.55, 0.63, 1] }}
                />
              )}
            </svg>
          </div>

          {/* Wordmark — fades in after ECG draw completes */}
          <AnimatePresence>
            {(wordmarkDone || reduce) && (
              <motion.div
                key="wordmark"
                className="flex flex-col items-center gap-1"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [...EASE.cinematic] }}
              >
                <p className="text-3xl font-black tracking-[-0.05em] text-white">
                  FITTRACK <span className="text-[#f97316]">GO</span>
                </p>
                <p className="text-xs font-medium tracking-[0.22em] uppercase text-white/40">
                  {siteConfig.tagline}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step status */}
          <div className="flex min-h-[1.5rem] items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.p
                key={status}
                className="text-sm font-medium text-white/60"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [...EASE.cinematic] }}
              >
                {status}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <motion.span
                key={i}
                className="h-1 rounded-full" style={{ backgroundColor: "#f97316" }}
                initial={false}
                animate={{ width: i <= step ? 28 : 8, opacity: i <= step ? 1 : 0.25 }}
                transition={{ duration: 0.35, ease: [...EASE.cinematic] }}
              />
            ))}
          </div>

          <p className={`text-typo-caption text-white/30 transition-opacity duration-500 ${step >= 1 ? "opacity-100" : "opacity-0"}`}>
            Tap to skip
          </p>
        </motion.div>
      </button>
    </div>
  )
}
