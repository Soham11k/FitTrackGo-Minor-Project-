"use client"

import { motion } from "framer-motion"
import { ArrowRight, MapPin } from "lucide-react"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC, DURATION, EASE } from "@/lib/motion"
import { pulse } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import { browserAllowsGeolocation } from "@/lib/geo-context"
import { useLocale } from "@/components/locale-provider"
import { useEffect, useState } from "react"

export type RunReadyGpsStatus = "off" | "searching" | "good" | "simulated"

export function RunReadyScreen({
  gpsStatus,
  onStartRun,
  className,
  insecureGpsReminder,
}: {
  gpsStatus: RunReadyGpsStatus
  onStartRun: () => void
  className?: string
  insecureGpsReminder?: boolean
}) {
  const { t } = useLocale()

  const gpsLabel = (status: RunReadyGpsStatus): string => {
    if (status === "good") return t("run.gps.idleGood")
    if (status === "searching") return t("run.gps.idleSearching")
    if (status === "simulated") {
      return browserAllowsGeolocation() ? t("run.gps.unavailable") : t("run.gps.idleHTTPS")
    }
    return t("run.gps.idleOff")
  }
  const [lockPhase, setLockPhase] = useState(0)

  useEffect(() => {
    if (gpsStatus !== "good") {
      setLockPhase(0)
      return
    }
    pulse("success")
    setLockPhase(1)
    const timeoutId = window.setTimeout(() => setLockPhase(2), 550)
    return () => clearTimeout(timeoutId)
  }, [gpsStatus])

  return (
    <CinematicStage
      vignette
      className={cn(
        "flex flex-col justify-end bg-[color-mix(in_oklab,var(--surface-stage)_88%,transparent)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex flex-1 flex-col justify-end px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12">
        <motion.div variants={CINEMATIC.heroEnter} initial="hidden" animate="show" className="mb-auto pt-6 text-center">
          <p className="text-sm text-[color:oklch(0.92_0_0/0.55)]">Outdoor run</p>
          <p
            className="mt-2 text-display-stat-lg text-[color:var(--surface-stage-fg)]"
            style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
          >
            Ready
          </p>
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-stage-hairline)] bg-black/30 px-3 py-1.5 text-typo-caption text-[color:oklch(0.92_0_0/0.72)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span>{gpsLabel(gpsStatus)}</span>
            {gpsStatus === "good" && lockPhase >= 1 ? (
              <span className="text-primary font-semibold">{lockPhase >= 2 ? "· Locked" : "· Locking…"}</span>
            ) : null}
          </div>
        </motion.div>

        {insecureGpsReminder ? (
          <p className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.12] px-3 py-2 text-center text-typo-caption leading-snug text-amber-100/90">
            Live GPS needs <strong className="text-foreground">localhost</strong> or <strong className="text-foreground">HTTPS</strong>.
          </p>
        ) : null}

        <motion.button
          type="button"
          layoutId="run-start-button"
          onClick={onStartRun}
          className="press-magnetic flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-[1.125rem] text-base font-bold uppercase tracking-[0.1em] text-primary-foreground shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--primary)_65%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary"
          aria-label="Start run"
          whileTap={{ scale: 0.98 }}
          transition={{ duration: DURATION.micro, ease: [...EASE.out] }}
        >
          Start run
          <ArrowRight className="h-5 w-5" aria-hidden />
        </motion.button>
      </div>
    </CinematicStage>
  )
}
