"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { SplashScreen } from "@/components/splash-screen"
import { LoginScreen } from "@/components/login-screen"
import { BottomNav, type TabId } from "@/components/bottom-nav"
import { Dashboard } from "@/components/dashboard"
import { BrandedTabLoad } from "@/components/app-tab-skeleton"
import { AppHydrateScreen } from "@/components/animated/AppHydrateScreen"

const RunTracker = dynamic(() => import("@/components/run-tracker").then((m) => m.RunTracker), {
  ssr: false,
  loading: () => (
    <BrandedTabLoad
      layout="map"
      label="Loading Run…"
      hint="Getting the tracker and map modules ready."
    />
  ),
})
const ExerciseLibrary = dynamic(
  () => import("@/components/exercise-library").then((m) => m.ExerciseLibrary),
  {
    ssr: false,
    loading: () => (
      <BrandedTabLoad layout="list" label="Loading Exercises…" hint="Fetching your workouts library shell." />
    ),
  },
)
const AICoach = dynamic(() => import("@/components/ai-coach").then((m) => m.AICoach), {
  ssr: false,
  loading: () => (
    <BrandedTabLoad
      layout="coach"
      label="Opening Form…"
      hint="Preparing on-device pose model — first open after refresh can take a few seconds."
    />
  ),
})
const ArenaHub = dynamic(() => import("@/components/arena-hub").then((m) => m.ArenaHub), {
  ssr: false,
  loading: () => (
    <BrandedTabLoad layout="default" label="Loading Arena…" hint="Fetching duels and leaderboards shell." />
  ),
})
import { ProfileScreen } from "@/components/profile-screen"
import { WorkoutHistory } from "@/components/workout-history"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { SupabaseSetupGuide } from "@/components/supabase-setup-guide"
import { NetworkStatusIndicator } from "@/components/network-status-indicator"
import { AlertTriangle, X } from "lucide-react"
import {
  createClient,
  invalidateSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client"
import { getAuthErrorMessage, isSupabaseFetchError } from "@/lib/supabase/config"
import {
  markSupabaseReachable,
  markSupabaseUnreachable,
} from "@/lib/supabase/connectivity-circuit"
import { primeSupabaseDevFromDiag } from "@/lib/supabase/dev-reachability"
import { getProfile, getStreak } from "@/lib/store-supabase"
import { isSecureContext } from "@/lib/secure-context"
import { setAICoachIntent } from "@/lib/ai-coach-intent"
import { AppHeader } from "@/components/app-header"
import { AmbientBackdrop } from "@/components/motion/ambient-backdrop"
import { TabTransition } from "@/components/motion/tab-transition"
import { isGuestMode, clearGuestMode, markGuestMode } from "@/lib/guest-mode"
import { rollingLocalDayWindows } from "@/lib/wearables/local-day-windows"

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
  const [supabaseCloudOffline, setSupabaseCloudOffline] = useState(false)

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

    let cancelled = false
    let subscription: { unsubscribe: () => void } | null = null

    async function runAuth() {
      const guest = guestSession || isGuestMode()

      if (process.env.NODE_ENV === "development" && !guest) {
        const diag = await primeSupabaseDevFromDiag()
        if (cancelled) return
        if (diag?.authReachable) {
          markSupabaseReachable()
          invalidateSupabaseBrowserClient()
          setSupabaseCloudOffline(false)
        } else if (diag && (diag as { configured?: boolean }).configured) {
          setSupabaseCloudOffline(true)
        }
      }
      if (cancelled) return
      if (guest) return

      const supabase = createClient()

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (guestSession || isGuestMode()) return
        if (user && appState === "splash") {
          setAppState("app")
        } else if (!user && appState === "app" && !guestSession && !isGuestMode()) {
          setAppState("login")
        }
      } catch (error) {
        if (cancelled) return
        if (isSupabaseFetchError(error)) markSupabaseUnreachable()
        console.warn("Auth check failed:", getAuthErrorMessage(error, "Unable to validate auth session."))
        if (!guestSession && !isGuestMode() && appState === "app") {
          setAppState("login")
        }
      }

      if (cancelled) return
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event: string, session: { user?: unknown } | null) => {
          if (isGuestMode() || guestSession) return
          if (event === "SIGNED_IN" && session) {
            clearGuestMode()
            setGuestSession(false)
            setAppState("app")
          } else if (event === "SIGNED_OUT") {
            clearGuestMode()
            setGuestSession(false)
            setAppState("login")
          }
        }
      )
      subscription = sub
    }

    void runAuth()

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [appState, guestSession])

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

  // Google Fit OAuth return: reconcile local-calendar days vs server UTC prefetch.
  useEffect(() => {
    if (appState !== "app" || guestSession) return
    let cancelled = false
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get("wearable_connected") !== "google_fit") return

      url.searchParams.delete("wearable_connected")
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)

      void (async () => {
        const days = rollingLocalDayWindows(14)
        await fetch("/api/wearables/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ provider: "google_fit", googleFitDays: days }),
        }).catch(() => {})
        if (cancelled) return
      })()
    } catch {
      /* ignore */
    }
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
      setActiveTab("ai-coach")
      setTransitioning(false)
    }, 300)
  }, [])

  const handleRequestSignInFromGuestCoach = useCallback(() => {
    clearGuestMode()
    setGuestSession(false)
    setTransitioning(true)
    setTimeout(() => {
      setAppState("login")
      setActiveTab("home")
      setTransitioning(false)
    }, 200)
  }, [])

  const handleLogout = useCallback(async () => {
    setTransitioning(true)
    try {
      clearGuestMode()
      setGuestSession(false)
      await createClient().auth.signOut()
      setAppState("login")
      setActiveTab("home")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setTransitioning(false)
    }
  }, [])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
  }, [])

  const handleOpenAICoachFromExercises = useCallback((opts?: { exerciseId?: string }) => {
    if (opts?.exerciseId) setAICoachIntent({ exerciseId: opts.exerciseId })
    handleTabChange("ai-coach")
  }, [handleTabChange])

  const handleOpenCustomExerciseBuilder = useCallback(() => {
    setAICoachIntent({ openCustomExerciseBuilder: true })
    handleTabChange("ai-coach")
  }, [handleTabChange])

  const handleProgramStartCoach = useCallback((specId: string) => {
    setAICoachIntent({ exerciseId: specId })
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
        <LoginScreen
          onLogin={handleLogin}
          onGuestEnter={handleGuestEnter}
          supabaseCloudOffline={supabaseCloudOffline}
        />
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

  if (appState === "app" && needsOnboarding === null) {
    return <AppHydrateScreen />
  }

  return (
    <div
      className={`relative min-h-screen transition-opacity duration-300 ${
        view === "main" && (activeTab === "home" || activeTab === "run" || activeTab === "ai-coach" || activeTab === "profile" || activeTab === "exercises") ? "bg-black" : "bg-background"
      } ${transitioning ? "opacity-0" : "opacity-100"}`}
    >
      {!(view === "main" && (activeTab === "home" || activeTab === "run" || activeTab === "ai-coach" || activeTab === "profile" || activeTab === "exercises")) ? <AmbientBackdrop /> : null}
      {!(view === "main" && (activeTab === "home" || activeTab === "run" || activeTab === "ai-coach" || activeTab === "profile" || activeTab === "exercises")) ? (
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
      ) : null}

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
          <TabTransition tabKey={activeTab}>
            {activeTab === "home" && (
              <Dashboard
                guestMode={guestSession}
                onNavigate={handleTabChange}
                onViewAll={() => setView("history")}
                onEnterCoachFocus={() => {
                  setCoachFocusMode(true)
                  setActiveTab("ai-coach")
                }}
                onStartProgramCoach={handleProgramStartCoach}
                onMobilityCoachIntent={() => {
                  setAICoachIntent({ openMobility: true })
                  setActiveTab("ai-coach")
                }}
              />
            )}
            {activeTab === "run" && <RunTracker guest={guestSession} streakDays={headerStreak} />}
            {activeTab === "exercises" && (
              <ExerciseLibrary
                onOpenAICoach={handleOpenAICoachFromExercises}
                onNavigate={handleTabChange}
                onCreateCustomExercise={handleOpenCustomExerciseBuilder}
              />
            )}
            {activeTab === "ai-coach" && (
              <AICoach
                focusMode={coachFocusMode}
                guestMode={guestSession}
                onExitFocus={() => setCoachFocusMode(false)}
                onNavigate={handleTabChange}
                onRequestSignIn={guestSession ? handleRequestSignInFromGuestCoach : undefined}
              />
            )}
            {activeTab === "arena" && <ArenaHub onNavigate={handleTabChange} />}
            {activeTab === "profile" && (
              <ProfileScreen onLogout={handleLogout} onCreateCustomExercise={handleOpenCustomExerciseBuilder} />
            )}
          </TabTransition>
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
