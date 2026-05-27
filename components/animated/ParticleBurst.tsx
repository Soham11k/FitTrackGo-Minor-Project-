"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  life: number
  maxLife: number
}

const COLORS = [
  "var(--primary)",      // volt-lime
  "var(--metric-run)",   // orange
  "var(--metric-hr)",    // red
  "var(--metric-coach)", // purple
  "var(--metric-streak)",// amber
  "#ffffff",
]

interface ParticleBurstProps {
  /** Whether to trigger a burst right now */
  trigger?: boolean
  /** Count of particles (default 60) */
  count?: number
  className?: string
  /** Width / height of canvas (default 200) */
  size?: number
}

/**
 * Canvas-based particle confetti burst.
 * Renders nothing when prefers-reduced-motion is set.
 */
export function ParticleBurst({ trigger = false, count = 60, className, size = 200 }: ParticleBurstProps) {
  const reduce = useReducedMotion() ?? false
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (!trigger || reduce || triggeredRef.current) return
    triggeredRef.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2

    particlesRef.current = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 5
      const life = 45 + Math.floor(Math.random() * 30)
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        radius: 3 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        life,
        maxLife: life,
      }
    })

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0)
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.12 // gravity
        p.vx *= 0.98 // drag
        p.life -= 1
        p.alpha = p.life / p.maxLife
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        triggeredRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [trigger, count, reduce])

  if (reduce) return null

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ pointerEvents: "none" }}
    />
  )
}
