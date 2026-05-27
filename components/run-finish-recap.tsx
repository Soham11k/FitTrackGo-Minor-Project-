"use client"

import { useMemo, useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Share2, Check, Map } from "lucide-react"
import { MetricGrid, MetricTile } from "@/components/brand/metric-panel"
import { Button } from "@/components/ui/button"
import { CelebrationBurst } from "@/components/ui/celebration-burst"
import { PbSticker } from "@/components/ui/pb-sticker"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { ParticleBurst } from "@/components/animated/ParticleBurst"
import { toast } from "sonner"
import { pathToSvgD } from "@/lib/run-path-svg"
import { composeRunShareFile } from "@/lib/share-card"
import { useLocale } from "@/components/locale-provider"
import type { PbResult } from "@/lib/run-pb"
import { CINEMATIC, DURATION, EASE, staggerChildren } from "@/lib/motion"

export type RunFinishLap = { lap: number; distance: number; time: number; pace: string }

/** Reusable km split bars (history detail, recap, etc.). */
export function RunSplitBars({ splits, tone = "stage" }: { splits: RunFinishLap[]; tone?: "stage" | "card" }) {
  const { t } = useLocale()
  const paceSecs = splits.map((s) => {
    const m = /^(\d+):(\d{1,2})$/.exec(s.pace.trim())
    if (!m) return null
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  })
  const validPaces = paceSecs.filter((n): n is number => n != null && Number.isFinite(n))
  const slowestSec = validPaces.length ? Math.max(...validPaces) : 0
  const fastestSec = validPaces.length ? Math.min(...validPaces) : 0
  const bestIdx = validPaces.length ? paceSecs.indexOf(fastestSec) : -1
  const worstIdx = validPaces.length ? paceSecs.indexOf(slowestSec) : -1
  let splitInsight = ""
  if (splits.length > 1 && bestIdx >= 0 && worstIdx >= 0 && bestIdx !== worstIdx) {
    splitInsight = t("run.split.insight")
      .replace("{{best}}", String(splits[bestIdx]?.lap ?? ""))
      .replace("{{worst}}", String(splits[worstIdx]?.lap ?? ""))
  }
  const labelCls = tone === "stage" ? "text-white/50" : "text-muted-foreground"
  const explainCls = tone === "stage" ? "text-white/75" : "text-muted-foreground"

  if (splits.length === 0) return null

  return (
    <div>
      <p className={`mb-2 text-typo-eyebrow font-bold uppercase tracking-[0.2em] ${labelCls}`}>{t("run.split.paceLabel")}</p>
      {splitInsight ? <p className={`mb-3 text-sm ${explainCls}`}>{splitInsight}</p> : null}
      <div className="flex h-20 items-end gap-1">
        {splits.map((s, i) => {
          const sec = paceSecs[i]
          const h = sec != null && slowestSec > 0 ? Math.max(12, (sec / slowestSec) * 100) : 40
          const isBest = i === bestIdx
          const isWorst = i === worstIdx && splits.length > 1
          const bestCls = tone === "stage" ? "bg-primary" : "bg-primary"
          const worstCls = tone === "stage" ? "bg-white/35" : "bg-muted-foreground/40"
          const midCls = tone === "stage" ? "bg-primary/80" : "bg-primary/70"
          return (
            <div key={s.lap} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md motion-safe:transition-all ${isBest ? bestCls : isWorst ? worstCls : midCls}`}
                style={{ height: `${h}%` }}
                title={`Km ${s.lap}: ${s.pace}${isBest ? t("run.split.fastest") : ""}${isWorst ? t("run.split.slowest") : ""}`}
              />
              <span className={`text-typo-micro font-bold tabular-nums ${tone === "stage" ? "text-white/50" : "text-muted-foreground"}`}>
                {s.lap}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDur(s: number) {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

/** Full-screen cinematic run finish (replaces sheet) with layoutIds for morph from live tracker. */
export function RunFinishRecap({
  open,
  onOpenChange,
  distanceKm,
  durationSec,
  pacePerKm,
  path,
  splits,
  calories,
  pbResult,
  weeklyImpactLine,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  distanceKm: number
  durationSec: number
  pacePerKm: string
  path: [number, number][]
  splits: RunFinishLap[]
  calories: number
  pbResult?: PbResult
  weeklyImpactLine?: string
}) {
  const { t, locale } = useLocale()
  const reduceMotion = useReducedMotion() ?? false
  const d = useMemo(() => pathToSvgD(path), [path])
  const [statsPhase, setStatsPhase] = useState<"wait" | "show">("wait")
  const [burstOn, setBurstOn] = useState(false)

  const statStaggerParent = staggerChildren(reduceMotion ? 0 : 0.08, reduceMotion ? 0 : 0.06)

  useEffect(() => {
    if (!open) {
      setStatsPhase("wait")
      setBurstOn(false)
      return undefined
    }
    setStatsPhase("wait")
    setBurstOn(false)
    return undefined
  }, [open])

  useEffect(() => {
    if (!d) setStatsPhase("show")
  }, [d, open])

  useEffect(() => {
    if (!open || !reduceMotion) return undefined
    setStatsPhase("show")
    return undefined
  }, [open, reduceMotion])

  useEffect(() => {
    if (!open || !pbResult) return undefined
    const id = window.setTimeout(() => setBurstOn(true), 200)
    return () => clearTimeout(id)
  }, [open, pbResult])

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  async function handleShare() {
    const text = `${distanceKm.toFixed(2)} km · ${formatDur(durationSec)} · ${pacePerKm}/km · FitTrack Go`
    try {
      const png = await composeRunShareFile(
        {
          distanceKm,
          durationSec,
          pacePerKm,
          dateLabel,
          path,
          isPb: Boolean(pbResult),
        },
        { locale }
      )
      if (png && navigator.share && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ title: t("run.share.nativeTitle"), text, files: [png] })
        return
      }
      if (png && navigator.share) {
        await navigator.share({ title: t("run.share.nativeTitle"), text })
        return
      }
    } catch {
      /* dismissed or unsupported */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("run.share.copied"))
    } catch {
      toast.error(t("run.share.failed"))
    }
  }

  if (!open) return null

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-finish-title"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">{dateLabel}</p>
          <h2
            id="run-finish-title"
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
          >
            {t("run.saved.title")}
          </h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          {t("run.saved.close")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-safe pb-28 pt-4">
        <div className="relative mx-auto max-w-lg">
          <div className="relative mx-auto flex flex-col items-start gap-1">
            {/* Particle burst on PB */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
              <ParticleBurst trigger={burstOn} count={100} size={320} />
            </div>
            {burstOn ? <CelebrationBurst className="absolute -top-4 right-0" /> : null}
            {pbResult ? <PbSticker variant={pbResult.variant} className="relative z-[1] mb-2" /> : null}
            <motion.div
              className="relative z-[2] w-full"
              variants={statStaggerParent}
              initial={reduceMotion ? false : "hidden"}
              animate={reduceMotion ? "show" : statsPhase === "show" ? "show" : "hidden"}
            >
              <motion.div variants={CINEMATIC.statReveal}>
                {/* Trophy icon on any completed run */}
                <motion.div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-metric-streak/20 text-2xl"
                  initial={reduceMotion ? false : { scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.2 }}
                >
                  🏃
                </motion.div>
                <p className="text-typo-eyebrow font-bold uppercase tracking-[0.28em] text-muted-foreground">{t("run.stat.distance")}</p>
                <p
                  className="text-display-stat-lg mt-1 tabular-nums text-foreground"
                  style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
                >
                  {statsPhase === "show" ? (
                    <AnimatedCounter value={distanceKm} decimals={2} duration={1.2} />
                  ) : "0.00"}
                  <span className="ml-2 text-xl font-semibold text-muted-foreground">km</span>
                </p>
              </motion.div>
              <motion.div variants={CINEMATIC.statReveal} className="mt-6 border-y border-border py-4">
                <MetricGrid cols={3}>
                  <MetricTile label={t("run.stat.pace")} value={pacePerKm} unit="/km" />
                  <MetricTile label={t("run.stat.time")} value={formatDur(durationSec)} />
                  <MetricTile label={t("run.stat.energy")} value={String(calories)} unit="kcal" />
                </MetricGrid>
              </motion.div>
            </motion.div>
          </div>

          <div className="relative mt-8 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-muted/30 nrc-card">
            {d ? (
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                <motion.path
                  d={d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: reduceMotion ? 0.05 : DURATION.cinematic,
                    ease: [...EASE.cinematic],
                  }}
                  onAnimationComplete={() => {
                    if (!reduceMotion) setStatsPhase("show")
                  }}
                />
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-typo-caption text-muted-foreground">
                {t("run.saved.noTrail")}
              </div>
            )}
          </div>

          <div className="mt-8">
            <RunSplitBars splits={splits} tone="card" />
            {weeklyImpactLine ? (
              <p className="mt-4 text-center text-typo-caption text-muted-foreground">{weeklyImpactLine}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-[81] flex flex-wrap gap-2 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          type="button"
          className="press-magnetic btn-lift min-h-12 flex-1 rounded-lg font-bold uppercase tracking-[0.18em] text-xs"
          onClick={() => onOpenChange(false)}
        >
          <Check className="h-4 w-4" />
          {t("run.saved.done")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="press-magnetic btn-lift min-h-12 flex-1 rounded-lg font-bold uppercase tracking-[0.18em] text-xs"
          onClick={() => void handleShare()}
        >
          <Share2 className="h-4 w-4" />
          {t("run.saved.share")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-12 min-w-[9rem] rounded-lg font-bold uppercase tracking-[0.18em] text-xs"
          disabled={!d}
          title={t("run.saved.routeTooltip")}
        >
          <Map className="h-4 w-4" />
          {t("run.saved.map")}
        </Button>
      </div>
    </motion.div>
  )
}
