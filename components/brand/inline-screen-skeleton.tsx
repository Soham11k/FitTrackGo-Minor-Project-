"use client"

import { FittrackLogoMark } from "@/components/fittrack-logo-mark"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { TabSkeletonLayout } from "@/components/app-tab-skeleton"

export function InlineScreenSkeleton({
  label = "Loading…",
  hint,
  layout = "default",
  showLogo = false,
  className,
}: {
  label?: string
  hint?: string
  layout?: TabSkeletonLayout
  showLogo?: boolean
  className?: string
}) {
  return (
    <section
      aria-busy="true"
      role="status"
      aria-label={label}
      className={cn("space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-[var(--shadow-card)]", className)}
    >
      <div className="flex items-center gap-3">
        {showLogo ? <FittrackLogoMark size={22} className="shrink-0" /> : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>

      <div className="space-y-2 ft-shimmer">
        {layout === "list" ? (
          <>
            <Skeleton className="h-9 w-full rounded-xl" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </>
        ) : layout === "map" ? (
          <>
            <Skeleton className="h-44 w-full rounded-2xl" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </>
        ) : layout === "coach" ? (
          <>
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3 rounded-lg" />
          </>
        ) : (
          <>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </>
        )}
      </div>
    </section>
  )
}
