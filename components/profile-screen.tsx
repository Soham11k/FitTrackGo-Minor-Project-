"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import {
  User,
  Settings,
  Bell,
  Award,
  TrendingUp,
  Calendar,
  MapPin,
  Dumbbell,
  Flame,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Moon,
  Shield,
  HelpCircle,
  Mail,
  FileText,
  UserCheck,
  Watch,
  Heart,
  RefreshCw,
  Link2,
  Unlink,
  Download,
  Lock,
  Wand2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAccent } from "@/components/accent-provider"
import { ACCENT_OPTIONS, type AccentId } from "@/lib/accent"
import type { UserProfile, RunRecord, WorkoutRecord, CoachRecord } from "@/lib/store"
import { getProfile, saveProfile, getTotalStats, getWeeklyActivity, getRuns, getWorkouts, getCoachSessions, formatErr } from "@/lib/store-supabase"
import { BodyWeightRow } from "@/components/profile/body-weight-row"
import { getSupabaseSqlEditorUrl } from "@/lib/supabase/config"
import { getFaq, getAchievements, siteConfig, type AchievementDef } from "@/lib/data"
import { ContactForm } from "@/components/contact-form"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { DURATION, EASE, staggerDelaySec, staggerChildren, CINEMATIC } from "@/lib/motion"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { useChartEnterOnce } from "@/hooks/use-chart-enter-once"
import { LanguageSelector } from "@/components/language-selector"
import { UnitSelector } from "@/components/unit-selector"
import { useLocale } from "@/components/locale-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { buildExportBundle, downloadBlob, runToGpx } from "@/lib/export"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getFaceEnrollment, saveFaceEnrollment, deleteFaceEnrollment } from "@/lib/face-verification"
import { FaceEnrollCapture } from "@/components/face-enroll-capture"
import { AchievementBadge, type AchievementBadgeTier } from "@/components/ui/achievement-badge"
import { StatDisplay } from "@/components/ui/stat-display"
import { Switch } from "@/components/ui/switch"
import { isRunVoiceEnabled, setRunVoiceEnabled } from "@/lib/run-voice"
import {
  coachClipsCloudFeatureFlag,
  isCoachClipCloudSyncEnabled,
  isCoachReplayLocalEnabled,
  setCoachClipCloudSyncEnabled,
  setCoachReplayLocalEnabled,
} from "@/lib/coach-replay/prefs"
import { isCoachMidsetTipsEnabled, setCoachMidsetTipsEnabled } from "@/lib/coach-midset-tips"
import { isClipEncryptionEnabledEnv } from "@/lib/encryption/env"
import { fetchUserClipKeyRow } from "@/lib/user-clip-keys-supabase"
import { rollingLocalDayWindows } from "@/lib/wearables/local-day-windows"
import { PassphraseSetupDialog } from "@/components/encryption/passphrase-setup"
import { InlineScreenSkeleton } from "@/components/brand/inline-screen-skeleton"
import { ScreenTitle } from "@/components/brand/screen-title"
import { MetricGrid, MetricTile } from "@/components/brand/metric-panel"

const menuItems = [
  { icon: Bell, label: "Notifications", action: "notifications" },
  { icon: Moon, label: "Dark mode", action: "theme", toggle: true },
  { icon: Shield, label: "Privacy", action: "privacy" },
  { icon: FileText, label: "Terms of Service", action: "terms" },
  { icon: HelpCircle, label: "Help & Support", action: "help" },
  { icon: Settings, label: "Settings", action: "settings" },
]

function achievementBadgeTier(def: AchievementDef): AchievementBadgeTier {
  if (def.type === "streak") return "neon"
  if (def.targetValue >= 100) return "gold"
  if (def.targetValue >= 40) return "silver"
  return "bronze"
}

