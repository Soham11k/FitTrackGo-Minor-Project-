"use client"

import { useRef, useEffect } from "react"
import Lottie, { type LottieRefCurrentProps } from "lottie-react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface LottieIconProps {
  /** Lottie JSON data (import the JSON directly) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  /** Width/height in px (square). Defaults to 64. */
  size?: number
  className?: string
  /** Auto-play loop (default true). Set false for one-shot play. */
  loop?: boolean
  /** Play the animation. Defaults to true. */
  play?: boolean
  /** Pause on last frame when play stops (one-shot). */
  keepLastFrame?: boolean
  /** Speed multiplier (1 = normal) */
  speed?: number
  /** When true, renders as a still first-frame with no animation */
  still?: boolean
}

/**
 * Sized Lottie player with automatic reduced-motion fallback.
 * In reduced-motion mode renders the first frame as a static SVG.
 */
export function LottieIcon({
  data,
  size = 64,
  className,
  loop = true,
  play = true,
  keepLastFrame = false,
  speed = 1,
  still = false,
}: LottieIconProps) {
  const reduce = useReducedMotion() ?? false
  const lottieRef = useRef<LottieRefCurrentProps>(null)

  useEffect(() => {
    if (!lottieRef.current) return
    lottieRef.current.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    if (!lottieRef.current) return
    if (play && !reduce && !still) {
      lottieRef.current.play()
    } else {
      lottieRef.current.pause()
      if (keepLastFrame) lottieRef.current.goToAndStop(lottieRef.current.getDuration(true) ?? 0, true)
    }
  }, [play, reduce, still, keepLastFrame])

  const paused = reduce || still || !play

  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        loop={!paused && loop}
        autoplay={!paused}
        style={{ width: size, height: size }}
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
    </div>
  )
}
