"use client"

import { FittrackLogoMark } from "@/components/fittrack-logo-mark"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type TabSkeletonLayout = "default" | "coach" | "list" | "map"

type Props = {
  /** Shown under the logo — e.g. "Loading Run…" */
  label: string
  /** Optional subtitle (e.g. pose model warmup). */
  hint?: string
  /** Rough layout of placeholder blocks */
  layout?: TabSkeletonLayout
  className?: string
}

/**
 * Branded interim UI while `next/dynamic` tab chunks load — logo + caption + lightweight skeletons.
 * Respects `prefers-reduced-motion` (no decorative spin on the rim).
 */
export function BrandedTabLoad({ label, hint, layout = "default", className }: Props) {
  return (
    <div
      className={cn("flex min-h-[70vh] flex-col items-center justify-center px-6 pb-28", className)}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center" aria-live="polite">
        <div className="mb-6 flex justify-center" aria-hidden>
          <FittrackLogoMark
            size={64}
            animated
            className="drop-shadow-[0_6px_28px_-8px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />
        </div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}

        <div className="mt-10 w-full space-y-3 ft-shimmer rounded-2xl p-1">
          {layout === "coach" ? (
            <>
              <Skeleton className="mx-auto h-8 w-44 rounded-lg" />
              <div className="flex justify-center gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
              </div>
              <Skeleton className="h-[min(38vh,220px)] w-full rounded-2xl" />
              <Skeleton className="mx-auto h-4 w-3/5" />
            </>
          ) : layout === "list" ? (
            <>
              <Skeleton className="h-10 w-full rounded-xl" />
              {[1, 2, 3, 4].map((k) => (
                <Skeleton key={k} className="h-16 w-full rounded-xl" />
              ))}
            </>
          ) : layout === "map" ? (
            <>
              <Skeleton className="h-[min(42vh,280px)] w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-36 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
