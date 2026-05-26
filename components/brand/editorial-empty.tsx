"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function EditorialEmpty({
  title,
  description,
  media,
  ctaLabel,
  onCta,
  secondary,
  className,
}: {
  title: string
  description: string
  media?: ReactNode
  ctaLabel?: string
  onCta?: () => void
  secondary?: ReactNode
  className?: string
}) {
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
