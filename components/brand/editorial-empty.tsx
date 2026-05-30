"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CHROME } from "@/lib/app-chrome"

export function EditorialEmpty({
  title,
  description,
  media,
  ctaLabel,
  onCta,
  secondary,
  className,
  variant = "cream",
}: {
  title: string
  description: string
  media?: ReactNode
  ctaLabel?: string
  onCta?: () => void
  secondary?: ReactNode
  className?: string
  /** cream = white card on cream bg; dark = dark card on black bg */
  variant?: "cream" | "dark"
}) {
  if (variant === "dark") {
    return (
      <div
        className={cn("rounded-2xl p-5 text-center", className)}
        style={{ backgroundColor: CHROME.cardBg, border: `1px solid ${CHROME.border}` }}
      >
        {media && <div className="mx-auto mb-3 flex w-fit items-center justify-center opacity-60">{media}</div>}
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs" style={{ color: CHROME.muted }}>{description}</p>
        {ctaLabel && onCta ? (
          <button
            type="button"
            onClick={onCta}
            className="mt-4 rounded-xl px-6 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: CHROME.orange }}
          >
            {ctaLabel}
          </button>
        ) : null}
        {secondary ? <div className="mt-2">{secondary}</div> : null}
      </div>
    )
  }

  return (
    <div className={cn("rounded-3xl border border-border/80 bg-card p-5 text-center shadow-[var(--shadow-card)]", className)}>
      {media ? <div className="mx-auto mb-3 flex w-fit items-center justify-center">{media}</div> : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {ctaLabel && onCta ? (
        <Button type="button" onClick={onCta} className="mt-4 rounded-full">
          {ctaLabel}
        </Button>
      ) : null}
      {secondary ? <div className="mt-2">{secondary}</div> : null}
    </div>
  )
}
