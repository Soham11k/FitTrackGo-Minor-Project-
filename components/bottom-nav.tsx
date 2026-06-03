"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Home, MapPin, ScanLine, Target, User } from "lucide-react"
import { hapticMoment } from "@/lib/haptic-moments"
import { CHROME } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"
import { WORKOUTS } from "@/lib/workouts-theme"

const NAV_ACCENT = CHROME_ACCENT.accent

const navItems = [
  { icon: Home,      labelKey: "nav.home",      id: "home"      },
  { icon: MapPin,    labelKey: "nav.run",        id: "run"       },
  { icon: ScanLine,  labelKey: "nav.coach",      id: "ai-coach"  },
  { icon: Target,    labelKey: "nav.goals",      id: "exercises" },
  { icon: User,      labelKey: "nav.profile",    id: "profile"   },
] as const

const NAV_LABELS: Record<(typeof navItems)[number]["id"], string> = {
  home: "Home",
  run: "Runs",
  "ai-coach": "Coach",
  exercises: "Goals",
  profile: "Profile",
}

/** Primary tabs in the bottom bar; `arena` remains routable via deep links / coach. */
export type TabId = (typeof navItems)[number]["id"] | "arena"

export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
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

  const activeIndex = navItems.findIndex((item) => item.id === activeTab)
  const underlineIndex = activeIndex >= 0 ? activeIndex : 0
  const showUnderline = activeIndex >= 0

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        backgroundColor: CHROME.black,
        borderTop: `1px solid ${CHROME.border}`,
      }}
    >
      <div className="relative mx-auto grid max-w-lg grid-cols-5 gap-0 px-1">
        <div
          className="pointer-events-none absolute inset-x-1 top-0 h-0.5 overflow-hidden"
          style={{ opacity: showUnderline ? 1 : 0 }}
        >
          <motion.div
            className="h-full w-1/5 rounded-b-full"
            style={{
              backgroundColor: activeTab === "exercises" ? WORKOUTS.accent : NAV_ACCENT,
            }}
            animate={{ x: `${underlineIndex * 100}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
            }
          />
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const label = NAV_LABELS[item.id]
          const accent = item.id === "exercises" ? WORKOUTS.accent : NAV_ACCENT

          return (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-tab-${item.id}`}
              onClick={() => {
                hapticMoment("tabChange")
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
