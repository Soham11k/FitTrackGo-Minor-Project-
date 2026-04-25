"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Activity, Flame, MapPin, Timer } from "lucide-react"
import { TodayAnimatedCount } from "@/components/today-animated-count"
import { DURATION, EASE, staggerDelaySec } from "@/lib/motion"
import { cn } from "@/lib/utils"

type StatCellProps = {
  icon: typeof Activity
  label: string
  valueNode: ReactNode
  sub?: string
  iconClass: string
  iconBg: string
}

function StatCell({ icon: Icon, label, valueNode, sub, iconClass, iconBg }: StatCellProps) {
  return (
    <div
      className={cn(
        "motion-card flex min-h-[5.5rem] flex-col gap-1.5 rounded-2xl border border-border/70 bg-card p-3 shadow-sm",
        "dark:border-white/10"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="line-clamp-2 text-left text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconBg)}>
          <Icon className={cn("h-4 w-4", iconClass)} strokeWidth={2.25} />
        </div>
      </div>
      <div
        className="mt-auto text-2xl font-bold tabular-nums leading-none text-foreground sm:text-[1.65rem]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {valueNode}
      </div>
      {sub ? <p className="text-[10px] font-medium tabular-nums text-teal-600/90 dark:text-teal-400/90">{sub}</p> : null}
    </div>
  )
}

export type TodayStatQuadProps = {
  sessions: number
  sessionGoal: number
  activeMinutes: number
  activeMinGoal: number
  distanceKm: number
  calories: number
  calorieGoal: number
  className?: string
}

/**
 * Four primary “Today” metrics in a 2x2 grid (4 columns from sm breakpoint).
 */
export function TodayStatQuad({
  sessions,
  sessionGoal,
  activeMinutes,
  activeMinGoal,
  distanceKm,
  calories,
  calorieGoal,
  className,
}: TodayStatQuadProps) {
  const dist =
    distanceKm > 0 && distanceKm < 10 ? distanceKm.toFixed(2) : distanceKm > 0 ? distanceKm.toFixed(1) : "0"
  const reduce = useReducedMotion() ?? false
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3",
        className
      )}
      role="list"
    >
      <motion.div
        role="listitem"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: DURATION.medium,
          delay: reduce ? 0 : staggerDelaySec(0, 4, 0.07),
          ease: EASE.out,
        }}
      >
        <StatCell
          icon={Activity}
          label="Activity"
          valueNode={
            <span>
              <TodayAnimatedCount value={sessions} />
            </span>
          }
          sub={`/ ${sessionGoal} goal`}
          iconClass="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-500/15"
        />
      </motion.div>
      <motion.div
        role="listitem"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: DURATION.medium,
          delay: reduce ? 0 : staggerDelaySec(1, 4, 0.07),
          ease: EASE.out,
        }}
      >
        <StatCell
          icon={Timer}
          label="Active min"
          valueNode={
            <span>
              <TodayAnimatedCount value={activeMinutes} />
            </span>
          }
          sub={`/ ${activeMinGoal} goal`}
          iconClass="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-500/15"
        />
      </motion.div>
      <motion.div
        role="listitem"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: DURATION.medium,
          delay: reduce ? 0 : staggerDelaySec(2, 4, 0.07),
          ease: EASE.out,
        }}
      >
        <StatCell
          icon={MapPin}
          label="Distance"
          valueNode={<span>{dist}</span>}
          sub="km"
          iconClass="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-500/15"
        />
      </motion.div>
      <motion.div
        role="listitem"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: DURATION.medium,
          delay: reduce ? 0 : staggerDelaySec(3, 4, 0.07),
          ease: EASE.out,
        }}
      >
        <StatCell
          icon={Flame}
          label="Calories"
          valueNode={
            <span>
              <TodayAnimatedCount value={calories} />
            </span>
          }
          sub={`/ ${calorieGoal} goal`}
          iconClass="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-500/15"
        />
      </motion.div>
    </div>
  )
}
