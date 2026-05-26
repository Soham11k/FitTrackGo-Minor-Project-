"use client"

import { motion, useReducedMotion } from "framer-motion"
import { FittrackLogoMark } from "@/components/fittrack-logo-mark"
import { FittrackWordmark } from "@/components/brand/fittrack-wordmark"
import { LOGO_INTRO } from "@/lib/motion"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  markSize?: number
  animated?: boolean
  variant?: "default" | "hero"
  layout?: "stack" | "inline"
  showWordmark?: boolean
  wordmarkClassName?: string
  tagline?: string
}

export function FittrackBrandLockup({
  className,
  markSize = 72,
  animated = false,
  variant = "default",
  layout = "stack",
  showWordmark = true,
  wordmarkClassName,
  tagline,
}: Props) {
  const reduce = useReducedMotion() ?? false
  const stage = variant === "hero"

  return (
    <div
      className={cn(
        layout === "inline" ? "flex items-center gap-2" : "flex flex-col items-center text-center",
        className,
      )}
    >
      <motion.div
        variants={LOGO_INTRO}
        initial={reduce ? false : "hidden"}
        animate="show"
        className={cn("shrink-0", layout === "stack" && "mb-2.5")}
        aria-hidden
      >
        <FittrackLogoMark size={markSize} variant={variant} animated={animated} />
      </motion.div>
      {showWordmark ? (
        <div className={cn(layout === "stack" && "space-y-1")}>
          <FittrackWordmark
            tone={stage ? "stage" : "default"}
            className={cn(
              layout === "stack" ? "text-[1.65rem] sm:text-[1.85rem]" : "text-[1.05rem]",
              wordmarkClassName,
            )}
          />
          {tagline ? (
            <p className={cn("text-sm", stage ? "text-[color:oklch(0.92_0_0/0.55)]" : "text-muted-foreground")}>
              {tagline}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
