"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Flame } from "lucide-react"
import { toast } from "sonner"
import { useAccent } from "@/components/accent-provider"
import { ParticleBurst } from "@/components/animated/ParticleBurst"
import { EcgMark } from "@/components/chrome/EcgMark"
import { THEME_PRESETS, getPresetById, type AccentId } from "@/lib/accent"
import { CHROME } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"
import { hapticMoment } from "@/lib/haptic-moments"
import { cn } from "@/lib/utils"

const NAV_DOTS = ["home", "run", "coach", "goals", "profile"] as const

function ThemePreview({ accentId, streakDays = 3 }: { accentId: AccentId; streakDays?: number }) {
  const preset = getPresetById(accentId)

  return (
    <div
      className="relative overflow-hidden rounded-[1.25rem] border p-4"
      style={{
        backgroundColor: CHROME.homeCard,
        borderColor: CHROME.border,
        boxShadow: `0 0 40px -12px ${preset.ambientHue}`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
        style={{ background: preset.ambientHue }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <EcgMark size={14} color={preset.swatch} animate={false} />
          <span
            className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white"
            style={{ fontFamily: CHROME.homeLabelFont }}
          >
            FitTrack Go
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px bg-white/15" aria-hidden />
          <Flame className="h-3 w-3" style={{ color: preset.swatch }} aria-hidden />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.08em] text-white"
            style={{ fontFamily: CHROME.homeLabelFont }}
          >
            {streakDays}d streak
          </span>
        </span>
      </div>

      <div
        className="relative mt-4 rounded-xl px-3 py-2.5 text-center text-sm font-black uppercase tracking-[0.18em] text-white"
        style={{
          backgroundColor: preset.swatch,
          fontFamily: CHROME.homeDisplayFont,
        }}
      >
        Run
      </div>

      <div className="relative mt-4 flex items-center justify-center gap-3">
        {NAV_DOTS.map((id, i) => (
          <span key={id} className="relative flex flex-col items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: i === 0 ? preset.swatch : "rgba(255,255,255,0.2)",
              }}
              aria-hidden
            />
            {i === 0 ? (
              <span
                className="absolute -top-1 h-1 w-1 rounded-full"
                style={{ backgroundColor: preset.swatch }}
                aria-hidden
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  )
}

function PresetChip({
  preset,
  selected,
  onSelect,
  reduceMotion,
}: {
  preset: (typeof THEME_PRESETS)[number]
  selected: boolean
  onSelect: () => void
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      className={cn(
        "relative flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-2xl p-2.5 text-center transition-opacity",
        selected ? "opacity-100" : "opacity-80 hover:opacity-100",
      )}
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: selected ? `1px solid ${preset.swatch}` : "1px solid rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 20px -4px ${preset.ambientHue}` : undefined,
      }}
      aria-pressed={selected}
      aria-label={`${preset.name} theme`}
    >
      {selected && !reduceMotion ? (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: `conic-gradient(from 0deg, ${preset.swatch}, transparent, ${preset.swatch})`,
            opacity: 0.35,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
      ) : null}
      <span
        className="relative z-[1] h-10 w-10 rounded-full shadow-lg"
        style={{ background: preset.gradient }}
        aria-hidden
      />
      <span className="relative z-[1] text-[10px] font-bold uppercase tracking-[0.06em] text-white">
        {preset.name}
      </span>
      <span className="relative z-[1] text-[9px] leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
        {preset.tagline}
      </span>
    </motion.button>
  )
}

export function ThemeStudio({ streakDays = 0 }: { streakDays?: number }) {
  const { accent, setAccent } = useAccent()
  const [previewId, setPreviewId] = useState<AccentId>(accent)
  const [burstKey, setBurstKey] = useState(0)
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    setPreviewId(accent)
  }, [accent])

  const applyPreset = useCallback(
    (id: AccentId) => {
      if (id === accent) {
        setPreviewId(id)
        return
      }
      setPreviewId(id)
      setAccent(id)
      if (!reduceMotion) {
        setBurstKey((k) => k + 1)
      }
      hapticMoment("themeChange")
      toast.success(`${getPresetById(id).name} applied`)
    },
    [accent, reduceMotion, setAccent],
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <ThemePreview accentId={previewId} streakDays={Math.max(streakDays, 3)} />
        {!reduceMotion ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <ParticleBurst key={burstKey} trigger count={70} size={280} />
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
        Colors sync across Home, Runs, Coach, Profile, and navigation.
      </p>

      <div
        className="flex gap-2.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
        role="listbox"
        aria-label="Theme presets"
      >
        {THEME_PRESETS.map((preset) => (
          <PresetChip
            key={preset.id}
            preset={preset}
            selected={previewId === preset.id}
            onSelect={() => applyPreset(preset.id)}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ backgroundColor: CHROME_ACCENT.accentDim, border: `1px solid ${CHROME_ACCENT.accentBorder}` }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: CHROME_ACCENT.accent }}
          aria-hidden
        />
        <p className="text-[11px] font-semibold text-white">
          Active: {getPresetById(accent).name}
        </p>
      </div>
    </div>
  )
}
