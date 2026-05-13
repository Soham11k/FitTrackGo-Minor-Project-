"use client"

import { useState, useEffect, useCallback, useRef, useId } from "react"
import Image from "next/image"
import type { AuthChangeEvent } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Trophy, Shield, Swords, Sparkles, Globe, Info, Flame } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { getCoachSessions, getProfile } from "@/lib/store-supabase"
import type { CoachRecord } from "@/lib/store"
import {
  effectiveRepCount,
  duelCompositeScore,
  computeVerifiedDayStreak,
  VERIFIED_FORM_MIN,
} from "@/lib/competition"
import { insightsFromRepScores } from "@/lib/movement-insights"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  arenaDuelsForceLocalOnly,
  createFormDuelRemote,
  isArenaCloudBackendUnavailableError,
  joinFormDuelRemote,
  listFormDuelsRemote,
  submitFormDuelScoreRemote,
  resolveDuelToastMessage,
} from "@/lib/duels-supabase"
import type { TabId } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { PbSticker } from "@/components/ui/pb-sticker"
import { StatDisplay } from "@/components/ui/stat-display"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  createDuel,
  joinDuelByCode,
  submitDuelScore,
  listDuels,
  type Duel,
} from "@/lib/duels-local"

function latestCoachSessionForExercise(
  sessions: CoachRecord[],
  exercise: string
): CoachRecord | null {
  const t = exercise.trim().toLowerCase()
  for (const s of sessions) {
    if (s.exercise.trim().toLowerCase() === t) return s
  }
  return sessions[0] ?? null
}

function toastDuelFailure(e: unknown) {
  toast.error(resolveDuelToastMessage(e))
}

