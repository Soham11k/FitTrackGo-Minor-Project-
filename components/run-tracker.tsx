"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Play, Pause, Square, MapPin, ChevronDown } from "lucide-react"
import { addRun } from "@/lib/store-supabase"
import { toast } from "sonner"

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

export function RunTracker() {
  const [runState, setRunState] = useState<RunState>("idle")
  const [seconds, setSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [pace, setPace] = useState("0:00")
  const [calories, setCalories] = useState(0)
  const [splits, setSplits] = useState<Lap[]>([])
  const [path, setPath] = useState<[number, number][]>([])
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"off" | "searching" | "good" | "simulated">("off")
  const [showSplits, setShowSplits] = useState(false)
  const [mapReady, setMapReady] = useState(false)
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

  useEffect(() => {
    if (runState !== "idle") return
    setMapReady(true)
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setMapCenter(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    )
  }, [runState])

  useEffect(() => {
    if (runState !== "running") return
    setGpsStatus("searching")
    watchIdRef.current = navigator.geolocation?.watchPosition(
      (pos) => {
        if (runStateRef.current !== "running") return
        const { latitude, longitude } = pos.coords
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
      () => setGpsStatus("simulated"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [runState])

  useEffect(() => {
    if (runState !== "running" || gpsStatus !== "simulated") return
    const t = setInterval(() => {
      setDistance((d) => d + 0.002 + Math.random() * 0.003)
    }, 1000)
    return () => clearInterval(t)
  }, [runState, gpsStatus])

  useEffect(() => {
    setCalories(Math.round(distance * 60 + seconds / 60 * 8))
  }, [distance, seconds])

  useEffect(() => {
    if (seconds > 0 && distance > 0) {
      const paceMin = seconds / 60 / distance
      const m = Math.floor(paceMin)
      const sec = Math.floor((paceMin - m) * 60)
      setPace(`${m}:${String(sec).padStart(2, "0")}`)
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
      setSplits((prev) => [
        ...prev,
        {
          lap: lapKm,
          distance: Math.round(distance * 100) / 100,
          time: lapTimeSecs,
          pace: paceFromDistTime(lapDist, lapTimeSecs),
        },
      ])
    }
  }, [runState, distance, seconds, paceFromDistTime])

  const handleStart = () => {
    lastPosRef.current = null
    lastLapDistRef.current = 0
    lastLapTimeRef.current = 0
    lapCountRef.current = 0
    setPath([])
    setSplits([])
    setRunState("running")
  }
  const handlePause = () => setRunState("paused")
  const handleResume = () => setRunState("running")
  const handleStop = async () => {
    if (seconds > 0 || distance > 0) {
      try {
        await addRun({
          distance,
          duration: seconds,
          pace,
          calories: Math.round(calories),
          path,
        })
        toast.success(`Run saved! ${distance.toFixed(2)} km in ${formatTime(seconds)}`)
      } catch (error) {
        toast.error("Failed to save run")
        console.error(error)
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
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 animate-fade-in-up">
      {/* Real map (OpenStreetMap / like Google Maps) */}
      <div className="relative h-[45vh] min-h-[300px] overflow-hidden bg-secondary rounded-b-2xl">
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
          <div className="flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 shadow-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {gpsStatus === "good" ? "GPS active" : gpsStatus === "searching" ? "Searching…" : gpsStatus === "simulated" ? "Simulated" : "Ready"}
            </span>
          </div>
          {typeof window !== "undefined" && !window.isSecureContext && runState !== "idle" && (
            <span className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg">
              Use HTTPS for real GPS
            </span>
          )}
        </div>
        {runState === "idle" && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] animate-scale-in">
            <MapPin className="h-12 w-12 text-primary mb-3 drop-shadow-sm" />
            <p className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              Ready to Run
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center px-4">
              Tap Start — your route will appear on the map
            </p>
            {typeof window !== "undefined" && !window.isSecureContext && (
              <p className="text-[10px] text-chart-4 mt-2 text-center px-4 max-w-[260px]">
                For real GPS, use HTTPS or localhost. Some browsers block location on plain HTTP.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        {[
          { label: "Distance", value: distance.toFixed(2), unit: "km", delay: "animate-stagger-1" },
          { label: "Duration", value: formatTime(seconds), unit: "", delay: "animate-stagger-2" },
          { label: "Pace", value: pace, unit: "min/km", delay: "animate-stagger-3" },
          { label: "Calories", value: String(Math.round(calories)), unit: "kcal", delay: "animate-stagger-4" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center justify-center bg-background p-5 opacity-0 animate-fade-in-up ${stat.delay}`}
          >
            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</span>
            <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums transition-transform duration-200 hover:scale-105" style={{ fontFamily: "var(--font-heading)" }}>
              {stat.value}
            </span>
            {stat.unit && <span className="text-xs text-muted-foreground">{stat.unit}</span>}
          </div>
        ))}
      </div>

      {splits.length > 0 && (
        <section className="mx-4 mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-sm animate-scale-in">
          <button
            onClick={() => setShowSplits((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
          >
            <span className="text-sm font-semibold text-foreground">Splits / Laps</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showSplits ? "rotate-180" : ""}`} />
          </button>
          {showSplits && (
            <div className="border-t border-border px-4 pb-4 pt-2 space-y-2 animate-fade-in-up">
              {splits.map((lap) => (
                <div key={lap.lap} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Km {lap.lap}</span>
                  <span className="font-medium text-foreground">{formatTime(lap.time)}</span>
                  <span className="text-muted-foreground">{lap.pace}/km</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-center gap-6 px-6 py-6 mt-auto">
        {runState === "idle" && (
          <button
            onClick={handleStart}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 animate-scale-in"
            aria-label="Start run"
          >
            <Play className="h-8 w-8 ml-1" fill="currentColor" />
          </button>
        )}
        {runState === "running" && (
          <>
            <button onClick={handleStop} className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-all duration-200 hover:scale-105 active:scale-95" aria-label="Stop run">
              <Square className="h-5 w-5" fill="currentColor" />
            </button>
            <button onClick={handlePause} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 active:scale-95 animate-pulse" aria-label="Pause run">
              <Pause className="h-8 w-8" fill="currentColor" />
            </button>
            <div className="w-14" />
          </>
        )}
        {runState === "paused" && (
          <>
            <button onClick={handleStop} className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-all duration-200 hover:scale-105 active:scale-95" aria-label="Stop run">
              <Square className="h-5 w-5" fill="currentColor" />
            </button>
            <button onClick={handleResume} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 active:scale-95" aria-label="Resume run">
              <Play className="h-8 w-8 ml-1" fill="currentColor" />
            </button>
            <div className="w-14" />
          </>
        )}
      </div>
    </div>
  )
}
