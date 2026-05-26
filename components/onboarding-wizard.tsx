"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronRight, Lock, Target, Zap, Flame, Heart, Award, Sparkles } from "lucide-react"
import type { UserProfile } from "@/lib/store"
import { saveProfile } from "@/lib/store-supabase"
import { toast } from "sonner"
import { StatDisplay } from "@/components/ui/stat-display"
import { CINEMATIC } from "@/lib/motion"
import { coachClipsCloudFeatureFlag } from "@/lib/coach-replay/prefs"
import { isClipEncryptionEnabledEnv } from "@/lib/encryption/env"
import { PassphraseSetupDialog } from "@/components/encryption/passphrase-setup"
import { Button } from "@/components/ui/button"

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
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg")
  const [bodyWeightStr, setBodyWeightStr] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [clipPassphraseOpen, setClipPassphraseOpen] = useState(false)

  const showClipProtect = coachClipsCloudFeatureFlag() && isClipEncryptionEnabledEnv()
  const steps = useMemo(
    () =>
      showClipProtect
        ? [
            { key: "welcome", label: "Welcome" },
            { key: "name", label: "Name" },
            { key: "level", label: "Level" },
            { key: "goals", label: "Goals" },
            { key: "weight", label: "Weight" },
            { key: "clip", label: "Clip privacy" },
          ]
        : [
            { key: "welcome", label: "Welcome" },
            { key: "name", label: "Name" },
            { key: "level", label: "Level" },
            { key: "goals", label: "Goals" },
            { key: "weight", label: "Weight" },
          ],
    [showClipProtect],
  )
  const progress = ((step + 1) / steps.length) * 100

  function toggleGoal(goal: string) {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]))
  }

  async function finish() {
    setSaving(true)
    try {
      const num = Number.parseFloat(bodyWeightStr)
      const validNum = Number.isFinite(num) && num > 0
      const bodyWeightKg = validNum ? (weightUnit === "lb" ? num * 0.45359237 : num) : undefined
      await saveProfile({
        name: name.trim() || "Athlete",
        level,
        goals,
        onboarded: true,
        bodyWeightKg,
        weightUnit,
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
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-typo-eyebrow font-bold uppercase tracking-[0.28em] text-foreground truncate">
                {steps[step]?.label ?? ""} · {step + 1}/{steps.length}
              </p>
            </div>
            <div className="relative mt-2 h-[3px] w-full overflow-hidden bg-foreground/10">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          >
            Skip
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-8">
        <div className="mx-auto max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${steps[step]!.key}-${step}`}
              variants={CINEMATIC.heroEnter}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="space-y-6"
            >
              {step === 0 && (
                <div className="space-y-6 rounded-lg border border-border bg-[color:var(--surface-stage)] px-5 py-8 text-[color:var(--surface-stage-fg)]">
                  <div className="flex justify-center" aria-hidden>
                    <Image src="/illustrations/onboarding-welcome.svg" alt="" width={96} height={96} className="h-24 w-24 opacity-95" />
                  </div>
                  <StatDisplay
                    tone="stage"
                    size="lg"
                    eyebrow="Welcome"
                    value="Train with proof"
                    secondary="Thirty seconds to tune FitTrack Go around your goals — runs, form checks, and fair Arena duels."
                  />
                  <ul className="space-y-2 text-sm text-[color:oklch(0.92_0_0/0.7)]">
                    <li className="flex items-center gap-2">
                      <Award className="h-4 w-4 shrink-0 text-primary" /> Camera form checks on your device — pose never uploaded as video
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> Arena duels use the same rep-level scores as Coach Assist
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> GPS runs, library workouts, and optional wearables in one flow
                    </li>
                  </ul>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.3em] text-muted-foreground">Step 1</p>
                  <label
                    htmlFor="onb-name"
                    className="block text-3xl font-bold uppercase leading-tight text-foreground"
                    style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
                  >
                    What should we call you?
                  </label>
                  <input
                    id="onb-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="FIRST NAME"
                    autoFocus
                    className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus:border-primary"
                  />
                  <p className="text-typo-caption text-muted-foreground">You can change this anytime from Profile.</p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.3em] text-muted-foreground">Step 2</p>
                  <h2 className="text-3xl font-bold uppercase leading-tight text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>
                    Your current level
                  </h2>
                  <div className="space-y-2">
                    {LEVELS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        aria-label={`Select fitness level ${l.label}`}
                        onClick={() => setLevel(l.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          level === l.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-secondary/40"
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
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.3em] text-muted-foreground">Step 3</p>
                  <h2 className="text-3xl font-bold uppercase leading-tight text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>
                    What are you working toward?
                  </h2>
                  <p className="text-typo-caption text-muted-foreground">Pick one or more. Skip to decide later.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {GOAL_OPTIONS.map((g) => {
                      const selected = goals.includes(g)
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-label={`Toggle goal ${g}`}
                          onClick={() => toggleGoal(g)}
                          className={`rounded-lg border p-4 text-sm font-bold uppercase tracking-wide transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:bg-secondary/40"
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

              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.3em] text-muted-foreground">Step 4</p>
                  <h2 className="text-3xl font-bold uppercase leading-tight text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>
                    Your weight
                  </h2>
                  <p className="text-typo-caption text-muted-foreground">
                    Optional. Used to make load-aware form scoring smarter (e.g. relax squat depth when you go heavy).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      placeholder={weightUnit === "kg" ? "e.g. 72" : "e.g. 158"}
                      value={bodyWeightStr}
                      onChange={(e) => setBodyWeightStr(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="flex-1 rounded-lg border border-border bg-transparent px-4 py-3 text-base font-semibold text-foreground placeholder:text-muted-foreground/60 placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <div className="flex rounded-lg border border-border bg-background p-1 text-xs font-bold">
                      {(["kg", "lb"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setWeightUnit(u)}
                          className={`rounded-sm px-3 py-2 uppercase tracking-[0.18em] ${weightUnit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        >
                          {u.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBodyWeightStr("")
                      if (showClipProtect) setStep(5)
                      else void finish()
                    }}
                    className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                  >
                    Skip for now →
                  </button>
                </div>
              )}

              {step === 5 && showClipProtect && (
                <div className="space-y-4">
                  <p className="text-typo-eyebrow font-bold uppercase tracking-[0.3em] text-muted-foreground">
                    Protect synced data
                  </p>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/25 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
                      <Lock className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="text-base font-semibold text-foreground">Optional passphrase backup</p>
                      <p>
                        Clips and synced profile/run data use a key on this device. Add a passphrase backup to unlock them on
                        another browser. You can skip and add this anytime from Profile.
                      </p>
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setClipPassphraseOpen(true)}>
                        Back up encryption key
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <PassphraseSetupDialog open={clipPassphraseOpen} onOpenChange={setClipPassphraseOpen} />

      <footer className="border-t border-border px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving}
              className="rounded-lg border border-border bg-transparent px-4 py-3 text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {step >= steps.length - 1 ? (saving ? "Saving…" : "Let's go") : "Continue"}
            {step < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </div>
  )
}
