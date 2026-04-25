"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"
import { DURATION, SPRING } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * One-shot entrance: scale + opacity spring, or near-instant if reduced motion.
 */
export function MotionCelebrate({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion() ?? false
  return (
    <motion.div
      className={cn(className)}
      initial={reduce ? false : { opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduce ? { duration: DURATION.fast } : SPRING.card}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
