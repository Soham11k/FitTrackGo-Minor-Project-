"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  ChevronLeft,
  Flame,
  Lock,
  Minus,
  Square,
} from "lucide-react"
import { CHROME } from "@/lib/app-chrome"
import { ChromeHeader } from "@/components/chrome/ChromeHeader"
import { EcgMark } from "@/components/chrome/EcgMark"
import type { CoachFamilyCategory } from "@/lib/coach-exercise-catalog"
import { formatLoad, lbToKg, snapLoad } from "@/lib/weight/units"
import type { WeightUnit } from "@/lib/weight/units"

/** Premium coach form screens — red accent on pure black (matches product mock). */
export const COACH_FORM = {
  accent: "#ff3b30",
  accentDim: "rgba(255,59,48,0.14)",
  accentBorder: "rgba(255,59,48,0.35)",
  card: "#171717",
  cardBorder: "rgba(255,255,255,0.08)",
  muted: "#8e8e93",
  green: "#34c759",
} as const

function categoryTag(cat: CoachFamilyCategory): string {
  const map: Record<CoachFamilyCategory, string> = {
    upper: "UPPER",
    lower: "LOWER",
    core: "CORE",
    cardio: "CARDIO",
    compound: "COMPOUND",
  }
  return map[cat]
}

function SquareMark({ color = COACH_FORM.accent }: { color?: string }) {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
      style={{ borderColor: color, backgroundColor: `${color}22` }}
      aria-hidden
    >
      <Square className="h-2 w-2" style={{ color, fill: `${color}55` }} />
    </span>
  )
}

export function CoachFormHeader({ streakDays }: { streakDays: number }) {
  return (
    <ChromeHeader
      right={
        streakDays > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white"
            style={{ backgroundColor: COACH_FORM.accent }}
          >
            <Flame className="h-3 w-3" aria-hidden />
            {streakDays} day streak
          </span>
        ) : null
      }
    />
  )
}

export function CoachHeroTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="px-4 pb-4 pt-3">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em]"
        style={{ color: COACH_FORM.accent }}
      >
        {eyebrow}
      </p>
      <h1
        className="mt-1 text-[2rem] font-black uppercase leading-[0.95] text-white"
        style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: COACH_FORM.muted }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

export function CoachPrivacyBanner({ text }: { text: string }) {
  return (
    <div
      className="mx-4 mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
      style={{ backgroundColor: COACH_FORM.card, borderColor: COACH_FORM.cardBorder }}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: COACH_FORM.muted }} aria-hidden />
      <p className="text-[11px] leading-snug" style={{ color: COACH_FORM.muted }}>
        {text}
      </p>
    </div>
  )
}

