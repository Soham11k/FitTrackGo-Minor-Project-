"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Home, MapPin, Dumbbell, ScanLine, Trophy, User } from "lucide-react"
import { useLocale } from "@/components/locale-provider"

/** Each tab maps to a metric tint used for the active highlight. */
const navItems = [
  { icon: Home, labelKey: "nav.home", id: "home", tint: "primary" },
  { icon: MapPin, labelKey: "nav.run", id: "run", tint: "metric-run" },
  { icon: Dumbbell, labelKey: "nav.exercises", id: "exercises", tint: "metric-move" },
  { icon: ScanLine, labelKey: "nav.coach", id: "ai-coach", tint: "metric-coach" },
  { icon: Trophy, labelKey: "nav.arena", id: "arena", tint: "metric-streak" },
  { icon: User, labelKey: "nav.profile", id: "profile", tint: "metric-profile" },
] as const

export type TabId = (typeof navItems)[number]["id"]

/**
 * Map each tab's tint to the static Tailwind classes it needs. Tailwind cannot
 * safelist `bg-${tint}/25` from a runtime string, so we resolve to full
 * classnames up-front (keeps JIT + tree-shaking happy).
 */
const tintClasses = {
  primary: { bg: "bg-primary/25", text: "text-primary" },
  "metric-run": { bg: "bg-metric-run/25", text: "text-metric-run" },
  "metric-move": { bg: "bg-metric-move/25", text: "text-metric-move" },
  "metric-coach": { bg: "bg-metric-coach/25", text: "text-metric-coach" },
  "metric-streak": { bg: "bg-metric-streak/25", text: "text-metric-streak" },
  "metric-profile": { bg: "bg-metric-profile/25", text: "text-metric-profile" },
} as const

export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  const { t } = useLocale()
  const prefersReducedMotion = useReducedMotion()
  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.id === activeTab)
  )
  const activeItem = navItems[activeIndex]
  const activeTint = tintClasses[activeItem.tint]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-lg px-4 pb-2 pointer-events-auto">
        <div className="relative rounded-full border border-border/80 bg-background/55 p-1.5 shadow-[var(--shadow-nav)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/50">
          <div className="pointer-events-none absolute inset-y-1.5 left-1.5 right-1.5 overflow-hidden rounded-full">
            <motion.div
              className={`h-full w-1/6 rounded-full ${activeTint.bg}`}
              animate={{ x: `${activeIndex * 100}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
              }
            />
          </div>
          <div className="relative grid grid-cols-6 gap-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              const label = t(item.labelKey)
              const activeText = tintClasses[item.tint].text
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-tab-${item.id}`}
                  onClick={() => {
                    try {
                      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                        navigator.vibrate(6)
                      }
                    } catch {
                      /* ignore */
                    }
                    onTabChange(item.id)
                  }}
                  className={`relative z-[1] flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-full py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isActive ? activeText : "text-muted-foreground"
                  }`}
                  aria-label={label}
                  title={label}
                >
                  <item.icon
                    className={`h-5 w-5 transition-transform duration-200 ease-out ${
                      isActive ? "scale-110" : "scale-100 opacity-80"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={`text-typo-micro max-w-[4.5rem] truncate font-bold uppercase tracking-[0.08em] leading-none ${
                      isActive ? activeText : "text-muted-foreground opacity-60"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="h-safe-area-inset-bottom pointer-events-none" />
    </nav>
  )
}
