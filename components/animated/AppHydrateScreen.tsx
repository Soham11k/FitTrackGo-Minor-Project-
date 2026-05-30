"use client"

import { motion, useReducedMotion } from "framer-motion"
import { EASE } from "@/lib/motion"
import { CHROME } from "@/lib/app-chrome"

const TAGLINES = ["Calibrating your fitness data…", "Loading movement engine…", "Preparing your session…"]

/**
 * Full-screen loading shimmer shown while client JS hydrates after splash.
 * Uses orange/black chrome to match the premium design system.
 */
export function AppHydrateScreen() {
  const reduce = useReducedMotion() ?? false

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8"
      style={{ backgroundColor: CHROME.black }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [...EASE.cinematic] }}
        className="flex flex-col items-center gap-4"
      >
        {/* Orange ECG mark */}
        <svg width="88" height="48" viewBox="0 0 88 48" fill="none" aria-hidden>
          {/* Dim track */}
          <path
            d="M0,24 L18,24 L26,6 L34,42 L42,24 L52,16 L60,24 L88,24"
            stroke={`${CHROME.orange}20`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <motion.path
            d="M0,24 L18,24 L26,6 L34,42 L42,24 L52,16 L60,24 L88,24"
            stroke={CHROME.orange}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [...EASE.cinematic], repeat: Infinity, repeatDelay: 1.5 }}
          />
          <motion.circle
            cx="60"
            cy="24"
            r="4"
            fill={CHROME.orange}
            animate={reduce ? {} : { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
          />
        </svg>

        <p
          className="text-sm font-bold uppercase tracking-[0.22em] text-white"
          style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
        >
          FITTRACK <span style={{ color: CHROME.orange }}>GO</span>
        </p>

        <motion.p
          className="text-xs"
          style={{ color: CHROME.muted }}
          animate={reduce ? {} : { opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          {TAGLINES[0]}
        </motion.p>
      </motion.div>

      {/* Orange loading dots */}
      <div className="flex items-center gap-2" aria-label="Loading" role="status">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: CHROME.orange }}
            animate={reduce ? {} : { scale: [1, 1.5, 1], opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  )
}