export function ProfileScreen({
  onLogout,
  onCreateCustomExercise,
}: {
  onLogout: () => void
  onCreateCustomExercise?: () => void
}) {
  const { t } = useLocale()
  const [editingName, setEditingName] = useState(false)
  const [editingLevel, setEditingLevel] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [newGoalInput, setNewGoalInput] = useState("")
  const [panel, setPanel] = useState<"notifications" | "support" | "settings" | null>(null)
  const { theme, setTheme } = useTheme()
  const { accent, setAccent } = useAccent()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [stats, setStats] = useState({ totalRuns: 0, totalWorkouts: 0, streak: 0, totalCalories: 0, totalDistance: 0, totalActiveMinutes: 0 })
  const [weekActivity, setWeekActivity] = useState<{ day: string; count: number; active: boolean }[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [coachSessions, setCoachSessions] = useState<CoachRecord[]>([])
  const [achievements, setAchievements] = useState<
    { title: string; description: string; earned: boolean; progress: number; tier: AchievementBadgeTier }[]
  >([])
  const [totalDistance, setTotalDistance] = useState(0)
  const [totalReps, setTotalReps] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [faceEnrolledStatus, setFaceEnrolledStatus] = useState<boolean | null>(null)
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [wearableLoading, setWearableLoading] = useState(false)
  const [runVoiceOn, setRunVoiceOn] = useState(false)
  const [coachReplayLocalOn, setCoachReplayLocalOn] = useState(true)
  const [coachClipSyncOn, setCoachClipSyncOn] = useState(false)
  const [midsetTipsOn, setMidsetTipsOn] = useState(false)
  const [clipPassphraseOpen, setClipPassphraseOpen] = useState(false)
  const [clipBackupOnServer, setClipBackupOnServer] = useState<boolean | null>(null)
  const [wearableSyncing, setWearableSyncing] = useState(false)
  const [wearableStatus, setWearableStatus] = useState<{
    configured: boolean
    connected: boolean
    lastSyncAt: string | null
    setupError?: string
    setup?: {
      oauthCallbackUrl: string | null
      reason?: string
      serverHasClientId?: boolean
      serverHasClientSecret?: boolean
    }
    latest: {
      restingHeartRate: number | null
      heartRateDate: string | null
      spo2AvgPct: number | null
      spo2Date: string | null
    } | null
  } | null>(null)
  /** Mirrors `providers.google_fit` from `/api/wearables/status` (Fitbit alone lives in `wearableStatus`). */
  const [wearableGoogleFit, setWearableGoogleFit] = useState<{
    configured: boolean
    connected: boolean
    lastSyncAt: string | null
  } | null>(null)
  const profileChartEnter = useChartEnterOnce()
  const reduceProfileMotion = useReducedMotion() ?? false
  // Use singleton client to prevent lock conflicts
  const supabase = createClient()

  useEffect(() => {
    if (!authUserId || !coachClipsCloudFeatureFlag() || !isClipEncryptionEnabledEnv()) return
    void fetchUserClipKeyRow().then((r) => setClipBackupOnServer(!!r))
  }, [authUserId])

  const showClipEncryptRow = coachClipsCloudFeatureFlag() && isClipEncryptionEnabledEnv()
  const achievementDefs = getAchievements()
  const faqList = getFaq()

  useEffect(() => {
    setRunVoiceOn(isRunVoiceEnabled())
    setCoachReplayLocalOn(isCoachReplayLocalEnabled())
    setCoachClipSyncOn(isCoachClipCloudSyncEnabled())
    setMidsetTipsOn(isCoachMidsetTipsEnabled())
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          toast.error("Supabase is not configured. Please check your environment variables.")
          setLoading(false)
          return
        }

        // Get user email from auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          throw new Error(`Authentication error: ${authError.message}`)
        }
        if (!user) {
          throw new Error("Not authenticated. Please sign in.")
        }
        
        if (user?.email) {
          setUserEmail(user.email)
        }
        setAuthUserId(user.id)
        const faceRec = await getFaceEnrollment(user.id)
        setFaceEnrolledStatus(!!faceRec?.signature?.length)

        const [p, s, w, r, wo, cs] = await Promise.all([
          getProfile(),
          getTotalStats(),
          getWeeklyActivity(),
          getRuns(),
          getWorkouts(),
          getCoachSessions(),
        ])
        setProfile(p)
        setStats(s)
        setWeekActivity(w)
        setRuns(r)
        setWorkouts(wo)
        setCoachSessions(cs)

        const calculatedDistance = r.reduce((a, run) => a + (run.distance || 0), 0)
        const calculatedReps = cs.reduce((a, c) => a + (c.reps || 0), 0)
        setTotalDistance(calculatedDistance)
        setTotalReps(calculatedReps)
        
        const activitiesCount = wo.length + cs.length
        const bestCoachScore = cs.length ? Math.max(...cs.map((c) => c.score || 0), 0) : 0

        const ach = achievementDefs.map((def) => {
          let current = 0
          if (def.type === "distance") current = calculatedDistance
          if (def.type === "activities") current = activitiesCount
          if (def.type === "coachScore") current = bestCoachScore
          if (def.type === "streak") current = s.streak
          if (def.type === "totalReps") current = calculatedReps
          const earned = current >= def.targetValue
          const progress = def.targetValue > 0 ? Math.min(100, (current / def.targetValue) * 100) : (earned ? 100 : 0)
          return { title: def.title, description: def.description, earned, progress, tier: achievementBadgeTier(def) }
        })
        setAchievements(ach)
      } catch (error: unknown) {
        const errorMessage = (error as Error)?.message ?? formatErr(error)
        console.error("Failed to load profile data:", errorMessage)
        
        // Check for database schema errors
        if (errorMessage.includes("Could not find the table") || errorMessage.includes("does not exist")) {
          if (process.env.NODE_ENV === "development") {
            toast.error("Database tables not set up. Please run the SQL schema.", {
              duration: 8000,
              action: {
                label: "View Instructions",
                onClick: () => {
                  window.open(getSupabaseSqlEditorUrl(), "_blank")
                  toast.info("1. Copy contents of supabase/schema.sql\n2. Paste in SQL Editor\n3. Click Run", { duration: 10000 })
                },
              },
            })
          } else {
            toast.error("We couldn't load your fitness profile. Please try again soon or contact support.")
          }
        } else if (errorMessage.includes("Not authenticated") || errorMessage.includes("Authentication error")) {
          toast.error(errorMessage)
          setTimeout(() => {
            toast.info("Please try logging out and logging back in", { duration: 5000 })
          }, 2000)
        } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
          setLoadError("Could not load profile. Check your connection.")
          toast.error("Could not load profile. Check your connection and retry.")
        } else {
          setLoadError(errorMessage)
          toast.error(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementDefs, retryCount])

  useEffect(() => {
    if (!authUserId) return
    let cancelled = false
    ;(async () => {
      setWearableLoading(true)
      try {
        const r = await fetch("/api/wearables/status", { credentials: "include" })
        const j = (await r.json()) as {
          fitbit?: {
            configured: boolean
            connected: boolean
            lastSyncAt: string | null
            setupError?: string
            setup?: {
              oauthCallbackUrl: string | null
              reason?: string
              serverHasClientId?: boolean
              serverHasClientSecret?: boolean
            }
            latest: {
              restingHeartRate: number | null
              heartRateDate: string | null
              spo2AvgPct: number | null
              spo2Date: string | null
            } | null
          }
          providers?: Record<
            string,
            { configured?: boolean; connected?: boolean; lastSyncAt?: string | null }
          >
          error?: string
        }
        if (cancelled) return
        if (!j.fitbit) {
          if (!cancelled) setWearableGoogleFit(null)
          return
        }
        const gf = j.providers?.google_fit
        setWearableGoogleFit(
          gf
            ? {
                configured: Boolean(gf.configured),
                connected: Boolean(gf.connected),
                lastSyncAt: (gf.lastSyncAt as string | null) ?? null,
              }
            : null
        )
        setWearableStatus({
          configured: j.fitbit.configured,
          connected: j.fitbit.connected,
          lastSyncAt: j.fitbit.lastSyncAt,
          setupError: j.fitbit.setupError,
          setup: j.fitbit.setup,
          latest: j.fitbit.latest,
        })
      } catch {
        if (!cancelled) {
          setWearableStatus(null)
          setWearableGoogleFit(null)
        }
      } finally {
        if (!cancelled) setWearableLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, retryCount])

  const refreshWearableStatus = async () => {
    try {
      const r = await fetch("/api/wearables/status", { credentials: "include" })
      const j = (await r.json()) as {
        fitbit?: {
          configured: boolean
          connected: boolean
          lastSyncAt: string | null
          setupError?: string
          setup?: {
            oauthCallbackUrl: string | null
            reason?: string
            serverHasClientId?: boolean
            serverHasClientSecret?: boolean
          }
          latest: {
            restingHeartRate: number | null
            heartRateDate: string | null
            spo2AvgPct: number | null
            spo2Date: string | null
          } | null
        }
        providers?: Record<
          string,
          { configured?: boolean; connected?: boolean; lastSyncAt?: string | null }
        >
      }
      if (j.fitbit) {
        const gf = j.providers?.google_fit
        setWearableGoogleFit(
          gf
            ? {
                configured: Boolean(gf.configured),
                connected: Boolean(gf.connected),
                lastSyncAt: (gf.lastSyncAt as string | null) ?? null,
              }
            : null
        )
        setWearableStatus({
          configured: j.fitbit.configured,
          connected: j.fitbit.connected,
          lastSyncAt: j.fitbit.lastSyncAt,
          setupError: j.fitbit.setupError,
          setup: j.fitbit.setup,
          latest: j.fitbit.latest,
        })
      } else if (!r.ok) {
        setWearableStatus((prev) =>
          prev ? { ...prev, connected: false, lastSyncAt: null, latest: null } : prev
        )
      }
    } catch {
      /* ignore */
    }
  }

  const handleConnectFitbit = () => {
    window.location.href = "/api/wearables/fitbit/authorize"
  }

  const handleSyncFitbit = async () => {
    setWearableSyncing(true)
    try {
      const r = await fetch("/api/wearables/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: "fitbit" }),
      })
      const j = (await r.json()) as { error?: string; spo2Days?: number; heartSynced?: boolean }
      if (!r.ok) {
        toast.error(j.error || "Sync failed")
        return
      }
      {
        const spo2 = j.spo2Days ?? 0
        const hr = j.heartSynced
        if (hr && spo2 > 0) {
          toast.success(`Synced · resting HR saved · SpO₂ ${spo2} day(s)`)
        } else if (hr) {
          toast.success("Synced · resting HR saved (no SpO₂ in the last week from Fitbit)")
        } else if (spo2 > 0) {
          toast.success(`Synced · SpO₂ ${spo2} day(s) (resting HR not ready — Fitbit often adds it after sleep/sync)`)
        } else {
          toast.info(
            "Synced, but Fitbit had no SpO₂ or resting heart rate in the last 30 days. Open the Fitbit app to sync the tracker, wear it overnight for SpO₂, then tap Sync again."
          )
        }
      }
      await refreshWearableStatus()
    } catch {
      toast.error("Sync failed")
    } finally {
      setWearableSyncing(false)
    }
  }

  const handleDisconnectFitbit = async () => {
    setWearableSyncing(true)
    try {
      const r = await fetch("/api/wearables/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: "fitbit" }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) {
        toast.error(j.error || "Disconnect failed")
        return
      }
      toast.success("Fitbit disconnected")
      setWearableStatus((prev) =>
        prev
          ? { ...prev, connected: false, lastSyncAt: null, latest: null }
          : {
              configured: true,
              connected: false,
              lastSyncAt: null,
              latest: null,
            }
      )
      await refreshWearableStatus()
    } catch {
      toast.error("Disconnect failed")
    } finally {
      setWearableSyncing(false)
    }
  }

  const handleConnectGoogleFit = () => {
    window.location.href = "/api/wearables/google_fit/auth"
  }

  const handleDisconnectGoogleFit = async () => {
    setWearableSyncing(true)
    try {
      const r = await fetch("/api/wearables/google_fit/disconnect", {
        method: "POST",
        credentials: "include",
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) {
        toast.error(j.error || "Could not disconnect Google Fit")
        return
      }
      toast.success("Google Fit disconnected")
      await refreshWearableStatus()
    } catch {
      toast.error("Could not disconnect Google Fit")
    } finally {
      setWearableSyncing(false)
    }
  }

  const handleSyncGoogleFit = async () => {
    setWearableSyncing(true)
    try {
      const days = rollingLocalDayWindows(14)
      const r = await fetch("/api/wearables/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: "google_fit", googleFitDays: days }),
      })
      const j = (await r.json()) as { error?: string; daysWritten?: number }
      if (!r.ok) {
        toast.error(j.error || "Google Fit sync failed")
        return
      }
      const n = typeof j.daysWritten === "number" ? j.daysWritten : 0
      if (n > 0) {
        toast.success(`Google Fit · updated ${n} day(s)`)
      } else {
        toast.info("Synced — no new step/hr/spo₂ buckets yet (open Google Fit so data can populate).")
      }
      await refreshWearableStatus()
    } catch {
      toast.error("Google Fit sync failed")
    } finally {
      setWearableSyncing(false)
    }
  }

  const wearablesOAuthConfigured =
    Boolean(wearableStatus?.configured) || Boolean(wearableGoogleFit?.configured)

  const displayName = profile?.name?.trim() || "Athlete"
  const profileInitial = displayName.charAt(0).toUpperCase()
  const joinYear = profile?.joinDate ? new Date(profile.joinDate).getFullYear() : new Date().getFullYear()
  const totalSessions = runs.length + workouts.length + coachSessions.length
  const activeDays = weekActivity.filter((d) => d.active).length

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      try {
        await saveProfile({ name: trimmed })
        const updated = await getProfile()
        setProfile(updated)
        setEditingName(false)
        setNameInput("")
        toast.success("Name updated")
      } catch (error) {
        toast.error("Failed to update name")
        console.error(error)
      }
    } else {
      setEditingName(false)
      setNameInput("")
    }
  }

  const handleSaveLevel = async (level: UserProfile['level']) => {
    try {
      await saveProfile({ level })
      const updated = await getProfile()
      setProfile(updated)
      setEditingLevel(false)
      toast.success(`Level updated to ${level}`)
    } catch (error) {
      toast.error("Failed to update level")
      console.error(error)
    }
  }

  const handleAddGoal = async () => {
    const trimmed = newGoalInput.trim()
    if (!trimmed) return
    
    const currentGoals = profile?.goals || []
    if (currentGoals.includes(trimmed)) {
      toast.error("Goal already exists")
      return
    }
    
    try {
      const newGoals = [...currentGoals, trimmed]
      await saveProfile({ goals: newGoals })
      const updated = await getProfile()
      setProfile(updated)
      setNewGoalInput("")
      toast.success("Goal added")
    } catch (error) {
      toast.error("Failed to add goal")
      console.error(error)
    }
  }

  const handleRemoveGoal = async (goalToRemove: string) => {
    const currentGoals = profile?.goals || []
    const newGoals = currentGoals.filter(g => g !== goalToRemove)
    
    try {
      await saveProfile({ goals: newGoals })
      const updated = await getProfile()
      setProfile(updated)
      toast.success("Goal removed")
    } catch (error) {
      toast.error("Failed to remove goal")
      console.error(error)
    }
  }

  const handleMenuAction = (action: string) => {
    if (action === "theme") {
      setTheme(theme === "dark" ? "light" : "dark")
      toast.success(theme === "dark" ? "Switched to light mode" : "Switched to dark mode")
      return
    }
    if (action === "notifications") {
      setPanel("notifications")
      return
    }
    if (action === "help") {
      setPanel("support")
      return
    }
    if (action === "settings") {
      setPanel("settings")
      return
    }
    if (action === "privacy") {
      window.location.href = siteConfig.privacyUrl || "/privacy"
      return
    }
    if (action === "terms") {
      window.location.href = siteConfig.termsUrl || "/terms"
      return
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-28">
        <InlineScreenSkeleton
          label="Loading profile…"
          hint="Preparing your metrics, privacy settings, and connected services."
          layout="default"
          showLogo
        />
      </div>
    )
  }

  // Show connection/profile load error with Retry
  if (loadError && !loading) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-6 space-y-4">
          <h2 className="text-lg font-bold text-destructive">Couldn&apos;t load profile</h2>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          {process.env.NODE_ENV === "development" &&
            (loadError.includes("fetch") || loadError.includes("Failed to fetch")) && (
            <p className="text-xs text-muted-foreground">
              Check <code className="bg-muted px-1 rounded">.env.local</code> (NEXT_PUBLIC_SUPABASE_URL and anon key), then restart the dev server. See <code className="bg-muted px-1 rounded">FAILED-TO-FETCH-FIX.md</code> for steps.
            </p>
          )}
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Show database setup message if profile is null and we're not loading
  if (!profile && !loading) {
    const isDev = process.env.NODE_ENV === "development"
    return (
      <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
              <Settings className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isDev ? "Database setup required" : "Profile not available"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isDev
                  ? "Your database tables need to be created"
                  : "We couldn't finish loading your profile. Try refreshing, or sign out and sign in again."}
              </p>
            </div>
          </div>

          {isDev ? (
            <>
              <div className="space-y-3 text-sm">
                <p className="text-foreground">To fix this, run the database schema in Supabase:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                  <li>Go to <a href={getSupabaseSqlEditorUrl()} target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase SQL Editor</a></li>
                  <li>Open <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">supabase/schema.sql</code> in your project</li>
                  <li>Copy the entire contents</li>
                  <li>Paste into SQL Editor and click <strong>Run</strong></li>
                  <li>Refresh this page</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <a
                  href={getSupabaseSqlEditorUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground text-center hover:bg-primary/90 transition-colors"
                >
                  Open SQL Editor
                </a>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
                >
                  Refresh
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                See <code className="bg-secondary px-1.5 py-0.5 rounded">DATABASE-SETUP.md</code> for detailed instructions
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-5 px-4 pt-4 pb-28 animate-fade-in-up" data-testid="screen-profile">
      <ScreenTitle title="Profile" subtitle="Account, fitness summary, and settings." />

      <div className="nrc-card p-5">
        <div className="flex items-start gap-4">
          {/* Avatar with orbiting Volt ring */}
          <div className="relative h-20 w-20 shrink-0" aria-hidden>
            {/* Orbiting ring */}
            <motion.div
              className="pointer-events-none absolute inset-[-6px] rounded-3xl border-2 border-primary/40"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            {/* Volt dot on the ring */}
            <motion.div
              className="absolute h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] z-10"
              style={{ top: -3, left: "50%", translateX: "-50%" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-foreground text-2xl font-bold text-background shadow-[0_12px_32px_-16px_oklch(0_0_0/0.45)]"
            >
              {profileInitial}
            </div>
          </div>
          <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={displayName}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName()
                    if (e.key === "Escape") { setEditingName(false); setNameInput("") }
                  }}
                />
                <button type="button" onClick={handleSaveName} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  Save
                </button>
                <button type="button" onClick={() => { setEditingName(false); setNameInput("") }} className="text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded">
                  Cancel
                </button>
              </div>
              <p className="text-typo-caption text-muted-foreground">Member since {joinYear}</p>
            </div>
          ) : (
            <>
              <h2
                className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
              >
                {displayName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Member since {joinYear}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(true)
                    setNameInput(profile?.name || "")
                  }}
                  className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded underline-offset-4"
                >
                  Edit name
                </button>
                {userEmail && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={() => handleMenuAction("settings")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label="Settings">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
        </div>
      </div>

      <section className="nrc-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Fitness summary</h2>
        <MetricGrid cols={2}>
          <MetricTile label="Sessions" value={String(totalSessions)} numericValue={totalSessions} tone="coach" icon={Dumbbell} />
          <MetricTile label="Distance" value={totalDistance.toFixed(1)} numericValue={totalDistance} unit="km" tone="run" icon={MapPin} />
          <MetricTile label="Streak" value={String(stats.streak)} numericValue={stats.streak} unit="days" tone="streak" icon={Flame} />
          <MetricTile label="Active days" value={String(activeDays)} numericValue={activeDays} unit="/ 7" tone="move" icon={Calendar} />
        </MetricGrid>
      </section>

      {/* Profile Details Section */}
      <section className="rounded-2xl bg-card p-4 border border-border space-y-3 animate-fade-in-up animate-stagger-2 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-foreground">Profile details</h2>

        {/* Level Selection */}
        <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">Fitness level</p>
            {!editingLevel && (
              <button
                type="button"
                onClick={() => setEditingLevel(true)}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                Change
              </button>
            )}
          </div>
          {editingLevel ? (
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleSaveLevel(level)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    profile?.level === level
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
              <button onClick={() => setEditingLevel(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold capitalize text-foreground">{profile?.level || "beginner"}</p>
          )}
        </div>

        {/* Goals */}
        <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">Goals</p>
            {!editingGoals && (
              <button
                type="button"
                onClick={() => setEditingGoals(true)}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                {profile?.goals?.length ? "Edit" : "Add"}
              </button>
            )}
          </div>
          {editingGoals ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGoalInput}
                  onChange={(e) => setNewGoalInput(e.target.value)}
                  placeholder="Add a goal..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddGoal()
                    }
                  }}
                />
                <button onClick={handleAddGoal} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile?.goals?.map((goal) => (
                  <div key={goal} className="flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-xs text-primary">
                    <span>{goal}</span>
                    <button
                      onClick={() => handleRemoveGoal(goal)}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove ${goal}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => { setEditingGoals(false); setNewGoalInput("") }} className="text-xs text-muted-foreground">Done</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile?.goals && profile.goals.length > 0 ? (
                profile.goals.map((goal) => (
                  <span key={goal} className="rounded-lg bg-primary/15 px-2 py-1 text-xs text-primary">
                    {goal}
                  </span>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingGoals(true)}
                  className="mt-2 w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary"
                >
                  Add your first goal
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-3">
          <BodyWeightRow profile={profile} onSaved={async () => { const u = await getProfile(); setProfile(u) }} />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-4 border border-border space-y-3 animate-fade-in-up animate-stagger-3 transition-shadow duration-300 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Watch className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Wearables</h2>
              <p className="text-typo-caption text-muted-foreground leading-snug">
                Fitbit (minute HR + SpO₂) and Google Fit (daily aggregates). Not medical advice.
              </p>
            </div>
          </div>
        </div>
        {wearableLoading && wearableStatus === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !wearableLoading && wearableStatus === null ? (
          <p className="text-xs text-muted-foreground">Could not load wearable status.</p>
        ) : wearableStatus != null && !wearablesOAuthConfigured ? (
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Wearable OAuth isn&apos;t configured on the server</p>
            {process.env.NODE_ENV === "development" ? (
              <>
                <p>
                  Create an app at{" "}
                  <a href="https://dev.fitbit.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    dev.fitbit.com/apps
                  </a>
                  , then put <code className="text-typo-eyebrow bg-muted px-1 rounded">FITBIT_CLIENT_ID</code> and{" "}
                  <code className="text-typo-eyebrow bg-muted px-1 rounded">FITBIT_CLIENT_SECRET</code> in{" "}
                  <code className="text-typo-eyebrow bg-muted px-1 rounded">.env.local</code> and restart{" "}
                  <code className="text-typo-eyebrow bg-muted px-1 rounded">npm run dev</code> so Next.js reloads env.
                </p>
                {wearableStatus.setup?.oauthCallbackUrl ? (
                  <p>
                    In the Fitbit app, set <strong>Callback URL</strong> to exactly:{" "}
                    <code className="text-typo-eyebrow bg-muted px-1 rounded break-all">{wearableStatus.setup.oauthCallbackUrl}</code>
                  </p>
                ) : (
                  <p>
                    Set <code className="text-typo-eyebrow bg-muted px-1 rounded">NEXT_PUBLIC_APP_URL</code> in{" "}
                    <code className="text-typo-eyebrow bg-muted px-1 rounded">.env.local</code> (e.g.{" "}
                    <code className="text-typo-eyebrow bg-muted px-1 rounded">http://localhost:3000</code>) so the callback URL can be built.
                  </p>
                )}
                <p className="text-typo-caption opacity-90">
                  Add Fitbit and/or Google OAuth keys (see <code className="text-typo-eyebrow bg-muted px-1 rounded">config/vercel-wearables.env.example</code> for
                  Vercel).
                </p>
                {(wearableStatus.setup?.serverHasClientId === false ||
                  wearableStatus.setup?.serverHasClientSecret === false) && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-typo-caption text-amber-800 dark:text-amber-100">
                    <p className="font-medium text-amber-900 dark:text-amber-50 mb-1">Server still does not see Fitbit OAuth env</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {wearableStatus.setup?.serverHasClientId === false && (
                        <li>
                          <code className="text-typo-eyebrow bg-black/10 dark:bg-black/30 px-1 rounded">FITBIT_CLIENT_ID</code> is missing or empty — paste the value from dev.fitbit.com after the <code className="text-typo-eyebrow">=</code> with no spaces.
                        </li>
                      )}
                      {wearableStatus.setup?.serverHasClientSecret === false && (
                        <li>
                          <code className="text-typo-eyebrow bg-black/10 dark:bg-black/30 px-1 rounded">FITBIT_CLIENT_SECRET</code> is missing or empty — same as above.
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
                      Save <code className="text-typo-eyebrow bg-black/10 dark:bg-black/30 px-1 rounded">.env.local</code> in the project root, then stop and start{" "}
                      <code className="text-typo-eyebrow bg-black/10 dark:bg-black/30 px-1 rounded">npm run dev</code> (reload is not enough).
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p>Your organizer can enable Fitbit in a future update.</p>
            )}
          </div>
        ) : (
          <>
            {wearableStatus?.setupError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{wearableStatus.setupError}</p>
            )}
            {!wearableStatus?.connected && wearableStatus?.configured ? (
              <div className="flex justify-center py-1 text-primary" aria-hidden>
                <Image src="/illustrations/wearables-disconnected.svg" alt="" width={64} height={64} className="h-16 w-16 opacity-90" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!wearableStatus?.connected ? (
                <button
                  type="button"
                  onClick={handleConnectFitbit}
                  disabled={!wearableStatus?.configured || !!wearableStatus?.setupError}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect Fitbit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSyncFitbit}
                    disabled={wearableSyncing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${wearableSyncing ? "animate-spin" : ""}`} />
                    Sync now
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectFitbit}
                    disabled={wearableSyncing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {wearableStatus?.connected &&
              (wearableStatus.latest ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-typo-eyebrow text-muted-foreground uppercase tracking-wide mb-1">
                      <Heart className="h-3 w-3" />
                      Resting HR
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {wearableStatus.latest.restingHeartRate != null ? `${wearableStatus.latest.restingHeartRate} bpm` : "—"}
                    </p>
                    {wearableStatus.latest.heartRateDate && (
                      <p className="text-typo-eyebrow text-muted-foreground mt-0.5">{wearableStatus.latest.heartRateDate}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-typo-eyebrow text-muted-foreground uppercase tracking-wide mb-1">
                      SpO₂ avg
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {wearableStatus.latest.spo2AvgPct != null ? `${Number(wearableStatus.latest.spo2AvgPct).toFixed(1)}%` : "—"}
                    </p>
                    {wearableStatus.latest.spo2Date && (
                      <p className="text-typo-eyebrow text-muted-foreground mt-0.5">{wearableStatus.latest.spo2Date}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pt-1">No metrics loaded yet. Tap Sync now.</p>
              ))}
            {wearableStatus?.connected && wearableStatus.lastSyncAt ? (
              <p className="text-typo-eyebrow text-muted-foreground">
                Fitbit last sync: {new Date(wearableStatus.lastSyncAt).toLocaleString()}
              </p>
            ) : null}
            {wearableGoogleFit?.configured ? (
              <div className="border-t border-border pt-3 mt-2 space-y-2">
                <p className="text-typo-caption font-bold uppercase tracking-[0.14em] text-muted-foreground">Google Fit</p>
                {!wearableGoogleFit.connected ? (
                  <button
                    type="button"
                    onClick={handleConnectGoogleFit}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    Connect Google Fit
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSyncGoogleFit()}
                      disabled={wearableSyncing}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${wearableSyncing ? "animate-spin" : ""}`} aria-hidden />
                      Sync now
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDisconnectGoogleFit()}
                      disabled={wearableSyncing}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <Unlink className="h-3.5 w-3.5" aria-hidden />
                      Disconnect Google Fit
                    </button>
                  </div>
                )}
                {wearableGoogleFit.connected && wearableGoogleFit.lastSyncAt ? (
                  <p className="text-typo-eyebrow text-muted-foreground">
                    Google Fit last sync: {new Date(wearableGoogleFit.lastSyncAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 border border-border" title="Total runs">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-metric-run/15">
            <MapPin className="h-4 w-4 text-metric-run" />
          </div>
          <StatDisplay eyebrow="Runs" value={stats.totalRuns} valueClassName="text-foreground tabular-nums" size="md" />
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 border border-border" title="Workouts + AI sessions">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-metric-move/15">
            <Dumbbell className="h-4 w-4 text-metric-move" />
          </div>
          <StatDisplay eyebrow="Workouts" value={stats.totalWorkouts} valueClassName="text-foreground tabular-nums" size="md" />
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 border border-border" title="Current streak">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-metric-streak/15">
            <TrendingUp className="h-4 w-4 text-metric-streak" />
          </div>
          <StatDisplay eyebrow="Streak" value={`${stats.streak}d`} valueClassName="text-foreground tabular-nums" size="md" />
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 border border-border" title="Earned achievements">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-metric-coach/15">
            <Award className="h-4 w-4 text-metric-coach" />
          </div>
          <StatDisplay eyebrow="Badges" value={achievements.filter((a) => a.earned).length} valueClassName="text-foreground tabular-nums" size="md" />
        </div>
      </div>

      <section className="rounded-2xl bg-card p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">This Week</h2>
          <span className="text-xs font-semibold tabular-nums text-metric-move">
            {activeDays}/7 days
          </span>
        </div>
        {weekActivity.length >= 2 && (
          <div className="mb-3">
            <MetricTrendMini
              className="h-20 w-full"
              points={weekActivity.map((d) => ({ v: d.count }))}
              stroke="var(--primary)"
              stopColor="var(--primary)"
              isAnimationActive={profileChartEnter}
            />
          </div>
        )}
        {weekActivity.length > 0 ? (
          (() => {
            const peak = Math.max(1, ...weekActivity.map((d) => d.count))
            return (
              <div className="flex items-end justify-between gap-2 px-1" style={{ height: 80 }}>
                {weekActivity.map((day, i) => {
                  const heightPct = day.active ? Math.max(18, (day.count / peak) * 100) : 8
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-md transition-[height] duration-500 ease-out ${
                            day.active
                              ? "bg-gradient-to-t from-metric-move to-primary"
                              : "bg-muted-foreground/15"
                          }`}
                          style={{ height: `${heightPct}%` }}
                          aria-label={`${day.day}: ${day.count} sessions`}
                        />
                      </div>
                      <span className="text-typo-eyebrow font-semibold uppercase tracking-wider text-muted-foreground">
                        {day.day}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()
        ) : (
          <div className="w-full text-center py-4 text-sm text-muted-foreground">No activity data available</div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Achievements</h2>
          <span className="text-xs text-muted-foreground">{achievements.filter((a) => a.earned).length}/{achievements.length}</span>
        </div>
        <motion.div
          className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          variants={staggerChildren(0.04, 0.06)}
          initial={reduceProfileMotion ? false : "hidden"}
          animate="show"
        >
          {achievements.length > 0
            ? achievements.map((ach, i) => (
                <motion.button
                  key={ach.title}
                  variants={CINEMATIC.statReveal}
                  type="button"
                  onClick={() => toast.info(ach.earned ? ach.title : `${ach.title}: ${Math.round(ach.progress)}%`)}
                  className={`motion-card flex min-w-[7.5rem] max-w-[8.5rem] shrink-0 snap-start snap-always flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${ach.earned ? "border-primary/30 bg-card shadow-[0_0_16px_-4px_rgb(251_191_36/0.25)]" : "border-border bg-card opacity-75"}`}
                  initial={reduceProfileMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: DURATION.medium,
                    delay: reduceProfileMotion ? 0 : staggerDelaySec(i, 9, 0.04),
                    ease: EASE.out,
                  }}
                >
                  <AchievementBadge tier={ach.tier} earned={ach.earned} title={ach.title} className="w-full px-1" />
                  {!ach.earned && ach.progress > 0 && (
                    <div className="mt-2 w-full h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${ach.progress}%` }} />
                    </div>
                  )}
                </motion.button>
              ))
            : (
                <div className="w-full shrink-0 py-4 text-center text-sm text-muted-foreground">
                  No achievements available
                </div>
              )}
        </motion.div>
      </section>

      <section className="rounded-2xl bg-card p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">All-time</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
        {(() => {
          const activitiesCount = workouts.length + runs.length + coachSessions.length
          // Soft milestones per metric — progress bars fill toward the next one.
          const distanceTarget = 42
          const activitiesTarget = Math.max(50, Math.ceil(activitiesCount / 50) * 50)
          const caloriesTarget = Math.max(5000, Math.ceil((stats.totalCalories || 0) / 5000) * 5000)
          const repsTarget = Math.max(500, Math.ceil(totalReps / 500) * 500)
          return (
            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Distance</span>
                  <span
                    className="text-metric-run font-bold tabular-nums"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {totalDistance.toFixed(1)} km
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-metric-run transition-all duration-500"
                    style={{ width: `${Math.min(100, (totalDistance / distanceTarget) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Activities</span>
                  <span
                    className="text-metric-move font-bold tabular-nums"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {activitiesCount}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-metric-move transition-all duration-500"
                    style={{ width: `${Math.min(100, (activitiesCount / activitiesTarget) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Total Reps</span>
                  <span
                    className="text-metric-coach font-bold tabular-nums"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {totalReps}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-metric-coach transition-all duration-500"
                    style={{ width: `${Math.min(100, (totalReps / repsTarget) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Calories</span>
                  <span
                    className="text-metric-hr font-bold tabular-nums"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {stats.totalCalories || 0}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-metric-hr transition-all duration-500"
                    style={{ width: `${Math.min(100, ((stats.totalCalories || 0) / caloriesTarget) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Coach Assist – Face recognition</h3>
              <p className="text-xs text-muted-foreground">
                {faceEnrolledStatus === null ? "…" : faceEnrolledStatus ? "Only your reps count for this account." : "Enroll so only your reps count."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={() => setShowFaceEnrollModal(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {faceEnrolledStatus ? "Re-enroll face" : "Enroll face"}
            </button>
            {faceEnrolledStatus && authUserId && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteFaceEnrollment(authUserId)
                    setFaceEnrolledStatus(false)
                    toast.success("Face un-enrolled. Anyone in frame can count reps in Coach Assist.")
                  } catch {
                    toast.error("Could not un-enroll face.")
                  }
                }}
                className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                Un-enroll face
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        {menuItems.map((item, i) => (
          <motion.div
            key={item.label}
            role="button"
            tabIndex={0}
            onClick={() => handleMenuAction(item.action)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleMenuAction(item.action)
              }
            }}
            whileTap={{ scale: 0.98 }}
            className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl ${i < menuItems.length - 1 ? "border-b border-border" : ""}`}
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">{item.label}</span>
            {item.toggle ? (
              <div
                role="switch"
                aria-checked={theme === "dark"}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark"); toast.success(theme === "dark" ? "Light mode" : "Dark mode"); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark"); toast.success(theme === "dark" ? "Light mode" : "Dark mode"); } }}
                className={`h-6 w-10 rounded-full p-0.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${theme === "dark" ? "bg-primary" : "bg-secondary"}`}
              >
                <div className={`h-5 w-5 rounded-full transition-transform ${theme === "dark" ? "bg-primary-foreground translate-x-4" : "bg-foreground translate-x-0.5"}`} />
              </div>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </motion.div>
        ))}
      </section>

      {/* Notifications / Support / Settings panel */}
      {panel && (
        <section className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <button type="button" onClick={() => setPanel(null)} className="p-1 -ml-1 rounded-lg hover:bg-secondary" aria-label="Back">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <h2 className="text-sm font-semibold text-foreground">
              {panel === "notifications" ? "Notifications" : panel === "support" ? "Help & Support" : "Settings"}
            </h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-foreground">
            {panel === "notifications" && (
              <>
                <p className="text-muted-foreground">Manage when you get reminders and activity alerts.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof Notification !== "undefined" && Notification.permission === "default") {
                      Notification.requestPermission().then((p) => toast.info(p === "granted" ? "Notifications enabled." : "Permission denied."))
                    } else {
                      toast.info("Check your device or browser settings to manage notifications.")
                    }
                  }}
                  className="rounded-xl bg-primary/15 text-primary px-4 py-2 font-medium"
                >
                  Enable notifications
                </button>
                <p className="text-xs text-muted-foreground pt-2">Enable browser notifications to get alerts from this app. In-app reminders and achievements may be added in a future update.</p>
              </>
            )}
            {panel === "support" && (
              <>
                <p className="text-muted-foreground">Frequently asked questions</p>
                <ul className="space-y-2 text-muted-foreground">
                  {faqList.map((item) => (
                    <li key={item.id} className="border-b border-border pb-2 last:border-0">
                      <span className="font-medium text-foreground">{item.question}</span>
                      <p className="text-xs mt-1">{item.answer}</p>
                    </li>
                  ))}
                </ul>
                <p className="pt-3 font-medium text-foreground">Contact us</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                  <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline">{siteConfig.supportEmail}</a>
                </p>
                <div className="pt-2">
                  <ContactForm />
                </div>
              </>
            )}
            {panel === "settings" && (
              <>
                <p className="text-muted-foreground">App preferences</p>
                <div className="space-y-2">
                  <LanguageSelector />
                  <UnitSelector />
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">Run voice cues</p>
                      <p className="text-xs text-muted-foreground max-w-[14rem] sm:max-w-none">
                        Spoken kilometer splits while tracking a run
                      </p>
                    </div>
                    <Switch
                      checked={runVoiceOn}
                      onCheckedChange={(on) => {
                        setRunVoiceEnabled(on)
                        setRunVoiceOn(on)
                      }}
                      aria-label="Toggle run voice cues"
                    />
                  </div>
                  {onCreateCustomExercise ? (
                    <button
                      type="button"
                      onClick={onCreateCustomExercise}
                      className="flex w-full items-center gap-3 py-3 border-b border-border text-left hover:bg-muted/40 rounded-lg px-1 -mx-1 transition-colors"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                        <Wand2 className="h-4 w-4 text-primary" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Custom exercises</p>
                        <p className="text-xs text-muted-foreground">Describe a movement — AI builds form rules for Coach</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("profile.coachReplayLocal")}</p>
                      <p className="text-xs text-muted-foreground max-w-[14rem] sm:max-w-none">
                        {t("profile.coachReplayLocalHelp")}
                      </p>
                    </div>
                    <Switch
                      checked={coachReplayLocalOn}
                      onCheckedChange={(on) => {
                        setCoachReplayLocalEnabled(on)
                        setCoachReplayLocalOn(on)
                      }}
                      aria-label="Toggle local coach clip recording"
                    />
                  </div>
                  {coachClipsCloudFeatureFlag() ? (
                    <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("profile.coachClipSync")}</p>
                        <p className="text-xs text-muted-foreground max-w-[14rem] sm:max-w-none">
                          {t("profile.coachClipSyncHelp")}
                        </p>
                        <p className="mt-1 text-[11px] text-primary/80">Required for AI review.</p>
                      </div>
                      <Switch
                        checked={coachClipSyncOn}
                        onCheckedChange={(on) => {
                          setCoachClipCloudSyncEnabled(on)
                          setCoachClipSyncOn(on)
                        }}
                        aria-label="Toggle coach clip cloud sync"
                      />
                    </div>
                  ) : null}
                  {showClipEncryptRow ? (
                    <div className="flex flex-col gap-3 py-3 border-b border-border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 min-w-0">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                            <Lock className="h-4 w-4 text-primary" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">Clip &amp; privacy key</p>
                            <p className="text-xs text-muted-foreground max-w-[16rem] sm:max-w-none">
                              This device key encrypts replay clips for the cloud and (by default) your display name plus run GPS
                              paths in Postgres. Back it up with a passphrase so another browser can decrypt your data — we never see
                              the passphrase.
                            </p>
                            {clipBackupOnServer === false ? (
                              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">No backup saved yet.</p>
                            ) : clipBackupOnServer === true ? (
                              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Backup on account.</p>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg border border-border bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-secondary/60"
                          onClick={() => setClipPassphraseOpen(true)}
                        >
                          Back up key
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("profile.midsetTips")}</p>
                      <p className="text-xs text-muted-foreground max-w-[14rem] sm:max-w-none">
                        {t("profile.midsetTipsHelp")}
                      </p>
                    </div>
                    <Switch
                      checked={midsetTipsOn}
                      onCheckedChange={(on) => {
                        setCoachMidsetTipsEnabled(on)
                        setMidsetTipsOn(on)
                      }}
                      aria-label="Toggle mid-set AI tips"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span>Theme</span>
                    <span className="text-muted-foreground">Use the Dark mode toggle above</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
                    <span>Theme color</span>
                    <div className="flex gap-2" role="group" aria-label="Accent color">
                      {ACCENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAccent(opt.id as AccentId); toast.success(`${opt.name} theme`); }}
                          className={`h-8 w-8 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${accent === opt.id ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                          style={{ backgroundColor: opt.lightHex }}
                          title={opt.name}
                          aria-pressed={accent === opt.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {authUserId && (
        <Dialog open={showFaceEnrollModal} onOpenChange={(open) => !open && setShowFaceEnrollModal(false)}>
          <DialogContent
            className="max-w-md overflow-hidden p-0 gap-0 sm:max-w-md"
            showCloseButton
            aria-describedby="face-enroll-desc"
          >
            <DialogHeader className="px-4 py-3 border-b border-border text-left">
              <DialogTitle>{t("face.enrollTitle")}</DialogTitle>
              <DialogDescription id="face-enroll-desc" className="text-left">
                {t("face.enrollDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="p-0">
              <FaceEnrollCapture
                onEnrolled={async (signature, embeddingVersion) => {
                  try {
                    const ok = await saveFaceEnrollment(authUserId, signature, embeddingVersion)
                    if (!ok) {
                      toast.error(
                        "Could not save face enrollment. Check that this site is allowed to use storage (not private mode with storage blocked).",
                      )
                      return
                    }
                    setFaceEnrolledStatus(true)
                    setShowFaceEnrollModal(false)
                    toast.success("Face enrolled. Only your reps will count in Coach Assist.")
                  } catch {
                    toast.error("Could not save face enrollment.")
                  }
                }}
                onCancel={() => setShowFaceEnrollModal(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Danger zone: Delete account */}
      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Your data</h3>
            <p className="text-xs text-muted-foreground">Export a copy of your profile, workouts, runs, and coach sessions.</p>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              const bundle = buildExportBundle({ profile, workouts, runs, coachSessions })
              const stamp = new Date().toISOString().slice(0, 10)
              downloadBlob(`fittrackgo-export-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json")
              toast.success("Export downloaded")
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-medium text-primary transition-all hover:bg-primary/20"
          >
            <Download className="h-4 w-4" /> Export all as JSON
          </button>
          {runs.length > 0 && runs[0].path?.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const run = runs[0]
                downloadBlob(`run-${run.id}.gpx`, runToGpx(run, { appName: siteConfig.appName }), "application/gpx+xml")
                toast.success("Latest run exported as GPX")
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-foreground transition-all hover:bg-secondary/80"
            >
              <MapPin className="h-4 w-4" /> Export latest run as GPX
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
          <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={() => setShowDeleteAccountConfirm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
          >
            Delete account
          </button>
        </div>
      </section>

      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Delete account?</h2>
            <p className="text-sm text-muted-foreground">
              This will permanently delete your account, profile, workouts, runs, and coach sessions. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteAccountConfirm(false)}
                disabled={deleteAccountLoading}
                className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleteAccountLoading(true)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session?.access_token) {
                      toast.error("Not signed in.")
                      setDeleteAccountLoading(false)
                      return
                    }
                    const res = await fetch("/api/delete-account", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                      credentials: "include",
                    })
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}))
                      toast.error(j?.error ?? "Failed to delete account.")
                      setDeleteAccountLoading(false)
                      return
                    }
                    setShowDeleteAccountConfirm(false)
                    toast.success("Account deleted.")
                    onLogout()
                  } catch {
                    toast.error("Something went wrong.")
                    setDeleteAccountLoading(false)
                  }
                }}
                disabled={deleteAccountLoading}
                className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteAccountLoading ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PassphraseSetupDialog
        open={clipPassphraseOpen}
        onOpenChange={setClipPassphraseOpen}
        onBackedUp={() => void fetchUserClipKeyRow().then((r) => setClipBackupOnServer(!!r))}
      />

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </motion.div>
  )
}
