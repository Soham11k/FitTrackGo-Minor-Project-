"use client"

import { useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { MapPin, Share2, Clock, Gauge, Flame, Check } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export type RunFinishLap = { lap: number; distance: number; time: number; pace: string }

function formatDur(s: number) {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

function pathToSvgD(path: [number, number][], inset = 8): string {
  if (path.length < 2) return ""
  const lats = path.map((p) => p[0])
  const lons = path.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const dLat = maxLat - minLat || 1e-6
  const dLon = maxLon - minLon || 1e-6
  const vb = 100 - inset * 2
  return path
    .map(([lat, lon], i) => {
      const x = inset + ((lon - minLon) / dLon) * vb
      const y = inset + (1 - (lat - minLat) / dLat) * vb
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join("")
}

export function RunFinishRecap({
  open,
  onOpenChange,
  distanceKm,
  durationSec,
  pacePerKm,
  path,
  splits,
  calories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  distanceKm: number
  durationSec: number
  pacePerKm: string
  path: [number, number][]
  splits: RunFinishLap[]
  calories: number
}) {
  const reduceMotion = useReducedMotion() ?? false
  const d = useMemo(() => pathToSvgD(path), [path])

  async function handleShare() {
    const text = `${distanceKm.toFixed(2)} km · ${formatDur(durationSec)} · ${pacePerKm}/km · FitTrack Go`
    try {
      if (navigator.share) {
        await navigator.share({ title: "My run", text })
        return
      }
    } catch {
      /* dismissed */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied run summary")
    } catch {
      toast.error("Could not share or copy")
    }
  }

  const paceNums = splits.map((s) => {
    const m = /^(\d+):(\d{1,2})$/.exec(s.pace.trim())
    if (!m) return null
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  })
  const validPaces = paceNums.filter((n): n is number => n != null && Number.isFinite(n))
  const peak = validPaces.length ? Math.max(...validPaces) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] rounded-t-3xl overflow-y-auto">
        <SheetHeader className="text-left border-b border-border pb-3">
          <SheetTitle style={{ fontFamily: "var(--font-heading)" }} className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden />
            Run saved
          </SheetTitle>
          <SheetDescription className="sr-only">
            Distance, pace, time, route preview, and split paces from your finished run.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-1 pb-10 pt-2">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-muted/30">
            {d ? (
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                <motion.path
                  d={d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduceMotion ? 0.05 : 0.85, ease: "easeOut" }}
                />
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center text-typo-caption text-muted-foreground px-6 text-center">
                No GPS trail for this run — distance and pace still saved.
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <Gauge className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="text-typo-stat-lg font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {distanceKm.toFixed(2)}
              </div>
              <div className="text-typo-micro font-semibold uppercase tracking-wider text-muted-foreground">km</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="text-typo-stat-lg font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {formatDur(durationSec)}
              </div>
              <div className="text-typo-micro font-semibold uppercase tracking-wider text-muted-foreground">time</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <Flame className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {pacePerKm}
              </div>
              <div className="text-typo-micro font-semibold uppercase tracking-wider text-muted-foreground">/km</div>
              <div className="text-typo-micro text-muted-foreground mt-1">{calories} kcal</div>
            </div>
          </div>

          {splits.length > 0 && (
            <div>
              <p className="mb-2 text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">Split pace</p>
              <div className="flex h-16 items-end gap-1">
                {splits.map((s, i) => {
                  const sec = paceNums[i]
                  const h = sec != null && peak > 0 ? Math.max(12, (sec / peak) * 100) : 40
                  return (
                    <div key={s.lap} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-primary/80 motion-safe:transition-all"
                        style={{ height: `${h}%` }}
                        title={`Km ${s.lap}: ${s.pace}`}
                      />
                      <span className="text-typo-micro font-bold tabular-nums text-muted-foreground">{s.lap}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="btn-lift flex-1 min-w-[9rem]" onClick={() => onOpenChange(false)}>
              <Check className="h-4 w-4" />
              Done
            </Button>
            <Button type="button" variant="outline" className="btn-lift flex-1 min-w-[9rem]" onClick={() => void handleShare()}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
