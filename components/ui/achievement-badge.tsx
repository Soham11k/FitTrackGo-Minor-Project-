"use client"

import { MotionCelebrate } from "@/components/motion-celebrate"
import { cn } from "@/lib/utils"
import Image from "next/image"

export type AchievementBadgeTier = "bronze" | "silver" | "gold" | "neon"

export function AchievementBadge({
  tier,
  earned,
  title,
  className,
}: {
  tier: AchievementBadgeTier
  earned: boolean
  title: string
  className?: string
}) {
  const src = `/illustrations/badges/${tier}.svg`

  const inner = (
    <>
      <div className={cn("relative mx-auto flex h-12 w-12 items-center justify-center", !earned && "opacity-45 grayscale")}>
        <Image src={src} alt="" width={48} height={48} className="h-full w-full object-contain drop-shadow-sm" />
      </div>
      <span className="text-typo-eyebrow font-semibold text-foreground leading-tight">{title}</span>
    </>
  )

  if (earned) {
    return (
      <MotionCelebrate className={cn("flex flex-col items-center gap-1 text-center", className)}>{inner}</MotionCelebrate>
    )
  }

  return <div className={cn("flex flex-col items-center gap-1 text-center", className)}>{inner}</div>
}
