"use client"

import { useState, useEffect, useCallback } from "react"
import { Trophy, Shield, Swords, Sparkles, Globe, Info, Flame } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getCoachSessions, getProfile } from "@/lib/store-supabase"
import type { CoachRecord } from "@/lib/store"
import {
  effectiveRepCount,
  duelCompositeScore,
  computeVerifiedDayStreak,
  VERIFIED_FORM_MIN,
} from "@/lib/competition"
import { insightsFromRepScores } from "@/lib/movement-insights"
import {
  createDuel,
  joinDuelByCode,
  submitDuelScore,
  listDuels,
  type Duel,
} from "@/lib/duels-local"

export function ArenaHub() {
  const [sessions, setSessions] = useState<CoachRecord[]>([])
  const [name, setName] = useState("You")
  const [duels, setDuels] = useState<Duel[]>([])
  const [code, setCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [pickExercise, setPickExercise] = useState("Squats")

  const reload = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([getCoachSessions(), getProfile()])
      setSessions(c)
      if (p?.name?.trim()) setName(p.name.trim().split(" ")[0] ?? p.name)
    } catch {
      setSessions([])
    }
    setDuels(listDuels())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

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

  function onCreateDuel() {
    const d = createDuel(pickExercise, name)
    setCode(d.code)
    setDuels(listDuels())
  }

  function onJoin() {
    const d = joinDuelByCode(joinCode, name)
    if (d) setDuels(listDuels())
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-28 max-w-lg mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <Trophy className="h-7 w-7 text-primary" />
          Arena
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Form-weighted scoring, verified sessions, local duels, and training insights — built for fair global competition later.
        </p>
      </header>

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
          <div className="rounded-xl bg-metric-coach/10 py-3">
            <div className="text-2xl font-bold tabular-nums text-metric-coach">{verifiedSessions}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Verified
            </div>
          </div>
          <div className="rounded-xl bg-metric-move/10 py-3">
            <div className="text-2xl font-bold tabular-nums text-metric-move">{totalEffective.toFixed(0)}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Eff. reps
            </div>
          </div>
          <div className="rounded-xl bg-metric-streak/10 py-3">
            <div className="text-2xl font-bold tabular-nums text-metric-streak">{Math.max(verifiedStreak, standardStreak)}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Day streak
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
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
          <p className="text-xs text-muted-foreground py-2">Complete a coach session to see rankings here.</p>
        ) : (
          <ul className="space-y-2">
            {bestByExercise.map(([ex, { composite, session }]) => (
              <li key={ex} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{ex}</div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{session.reps}</span> reps · <span className="tabular-nums">{session.score}%</span>
                    {session.verifiedMovement ? <span className="ml-1 text-metric-move">✓</span> : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-metric-coach">{composite.toFixed(1)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">pts</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Swords className="h-4 w-4 text-destructive" />
          Async form duels (device)
        </div>
        <p className="text-xs text-muted-foreground">
          Create a code, share with a friend, both log a coach session and enter composite scores here. Stored on this device until cloud duels ship.
        </p>
        <div className="flex flex-col gap-2">
          <input
            value={pickExercise}
            onChange={(e) => setPickExercise(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Exercise name"
          />
          <button
            type="button"
            onClick={onCreateDuel}
            className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Create duel code
          </button>
          {code && (
            <p className="text-center text-lg font-mono font-bold tracking-widest text-primary py-2">{code}</p>
          )}
          <div className="flex gap-2 pt-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Enter code"
              maxLength={8}
            />
            <button type="button" onClick={onJoin} className="rounded-xl bg-secondary px-4 text-sm font-medium">
              Join
            </button>
          </div>
        </div>
        {duels.length > 0 && (
          <ul className="space-y-2 pt-2 border-t border-border">
            {duels.slice(0, 5).map((d) => (
              <li key={d.id} className="text-[11px] rounded-lg bg-secondary/30 px-2 py-2 space-y-1">
                <div className="font-medium text-foreground">{d.exercise} · {d.code}</div>
                <div className="text-muted-foreground">
                  {d.challengerName}: {d.challengerScore ?? "—"} vs {d.opponentName ?? "?"}: {d.opponentScore ?? "—"}
                </div>
                {!d.settled && d.opponentName && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="text-[10px] underline text-primary"
                      onClick={() => {
                        const s = sessions[0]
                        if (!s) return
                        const sc = duelCompositeScore(s.reps, s.repScores, s.score)
                        submitDuelScore(d.id, "challenger", sc)
                        setDuels(listDuels())
                      }}
                    >
                      Log challenger score (uses latest session)
                    </button>
                  </div>
                )}
                {d.settled && d.challengerScore != null && d.opponentScore != null && (
                  <div className="mt-1 -mx-2 flex items-center gap-2 rounded-lg bg-metric-streak/15 px-3 py-2">
                    <Trophy className="h-5 w-5 shrink-0 text-metric-streak" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-metric-streak">
                        Winner
                      </div>
                      <div className="truncate text-2xl font-bold text-foreground">
                        {d.challengerScore >= d.opponentScore ? d.challengerName : d.opponentName}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4" />
          Movement patterns
        </div>
        <p className="text-[11px] text-muted-foreground">
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
                  i.severity === "watch" ? "bg-amber-500/10 text-amber-200 border border-amber-500/20" : "bg-secondary/50 text-foreground"
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
