"use client"

import { cn } from "@/lib/utils"

export function StridePathMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 80" className={cn("h-16 w-full text-primary/60", className)} aria-hidden>
      <path d="M10 55 C35 20, 55 20, 78 50 C95 70, 122 72, 146 46 C163 28, 182 24, 210 42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="52" cy="28" r="4" fill="currentColor" />
      <circle cx="136" cy="50" r="4" fill="currentColor" />
    </svg>
  )
}

export function RepArcMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("h-24 w-24 text-chart-2/70", className)} aria-hidden>
      <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="160 80" transform="rotate(-42 60 60)" />
      <circle cx="60" cy="60" r="26" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray="70 90" transform="rotate(30 60 60)" />
    </svg>
  )
}

export function FormScanGridMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 100" className={cn("h-20 w-full text-foreground/45", className)} aria-hidden>
      <rect x="8" y="8" width="164" height="84" rx="16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
      <path d="M20 48 H160" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <path d="M90 16 V84" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="90" cy="48" r="7" fill="currentColor" />
    </svg>
  )
}
