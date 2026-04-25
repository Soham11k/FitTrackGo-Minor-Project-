"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronRight, Target, Zap, Flame, Heart, Award, Sparkles } from "lucide-react"
import type { UserProfile } from "@/lib/store"
import { saveProfile } from "@/lib/store-supabase"
import { toast } from "sonner"

type Level = UserProfile["level"]

const LEVELS: { id: Level; label: string; hint: string; icon: typeof Zap; tintBg: string; tintFg: string }[] = [
  { id: "beginner", label: "Beginner", hint: "Brand new or getting back into it", icon: Sparkles, tintBg: "bg-metric-spo2/15", tintFg: "text-metric-spo2" },
  { id: "intermediate", label: "Intermediate", hint: "Workout a few times per week", icon: Zap, tintBg: "bg-primary/15", tintFg: "text-primary" },
  { id: "advanced", label: "Advanced", hint: "Train consistently, chasing PRs", icon: Flame, tintBg: "bg-metric-streak/15", tintFg: "text-metric-streak" },
]

const GOAL_OPTIONS = [
  "Build strength",
  "Improve cardio",
  "Lose weight",
  "Stay consistent",
  "Run a 5K",
  "Master form",
] as const

export function OnboardingWizard({
  initialName,
  onComplete,
}: {
  initialName?: string
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialName?.trim() ?? "")
  const [level, setLevel] = useState<Level>("beginner")
  const [goals, setGoals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const steps = [
    { key: "welcome", label: "Welcome" },
    { key: "name", label: "Name" },
    { key: "level", label: "Level" },
    { key: "goals", label: "Goals" },
  ] as const
  const progress = ((step + 1) / steps.length) * 100

  function toggleGoal(goal: string) {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]))
  }

  async function finish() {
    setSaving(true)
    try {
      await saveProfile({
        name: name.trim() || "Athlete",
        level,
        goals,
        onboarded: true,
      })
      toast.success("You're all set!")
      onComplete()
    } catch (err) {
      console.error(err)
      toast.error("Couldn't save onboarding. Try again — or skip and set from Profile.")
    } finally {
      setSaving(false)
    }
  }

  async function skip() {
    setSaving(true)
    try {
      await saveProfile({ onboarded: true })
    } catch {}
    setSaving(false)
    onComplete()
  }

  const canAdvance = (() => {
    if (step === 1) return name.trim().length > 0
    return true
  })()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {steps[step].label} · {step + 1}/{steps.length}
              </p>
              <div className="flex items-center gap-1" aria-hidden>
                {steps.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? "w-4 bg-primary"
                        : i < step
                          ? "w-1.5 bg-primary/70"
                          : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          >
            Skip
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-8">
        <div className="mx-auto max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={steps[step].key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {step === 0 && (
                <>
                  <div className="flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30">
                      <Award className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h1
                      className="text-3xl font-bold text-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Welcome!
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Let&apos;s take 30 seconds to personalize your fitness companion.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> Runs, workouts, and AI coach in one place
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> Form scores and progress trends
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> Private — your data stays yours
                    </li>
                  </ul>
                </>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <label htmlFor="onb-name" className="block text-sm font-semibold text-foreground">
                    What should we call you?
                  </label>
                  <input
                    id="onb-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First name"
                    autoFocus
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">You can change this anytime from Profile.</p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    Your current level
                  </h2>
                  <div className="space-y-2">
                    {LEVELS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLevel(l.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                          level === l.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-[var(--shadow-card)]"
                            : "border-border bg-card hover:bg-secondary/40"
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${l.tintBg}`}>
                          <l.icon className={`h-5 w-5 ${l.tintFg}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{l.label}</p>
                          <p className="text-xs text-muted-foreground">{l.hint}</p>
                        </div>
                        {level === l.id && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    What are you working toward?
                  </h2>
                  <p className="text-xs text-muted-foreground">Pick one or more. Skip to decide later.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {GOAL_OPTIONS.map((g) => {
                      const selected = goals.includes(g)
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGoal(g)}
                          className={`rounded-2xl border p-4 text-sm font-medium transition-all active:scale-[0.98] ${
                            selected
                              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/60 shadow-[var(--shadow-card)]"
                              : "border-border bg-card text-foreground hover:bg-secondary/40"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <Target className="h-3.5 w-3.5 opacity-70" />
                              {g}
                            </span>
                            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving}
              className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground disabled:opacity-60"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (step >= steps.length - 1) void finish()
              else setStep((s) => s + 1)
            }}
            disabled={!canAdvance || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 active:scale-[0.98]"
          >
            {step >= steps.length - 1 ? (saving ? "Saving…" : "Let's go") : "Continue"}
            {step < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </div>
  )
}
