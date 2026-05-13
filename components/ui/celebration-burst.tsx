"use client"

import { motion, useReducedMotion } from "framer-motion"

const N = 8

/** Short radial burst ring for PB / favorites; respects reduced motion. */
export function CelebrationBurst({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion() ?? false
  if (reduce) return null

  return (
    <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`} aria-hidden>
      <div className="relative h-28 w-28">
        {Array.from({ length: N }).map((_, i) => {
          const rot = (360 / N) * i
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 h-[2px] w-6 origin-[0_50%] rounded-full bg-primary"
              style={{ rotate: rot }}
              initial={{ scaleX: 0.2, opacity: 0, x: 0 }}
              animate={{
                scaleX: [0.15, 1.2],
                opacity: [0, 0.95, 0],
                x: [0, 38],
              }}
              transition={{
                duration: 0.55,
                delay: i * 0.03,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          )
        })}
        <motion.span
          className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-md"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.6, 1.15], opacity: [0.5, 0] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
