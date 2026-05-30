"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Home, MapPin, Dumbbell, ScanLine, Trophy, User } from "lucide-react"
import { useLocale } from "@/components/locale-provider"
import { pulse } from "@/lib/haptics"
import { CHROME } from "@/lib/app-chrome"
import { WORKOUTS } from "@/lib/workouts-theme"

/**
 * Premium orange-on-black nav bar.
 * Sliding orange underline indicator; icons scale + tint on active.
 */
const navItems = [
  { icon: Home,      labelKey: "nav.home",      id: "home"      },
  { icon: MapPin,    labelKey: "nav.run",        id: "run"       },
  { icon: Dumbbell,  labelKey: "nav.exercises",  id: "exercises" },
  { icon: ScanLine,  labelKey: "nav.coach",      id: "ai-coach"  },
  { icon: Trophy,    labelKey: "nav.arena",      id: "arena"     },
  { icon: User,      labelKey: "nav.profile",    id: "profile"   },
] as const

export type TabId = (typeof navItems)[number]["id"]

export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  const { t } = useLocale()
  const prefersReducedMotion = useReducedMotion()
  const [compactInactiveLabels, setCompactInactiveLabels] = useState(false)

  useEffect(() => {
    const read = () => {
      try {
        setCompactInactiveLabels(
          typeof localStorage !== "undefined" &&
            localStorage.getItem("ft-bottom-nav-tutored") === "1",
        )
      } catch {
        setCompactInactiveLabels(false)
      }
    }
    read()
    if (typeof window !== "undefined") {
      window.addEventListener("ft-bottom-nav-tutored", read)
      return () => window.removeEventListener("ft-bottom-nav-tutored", read)
    }
  }, [])

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab))

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        backgroundColor: CHROME.black,
        borderTop: `1px solid ${CHROME.border}`,
      }}
    >
      <div className="relative mx-auto grid max-w-lg grid-cols-6 gap-0 px-1">
        {/* Sliding orange underline */}
        <div className="pointer-events-none absolute inset-x-1 top-0 h-0.5 overflow-hidden">
          <motion.div
            className="h-full w-1/6 rounded-b-full"
            style={{
              backgroundColor: activeTab === "exercises" ? WORKOUTS.accent : CHROME.orange,
            }}
            animate={{ x: `${activeIndex * 100}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
            }
          />
        </div>

        {/* Orange glow blur behind indicator */}
        <div className="pointer-events-none absolute inset-x-1 top-0 h-0.5 overflow-hidden opacity-60">
          <motion.div
            className="h-full w-1/6 blur-[3px]"
            style={{
              backgroundColor: activeTab === "exercises" ? WORKOUTS.accent : CHROME.orange,
            }}
            animate={{ x: `${activeIndex * 100}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
            }
          />
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const label = t(item.labelKey)
          const accent = item.id === "exercises" ? WORKOUTS.accent : CHROME.orange

          return (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-tab-${item.id}`}
              onClick={() => {
                pulse("tick")
                onTabChange(item.id)
              }}
              className="press-magnetic relative z-[1] flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 focus-visible:outline-none"
              aria-label={label}
              title={label}
            >
              <motion.span
                className="relative flex items-center justify-center"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : isActive
                    ? { scale: 1.18, y: -2 }
                    : { scale: 1, y: 0 }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 28 }
                }
              >
                <item.icon
                  className="h-5 w-5 transition-colors duration-150"
                  style={{ color: isActive ? accent : CHROME.muted }}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
              </motion.span>
              <span
                className="max-w-[4.5rem] truncate text-[9px] font-bold uppercase tracking-[0.18em] leading-none transition-colors duration-150"
                style={{ color: isActive ? accent : CHROME.muted }}
              >
                {!compactInactiveLabels || isActive ? label : ""}
              </span>
            </button>
          )
        })}
      </div>
      <div className="h-safe-area-inset-bottom pointer-events-none" />
    </nav>
  )
}
