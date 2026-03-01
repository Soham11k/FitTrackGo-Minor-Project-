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
import { NetworkStatusIndicator } from "@/components/network-status-indicator"
import { Activity, AlertTriangle, X } from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getStreak } from "@/lib/store-supabase"
import { isSecureContext } from "@/lib/secure-context"
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
  const [insecureContext, setInsecureContext] = useState(false)
  const [insecureBannerDismissed, setInsecureBannerDismissed] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setInsecureContext(!isSecureContext())
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("fit-track-insecure-banner-dismissed") === "1") {
        setInsecureBannerDismissed(true)
      }
    } catch {}
  }, [])

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

  // Load streak for header when user is in app
  useEffect(() => {
    if (appState !== "app") return
    getStreak().then(setStreak).catch(() => setStreak(0))
  }, [appState])

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

  const dismissInsecureBanner = useCallback(() => {
    setInsecureBannerDismissed(true)
    try {
      sessionStorage?.setItem("fit-track-insecure-banner-dismissed", "1")
    } catch {}
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

      {/* Insecure context banner (HTTP / LAN) */}
      {appState === "app" && insecureContext && !insecureBannerDismissed && (
        <div className="sticky top-[57px] z-10 flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <p className="text-xs flex-1">
            Use <strong>localhost</strong> or <strong>HTTPS</strong> for camera and GPS (<code className="text-[10px] bg-amber-500/20 px-1 rounded">npm run dev:https</code> for LAN).
          </p>
          <button
            type="button"
            onClick={dismissInsecureBanner}
            className="shrink-0 p-1 rounded hover:bg-amber-500/20"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            {activeTab === "exercises" && <ExerciseLibrary onOpenAICoach={() => handleTabChange("ai-coach")} />}
            {activeTab === "ai-coach" && <AICoach />}
            {activeTab === "profile" && <ProfileScreen onLogout={handleLogout} />}
          </>
        )}
      </main>

      {/* Bottom navigation - hide when viewing history */}
      {view === "main" && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Network status indicator */}
      {appState === "app" && <NetworkStatusIndicator />}
    </div>
  )
}
