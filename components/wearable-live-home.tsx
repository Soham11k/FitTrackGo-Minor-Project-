"use client"

import { useCallback, useEffect, useState } from "react"
import { Bluetooth, Heart, Droplets, Watch } from "lucide-react"
import { useBleHeartRate } from "@/hooks/use-ble-heart-rate"
import { useChartEnterOnce } from "@/hooks/use-chart-enter-once"
import type { TabId } from "@/components/bottom-nav"
import { RingGauge } from "@/components/ring-gauge"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { computeReadiness } from "@/lib/readiness"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"

type LivePayload = {
  ok?: boolean
  fitbitConfigured?: boolean
  connected?: boolean
  heartBpm?: number | null
  heartAsOf?: string | null
  heartSource?: string | null
  spo2AvgPct?: number | null
  spo2Date?: string | null
  spo2Source?: string | null
  note?: string | null
  error?: string
}

type HistoryRow = {
  metric_date: string
  resting_heart_rate: number | null
  spo2_avg_pct: number | null
  spo2_min_pct: number | null
  spo2_max_pct: number | null
}

const POLL_MS = 8_000
const POLL_BACKOFF_MAX_MS = 60_000
/** Default HR zone bounds when user resting/max is unknown. Fitbit "zone" rings
 *  fill against heart-rate-reserve: (bpm - resting) / (max - resting). */
const HR_RESTING_DEFAULT = 60
const HR_MAX_DEFAULT = 180
const SPO2_RING_MAX = 100

function localDateYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatAsOf(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  } catch {
    return ""
  }
}

function formatHistoryDate(ymd: string): string {
  try {
    const d = new Date(`${ymd}T12:00:00`)
    if (Number.isNaN(d.getTime())) return ymd
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  } catch {
    return ymd
  }
}

function BleHeartRatePanel({
  ble,
  className,
}: {
  ble: ReturnType<typeof useBleHeartRate>
  className?: string
}) {
  const { t } = useLocale()
  if (!ble.supported) return null
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/35 px-3 py-2.5 dark:border-white/10",
        className
      )}
    >
      <p className="text-typo-eyebrow leading-snug text-muted-foreground">
        <Bluetooth className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-primary" aria-hidden />
        {t("wearable.bleIntro")}
      </p>
      {ble.status === "connected" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-foreground">{ble.bpm ?? "—"}</span>
          <span className="text-typo-eyebrow text-muted-foreground">bpm</span>
          {ble.deviceLabel && (
            <span className="max-w-[12rem] truncate text-typo-eyebrow text-muted-foreground">{ble.deviceLabel}</span>
          )}
          <button
            type="button"
            onClick={() => void ble.disconnect()}
            className="ml-auto rounded-lg border border-border px-2 py-1 text-typo-eyebrow font-semibold text-foreground hover:bg-muted"
          >
            {t("wearable.disconnect")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void ble.connect()}
          disabled={ble.status === "connecting"}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary/90 px-3 py-2 text-typo-eyebrow font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
        >
          <Bluetooth className="h-3.5 w-3.5" aria-hidden />
          {ble.status === "connecting" ? t("wearable.pairing") : t("wearable.pairBluetoothHr")}
        </button>
      )}
      {ble.error && <p className="mt-1.5 text-typo-eyebrow text-destructive">{ble.error}</p>}
    </div>
  )
}

