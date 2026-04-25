"use client"

import { useEffect, useState } from "react"
import { CHART } from "@/lib/motion"

/** Returns true only briefly so Recharts can play enter animation once, then false to avoid re-anim on refetch. */
export function useChartEnterOnce() {
  const [active, setActive] = useState(true)
  useEffect(() => {
    const id = window.setTimeout(() => setActive(false), CHART.enterSettleMs)
    return () => window.clearTimeout(id)
  }, [])
  return active
}
