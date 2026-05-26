"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { Play, Pause, Square, MapPin, ChevronDown } from "lucide-react"
import { addRun, getRuns } from "@/lib/store-supabase"
import { isNetworkError } from "@/lib/network-status"
import {
  browserAllowsGeolocation,
  faultFromGeoError,
  type RunGeolocationFault,
} from "@/lib/geo-context"
import { toast } from "sonner"
import { RunFinishRecap, type RunFinishLap } from "@/components/run-finish-recap"
import { RunReadyScreen, type RunReadyGpsStatus } from "@/components/run-ready-screen"
import { MetricGrid, MetricTile } from "@/components/brand/metric-panel"
import { StatDisplay } from "@/components/ui/stat-display"
import { staggerChildren, CINEMATIC } from "@/lib/motion"
import { computeWeeklyRunKmImpact, weeklyImpactSentence } from "@/lib/run-week-impact"
import { detectRunPersonalBest } from "@/lib/run-pb"
import type { PbResult } from "@/lib/run-pb"
import type { RunRecord } from "@/lib/store"
import { announceRunKmSplit } from "@/lib/run-voice"
import { useLocale } from "@/components/locale-provider"
import { isSecureContext } from "@/lib/secure-context"
import { cn } from "@/lib/utils"

const RunMap = dynamic(() => import("./run-map").then((m) => m.RunMap), { ssr: false })

export type RunState = "idle" | "running" | "paused"

interface Lap {
  lap: number
  distance: number
  time: number
  pace: string
}

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

type PrimaryRunMetric = "pace" | "distance" | "time"