export function WearableLiveHome({
  onNavigate,
  paused = false,
  sessionsLast7d = 0,
}: {
  onNavigate: (tab: TabId) => void
  paused?: boolean
  /** Sessions logged in rolling 7d (dash + readiness load). */
  sessionsLast7d?: number
}) {
  const { t } = useLocale()
  const [data, setData] = useState<LivePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<null | "heart" | "spo2">(null)
  const [histRows, setHistRows] = useState<HistoryRow[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const ble = useBleHeartRate()
  const trendChartEnter = useChartEnterOnce()

  const fetchLive = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const r = await fetch(`/api/wearables/live?date=${encodeURIComponent(localDateYmd())}`, {
        credentials: "include",
        signal,
      })
      const j = (await r.json()) as LivePayload
      if (!r.ok) {
        setData({ error: j.error || "Could not load" })
        return false
      }
      setData(j)
      return true
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return false
      setData({ error: "Network error" })
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (paused) return

    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let failures = 0

    const shouldFetch = () =>
      typeof document === "undefined" || document.visibilityState === "visible"

    const run = async () => {
      if (cancelled) return
      if (shouldFetch()) {
        const ok = await fetchLive(controller.signal)
        if (cancelled) return
        failures = ok ? 0 : failures + 1
      }
      if (cancelled) return
      const delay = Math.min(
        POLL_BACKOFF_MAX_MS,
        POLL_MS * Math.pow(2, Math.min(failures, 4))
      )
      timeoutId = setTimeout(run, delay)
    }

    void run()

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        failures = 0
        if (timeoutId) clearTimeout(timeoutId)
        void run()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      controller.abort()
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [paused, fetchLive])

  useEffect(() => {
    if (paused || !data?.connected || data?.error) return
    let cancelled = false
    void fetch(`/api/wearables/history?limit=45`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { rows?: HistoryRow[] }
        if (!cancelled) setHistRows(Array.isArray(j.rows) ? j.rows : [])
      })
      .catch(() => {
        if (!cancelled) setHistRows([])
      })
    return () => {
      cancelled = true
    }
  }, [paused, data?.connected, data?.error])

  useEffect(() => {
    if (!sheet) return
    let cancelled = false
    setHistLoading(true)
    void fetch(`/api/wearables/history?limit=45`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { rows?: HistoryRow[] }
        if (!cancelled) setHistRows(Array.isArray(j.rows) ? j.rows : [])
      })
      .catch(() => {
        if (!cancelled) setHistRows([])
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sheet])

  if (loading && !data) {
    return (
      <section
        className="rounded-3xl border border-border/80 bg-card/50 p-4 space-y-3 backdrop-blur-xl shadow-[var(--shadow-card)] dark:border-white/10"
        aria-busy="true"
        aria-label="Loading vitals"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded-full bg-muted/60" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl border border-border/60 bg-background/40 p-3 dark:border-white/10"
            >
              <div className="mb-1 h-2.5 w-10 animate-pulse rounded-full bg-muted" />
              <div className="relative my-0.5 flex h-[108px] w-[108px] items-center justify-center">
                <div className="absolute inset-1 rounded-full border-[8px] border-muted/50" />
                <div className="h-6 w-10 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="mt-1 h-2 w-12 animate-pulse rounded-full bg-muted/60" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (!data) {
    return null
  }

  // Only hide when server explicitly says Fitbit env is not configured (not when field is missing on error JSON).
  if (data.fitbitConfigured === false) {
    if (!ble.supported) return null
    return (
      <section className="rounded-3xl border border-border/80 bg-card/50 p-4 backdrop-blur-xl shadow-[var(--shadow-card)] animate-fade-in-up animate-stagger-2 dark:border-white/10">
        <h2 className="mb-2 flex items-center gap-2 text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Bluetooth className="h-4 w-4 text-primary" />
          {t("wearable.liveHrBluetooth")}
        </h2>
        <BleHeartRatePanel ble={ble} />
      </section>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-2 animate-fade-in-up animate-stagger-2">
        <section className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
          {t("wearable.errorPrefix")} {data.error}
        </section>
        <BleHeartRatePanel ble={ble} />
      </div>
    )
  }

  if (!data.connected) {
    return (
      <div className="space-y-2 animate-fade-in-up animate-stagger-2">
        <Empty className="w-full rounded-3xl border border-border/80 bg-card/50 px-4 py-8 text-primary shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10">
          <EmptyHeader>
            <EmptyMedia>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/wearables-disconnected.svg"
                alt=""
                className="h-24 w-24 opacity-90"
              />
            </EmptyMedia>
            <EmptyTitle className="text-foreground">{t("wearable.vitalsNeedLink")}</EmptyTitle>
            <EmptyDescription>
              {t("wearable.vitalsNeedLinkDesc")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" className="w-full max-w-xs rounded-2xl" onClick={() => onNavigate("profile")}>
              {t("wearable.goProfile")}
            </Button>
          </EmptyContent>
        </Empty>
        <BleHeartRatePanel ble={ble} />
      </div>
    )
  }

  const heartLabel =
    data.heartSource === "intraday_1min"
      ? t("wearable.label.heartRate")
      : data.heartSource === "resting_daily"
        ? t("wearable.label.restingHrDaily")
        : data.heartSource === "resting_series"
          ? t("wearable.label.restingHrRecent")
          : data.heartSource === "cached"
            ? t("wearable.label.restingHrSynced")
            : t("wearable.label.heartRate")

  const displayHeartBpm = ble.bpm ?? data.heartBpm
  const heartLabelResolved = ble.bpm != null ? t("wearable.liveHrBluetooth") : heartLabel

  // Zone-based fill: % of heart-rate reserve used. 0 at rest, 100 at max.
  const heartZonePct =
    displayHeartBpm != null
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((displayHeartBpm - HR_RESTING_DEFAULT) / (HR_MAX_DEFAULT - HR_RESTING_DEFAULT)) * 100,
            ),
          ),
        )
      : 0
  const spo2RingValue = data.spo2AvgPct != null ? Number(data.spo2AvgPct) : 0

  const heartHistory = histRows.filter((r) => r.resting_heart_rate != null)
  const spo2History = histRows.filter((r) => r.spo2_avg_pct != null)
  const heartTrendPoints = [...heartHistory]
    .slice(0, 14)
    .reverse()
    .map((r) => ({ v: Number(r.resting_heart_rate) }))
    .filter((p) => Number.isFinite(p.v) && p.v > 0)
  const spo2TrendPoints = [...spo2History]
    .slice(0, 14)
    .reverse()
    .map((r) => ({ v: Number(r.spo2_avg_pct) }))
    .filter((p) => Number.isFinite(p.v) && p.v > 0)
  const maxHistHr = Math.max(1, ...heartHistory.map((r) => r.resting_heart_rate ?? 0))
  const maxHistSpo2 = Math.max(1, ...spo2History.map((r) => Number(r.spo2_avg_pct) || 0))

  const restingSeries = [...heartHistory]
    .reverse()
    .map((r) => r.resting_heart_rate!)
    .filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
  const latestResting = heartHistory[0]?.resting_heart_rate ?? null
  const spo2Series = spo2History.map((r) => Number(r.spo2_avg_pct)).filter((n) => Number.isFinite(n) && n > 0)

  const readiness = computeReadiness({
    restingSeries,
    latestResting,
    spo2Series,
    sessionsLast7d,
  })

  return (
    <>
      <section className="rounded-3xl border border-border/80 bg-card/50 p-4 space-y-3 backdrop-blur-xl shadow-[var(--shadow-card)] animate-fade-in-up animate-stagger-2 transition-shadow hover:shadow-md dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Watch className="h-4 w-4 text-primary" />
            {t("wearable.vitalsTitle")}
            <span
              className="relative flex h-2 w-2"
              title="Refreshes about every 8 seconds"
              aria-hidden
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </h2>
          <span className="text-typo-micro font-semibold uppercase tracking-wider text-muted-foreground/80">{t("wearable.tapGraph")}</span>
        </div>

        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card/25 to-card p-4 shadow-sm">
          <p className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-primary">{t("wearable.readiness")}</p>
          <p className="text-typo-micro text-muted-foreground">{t("wearable.readinessDisclaimer")}</p>
          <p
            className="mt-2 text-4xl font-bold tabular-nums text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {readiness.score}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{readiness.hint}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSheet("heart")}
            className={cn(
              "flex flex-col items-center rounded-2xl border border-border/60 bg-background/40 p-3 text-left transition-[transform,box-shadow] active:scale-[0.98]",
              "hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "dark:border-white/10"
            )}
            aria-label={`${heartLabelResolved}, open past history`}
            title={heartLabelResolved}
          >
            <div className="mb-1 flex w-full items-center justify-center gap-1.5 text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">
              <Heart className="h-3.5 w-3.5 text-metric-hr" />
              HR
            </div>
            <RingGauge
              value={heartZonePct}
              max={100}
              size={108}
              thickness={8}
              spring
              progressClassName="stroke-metric-hr"
              className="my-0.5"
            >
              <Heart className="mx-auto h-5 w-5 text-metric-hr/90" strokeWidth={2} />
              <span
                className="mt-0.5 text-xl font-bold tabular-nums leading-none text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {displayHeartBpm != null ? displayHeartBpm : "—"}
              </span>
              {displayHeartBpm != null && (
                <span className="text-typo-micro font-medium text-muted-foreground">bpm</span>
              )}
            </RingGauge>
            {ble.bpm != null && ble.deviceLabel && (
              <p className="mt-1 line-clamp-2 text-center text-typo-eyebrow text-muted-foreground">{ble.deviceLabel}</p>
            )}
            {ble.bpm == null && data.heartAsOf && data.heartSource === "intraday_1min" && (
              <p className="mt-1 text-center text-typo-eyebrow text-muted-foreground">~{formatAsOf(data.heartAsOf)}</p>
            )}
            {ble.bpm == null &&
              data.heartAsOf &&
              (data.heartSource === "resting_daily" ||
                data.heartSource === "resting_series" ||
                data.heartSource === "cached") && (
                <p className="mt-1 text-center text-typo-eyebrow text-muted-foreground">{data.heartAsOf}</p>
              )}
          </button>

          <button
            type="button"
            onClick={() => setSheet("spo2")}
            className={cn(
              "flex flex-col items-center rounded-2xl border border-border/60 bg-background/40 p-3 text-left transition-[transform,box-shadow] active:scale-[0.98]",
              "hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "dark:border-white/10"
            )}
            aria-label="SpO₂, open past history"
            title="Blood oxygen (SpO₂)"
          >
            <div className="mb-1 flex w-full items-center justify-center gap-1.5 text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">
              <Droplets className="h-3.5 w-3.5 text-metric-spo2" />
              O₂
            </div>
            <RingGauge
              value={spo2RingValue}
              max={SPO2_RING_MAX}
              size={108}
              thickness={8}
              spring
              progressClassName="stroke-metric-spo2"
              className="my-0.5"
            >
              <Droplets className="mx-auto h-5 w-5 text-metric-spo2/90" strokeWidth={2} />
              <span
                className="mt-0.5 text-xl font-bold tabular-nums leading-none text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {data.spo2AvgPct != null ? Number(data.spo2AvgPct).toFixed(1) : "—"}
              </span>
              {data.spo2AvgPct != null && (
                <span className="text-typo-micro font-medium text-muted-foreground">%</span>
              )}
            </RingGauge>
            {data.spo2Date && (
              <p className="mt-1 text-center text-typo-eyebrow text-muted-foreground">
                {data.spo2Date}
                {data.spo2Source === "cached" ? " · cached" : ""}
              </p>
            )}
          </button>
        </div>
        {data.connected && data.heartBpm == null && data.spo2AvgPct == null && ble.bpm == null && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center">
            <p className="text-typo-eyebrow leading-snug text-muted-foreground">
              Your watch syncs to Fitbit through the <strong className="text-foreground">Fitbit phone app</strong>. FitTrack
              Go loads summaries from <strong className="text-foreground">Fitbit&apos;s cloud</strong>—not your phone&apos;s
              Bluetooth to the band. Sync in the Fitbit app, wait a minute, then tap{" "}
              <button
                type="button"
                onClick={() => onNavigate("profile")}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Profile → Sync now
              </button>
              . For <strong className="text-foreground">live</strong> HR from this device, use{" "}
              <strong className="text-foreground">Pair Bluetooth HR</strong> below if you have a BLE strap.
            </p>
          </div>
        )}
        <BleHeartRatePanel ble={ble} />
        {data.note && (
          <p className="text-typo-eyebrow leading-snug text-muted-foreground motion-reduce:opacity-100">{data.note}</p>
        )}
      </section>

      <Sheet open={sheet != null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-t border-border">
          <SheetHeader className="border-b border-border/60 pb-3 text-left">
            <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>
              {sheet === "heart" ? "Heart rate" : "SpO₂"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {sheet === "heart"
                ? "Daily resting heart rate from Fitbit sync. Profile sync adds history."
                : "Daily SpO₂ from Fitbit sync. Profile sync adds history."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
            {histLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/80" />
                ))}
              </div>
            ) : sheet === "heart" ? (
              heartHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No synced days yet. Connect sync from Profile.</p>
              ) : (
                <>
                  <MetricTrendMini
                    points={heartTrendPoints}
                    stroke="var(--metric-hr)"
                    stopColor="var(--metric-hr)"
                    isAnimationActive={trendChartEnter}
                  />
                  <ul className="mt-3 flex flex-col gap-2">
                    {heartHistory.map((row) => (
                      <li
                        key={row.metric_date}
                        className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 dark:border-white/10"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">{formatHistoryDate(row.metric_date)}</span>
                          <span className="text-sm font-bold tabular-nums text-metric-hr">{row.resting_heart_rate}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-metric-hr/90 transition-all duration-500"
                            style={{ width: `${Math.min(100, ((row.resting_heart_rate ?? 0) / maxHistHr) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : spo2History.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No synced days yet. Connect sync from Profile.</p>
            ) : (
              <>
                <MetricTrendMini
                  points={spo2TrendPoints}
                  stroke="var(--metric-spo2)"
                  stopColor="var(--metric-spo2)"
                  isAnimationActive={trendChartEnter}
                />
                <ul className="mt-3 flex flex-col gap-2">
                  {spo2History.map((row) => (
                    <li
                      key={row.metric_date}
                      className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 dark:border-white/10"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{formatHistoryDate(row.metric_date)}</span>
                        <span className="text-sm font-bold tabular-nums text-metric-spo2">
                          {row.spo2_avg_pct != null ? Number(row.spo2_avg_pct).toFixed(1) : "—"}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-metric-spo2/90 transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((Number(row.spo2_avg_pct) || 0) / maxHistSpo2) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
