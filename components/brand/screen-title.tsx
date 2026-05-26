"use client"

import { cn } from "@/lib/utils"

export function ScreenTitle({
  title,
  subtitle,
  eyebrow,
  className,
}: {
  title: string
  subtitle?: string
  /** Optional date/context line above the title */
  eyebrow?: string
  className?: string
}) {
  return (
    <header className={cn("space-y-1", className)}>
      {eyebrow ? (
        <p className="text-typo-eyebrow font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className="text-2xl font-bold text-foreground sm:text-[1.75rem]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h1>
      {subtitle ? <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p> : null}
    </header>
  )
}