export function ArenaHub({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const [sessions, setSessions] = useState<CoachRecord[]>([])
  const [name, setName] = useState("You")
  const [userId, setUserId] = useState<string | null>(null)
  const [arenaCloudBlocked, setArenaCloudBlocked] = useState(false)
  const [duels, setDuels] = useState<Duel[]>([])
  const [code, setCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [pickExercise, setPickExercise] = useState("Squats")
  const duelExerciseInputId = useId()
  const duelJoinInputId = useId()
  const deviceOnlyExplainedRef = useRef(false)

  const useCloudDuels =
    userId !== null &&
    isSupabaseConfigured() &&
    !arenaCloudBlocked &&
    !arenaDuelsForceLocalOnly()

  const reload = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([getCoachSessions(), getProfile()])
      setSessions(c)
      if (p?.name?.trim()) setName(p.name.trim().split(" ")[0] ?? p.name)
    } catch {
      setSessions([])
    }

    if (!isSupabaseConfigured()) {
      setUserId(null)
      setDuels(listDuels())
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const tryCloud =
      !!user && !arenaDuelsForceLocalOnly() && !arenaCloudBlocked

    if (tryCloud) {
      try {
        setDuels(await listFormDuelsRemote())
      } catch (e) {
        if (isArenaCloudBackendUnavailableError(e)) {
          setArenaCloudBlocked(true)
          setDuels(listDuels())
          if (!deviceOnlyExplainedRef.current) {
            deviceOnlyExplainedRef.current = true
            toast.message(
              "Arena is using device-only duels. Your Supabase project can’t run cloud duels right now (paused, billing, or missing migration). Add NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1 to .env.local to always skip the server."
            )
          }
        } else {
          setDuels([])
        }
      }
    } else {
      setDuels(listDuels())
    }
  }, [arenaCloudBlocked])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") {
        setArenaCloudBlocked(false)
        deviceOnlyExplainedRef.current = false
      }
      void reload()
    })
    return () => subscription.unsubscribe()
  }, [reload])

  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      !userId ||
      arenaCloudBlocked ||
      arenaDuelsForceLocalOnly()
    )
      return
    const supabase = createClient()
    const channel = supabase
      .channel(`form_duels:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "form_duels" },
        () => {
          void listFormDuelsRemote()
            .then(setDuels)
            .catch(() => {})
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, arenaCloudBlocked])

  const totalEffective = sessions.reduce(
    (a, s) => a + (s.effectiveReps ?? effectiveRepCount(s.reps, s.repScores, s.score)),
    0
  )
  const verifiedSessions = sessions.filter((s) => s.verifiedMovement).length
  const verifiedStreak = computeVerifiedDayStreak(
    sessions.map((s) => ({ completedAt: s.completedAt, faceVerifiedSession: s.faceVerifiedSession })),
    true
  )
  const standardStreak = computeVerifiedDayStreak(
    sessions.map((s) => ({ completedAt: s.completedAt, faceVerifiedSession: s.faceVerifiedSession })),
    false
  )

  const last = sessions[0]
  const movementInsights = last ? insightsFromRepScores(last.repScores, last.exercise) : []

  const bestByExercise = (() => {
    const m = new Map<string, { composite: number; session: CoachRecord }>()
    for (const s of sessions) {
      const comp = duelCompositeScore(s.reps, s.repScores, s.score)
      const prev = m.get(s.exercise)
      if (!prev || comp > prev.composite) m.set(s.exercise, { composite: comp, session: s })
    }
    return [...m.entries()].sort((a, b) => b[1].composite - a[1].composite).slice(0, 6)
  })()

  async function onCreateDuel() {
    try {
      if (useCloudDuels) {
        try {
          const d = await createFormDuelRemote(pickExercise, name)
          setCode(d.code)
          setDuels(await listFormDuelsRemote())
          toast.success("Duel created — share the code.")
        } catch (e) {
          if (isArenaCloudBackendUnavailableError(e)) {
            setArenaCloudBlocked(true)
            const d = createDuel(pickExercise, name)
            setCode(d.code)
            setDuels(listDuels())
            if (!deviceOnlyExplainedRef.current) {
              deviceOnlyExplainedRef.current = true
              toast.message(
                "Switched to device-only duels. Cloud isn’t available on your Supabase project right now."
              )
            }
          } else {
            throw e
          }
        }
      } else {
        const d = createDuel(pickExercise, name)
        setCode(d.code)
        setDuels(listDuels())
        if (!isSupabaseConfigured()) {
          toast.message("Saved on this device only — add Supabase for cloud duels.")
        } else if (!userId) {
          toast.message("Sign in to challenge friends on another device (when cloud duels work).")
        }
      }
    } catch (e) {
      toastDuelFailure(e)
    }
  }

  async function onJoin() {
    if (!joinCode.trim()) {
      toast.error("Enter a duel code.")
      return
    }
    try {
      if (useCloudDuels) {
        try {
          await joinFormDuelRemote(joinCode, name)
          setDuels(await listFormDuelsRemote())
          toast.success("Joined duel.")
          setJoinCode("")
        } catch (e) {
          if (isArenaCloudBackendUnavailableError(e)) {
            setArenaCloudBlocked(true)
            setDuels(listDuels())
            const d = joinDuelByCode(joinCode, name)
            if (d) {
              setDuels(listDuels())
              toast.success("Joined on this device.")
              setJoinCode("")
            } else if (!deviceOnlyExplainedRef.current) {
              deviceOnlyExplainedRef.current = true
              toast.message("Cloud unavailable — only duels created on this device can be joined here.")
            } else {
              toast.error("No matching open duel on this device.")
            }
          } else {
            throw e
          }
        }
      } else {
        const d = joinDuelByCode(joinCode, name)
        if (d) {
          setDuels(listDuels())
          toast.success("Matched on this device.")
          setJoinCode("")
        } else {
          toast.error(
            isSupabaseConfigured()
              ? "No matching open duel on this device — sign in to join friends online."
              : "No matching open duel on this device."
          )
        }
      }
    } catch (e) {
      toastDuelFailure(e)
    }
  }

  async function applyScoreFromLatestSession(d: Duel, role: "challenger" | "opponent") {
    const s = latestCoachSessionForExercise(sessions, d.exercise)
    if (!s) {
      toast.error("Complete a coach session for this exercise first.")
      return
    }
    const sc = duelCompositeScore(s.reps, s.repScores, s.score)
    try {
      if (useCloudDuels) {
        await submitFormDuelScoreRemote(d.id, sc)
        setDuels(await listFormDuelsRemote())
      } else {
        submitDuelScore(d.id, role, sc)
        setDuels(listDuels())
      }
      toast.success("Score logged.")
    } catch (e) {
      if (useCloudDuels && isArenaCloudBackendUnavailableError(e)) {
        setArenaCloudBlocked(true)
        setDuels(listDuels())
        toast.message(
          "Cloud unavailable — start a new device-only duel to log scores locally."
        )
      } else {
        toastDuelFailure(e)
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-28 max-w-lg mx-auto">
      <CinematicStage
        vignette
        className="rounded-2xl border border-border p-5 shadow-[var(--shadow-card)] text-[color:var(--surface-stage-fg)]"
      >
        <p className="text-eyebrow-mega text-[color:oklch(0.92_0_0/0.5)]">Arena</p>
        <StatDisplay
          tone="stage"
          size="lg"
          eyebrow="Compete fairly"
          value="Form duels"
          secondary="Form-weighted scoring and verified sessions — challenge friends with the same composite metric you earn in Coach Assist."
          icon={<Trophy className="h-8 w-8 text-[color:var(--primary)]" />}
          className="mt-3 text-start"
          contentClassName="justify-start"
        />
      </CinematicStage>

      <section
        className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground leading-relaxed volt-edge"
        aria-label="Why Arena is different"
      >
        <p className="font-semibold text-foreground">Hero duels</p>
        <p className="mt-1">
          Create a code, both players log a coach session for that lift, then submit scores here. Numbers come from on-device pose —
          not manually typed PRs — so wins match the rep quality you saw in session.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-metric-coach" />
            Verified movement
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                aria-label="About verified movement"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>About verified movement</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
                <p>
                  A session earns <strong className="text-foreground">Verified movement</strong> when rep-level scores stay high (typically ≥{VERIFIED_FORM_MIN}%).
                  Use this tier for integrity-friendly leaderboards.
                </p>
                <p>
                  <strong className="text-foreground">Face-verified</strong> means you were enrolled and identity-matched on counted reps — great for proof-of-you challenges.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-metric-coach/10 py-3 px-1">
            <StatDisplay eyebrow="Verified" value={verifiedSessions} valueClassName="text-metric-coach tabular-nums" size="md" />
          </div>
          <div className="rounded-xl bg-metric-move/10 py-3 px-1">
            <StatDisplay
              eyebrow="Eff. reps"
              value={totalEffective.toFixed(0)}
              valueClassName="text-metric-move tabular-nums"
              size="md"
            />
          </div>
          <div className="rounded-xl bg-metric-streak/10 py-3 px-1">
            <StatDisplay
              eyebrow="Day streak"
              value={Math.max(verifiedStreak, standardStreak)}
              valueClassName="text-metric-streak tabular-nums"
              size="md"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-typo-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-metric-spo2" /> Face days: <span className="tabular-nums font-semibold text-foreground">{verifiedStreak}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-metric-streak" /> Coach days: <span className="tabular-nums font-semibold text-foreground">{standardStreak}</span>
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Globe className="h-4 w-4 text-chart-4" />
          Your leaderboard (local)
        </div>
        <p className="text-xs text-muted-foreground">
          Personal bests by composite score (reps × form × consistency). Sync to global ranks when you connect a season.
        </p>
        {bestByExercise.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border/70 bg-muted/15 py-8 text-chart-4">
            <EmptyHeader className="max-w-md">
              <EmptyMedia>
                <Image
                  src="/illustrations/arena-empty.svg"
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 opacity-90"
                />
              </EmptyMedia>
              <EmptyTitle className="text-foreground">Leaderboard unlocks after Coach</EmptyTitle>
              <EmptyDescription>
                Finish at least one verified Coach Assist set — we rank your composite score (reps × form × consistency) per exercise.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-none flex-row justify-center pt-1">
              {onNavigate ? (
                <Button type="button" className="rounded-full" onClick={() => onNavigate("ai-coach")}>
                  Open Coach Assist
                </Button>
              ) : (
                <p className="text-typo-caption text-muted-foreground">Switch to Coach to log your first session.</p>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {bestByExercise.map(([ex, { composite, session }]) => (
              <li key={ex} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{ex}</div>
                  <div className="text-typo-caption text-muted-foreground">
                    <span className="tabular-nums">{session.reps}</span> reps · <span className="tabular-nums">{session.score}%</span>
                    {session.verifiedMovement ? <span className="ml-1 text-metric-move">✓</span> : null}
                  </div>
                </div>
                <div className="text-right">
                  <StatDisplay
                    className="text-end"
                    contentClassName="justify-end"
                    value={composite.toFixed(1)}
                    unit="pts"
                    valueClassName="text-metric-coach tabular-nums"
                    size="md"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Swords className="h-4 w-4 text-destructive" />
          Async form duels {useCloudDuels ? "(cloud)" : "(this device)"}
        </div>
        <p className="text-xs text-muted-foreground rounded-lg bg-metric-coach/10 border border-metric-coach/20 px-3 py-2">
          <span className="font-semibold text-foreground">Same language as Coach: </span>
          duel points use rep-level form scores and consistency — the data behind your live breakdown chips and post-set recap.
        </p>
        <p className="text-xs text-muted-foreground">
          {useCloudDuels
            ? "Create a code and share it — a signed-in friend enters it on their phone to join. Scores sync when you log them (live updates if Realtime is enabled on your project)."
            : userId && (arenaCloudBlocked || arenaDuelsForceLocalOnly())
              ? "Cloud duels are off — codes and scores stay on this browser only (e.g. project paused, no credits, or NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1). Cross-device needs an active Supabase project with the form_duels migration."
              : "Create a code for practice on this device, or sign in when your Supabase project can host cloud duels."}
        </p>
        <div className="flex flex-col gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={duelExerciseInputId}>Exercise name</Label>
            <input
              id={duelExerciseInputId}
              value={pickExercise}
              onChange={(e) => setPickExercise(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Squats"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={() => void onCreateDuel()}
            className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create duel code
          </button>
          {code && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 py-3 text-center text-2xl font-mono font-bold tracking-[0.3em] text-primary">{code}</p>
          )}
          <div className="flex gap-2 items-end pt-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={duelJoinInputId}>Duel code</Label>
              <input
                id={duelJoinInputId}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                placeholder="Enter code"
                maxLength={8}
                autoComplete="off"
              />
            </div>
            <button type="button" onClick={() => void onJoin()} className="shrink-0 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Join
            </button>
          </div>
        </div>
        {duels.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border/70 bg-muted/15 py-6">
            <EmptyHeader className="max-w-md">
              <EmptyMedia>
                <Image src="/illustrations/arena-duel-empty.svg" alt="" width={80} height={80} className="h-20 w-20 opacity-90" />
              </EmptyMedia>
              <EmptyTitle className="text-foreground">No active duels yet</EmptyTitle>
              <EmptyDescription>
                Create a code and share it — or join a friend with their duel code. Same scoring as Coach Assist.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-2 pt-2 border-t border-border">
            {duels.slice(0, 5).map((d) => {
              const showChallenger =
                !useCloudDuels ||
                (d.challengerUserId != null && userId === d.challengerUserId)
              const showOpponent =
                !useCloudDuels ||
                (d.opponentUserId != null && userId === d.opponentUserId)
              const showScoreActions =
                !d.settled && d.opponentName && (showChallenger || showOpponent)

              return (
                <li key={d.id} className="text-typo-caption space-y-2 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
                  <div className="font-medium text-foreground">{d.exercise} · {d.code}</div>
                  <div className="text-muted-foreground">
                    {d.challengerName}: {d.challengerScore ?? "—"} vs {d.opponentName ?? "?"}: {d.opponentScore ?? "—"}
                  </div>
                  {showScoreActions && (
                    <div className="flex flex-col gap-1 pt-1">
                      {showChallenger && (
                        <button
                          type="button"
                          className="text-left text-typo-eyebrow underline text-primary"
                          onClick={() => void applyScoreFromLatestSession(d, "challenger")}
                        >
                          Log your score (challenger) — uses latest session for {d.exercise}
                        </button>
                      )}
                      {showOpponent && (
                        <button
                          type="button"
                          className="text-left text-typo-eyebrow underline text-primary"
                          onClick={() => void applyScoreFromLatestSession(d, "opponent")}
                        >
                          Log your score (opponent) — uses latest session for {d.exercise}
                        </button>
                      )}
                    </div>
                  )}
                  {d.settled && d.challengerScore != null && d.opponentScore != null && (
                    <>
                      <div className="relative mt-1 -mx-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                        <Trophy className="h-5 w-5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <StatDisplay
                            className="text-start"
                            contentClassName="justify-start flex-nowrap gap-2"
                            eyebrow="Winner"
                            eyebrowClassName="text-metric-streak tracking-[0.14em]"
                            size="lg"
                            value={
                              (d.challengerScore ?? 0) >= (d.opponentScore ?? 0)
                                ? d.challengerName
                                : d.opponentName ?? "Opponent"
                            }
                            valueClassName="truncate text-foreground"
                          />
                          {(() => {
                            const winSession = latestCoachSessionForExercise(sessions, d.exercise)
                            return winSession && (winSession.score ?? 0) >= VERIFIED_FORM_MIN ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <PbSticker variant="pb-form-score" className="rotate-0 text-typo-micro" />
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                      {(() => {
                        const s = latestCoachSessionForExercise(sessions, d.exercise)
                        if (!s) return null
                        const insightRows = insightsFromRepScores(s.repScores, s.exercise)
                        return (
                          <div className="mt-2 space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.15em] text-primary">
                              Duel recap · your coach data
                            </p>
                            <p className="text-typo-caption text-foreground">
                              Latest <strong>{d.exercise}</strong> session:{" "}
                              <span className="tabular-nums">{s.reps}</span> reps ·{" "}
                              <span className="tabular-nums">{s.score}%</span> form
                              {s.verifiedMovement ? " · verified movement" : ""}
                              {s.faceVerifiedSession ? " · face verified" : ""}
                            </p>
                            <p className="text-typo-eyebrow text-muted-foreground">
                              Patterns below use the same rep-level scores as live Coach breakdown (not a medical read).
                            </p>
                            {insightRows.length > 0 ? (
                              <ul className="space-y-1.5">
                                {insightRows.map((row) => (
                                  <li key={row.id} className="text-typo-caption text-foreground">
                                    <span className="font-semibold">{row.title}:</span> {row.detail}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-typo-eyebrow text-muted-foreground">
                                Add a few more reps in Coach to unlock fatigue and consistency hints here.
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4" />
          Movement patterns
        </div>
        <p className="text-typo-caption text-muted-foreground">
          Educational summaries from rep scores — not a medical assessment. Ask a professional about pain or injury.
        </p>
        {movementInsights.length === 0 ? (
          <p className="text-xs text-muted-foreground">No patterns detected for your last session (need a few reps).</p>
        ) : (
          <ul className="space-y-2">
            {movementInsights.map((i) => (
              <li
                key={i.id}
                className={`text-xs rounded-lg px-3 py-2 ${
                  i.severity === "watch"
                    ? "bg-amber-500/10 text-amber-900 dark:text-amber-50 border border-amber-500/25"
                    : "bg-secondary/50 text-foreground"
                }`}
              >
                <strong className="block">{i.title}</strong>
                {i.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
