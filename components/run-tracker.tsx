"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { AnimatePresence } from "framer-motion"
import { addRun, getRuns } from "@/lib/store-supabase"
import { isNetworkError } from "@/lib/network-status"
import {
  browserAllowsGeolocation,
  faultFromGeoError,
  type RunGeolocationFault,
} from "@/lib/geo-context"
import { toast } from "sonner"
import { RunFinishRecap, type RunFinishLap } from "@/components/run-finish-recap"
import { RunScreen } from "@/components/run-screen"
import { computeWeeklyRunKmImpact, weeklyImpactSentence } from "@/lib/run-week-impact"
import { detectRunPersonalBest } from "@/lib/run-pb"
import type { PbResult } from "@/lib/run-pb"
import type { RunRecord } from "@/lib/store"
import { announceRunKmSplit } from "@/lib/run-voice"
import { isSecureContext } from "@/lib/secure-context"

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
  lat2: number, lon2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function RunTracker({
  guest = false,
  streakDays = 0,
}: {
  guest?: boolean
  streakDays?: number
}) {
  const [runState, setRunState] = useState<RunState>("idle")
  const [seconds, setSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [pace, setPace] = useState("0:00")
  const [calories, setCalories] = useState(0)
  const [splits, setSplits] = useState<Lap[]>([])
  const [path, setPath] = useState<[number, number][]>([])
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"off" | "searching" | "good" | "simulated">("off")
  const [gpsFault, setGpsFault] = useState<RunGeolocationFault | null>(null)
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
  const [runInsecureGpsReminder, setRunInsecureGpsReminder] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const runStateRef = useRef<RunState>("idle")
  const lastPosRef = useRef<{ lat: number; lon: number } | null>(null)
  const lastLapDistRef = useRef(0)
  const lastLapTimeRef = useRef(0)
  const lapCountRef = useRef(0)

  // ── Secure-context reminder ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const tick = () => {
      if (isSecureContext()) { setRunInsecureGpsReminder(false); return }
      try {
        setRunInsecureGpsReminder(sessionStorage.getItem("fit-track-insecure-banner-dismissed") === "1")
      } catch { setRunInsecureGpsReminder(false) }
    }
    tick()
    window.addEventListener("pageshow", tick)
    window.addEventListener("focus", tick)
    return () => {
      window.removeEventListener("pageshow", tick)
      window.removeEventListener("focus", tick)
    }
  }, [])

  // ── Auto-redirect 0.0.0.0 → localhost ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV !== "development") return
    if (window.location.hostname !== "0.0.0.0") return
    try {
      const u = new URL(window.location.href)
      u.hostname = "localhost"
      window.location.replace(u.toString())
    } catch { /* ignore */ }
  }, [])

  // ── Map ready on idle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (runState !== "idle") return
    setMapReady(true)
    if (!browserAllowsGeolocation()) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setMapCenter(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    )
  }, [runState])

  // ── GPS watch while running ───────────────────────────────────────────────
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
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [runState])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (runState !== "running") return
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [runState])

  runStateRef.current = runState

  // ── Derived: calories ─────────────────────────────────────────────────────
  useEffect(() => { setCalories(Math.round(distance * 60)) }, [distance])

  // ── Derived: pace ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (seconds > 0 && distance > 0.05) {
      const paceMin = seconds / 60 / distance
      const m = Math.floor(paceMin)
      const sec = Math.floor((paceMin - m) * 60)
      setPace(`${m}:${String(sec).padStart(2, "0")}`)
    } else if (distance <= 0.05) {
      setPace("0:00")
    }
  }, [seconds, distance])

  // ── Km-split detection ────────────────────────────────────────────────────
  const paceFromDistTime = useCallback((d: number, t: number) => {
    if (d <= 0) return "0:00"
    const paceMin = t / 60 / d
    const m = Math.floor(paceMin)
    const sec = Math.floor((paceMin - m) * 60)
    return `${m}:${String(sec).padStart(2, "0")}`
  }, [])

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
      setSplits((prev) => [...prev, { lap: lapKm, distance: Math.round(distance * 100) / 100, time: lapTimeSecs, pace: lapPace }])
      announceRunKmSplit(lapKm, lapPace)
    }
  }, [runState, distance, seconds, paceFromDistTime])

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleStart = () => {
    lastPosRef.current = null
    lastLapDistRef.current = 0
    lastLapTimeRef.current = 0
    lapCountRef.current = 0
    setGpsFault(null)
    setPath([])
    setSplits([])
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
        priorRuns = list.map((r) => ({ distance: r.distance, pace: r.pace, completedAt: r.completedAt }))
      } catch { /* guest / offline */ }

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
        await addRun({ distance, duration: seconds, pace, calories: Math.round(calories), path })
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = useCallback((s: number) => {
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }, [])

  const gpsLabel = (() => {
    if (gpsStatus === "good") return "GPS locked"
    if (gpsStatus === "searching") return "Acquiring location…"
    if (gpsStatus === "simulated") {
      if (gpsFault === "insecure_origin" || gpsFault === "no_api") return "GPS unavailable — HTTPS needed"
      if (gpsFault === "permission_denied") return "GPS denied"
      if (gpsFault === "timeout") return "GPS timeout"
      return "GPS simulated"
    }
    return "Ready"
  })()

  const liveMap =
    mapReady && (runState === "running" || runState === "paused") ? (
      <RunMap path={path} center={mapCenter} runState={runState} className="absolute inset-0" />
    ) : null

  return (
    <>
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

      <RunScreen
        runState={runState}
        gpsStatus={gpsStatus}
        gpsLabel={gpsLabel}
        pace={pace}
        distance={distance}
        seconds={seconds}
        calories={calories}
        heartBpm={null}
        splits={splits}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        savingRun={savingRun}
        guest={guest}
        streakDays={streakDays}
        insecureGpsReminder={runInsecureGpsReminder}
        mapSlot={liveMap}
        formatTime={formatTime}
      />
    </>
  )
}
