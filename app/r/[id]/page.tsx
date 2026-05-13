import type { Metadata } from "next"
import Link from "next/link"
import { pathToSvgD } from "@/lib/run-path-svg"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { publicSiteOrigin } from "@/lib/site-origin"

type RunRow = {
  distance: number
  duration: number
  pace: string
  calories: number
  completed_at?: string | null
  path: unknown
}

function formatDur(s: number) {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  const two = (x: number) => String(x).padStart(2, "0")
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`
  return `${m}:${two(sec)}`
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  const og = `${publicSiteOrigin()}/api/share/run/${encodeURIComponent(id)}`
  return {
    title: `Run · FitTrack Go`,
    openGraph:
      og && og.startsWith("http")
        ? {
            title: `Run · FitTrack Go`,
            images: [{ url: og, width: 1200, height: 630, alt: "Shared run recap" }],
          }
        : { title: `Run · FitTrack Go` },
    twitter:
      og && og.startsWith("http")
        ? {
            card: "summary_large_image",
            images: [og],
          }
        : undefined,
  }
}

export default async function PublicRunPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  if (process.env.FITTRACK_DISABLE_PUBLIC_RUN_SHARE === "1") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070707] px-6 pb-24 pt-14 text-white">
        <p className="text-sm text-white/70">This shared link is not available.</p>
        <Link href="/" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          Open FitTrack Go
        </Link>
      </main>
    )
  }

  const admin = createServiceRoleClient()
  if (!admin || !id) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070707] px-6 pb-24 pt-14 text-white">
        <p className="max-w-md text-center text-sm text-white/70">Could not load this run (service unavailable).</p>
        <Link href="/" className="mt-6 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">
          Open FitTrack Go
        </Link>
      </main>
    )
  }

  const { data, error } = await admin
    .from("runs")
    .select("distance, duration, pace, calories, path, completed_at")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070707] px-6 pb-24 pt-14 text-white">
        <p className="text-sm text-white/70">Run not found.</p>
        <Link href="/" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          Open FitTrack Go
        </Link>
      </main>
    )
  }

  const row = data as RunRow
  const dist = typeof row.distance === "string" ? parseFloat(row.distance) : Number(row.distance ?? 0)
  const dur = typeof row.duration === "number" ? row.duration : 0
  const pace = typeof row.pace === "string" ? row.pace : "—"
  const cal = typeof row.calories === "number" ? row.calories : 0
  let path: [number, number][] = []
  if (Array.isArray(row.path)) {
    path = row.path
      .map((p) => {
        if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])] as [number, number]
        return null
      })
      .filter((x): x is [number, number] => Boolean(x))
  }

  const d = pathToSvgD(path)
  const stamp = row.completed_at
    ? new Date(row.completed_at).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : ""

  return (
    <main className="min-h-dvh bg-[color:var(--surface-stage)] px-6 pb-safe pt-14 text-[color:var(--surface-stage-fg)]">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header className="space-y-1">
          <p className="text-typo-micro font-bold uppercase tracking-[0.28em] text-white/55">SHARED RUN</p>
          <h1 className="text-display-stat" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
            FitTrack Go
          </h1>
          {stamp ? <p className="text-typo-caption text-white/65">{stamp}</p> : null}
        </header>

        <div className="overflow-hidden rounded-2xl border border-[color:var(--surface-stage-hairline)] bg-black/35">
          {d ? (
            <svg viewBox="0 0 100 100" className="aspect-[16/10] w-full" aria-hidden>
              <path
                d={d}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center px-6 text-center text-typo-caption text-white/55">
              No GPS trail for this run
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--surface-stage-hairline)] pt-6">
          <div className="text-center">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-white/55">Distance</p>
            <p className="mt-1 text-display-stat text-white" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
              {Number.isFinite(dist) ? dist.toFixed(2) : "—"}
            </p>
            <p className="text-typo-micro font-bold uppercase tracking-wider text-white/45">km</p>
          </div>
          <div className="text-center">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-white/55">Time</p>
            <p className="mt-1 text-display-stat text-white" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
              {formatDur(dur)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-white/55">Pace</p>
            <p className="mt-1 text-display-stat text-white" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
              {pace}
            </p>
            <p className="text-typo-micro font-bold uppercase tracking-wider text-white/45">/km</p>
          </div>
        </div>

        <p className="text-center text-sm text-white/65">
          Energy <span className="font-semibold tabular-nums text-white">{Math.round(cal)}</span> kcal
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-lift flex flex-1 items-center justify-center rounded-2xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground"
          >
            View in app
          </Link>
          {publicSiteOrigin() ? (
            <a
              href={`${publicSiteOrigin()}/api/share/run/${encodeURIComponent(id)}`}
              className="btn-lift flex flex-1 items-center justify-center rounded-2xl border border-white/25 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
              target="_blank"
              rel="noreferrer noopener"
            >
              Preview image
            </a>
          ) : null}
        </div>
      </div>
    </main>
  )
}
