"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/lib/data"

export function AppHeader({
  streakChip,
  guest,
  right,
  className,
}: {
  /** Shown when streak &gt; 0 (or override with null to hide) */
  streakChip?: ReactNode
  guest?: boolean
  /** Tab-specific slot (GPS, coach faults, etc.) */
  right?: ReactNode
  className?: string
}) {
  const base = siteConfig.appName.replace(/Go\s*$/i, "").trim()
  const hasGo = /Go\s*$/i.test(siteConfig.appName)

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 flex items-center gap-2">
        <span
          className="truncate text-xl tracking-[0.04em] text-foreground"
          style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
        >
          {hasGo ? (
            <>
              <span className="font-bold uppercase">{base}</span>
              <span className="font-bold uppercase">GO</span>
              <span className="ml-0.5 text-primary">.</span>
            </>
          ) : (
            <span className="font-bold uppercase">{siteConfig.appName}</span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {guest ? (
          <span className="rounded-sm border border-border bg-transparent px-2 py-0.5 text-typo-micro font-bold uppercase tracking-[0.18em] text-foreground tabular-nums">
            Guest
          </span>
        ) : null}
        {right ?? streakChip}
      </div>
    </header>
  )
}
