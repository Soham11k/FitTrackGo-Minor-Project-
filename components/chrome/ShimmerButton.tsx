"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import { cn } from "@/lib/utils"

interface ShimmerButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "orange" | "dark" | "outline"
  className?: string
  type?: "button" | "submit" | "reset"
  layoutId?: string
  "aria-label"?: string
}

/**
 * Reusable CTA button with a horizontal shimmer sweep.
 * - orange: solid orange fill (primary actions)
 * - dark:   dark card bg with hairline border (START RUN style)
 * - outline: transparent with orange border
 */
export function ShimmerButton({
  children,
  onClick,
  disabled,
  variant = "orange",
  className,
  type = "button",
  layoutId,
  "aria-label": ariaLabel,
}: ShimmerButtonProps) {
  const reduce = useReducedMotion() ?? false

  const bg =
    variant === "orange"
      ? CHROME.orange
      : variant === "dark"
      ? CHROME.cardBg
      : "transparent"

  const border =
    variant === "dark"
      ? `1.5px solid #333336`
      : variant === "outline"
      ? `1.5px solid ${CHROME.orange}`
      : "none"

  return (
    <motion.button
      type={type}
      layoutId={layoutId}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-2xl py-5 text-xl font-black uppercase tracking-[0.14em] text-white disabled:opacity-60",
        className,
      )}
      style={{ backgroundColor: bg, border }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
    >
      {/* Horizontal shimmer sweep */}
      {!reduce && !disabled && (
        <motion.span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.07) 50%, transparent 65%)",
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["-100% 0", "200% 0"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
        />
      )}
      {children}
    </motion.button>
  )
}
