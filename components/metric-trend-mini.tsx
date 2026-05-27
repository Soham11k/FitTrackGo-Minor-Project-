"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { CHART } from "@/lib/motion"
import { cn } from "@/lib/utils"

type Point = { v: number }

export function MetricTrendMini({
  points,
  stroke,
  stopColor,
  className,
  isAnimationActive = true,
  animationDuration = CHART.areaEnterMs,
}: {
  points: Point[]
  stroke: string
  stopColor: string
  className?: string
  isAnimationActive?: boolean
  animationDuration?: number
}) {
  const gid = useId().replace(/:/g, "")
  const data = useMemo(() => points.map((p, i) => ({ i, v: p.v })), [points])

  if (points.length < 2) return null

  return (
    <div className={cn("h-[7.5rem] w-full", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stopColor} stopOpacity={0.42} />
              <stop offset="55%" stopColor={stopColor} stopOpacity={0.12} />
              <stop offset="100%" stopColor={stopColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2.5}
            fill={`url(#fill-${gid})`}
            dot={false}
            isAnimationActive={isAnimationActive}
            animationDuration={animationDuration}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