export function CoachTrackTabs({
  track,
  onTrack,
}: {
  track: "strength" | "mobility"
  onTrack: (t: "strength" | "mobility") => void
}) {
  return (
    <div className="mx-4 mb-4 flex gap-6 border-b" style={{ borderColor: COACH_FORM.cardBorder }}>
      {(["strength", "mobility"] as const).map((id) => {
        const active = track === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTrack(id)}
            className="relative pb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors"
            style={{ color: active ? CHROME.white : COACH_FORM.muted }}
          >
            {id}
            {active ? (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                style={{ backgroundColor: COACH_FORM.accent }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function CoachSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.28em]"
      style={{ color: COACH_FORM.accent }}
    >
      {children}
    </p>
  )
}

export function CoachMovementRow({
  index,
  title,
  subtitle,
  category,
  onClick,
  delay = 0,
}: {
  index: number
  title: string
  subtitle: string
  category: CoachFamilyCategory
  onClick: () => void
  delay?: number
}) {
  const reduce = useReducedMotion() ?? false
  const num = String(index + 1).padStart(2, "0")

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left"
      style={{ backgroundColor: COACH_FORM.card, borderColor: COACH_FORM.cardBorder }}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={reduce ? undefined : { scale: 0.99 }}
    >
      <span
        className="w-8 shrink-0 text-xl font-black tabular-nums leading-none"
        style={{ color: "rgba(255,255,255,0.14)", fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
      >
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: COACH_FORM.muted }}>
          {subtitle}
        </p>
        <span
          className="mt-2 inline-block rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-[0.12em]"
          style={{ color: COACH_FORM.accent, borderColor: COACH_FORM.accentBorder, backgroundColor: COACH_FORM.accentDim }}
        >
          {categoryTag(category)}
        </span>
      </div>
      <SquareMark />
    </motion.button>
  )
}

export function CoachBackButton({ label = "Back", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-4 mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={{ color: COACH_FORM.muted }}
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      <SquareMark color={COACH_FORM.muted} />
      {label}
    </button>
  )
}

export function CoachDarkPanel({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${className}`}
      style={{ backgroundColor: COACH_FORM.card, borderColor: COACH_FORM.cardBorder }}
    >
      {children}
    </div>
  )
}

export function CoachTipBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
      style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: "rgba(255,255,255,0.03)" }}
    >
      <SquareMark color={COACH_FORM.muted} />
      <p className="text-[11px] leading-snug" style={{ color: COACH_FORM.muted }}>
        {children}
      </p>
    </div>
  )
}

export function CoachSetLoadRow({
  unit,
  valueKg,
  onChange,
}: {
  unit: WeightUnit
  valueKg: number | undefined
  onChange: (kg: number | undefined) => void
}) {
  const stepKg = unit === "lb" ? lbToKg(5) : 2.5
  const display = valueKg !== undefined ? formatLoad(valueKg, unit, { precision: 0 }) : "—"

  return (
    <div className="mt-4">
      <p
        className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em]"
        style={{ color: COACH_FORM.muted }}
      >
        Set load
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease load"
          onClick={() => {
            const base = valueKg ?? 20
            onChange(snapLoad(Math.max(stepKg, base - stepKg), unit))
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{ borderColor: COACH_FORM.cardBorder, color: CHROME.white }}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div
          className="flex min-h-10 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-bold tabular-nums text-white"
          style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          {display}
        </div>
        <button
          type="button"
          onClick={() => {
            const base = valueKg ?? 0
            onChange(snapLoad(base + stepKg, unit))
          }}
          className="rounded-xl border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white"
          style={{ borderColor: COACH_FORM.cardBorder }}
        >
          + Add
        </button>
      </div>
    </div>
  )
}

export function CoachFormCues({ tips }: { tips: string[] }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <SquareMark />
        <p
          className="text-[10px] font-bold uppercase tracking-[0.24em]"
          style={{ color: COACH_FORM.accent }}
        >
          Form cues
        </p>
      </div>
      <div className="space-y-2">
        {tips.slice(0, 5).map((tip, i) => (
          <div
            key={`${i}-${tip.slice(0, 12)}`}
            className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
            style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <span
              className="w-6 shrink-0 text-xs font-black tabular-nums"
              style={{ color: COACH_FORM.accent }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[12px] leading-snug text-white/90">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CoachOutlineCta({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const reduce = useReducedMotion() ?? false
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="mx-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-2xl border py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white"
      style={{ borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.03)" }}
      whileTap={reduce ? undefined : { scale: 0.99 }}
    >
      <SquareMark color={CHROME.white} />
      {label}
      <EcgMark size={12} color={COACH_FORM.accent} />
    </motion.button>
  )
}

export function CoachRedToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description ? (
          <p className="text-[11px]" style={{ color: COACH_FORM.muted }}>
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? COACH_FORM.accent : "rgba(255,255,255,0.18)" }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  )
}

export function CoachRepGoalInput({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-white">Rep goal</p>
      <p className="mt-0.5 text-[11px]" style={{ color: COACH_FORM.muted }}>
        Set a target number of reps. Leave 0 for no goal.
      </p>
      <div
        className="mt-2 flex items-center justify-between rounded-xl border px-4 py-3"
        style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: "rgba(255,255,255,0.03)" }}
      >
        <input
          type="number"
          min={0}
          max={999}
          value={value || ""}
          onChange={(e) => onChange(Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)))}
          placeholder="0"
          className="w-16 bg-transparent text-2xl font-black tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
          aria-label="Target reps"
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: COACH_FORM.muted }}>
          Reps
        </span>
      </div>
    </div>
  )
}

export function CoachFaceStatus({
  enrolled,
  onEnroll,
}: {
  enrolled: boolean | null
  onEnroll: () => void
}) {
  if (enrolled) {
    return (
      <div
        className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{ borderColor: `${COACH_FORM.green}35`, backgroundColor: `${COACH_FORM.green}10` }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COACH_FORM.green }} aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: COACH_FORM.green }}>
          Face enrolled — only your reps count
        </p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onEnroll}
      className="mt-3 w-full rounded-xl border py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white"
      style={{ borderColor: COACH_FORM.cardBorder }}
    >
      Enroll your face
    </button>
  )
}
