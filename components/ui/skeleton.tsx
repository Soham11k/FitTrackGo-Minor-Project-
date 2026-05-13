import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Loading placeholder with optional shimmer (disabled when user prefers reduced motion).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-lg bg-muted/70 shadow-[var(--shadow-card)]",
        "motion-safe:animate-[shimmer_1.8s_linear_infinite] motion-safe:bg-gradient-to-r motion-safe:from-muted/50 motion-safe:via-muted/90 motion-safe:to-muted/50 motion-safe:bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
