"use client"

import { useState, useCallback, useEffect } from "react"
import { SplashScreen } from "@/components/splash-screen"
import { LoginScreen } from "@/components/login-screen"
import { BottomNav, type TabId } from "@/components/bottom-nav"
import { Dashboard } from "@/components/dashboard"
import { RunTracker } from "@/components/run-tracker"
import { ExerciseLibrary } from "@/components/exercise-library"
import { AICoach } from "@/components/ai-coach"
import { ProfileScreen } from "@/components/profile-screen"
import { WorkoutHistory } from "@/components/workout-history"
import { SupabaseSetupGuide } from "@/components/supabase-setup-guide"
import { Activity } from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { siteConfig } from "@/lib/data"

type AppState = "splash" | "login" | "app"
type View = "main" | "history"

export default function Page() {
  const [appState, setAppState] = useState<AppState>("splash")
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [view, setView] = useState<View>("main")
  const [transitioning, setTransitioning] = useState(false)
  const [streak, setStreak] = useState(0)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      setShowSetupGuide(true)
      return
    }
    setShowSetupGuide(false)

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && appState === "splash") {
        setAppState("app")
      } else if (!user && appState === "app") {
        setAppState("login")
      }
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setAppState("app")
      } else if (event === "SIGNED_OUT") {
        setAppState("login")
      }
    })

    return () => subscription.unsubscribe()
  }, [appState, supabase])

  // Show setup guide if Supabase is not configured
  if (showSetupGuide) {
    return <SupabaseSetupGuide />
  }

  const handleSplashComplete = useCallback(() => {
    setAppState("login")
  }, [])

  const handleLogin = useCallback(() => {
    setTransitioning(true)
    setTimeout(() => {
      setAppState("app")
      setTransitioning(false)
    }, 300)
  }, [])

  const handleLogout = useCallback(async () => {
    setTransitioning(true)
    try {
      await supabase.auth.signOut()
      setAppState("login")
      setActiveTab("home")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setTransitioning(false)
    }
  }, [supabase])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
  }, [])

  // Splash screen
  if (appState === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // Login screen
  if (appState === "login") {
    return (
      <div
        className={`transition-opacity duration-300 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <LoginScreen onLogin={handleLogin} />
      </div>
    )
  }

  // Main app
  return (
    <div
      className={`min-h-screen bg-background transition-opacity duration-300 ${
        transitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span
            className="text-base font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {siteConfig.appName.includes("Go") ? (
              <>
                {siteConfig.appName.replace("Go", "")}
                <span className="text-primary">Go</span>
              </>
            ) : (
              siteConfig.appName
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border" title="Day streak">
            <span className="text-xs font-bold text-primary">{streak}</span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main>
        {view === "history" ? (
          <WorkoutHistory onBack={() => setView("main")} />
        ) : (
          <>
            {activeTab === "home" && (
              <Dashboard
                onNavigate={handleTabChange}
                onViewAll={() => setView("history")}
              />
            )}
            {activeTab === "run" && <RunTracker />}
            {activeTab === "exercises" && <ExerciseLibrary />}
            {activeTab === "ai-coach" && <AICoach />}
            {activeTab === "profile" && <ProfileScreen onLogout={handleLogout} />}
          </>
        )}
      </main>

      {/* Bottom navigation - hide when viewing history */}
      {view === "main" && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  )
}
