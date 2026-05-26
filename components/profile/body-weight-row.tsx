"use client"

import { useEffect, useMemo, useState } from "react"
import { saveProfile } from "@/lib/store-supabase"
import type { UserProfile } from "@/lib/store"
import { formatLoad, kgToLb, lbToKg } from "@/lib/weight/units"
import { toast } from "sonner"

export function BodyWeightRow({
  profile,
  onSaved,
}: {
  profile: UserProfile | null
  onSaved: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [unit, setUnit] = useState<"kg" | "lb">("kg")
  const [input, setInput] = useState<string>("")

  useEffect(() => {
    setUnit(profile?.weightUnit ?? "kg")
    if (profile?.bodyWeightKg !== undefined) {
      const v = profile.weightUnit === "lb" ? kgToLb(profile.bodyWeightKg) : profile.bodyWeightKg
      setInput(String(Math.round(v * 10) / 10))
    }
  }, [profile?.bodyWeightKg, profile?.weightUnit])

  const display = useMemo(() => formatLoad(profile?.bodyWeightKg, profile?.weightUnit ?? "kg"), [profile?.bodyWeightKg, profile?.weightUnit])
  const hasWeight = profile?.bodyWeightKg !== undefined && profile.bodyWeightKg > 0

  async function save() {
    const num = Number.parseFloat(input)
    const valid = Number.isFinite(num) && num > 0
    try {
      await saveProfile({
        bodyWeightKg: valid ? (unit === "lb" ? lbToKg(num) : num) : undefined,
        weightUnit: unit,
      })
      await onSaved()
      setEditing(false)
      toast.success("Body weight saved")
    } catch (e) {
      console.error(e)
      toast.error("Couldn't save body weight")
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-typo-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">Body weight</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            {hasWeight ? "Edit" : "Add"}
          </button>
        </div>
        {hasWeight ? (
          <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">{display}</p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary"
          >
            Add body weight for load-aware scoring
          </button>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">Used for load-aware form scoring in Coach Assist.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-typo-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">Body weight</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={unit === "kg" ? "e.g. 72" : "e.g. 158"}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <div className="flex rounded-lg border border-border bg-background p-1 text-xs font-semibold">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`rounded px-2 py-1 ${unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={save} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          Save
        </button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          Cancel
        </button>
      </div>
    </div>
  )
}
