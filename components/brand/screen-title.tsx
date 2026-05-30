"use client"

import { cn } from "@/lib/utils"
import { CHROME } from "@/lib/app-chrome"

export function ScreenTitle({
  title,
  subtitle,
  eyebrow,
  className,
  variant = "default",
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  className?: string
  /** default = theme tokens; chrome = orange eyebrow on dark bg */
  variant?: "default" | "chrome"
}) {
  if (variant === "chrome") {
    return (
      <header className={cn("space-y-1", className)}>
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.orange }}>
            {eyebrow}
          </p>
        )}
        <h1
          className="text-4xl font-black uppercase leading-none text-white"
          style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs" style={{ color: CHROME.muted }}>{subtitle}</p>
        )}
      </header>
    )
  }

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
