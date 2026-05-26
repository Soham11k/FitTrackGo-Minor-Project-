"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { TAB_PAGE } from "@/lib/motion"

export function TabTransition({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false

  if (reduce) {
    return <div className="relative z-[1] pb-24">{children}</div>
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        className="relative z-[1] pb-24"
        variants={TAB_PAGE}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
