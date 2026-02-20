"use client"

import { Home, MapPin, Dumbbell, ScanLine, User } from "lucide-react"

const navItems = [
  { icon: Home, label: "Home", id: "home" },
  { icon: MapPin, label: "Run", id: "run" },
  { icon: Dumbbell, label: "Exercise", id: "exercises" },
  { icon: ScanLine, label: "AI Coach", id: "ai-coach" },
  { icon: User, label: "Profile", id: "profile" },
] as const

export type TabId = (typeof navItems)[number]["id"]

export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`group flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label={item.label}
            >
              <div className="relative">
                {isActive && (
                  <div className="absolute -inset-2 rounded-full bg-primary/10 animate-in fade-in duration-200" />
                )}
                <item.icon
                  className={`relative h-5 w-5 transition-all ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-all ${
                  isActive ? "text-primary" : ""
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      {/* Safe area spacer for mobile */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  )
}
