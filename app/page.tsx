"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { SplashScreen } from "@/components/splash-screen"
import { LoginScreen } from "@/components/login-screen"
import { BottomNav, type TabId } from "@/components/bottom-nav"
import { Dashboard } from "@/components/dashboard"

const TabLoader = () => (
  <div className="flex h-[70vh] items-center justify-center" aria-busy="true" aria-label="Loading">
    <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
)

const RunTracker = dynamic(() => import("@/components/run-tracker").then((m) => m.RunTracker), {
  ssr: false,
  loading: () => <TabLoader />,
})
const ExerciseLibrary = dynamic(
  () => import("@/components/exercise-library").then((m) => m.ExerciseLibrary),
  { ssr: false, loading: () => <TabLoader /> }
)
const AICoach = dynamic(() => import("@/components/ai-coach").then((m) => m.AICoach), {
  ssr: false,
  loading: () => <TabLoader />,
})
const ArenaHub = dynamic(() => import("@/components/arena-hub").then((m) => m.ArenaHub), {
  ssr: false,
  loading: () => <TabLoader />,
})
import { ProfileScreen } from "@/components/profile-screen"
import { WorkoutHistory } from "@/components/workout-history"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { SupabaseSetupGuide } from "@/components/supabase-setup-guide"
import { NetworkStatusIndicator } from "@/components/network-status-indicator"
import { Activity, AlertTriangle, X } from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { getProfile } from "@/lib/store-supabase"
import { isSecureContext } from "@/lib/secure-context"
import { siteConfig } from "@/lib/data"

type AppState = "splash" | "login" | "app"
type View = "main" | "history"

export default function Page() {
  const [appState, setAppState] = useState<AppState>("splash")
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [view, setView] = useState<View>("main")
  const [transitioning, setTransitioning] = useState(false)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [insecureContext, setInsecureContext] = useState(false)
  const [insecureBannerDismissed, setInsecureBannerDismissed] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null)
  const [initialName, setInitialName] = useState<string>("")
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
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && appState === "splash") {
          setAppState("app")
        } else if (!user && appState === "app") {
          setAppState("login")
        }
      } catch (error) {
        console.warn("Auth check failed:", getAuthErrorMessage(error, "Unable to validate auth session."))
        if (appState === "app") {
          setAppState("login")
        }
      }
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { user?: unknown } | null) => {
      if (event === "SIGNED_IN" && session) {
        setAppState("app")
      } else if (event === "SIGNED_OUT") {
        setAppState("login")
      }
    })

    return () => subscription.unsubscribe()
  }, [appState, supabase])

  // Check onboarding flag once the user is signed in.
  useEffect(() => {
    if (appState !== "app") return
    let cancelled = false
    getProfile()
      .then((p) => {
        if (cancelled) return
        setInitialName(p?.name ?? "")
        setNeedsOnboarding(p?.onboarded === false)
      })
      .catch(() => {
        if (!cancelled) setNeedsOnboarding(false)
      })
    return () => {
      cancelled = true
    }
  }, [appState])

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

  if (showSetupGuide) {
    return <SupabaseSetupGuide />
  }

  if (appState === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

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

  if (needsOnboarding) {
    return (
      <OnboardingWizard
        initialName={initialName}
        onComplete={() => setNeedsOnboarding(false)}
      />
    )
  }

  return (
    <div
      className={`min-h-screen bg-background transition-opacity duration-300 ${
        transitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Top bar — slim, brand-only. Streak lives in the Dashboard hero to
          avoid duplicate chrome. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 py-2.5">
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
            {activeTab === "arena" && <ArenaHub />}
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