export function RunTracker() {
  const { t } = useLocale()
  const reducedMotionPref = useReducedMotion() ?? false
  const [runState, setRunState] = useState<RunState>("idle")
  const [seconds, setSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [pace, setPace] = useState("0:00")
  const [calories, setCalories] = useState(0)
  const [splits, setSplits] = useState<Lap[]>([])
  const [path, setPath] = useState<[number, number][]>([])
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"off" | "searching" | "good" | "simulated">("off")
  /** When GPS shows as unavailable, distinguishes HTTP/LAN blocks vs permission/timeouts vs missing API */
  const [gpsFault, setGpsFault] = useState<RunGeolocationFault | null>(null)
  const [showSplits, setShowSplits] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [savingRun, setSavingRun] = useState(false)
  const [recapOpen, setRecapOpen] = useState(false)
  const [recapPayload, setRecapPayload] = useState<{
    distanceKm: number
    durationSec: number
    pace: string
    path: [number, number][]
    splits: RunFinishLap[]
    calories: number
    pbResult: PbResult
    weeklyImpactLine: string
  } | null>(null)
  const [primaryMetric, setPrimaryMetric] = useState<PrimaryRunMetric>("pace")
  const [liveHudAnimKey, setLiveHudAnimKey] = useState(0)
  /** Shown inside Run-ready when insecure context remains but global amber banner was dismissed. */
  const [runInsecureGpsReminder, setRunInsecureGpsReminder] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const tick = () => {
      if (isSecureContext()) {
        setRunInsecureGpsReminder(false)
        return
      }
      try {
        setRunInsecureGpsReminder(sessionStorage.getItem("fit-track-insecure-banner-dismissed") === "1")
      } catch {
        setRunInsecureGpsReminder(false)
      }
    }
    tick()
    window.addEventListener("pageshow", tick)
    window.addEventListener("focus", tick)
    return () => {
      window.removeEventListener("pageshow", tick)
      window.removeEventListener("focus", tick)
    }
  }, [])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const runStateRef = useRef<RunState>("idle")
  const lastPosRef = useRef<{ lat: number; lon: number } | null>(null)
  const lastLapDistRef = useRef(0)
  const lastLapTimeRef = useRef(0)
  const lapCountRef = useRef(0)

  const formatTime = useCallback((s: number) => {
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }, [])

  const paceFromDistTime = useCallback((d: number, t: number) => {
    if (d <= 0) return "0:00"
    const paceMin = t / 60 / d
    const m = Math.floor(paceMin)
    const sec = Math.floor((paceMin - m) * 60)
    return `${m}:${String(sec).padStart(2, "0")}`
  }, [])

  useEffect(() => {
    if (runState !== "running") return
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runState])

  runStateRef.current = runState

  // Next often prints Network: http://0.0.0.0:3000 — that host is NOT a secure context,
  // so Geolocation stays blocked until you open the same app at http://localhost:3000.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV !== "development") return
    if (window.location.hostname !== "0.0.0.0") return
    try {
      const u = new URL(window.location.href)
      u.hostname = "localhost"
      window.location.replace(u.toString())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (runState !== "idle") return
    setMapReady(true)
    if (!browserAllowsGeolocation()) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setMapCenter(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    )
  }, [runState])

  useEffect(() => {
    if (runState !== "running") return
    if (!browserAllowsGeolocation() || !navigator.geolocation.watchPosition) {
      setGpsFault(typeof navigator !== "undefined" && !navigator.geolocation ? "no_api" : "insecure_origin")
      setGpsStatus("simulated")
      return
    }
    setGpsFault(null)
    setGpsStatus("searching")
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (runStateRef.current !== "running") return
        const { latitude, longitude } = pos.coords
        setGpsFault(null)
        setGpsStatus("good")
        const pt: [number, number] = [latitude, longitude]
        setPath((prev) => [...prev, pt])
        setMapCenter(pt)
        const last = lastPosRef.current
        lastPosRef.current = { lat: latitude, lon: longitude }
        if (last) {
          const km = haversineKm(last.lat, last.lon, latitude, longitude)
          setDistance((d) => d + km)
        }
      },
      (err: GeolocationPositionError) => {
        setGpsFault(faultFromGeoError(err?.code))
        setGpsStatus("simulated")
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [runState])

  useEffect(() => {
    // When GPS is simulated (e.g. insecure HTTP), don't fake distance.
    // This keeps distance, pace, and calories honest instead of drifting.
    if (runState !== "running" || gpsStatus !== "simulated") return
  }, [runState, gpsStatus])

  useEffect(() => {
    // Simple model: calories scale with distance.
    // When distance is 0 (standing still), calories stay at 0 so they don't
    // creep up every second while the user isn't moving.
    setCalories(Math.round(distance * 60))
  }, [distance])

  useEffect(() => {
    // Guard against noisy GPS: only show pace once we've moved a bit.
    if (seconds > 0 && distance > 0.05) {
      const paceMin = seconds / 60 / distance
      const m = Math.floor(paceMin)
      const sec = Math.floor((paceMin - m) * 60)
      setPace(`${m}:${String(sec).padStart(2, "0")}`)
    } else if (distance <= 0.05) {
      setPace("0:00")
    }
  }, [seconds, distance])

  useEffect(() => {
    if (runState !== "running" || distance < 0.01) return
    const lapKm = Math.floor(distance)
    if (lapKm > lapCountRef.current) {
      lapCountRef.current = lapKm
      const lapDist = distance - lastLapDistRef.current
      const lapTimeSecs = seconds - lastLapTimeRef.current
      lastLapDistRef.current = distance
      lastLapTimeRef.current = seconds
      const lapPace = paceFromDistTime(lapDist, lapTimeSecs)
      setSplits((prev) => [
        ...prev,
        {
          lap: lapKm,
          distance: Math.round(distance * 100) / 100,
          time: lapTimeSecs,
          pace: lapPace,
        },
      ])
      announceRunKmSplit(lapKm, lapPace)
    }
  }, [runState, distance, seconds, paceFromDistTime])

  const handleStart = () => {
    lastPosRef.current = null
    lastLapDistRef.current = 0
    lastLapTimeRef.current = 0
    lapCountRef.current = 0
    setGpsFault(null)
    setPath([])
    setSplits([])
    setPrimaryMetric("pace")
    setLiveHudAnimKey((k) => k + 1)
    setRunState("running")
  }
  const handlePause = () => setRunState("paused")
  const handleResume = () => setRunState("running")
  const handleStop = async () => {
    const hadActivity = seconds > 0 || distance > 0
    if (hadActivity) {
      let priorRuns: Pick<RunRecord, "distance" | "pace" | "completedAt">[] = []
      try {
        const list = await getRuns()
        priorRuns = list.map((r) => ({
          distance: r.distance,
          pace: r.pace,
          completedAt: r.completedAt,
        }))
      } catch {
        /* guest / offline — skip history-based signals */
      }

      const pbResult = detectRunPersonalBest(
        priorRuns.map(({ distance: d, pace: p }) => ({ distance: d, pace: p })),
        { distanceKm: distance, pace },
      )
      const weeklyImpactLine = weeklyImpactSentence(computeWeeklyRunKmImpact(priorRuns, distance))

      const snapshot = {
        distanceKm: distance,
        durationSec: seconds,
        pace,
        path: [...path] as [number, number][],
        splits: [...splits] as RunFinishLap[],
        calories: Math.round(calories),
        pbResult,
        weeklyImpactLine,
      }
      setSavingRun(true)
      try {
        await addRun({
          distance,
          duration: seconds,
          pace,
          calories: Math.round(calories),
          path,
        })
        toast.success(`Run saved! ${distance.toFixed(2)} km in ${formatTime(seconds)}`)
        setRecapPayload(snapshot)
        setRecapOpen(true)
      } catch (error) {
        if (isNetworkError(error)) {
          toast.info("Run queued — will sync when back online")
          setRecapPayload(snapshot)
          setRecapOpen(true)
        } else {
          toast.error("Failed to save run")
          console.error(error)
        }
      } finally {
        setSavingRun(false)
      }
    }
    setRunState("idle")
    setSeconds(0)
    setDistance(0)
    setCalories(0)
    setPace("0:00")
    setSplits([])
    setPath([])
    setMapCenter(null)
    setGpsStatus("off")
    setGpsFault(null)
  }

  const idleReadyGps = (): RunReadyGpsStatus => {
    if (typeof window === "undefined") return "off"
    if (!browserAllowsGeolocation()) return "simulated"
    return mapCenter ? "good" : "searching"
  }

  const gpsBadgeLabel = () => {
    if (gpsStatus === "good") return t("run.gps.active")
    if (gpsStatus === "searching") return t("run.gps.searching")
    if (gpsStatus === "simulated") {
      if (gpsFault === "insecure_origin" || gpsFault === "no_api") return t("run.gps.insecure")
      if (gpsFault === "permission_denied") return t("run.gps.denied")
      if (gpsFault === "timeout") return t("run.gps.timeout")
      if (gpsFault === "position_unavailable") return t("run.gps.unavailable")
      return t("run.gps.simulated")
    }
    return t("run.gps.ready")
  }

  const cyclePrimaryMetric = () => {
    setPrimaryMetric((m) => (m === "pace" ? "distance" : m === "distance" ? "time" : "pace"))
  }

  const secondaryMetrics = (["pace", "distance", "time"] as const).filter((m) => m !== primaryMetric)

  const hudVariants = staggerChildren(0.06, 0.05)

  function renderMetricCell(m: PrimaryRunMetric, opts: { hero: boolean }) {
    const layoutIds: Record<PrimaryRunMetric, string> = {
      pace: "run-stat-pace",
      distance: "run-stat-distance",
      time: "run-stat-time",
    }
    const lid = opts.hero ? layoutIds[m] : undefined
    const size = opts.hero ? "lg" : "md"
    if (m === "pace") {
      return (
        <StatDisplay
          key="pace"
          eyebrow={t("run.stat.pace")}
          value={pace}
          unit="/km"
          size={size}
          layoutId={lid}
        />
      )
    }
    if (m === "distance") {
      return (
        <StatDisplay
          key="dist"
          eyebrow={t("run.stat.distance")}
          value={distance.toFixed(2)}
          unit="km"
          size={size}
          layoutId={lid}
        />
      )
    }
    return (
      <StatDisplay
        key="time"
        eyebrow={t("run.stat.time")}
        value={formatTime(seconds)}
        size={size}
        layoutId={lid}
      />
    )
  }

  const statsCardClass =
    runState === "idle"
      ? "relative z-[20] mx-4 -mt-12 rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-card)] backdrop-blur-xl"
      : "relative z-[20] mx-4 -mt-12 overflow-hidden rounded-3xl border border-border/80 bg-[color:var(--surface-stage)] text-[color:var(--surface-stage-fg)] shadow-[var(--shadow-card)]"

  const primaryMetricLabel = primaryMetric === "pace" ? t("run.stat.pace") : primaryMetric === "distance" ? t("run.stat.distance") : t("run.stat.time")
  const primaryMetricValue =
    primaryMetric === "pace" ? pace : primaryMetric === "distance" ? distance.toFixed(2) : formatTime(seconds)
  const primaryMetricUnit = primaryMetric === "pace" ? "/km" : primaryMetric === "distance" ? "km" : undefined

  const statsBody = (
    <>
      <button
        type="button"
        onClick={cyclePrimaryMetric}
        className="w-full border border-transparent py-2 text-center transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Cycle primary statistic"
      >
        {renderMetricCell(primaryMetric, { hero: true })}
      </button>
      <div className="mt-5 grid grid-cols-3 hairline-divide-x border-t border-border pt-5">
        {secondaryMetrics.map((m) => (
          <div key={m} className="px-2">{renderMetricCell(m, { hero: false })}</div>
        ))}
        <div className="px-2">
          <StatDisplay eyebrow={t("run.stat.cal")} value={String(Math.round(calories))} unit="kcal" size="md" />
        </div>
      </div>
    </>
  )

  const liveStatsBody = (
    <>
      <button
        type="button"
        onClick={cyclePrimaryMetric}
        className="w-full rounded-2xl bg-primary px-4 py-5 text-left text-primary-foreground transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/40"
        aria-label="Cycle primary statistic"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{primaryMetricLabel}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
          {primaryMetricValue}
          {primaryMetricUnit ? <span className="ml-1 text-lg font-semibold opacity-80">{primaryMetricUnit}</span> : null}
        </p>
      </button>
      <div className="mt-4 px-1">
        <MetricGrid cols={3}>
          {secondaryMetrics.map((m) => (
            <MetricTile
              key={m}
              tone="stage"
              label={m === "pace" ? t("run.stat.pace") : m === "distance" ? t("run.stat.distance") : t("run.stat.time")}
              value={m === "pace" ? pace : m === "distance" ? distance.toFixed(2) : formatTime(seconds)}
              unit={m === "pace" ? "/km" : m === "distance" ? "km" : undefined}
            />
          ))}
          <MetricTile tone="stage" label={t("run.stat.cal")} value={String(Math.round(calories))} unit="kcal" />
        </MetricGrid>
      </div>
    </>
  )

  return (
    <LayoutGroup id="run-track-session">
      <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 animate-fade-in-up route-in">
        <AnimatePresence>
          {recapOpen && recapPayload ? (
            <RunFinishRecap
              key="run-finish"
              open={recapOpen}
              onOpenChange={(o) => {
                setRecapOpen(o)
                if (!o) setRecapPayload(null)
              }}
              distanceKm={recapPayload.distanceKm}
              durationSec={recapPayload.durationSec}
              pacePerKm={recapPayload.pace}
              path={recapPayload.path}
              splits={recapPayload.splits}
              calories={recapPayload.calories}
              pbResult={recapPayload.pbResult}
              weeklyImpactLine={recapPayload.weeklyImpactLine}
            />
          ) : null}
        </AnimatePresence>
      {/* Real map — NRC scale; taller while running */}
      <div className={cn(
        "relative overflow-hidden bg-secondary transition-[height,min-height] duration-300",
        runState === "idle" ? "h-[40vh] min-h-[280px]" : "h-[48vh] min-h-[320px]",
      )}>
        {mapReady && (
          <RunMap
            path={path}
            center={mapCenter}
            runState={runState}
            className="absolute inset-0"
          />
        )}
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <div className="animate-pulse rounded-full bg-primary/20 h-12 w-12" />
          </div>
        )}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-sm border border-border bg-background/95 backdrop-blur-sm px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-foreground">
              {gpsBadgeLabel()}
            </span>
          </div>
          {typeof window !== "undefined" && !window.isSecureContext && runState !== "idle" && (
            <span className="text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-muted-foreground border border-border bg-background/80 backdrop-blur-sm px-2 py-1 rounded-sm">
              {t("run.httpsGPS")}
            </span>
          )}
        </div>
        {runState === "idle" && (
          <>
            <RunReadyScreen
              gpsStatus={idleReadyGps()}
              onStartRun={handleStart}
              className="absolute inset-0 z-[500]"
              insecureGpsReminder={runInsecureGpsReminder}
            />
          </>
        )}
      </div>

      {runState === "idle" ? (
        <div className={statsCardClass}>{statsBody}</div>
      ) : (
        <motion.div
          key={liveHudAnimKey}
          className={statsCardClass}
          variants={hudVariants}
          initial={reducedMotionPref ? false : "hidden"}
          animate="show"
        >
          <motion.div variants={CINEMATIC.statReveal} className="p-4">
            {liveStatsBody}
          </motion.div>
        </motion.div>
      )}

      {splits.length > 0 && (
        <section className="mx-4 mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-sm animate-scale-in transition-shadow duration-300 hover:shadow-md">
          <button
            onClick={() => setShowSplits((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left transition-all duration-200 hover:bg-secondary/50 active:scale-[0.99]"
          >
            <span className="text-sm font-semibold text-foreground">{t("run.splits")}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${showSplits ? "rotate-180" : ""}`} />
          </button>
          {showSplits && (
            <div className="border-t border-border px-4 pb-4 pt-2 space-y-2 animate-fade-in-up">
              {splits.map((lap) => (
                <div key={lap.lap} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("run.kmAbbrev")} {lap.lap}
                  </span>
                  <span className="font-medium text-foreground">{formatTime(lap.time)}</span>
                  <span className="text-muted-foreground">{lap.pace}/km</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-center gap-6 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-auto">
        {runState === "idle" && <div className="w-20 shrink-0" aria-hidden />}
        {runState === "running" && (
          <>
            <button onClick={handleStop} disabled={savingRun} className="flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-destructive bg-transparent text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70 disabled:pointer-events-none" aria-label="Stop run">
              {savingRun ? <span className="text-typo-eyebrow font-bold uppercase tracking-[0.18em]">{t("run.saving")}</span> : <Square className="h-5 w-5" fill="currentColor" />}
            </button>
            <motion.button
              layoutId="run-start-button"
              type="button"
              onClick={handlePause}
              className="flex h-20 w-20 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-foreground ring-offset-4 ring-offset-background transition-colors hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-primary"
              aria-label="Pause run"
              whileTap={{ scale: reducedMotionPref ? 1 : 0.96 }}
            >
              <Pause className="h-8 w-8" fill="currentColor" />
            </motion.button>
            <div className="w-14" />
          </>
        )}
        {runState === "paused" && (
          <>
            <button onClick={handleStop} disabled={savingRun} className="flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-destructive bg-transparent text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70 disabled:pointer-events-none" aria-label="Stop run">
              {savingRun ? <span className="text-typo-eyebrow font-bold uppercase tracking-[0.18em]">{t("run.saving")}</span> : <Square className="h-5 w-5" fill="currentColor" />}
            </button>
            <motion.button
              layoutId="run-start-button"
              type="button"
              onClick={handleResume}
              className="flex h-20 w-20 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-foreground ring-offset-4 ring-offset-background transition-colors hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-primary"
              aria-label="Resume run"
              whileTap={{ scale: reducedMotionPref ? 1 : 0.96 }}
            >
              <Play className="h-8 w-8 ml-1" fill="currentColor" />
            </motion.button>
            <div className="w-14" />
          </>
        )}
      </div>
    </div>
    </LayoutGroup>
  )
}
