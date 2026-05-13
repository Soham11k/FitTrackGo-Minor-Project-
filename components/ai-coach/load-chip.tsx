"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Minus, Plus, X } from "lucide-react"
import { formatLoad, lbToKg, snapLoad } from "@/lib/weight/units"
import type { WeightUnit } from "@/lib/weight/units"
import { getBestLoadKg, getLastLoadKg } from "@/lib/weight/load-history"

interface LoadChipProps {
  exerciseId: string
  unit?: WeightUnit
  value?: number
  onChange: (kg: number | undefined) => void
}

/**
 * Tap-to-edit "Add load" chip rendered in the AI Coach set header for
 * weighted exercises. Stores in kg; UI honors the user's display unit.
 */
export function LoadChip({ exerciseId, unit = "kg", value, onChange }: LoadChipProps) {
  const [open, setOpen] = useState(false)
  // Re-read history when the chip opens; including `open` is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const last = useMemo(() => getLastLoadKg(exerciseId), [exerciseId, open])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const best = useMemo(() => getBestLoadKg(exerciseId), [exerciseId, open])

  const defaultKg = value ?? last ?? 20
  const [draft, setDraft] = useState<number>(defaultKg)

  useEffect(() => {
    setDraft(value ?? last ?? 20)
  }, [value, last, open])

  const stepKg = unit === "lb" ? lbToKg(5) : 2.5

  const inc = () => setDraft((d) => snapLoad(d + stepKg, unit))
  const dec = () => setDraft((d) => snapLoad(Math.max(0, d - stepKg), unit))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-foreground/80 hover:text-foreground"
      >
        <span className="text-muted-foreground">Load</span>
        <span className="tabular-nums">{value !== undefined ? formatLoad(value, unit) : "Add"}</span>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"
    >
      <button onClick={dec} type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground" aria-label="Decrease load">
        <Minus className="h-4 w-4" />
      </button>
      <div className="min-w-[70px] text-center text-sm font-bold tabular-nums">
        {formatLoad(draft, unit)}
      </div>
      <button onClick={inc} type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground" aria-label="Increase load">
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => { onChange(draft); setOpen(false) }}
        className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
      >
        Set
      </button>
      <button
        type="button"
        onClick={() => { onChange(undefined); setOpen(false) }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        aria-label="Clear load"
      >
        <X className="h-4 w-4" />
      </button>
      {best && (
        <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">
          PR {formatLoad(best.kg, unit, { showUnit: false })}{unit} × {best.reps}
        </div>
      )}
    </motion.div>
  )
}
