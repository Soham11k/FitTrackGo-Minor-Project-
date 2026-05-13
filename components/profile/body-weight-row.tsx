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
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Body weight</span>
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Edit</button>
        </div>
        <div className="text-sm text-foreground tabular-nums">{display}</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Used for load-aware form scoring.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">Body weight</div>
      <div className="flex items-center gap-2">
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
        <button onClick={save} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Save</button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Cancel</button>
      </div>
    </div>
  )
}
