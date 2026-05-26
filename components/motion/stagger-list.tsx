"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { LIST_ITEM, staggerChildren } from "@/lib/motion"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
  /** Delay before first child animates */
  delayChildren?: number
}

/** Wraps sections so direct `motion.*` children stagger in on mount. */
export function StaggerList({ children, className, delayChildren = 0.04 }: Props) {
  const reduce = useReducedMotion() ?? false

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      variants={staggerChildren(delayChildren, 0.05)}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion() ?? false

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={LIST_ITEM}>
      {children}
    </motion.div>
  )
}
