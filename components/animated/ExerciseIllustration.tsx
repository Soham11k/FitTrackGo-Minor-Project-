"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export type ExerciseIllustrationId =
  | "squat" | "pushup" | "plank" | "lunge" | "deadlift" | "rdl"
  | "bicep_curl" | "shoulder_press" | "jumping_jacks" | "high_knees"
  | "crunch" | "run" | "strength" | "cardio" | "yoga" | "hiit" | "default"

interface IllustrationProps {
  id: ExerciseIllustrationId
  size?: number
  className?: string
  /** Trigger the exercise "one-rep" animation */
  animate?: boolean
  color?: string
}

const toneColor: Record<ExerciseIllustrationId, string> = {
  squat:          "var(--metric-move)",
  pushup:         "var(--metric-run)",
  plank:          "var(--metric-coach)",
  lunge:          "var(--metric-move)",
  deadlift:       "var(--metric-run)",
  rdl:            "var(--metric-run)",
  bicep_curl:     "var(--metric-hr)",
  shoulder_press: "var(--metric-hr)",
  jumping_jacks:  "var(--metric-streak)",
  high_knees:     "var(--metric-streak)",
  crunch:         "var(--metric-coach)",
  run:            "var(--metric-run)",
  strength:       "var(--metric-move)",
  cardio:         "var(--metric-run)",
  yoga:           "var(--metric-coach)",
  hiit:           "var(--metric-hr)",
  default:        "var(--foreground)",
}

/** Minimal stick-figure SVG for each exercise category */
function SquatFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <motion.g
      animate={anim && !reduce ? { scaleY: [1, 0.7, 1], originY: "bottom" } : {}}
      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      style={{ transformOrigin: "center bottom" }}
    >
      {/* torso */}
      <line x1="24" y1="14" x2="24" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* head */}
      <circle cx="24" cy="9" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      {/* arms */}
      <line x1="24" y1="20" x2="14" y2="27" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="20" x2="34" y2="27" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* legs */}
      <line x1="24" y1="30" x2="16" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="30" x2="32" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* feet */}
      <line x1="16" y1="42" x2="12" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="42" x2="36" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </motion.g>
  )
}

function PushupFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <motion.g
      animate={anim && !reduce ? { y: [0, 8, 0] } : {}}
      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
    >
      <circle cx="10" cy="12" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="15" y1="14" x2="38" y2="26" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="20" x2="20" y2="32" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="28" x2="34" y2="38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="32" x2="24" y2="32" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="38" x2="40" y2="38" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </motion.g>
  )
}

function RunFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <g>
      <circle cx="26" cy="9" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="26" y1="14" x2="26" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Arms */}
      <motion.line
        x1="26" y1="20" x2="14" y2="26"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={anim && !reduce ? { x2: [14, 18, 14], y2: [26, 20, 26] } : {}}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
      />
      <motion.line
        x1="26" y1="20" x2="36" y2="26"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={anim && !reduce ? { x2: [36, 32, 36], y2: [26, 20, 26] } : {}}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.3 }}
      />
      {/* Legs */}
      <motion.line
        x1="26" y1="28" x2="18" y2="40"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={anim && !reduce ? { x2: [18, 22, 18], y2: [40, 36, 40] } : {}}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
      />
      <motion.line
        x1="26" y1="28" x2="34" y2="40"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={anim && !reduce ? { x2: [34, 30, 34], y2: [40, 44, 40] } : {}}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.3 }}
      />
    </g>
  )
}

function PlankFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <motion.g
      animate={anim && !reduce ? { scaleY: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
    >
      <circle cx="8" cy="18" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="13" y1="20" x2="38" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="26" x2="14" y2="36" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="28" x2="40" y2="38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </motion.g>
  )
}

function CurlFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <g>
      <circle cx="24" cy="8" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="24" y1="13" x2="24" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="20" x2="10" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <motion.line
        x1="24" y1="20" x2="36" y2="28"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={anim && !reduce ? { x2: [36, 30, 36], y2: [28, 16, 28] } : {}}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      />
      <line x1="24" y1="30" x2="18" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="30" x2="30" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

function DefaultFigure({ color, anim, reduce }: { color: string; anim: boolean; reduce: boolean }) {
  return (
    <motion.g
      animate={anim && !reduce ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
    >
      <circle cx="24" cy="9" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="24" y1="14" x2="24" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="20" x2="14" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="20" x2="34" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="32" x2="18" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="32" x2="30" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </motion.g>
  )
}

const FIGURE_MAP: Record<ExerciseIllustrationId, typeof DefaultFigure> = {
  squat:          SquatFigure,
  pushup:         PushupFigure,
  plank:          PlankFigure,
  lunge:          DefaultFigure,
  deadlift:       DefaultFigure,
  rdl:            DefaultFigure,
  bicep_curl:     CurlFigure,
  shoulder_press: CurlFigure,
  jumping_jacks:  DefaultFigure,
  high_knees:     RunFigure,
  crunch:         PlankFigure,
  run:            RunFigure,
  strength:       SquatFigure,
  cardio:         RunFigure,
  yoga:           PlankFigure,
  hiit:           DefaultFigure,
  default:        DefaultFigure,
}

export function ExerciseIllustration({
  id,
  size = 48,
  className,
  animate: doAnimate = false,
  color,
}: IllustrationProps) {
  const reduce = useReducedMotion() ?? false
  const resolvedColor = color ?? toneColor[id] ?? toneColor.default
  const Figure = FIGURE_MAP[id] ?? DefaultFigure

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <Figure color={resolvedColor} anim={doAnimate} reduce={reduce} />
    </svg>
  )
}

export { toneColor as exerciseToneColor }
