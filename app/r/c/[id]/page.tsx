import type { Metadata } from "next"
import Link from "next/link"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { publicSiteOrigin } from "@/lib/site-origin"

type CoachRow = {
  exercise: string
  reps: number
  score: number
  effective_reps: number | null
  verified_movement: boolean | null
  face_verified_session: boolean | null
  completed_at?: string | null
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  const og = `${publicSiteOrigin()}/api/share/coach/${encodeURIComponent(id)}`
  return {
    title: `Coach recap · FitTrack Go`,
    openGraph:
      og && og.startsWith("http")
        ? {
            title: `Coach recap · FitTrack Go`,
            images: [{ url: og, width: 1200, height: 630, alt: "Shared coach session" }],
          }
        : { title: `Coach recap · FitTrack Go` },
    twitter:
      og && og.startsWith("http")
        ? {
            card: "summary_large_image",
            images: [og],
          }
        : undefined,
  }
}

export default async function PublicCoachPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const admin = createServiceRoleClient()
  if (!admin || !id) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070707] px-6 pb-24 pt-14 text-white">
        <p className="max-w-md text-center text-sm text-white/70">Could not load this session.</p>
        <Link href="/" className="mt-6 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">
          Open FitTrack Go
        </Link>
      </main>
    )
  }

  const { data, error } = await admin
    .from("coach_sessions")
    .select("exercise, reps, score, effective_reps, verified_movement, face_verified_session, completed_at")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070707] px-6 pb-24 pt-14 text-white">
        <p className="text-sm text-white/70">Session not found.</p>
        <Link href="/" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          Open FitTrack Go
        </Link>
      </main>
    )
  }

  const row = data as CoachRow
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
          <p className="text-typo-micro font-bold uppercase tracking-[0.28em] text-white/55">COACH SESSION</p>
          <h1 className="text-display-stat-lg text-primary" style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}>
            {row.score}%
          </h1>
          <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-white/55">Form score</p>
          {stamp ? <p className="text-typo-caption text-white/65">{stamp}</p> : null}
        </header>

        <div className="rounded-2xl border border-[color:var(--surface-stage-hairline)] bg-black/35 p-5">
          <p className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            {row.exercise}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-typo-micro font-bold uppercase tracking-wider text-white/50">Reps</p>
              <p className="text-xl font-bold tabular-nums text-white">{row.reps}</p>
            </div>
            <div>
              <p className="text-typo-micro font-bold uppercase tracking-wider text-white/50">Effective</p>
              <p className="text-xl font-bold tabular-nums text-white">{row.effective_reps ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-typo-caption text-white/65">
            {row.verified_movement ? (
              <span className="rounded-full border border-white/25 px-3 py-1">Verified movement</span>
            ) : null}
            {row.face_verified_session ? (
              <span className="rounded-full border border-white/25 px-3 py-1">Face verified</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-lift flex flex-1 items-center justify-center rounded-2xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground"
          >
            View in app
          </Link>
          {publicSiteOrigin() ? (
            <a
              href={`${publicSiteOrigin()}/api/share/coach/${encodeURIComponent(id)}`}
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
