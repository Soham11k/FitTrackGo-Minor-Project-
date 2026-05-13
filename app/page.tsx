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
import { AlertTriangle, X } from "lucide-react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { getProfile, getStreak } from "@/lib/store-supabase"
import { isSecureContext } from "@/lib/secure-context"
import { setAICoachIntent } from "@/lib/ai-coach-intent"
import type { ExerciseId } from "@/lib/form-analysis"
import { AppHeader } from "@/components/app-header"
import { isGuestMode, clearGuestMode, markGuestMode } from "@/lib/guest-mode"

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
  const [coachFocusMode, setCoachFocusMode] = useState(false)
  const [headerStreak, setHeaderStreak] = useState(0)
  const [initialName, setInitialName] = useState<string>("")
  const [guestSession, setGuestSession] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && isGuestMode()) {
        setGuestSession(true)
        setAppState((s) => (s === "splash" || s === "login" ? "app" : s))
      }
    } catch {
      /* ignore */
    }
  }, [])

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
        if (guestSession) return
        if (user && appState === "splash") {
          setAppState("app")
        } else if (!user && appState === "app") {
          setAppState("login")
        }
      } catch (error) {
        console.warn("Auth check failed:", getAuthErrorMessage(error, "Unable to validate auth session."))
        if (!guestSession && appState === "app") {
          setAppState("login")
        }
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { user?: unknown } | null) => {
      if (event === "SIGNED_IN" && session) {
        clearGuestMode()
        setGuestSession(false)
        setAppState("app")
      } else if (event === "SIGNED_OUT") {
        clearGuestMode()
        setGuestSession(false)
        setAppState("login")
      }
    })

    return () => subscription.unsubscribe()
  }, [appState, supabase, guestSession])

  useEffect(() => {
    if (appState !== "app") return
    let cancelled = false
    void getStreak()
      .then((n) => {
        if (!cancelled) setHeaderStreak(Number(n) || 0)
      })
      .catch(() => {
        if (!cancelled) setHeaderStreak(0)
      })
    return () => {
      cancelled = true
    }
  }, [appState, activeTab])

  // Check onboarding flag once the user is signed in (skip for guest).
  useEffect(() => {
    if (appState !== "app") return
    if (guestSession) {
      setNeedsOnboarding(false)
      return
    }
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
  }, [appState, guestSession])

  // PWA manifest shortcuts: /?tab=run | ai-coach | arena
  useEffect(() => {
    if (appState !== "app") return
    try {
      const q = new URLSearchParams(window.location.search).get("tab")
      const allowed: TabId[] = ["home", "run", "exercises", "ai-coach", "arena", "profile"]
      if (q && (allowed as string[]).includes(q)) setActiveTab(q as TabId)
    } catch {
      /* ignore */
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

  const handleGuestEnter = useCallback(() => {
    markGuestMode()
    setGuestSession(true)
    setTransitioning(true)
    setTimeout(() => {
      setAppState("app")
      setTransitioning(false)
    }, 300)
  }, [])

  const handleLogout = useCallback(async () => {
    setTransitioning(true)
    try {
      clearGuestMode()
      setGuestSession(false)
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

  const handleOpenAICoachFromExercises = useCallback((opts?: { exerciseId?: ExerciseId }) => {
    if (opts?.exerciseId) setAICoachIntent({ exerciseId: opts.exerciseId })
    handleTabChange("ai-coach")
  }, [handleTabChange])

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
        <LoginScreen onLogin={handleLogin} onGuestEnter={handleGuestEnter} />
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
      <AppHeader
        guest={guestSession}
        streakChip={
          headerStreak > 0 ? (
            <span className="shrink-0 rounded-sm border border-border bg-transparent px-2.5 py-1 text-typo-micro font-bold uppercase tracking-[0.18em] text-foreground tabular-nums">
              <span className="text-primary">{headerStreak}d</span> streak
            </span>
          ) : null
        }
      />

      {/* Insecure context banner (HTTP / LAN) */}
      {appState === "app" && insecureContext && !insecureBannerDismissed && (
        <div className="sticky top-[57px] z-10 flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <p className="text-xs flex-1">
            Use <strong>localhost</strong> or <strong>HTTPS</strong> for camera and GPS (<code className="text-typo-eyebrow bg-amber-500/20 px-1 rounded">npm run dev:https</code> for LAN).
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
      <main className="min-h-0">
        {view === "history" ? (
          <WorkoutHistory
            onBack={() => setView("main")}
            onNavigate={(tab) => {
              setView("main")
              handleTabChange(tab)
            }}
          />
        ) : (
          <div key={activeTab} className="route-in pb-24">
            {activeTab === "home" && (
              <Dashboard
                onNavigate={handleTabChange}
                onViewAll={() => setView("history")}
                onEnterCoachFocus={() => {
                  setCoachFocusMode(true)
                  setActiveTab("ai-coach")
                }}
              />
            )}
            {activeTab === "run" && <RunTracker />}
            {activeTab === "exercises" && (
              <ExerciseLibrary onOpenAICoach={handleOpenAICoachFromExercises} onNavigate={handleTabChange} />
            )}
            {activeTab === "ai-coach" && (
              <AICoach
                focusMode={coachFocusMode}
                onExitFocus={() => setCoachFocusMode(false)}
                onNavigate={handleTabChange}
              />
            )}
            {activeTab === "arena" && <ArenaHub onNavigate={handleTabChange} />}
            {activeTab === "profile" && <ProfileScreen onLogout={handleLogout} />}
          </div>
        )}
      </main>

      {/* Bottom navigation - hide when viewing history */}
      {view === "main" && !(coachFocusMode && activeTab === "ai-coach") && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Network status indicator */}
      {appState === "app" && <NetworkStatusIndicator />}
    </div>
  )
}
