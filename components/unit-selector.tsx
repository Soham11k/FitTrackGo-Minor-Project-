"use client"

import { useState, useCallback } from "react"
import { getStoredUnit, setStoredUnit, type DistanceUnit } from "@/lib/units"
import { Ruler } from "lucide-react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"

export function UnitSelector() {
  const [unit, setUnit] = useState<DistanceUnit>(getStoredUnit)
  const { t } = useLocale()

  const handleChange = useCallback((newUnit: DistanceUnit) => {
    setUnit(newUnit)
    setStoredUnit(newUnit)
    toast.success(newUnit === 'km' ? 'Kilometers' : 'Miles')
  }, [])

  return (
    <div className="flex items-center justify-between py-2 border-b border-border">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{t("settings.distanceUnits")}</span>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Distance units">
        {(['km', 'mi'] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => handleChange(u)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              unit === u
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={unit === u}
          >
            {u.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
