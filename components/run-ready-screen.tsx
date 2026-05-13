"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { MapPin, Play } from "lucide-react"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC, DURATION, EASE } from "@/lib/motion"
import { pulse } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export type RunReadyGpsStatus = "off" | "searching" | "good" | "simulated"

function gpsLabel(status: RunReadyGpsStatus): string {
  if (status === "good") return "GPS locked · High accuracy"
  if (status === "searching") return "Acquiring satellites…"
  if (status === "simulated") return "Demo mode · Connect HTTPS for real GPS"
  return "GPS ready when you press Start"
}

export function RunReadyScreen({
  gpsStatus,
  onStartRun,
  className,
}: {
  gpsStatus: RunReadyGpsStatus
  onStartRun: () => void
  className?: string
}) {
  const [lockPhase, setLockPhase] = useState(0)

  useEffect(() => {
    if (gpsStatus !== "good") {
      setLockPhase(0)
      return
    }
    pulse("success")
    setLockPhase(1)
    const t = window.setTimeout(() => setLockPhase(2), 550)
    return () => clearTimeout(t)
  }, [gpsStatus])

  return (
    <CinematicStage
      vignette
      className={cn(
        "flex flex-col justify-end bg-[color-mix(in_oklab,var(--surface-stage)_76%,transparent)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex flex-1 flex-col justify-center px-6 pb-4 pt-14">
        <motion.div variants={CINEMATIC.heroEnter} initial="hidden" animate="show" className="text-center">
          <p className="text-eyebrow-mega text-[color:oklch(0.92_0_0/0.55)]">READY</p>
          <p
            className="mt-2 text-display-stat-lg text-[color:var(--surface-stage-fg)] transition-opacity duration-300"
            style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
          >
            FREE RUN
          </p>
          <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-typo-caption text-[color:oklch(0.92_0_0/0.7)]">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{gpsLabel(gpsStatus)}</span>
            {gpsStatus === "good" && lockPhase >= 1 ? (
              <span className="rounded-full bg-primary/25 px-2 py-0.5 text-typo-micro font-bold tabular-nums text-primary">
                {lockPhase >= 2 ? "LOCK ✓" : "LOCK…"}
              </span>
            ) : null}
          </div>
        </motion.div>

        <div className="mt-8 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[color:var(--surface-stage-hairline)] bg-black/35 p-3 text-left">
            <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-white/55">Trail</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--surface-stage-fg)]">Route paints live</p>
            <p className="text-typo-caption text-white/50">Km splits + voice cues when enabled</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--surface-stage-hairline)] bg-black/35 p-3 text-left">
            <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-white/55">Outdoor</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--surface-stage-fg)]">Clear sky helps GPS</p>
            <p className="text-typo-caption text-white/50">Use HTTPS or localhost</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <motion.button
          type="button"
          layoutId="run-start-button"
          onClick={onStartRun}
          className="flex h-[5.25rem] w-[5.25rem] min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary"
          aria-label="Start run"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: DURATION.micro, ease: [...EASE.out] }}
        >
          <Play className="relative z-[1] h-11 w-11 translate-x-[3px] fill-current motion-safe:animate-float" aria-hidden />
        </motion.button>
      </div>
    </CinematicStage>
  )
}
