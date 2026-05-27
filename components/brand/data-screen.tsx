"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const brandCardClass = "nrc-card"
export const brandCardInsetClass = "rounded-xl border border-border bg-muted/30"
export const heroStageTileClass =
  "rounded-lg border border-white/10 bg-foreground text-background shadow-[0_20px_44px_-24px_color-mix(in_oklab,var(--primary)_50%,transparent)]"

export function DataScreen({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("relative z-[1] flex flex-col gap-4 px-4 pt-4 pb-28", className)}>{children}</section>
}

export function DataShell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("nrc-card p-3", className)}>{children}</div>
}

export function DataModule({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("nrc-card p-4", className)}>{children}</section>
}
