"use client"

import { useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Settings,
  Bell,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Moon,
  Shield,
  HelpCircle,
  Mail,
  FileText,
  UserCheck,
  Heart,
  RefreshCw,
  Download,
} from "lucide-react"
import { useTheme } from "next-themes"
import type { UserProfile, RunRecord, WorkoutRecord, CoachRecord } from "@/lib/store"
import { getProfile, saveProfile, getTotalStats, getWeeklyActivity, getRuns, getWorkouts, getCoachSessions, formatErr } from "@/lib/store-supabase"
import { BodyWeightRow } from "@/components/profile/body-weight-row"
import { getSupabaseSqlEditorUrl } from "@/lib/supabase/config"
import { getFaq, getAchievements, siteConfig, type AchievementDef } from "@/lib/data"
import { ContactForm } from "@/components/contact-form"
import { CHROME } from "@/lib/app-chrome"
import { ChromeHeader } from "@/components/chrome/ChromeHeader"
import { LanguageSelector } from "@/components/language-selector"
import { UnitSelector } from "@/components/unit-selector"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { buildExportBundle, downloadBlob } from "@/lib/export"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getFaceEnrollment, saveFaceEnrollment } from "@/lib/face-verification"
import { FaceEnrollCapture } from "@/components/face-enroll-capture"
import { AchievementBadge, type AchievementBadgeTier } from "@/components/ui/achievement-badge"
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
  onCreateCustomExercise: _onCreateCustomExercise,
}: {
  onLogout: () => void
  onCreateCustomExercise?: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [panel, setPanel] = useState<"notifications" | "support" | "settings" | null>(null)
  const { theme, setTheme } = useTheme()
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
  const [, setWearableLoading] = useState(false)
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

  const handleConnectGoogleFit = () => {
    window.location.href = "/api/wearables/google_fit/auth"
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
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: CHROME.cream }} data-testid="screen-profile">
      <ChromeHeader streakDays={stats.streak} />

      {/* ── Dark hero card ───────────────────────────────────────── */}
      <div className="relative px-5 pb-6 pt-4" style={{ backgroundColor: CHROME.black }}>
        <div className="flex items-center gap-4">
          {/* Orange avatar with orbit ring */}
          <div className="relative shrink-0">
            {!reduceProfileMotion && (
              <>
                <motion.div
                  className="pointer-events-none absolute rounded-2xl border-2"
                  style={{ inset: -5, borderColor: `${CHROME.orange}45` }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute z-10 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CHROME.orange, boxShadow: `0 0 8px ${CHROME.orange}`, top: -5, left: "50%", translateX: "-50%" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                />
              </>
            )}
            <div
              className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl text-3xl font-black"
              style={{ backgroundColor: CHROME.orange, color: CHROME.white }}
            >
              {profileInitial}
            </div>
          </div>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={displayName}
                    className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm"
                    style={{ backgroundColor: CHROME.focusBg, borderColor: CHROME.border, color: CHROME.white }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName()
                      if (e.key === "Escape") { setEditingName(false); setNameInput("") }
                    }}
                  />
                  <button type="button" onClick={handleSaveName}
                    className="rounded-xl px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: CHROME.orange }}>Save</button>
                  <button type="button" onClick={() => { setEditingName(false); setNameInput("") }}
                    className="text-xs" style={{ color: CHROME.muted }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" onClick={() => { setEditingName(true); setNameInput(profile?.name || "") }} className="text-left">
                  <h2 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-display),var(--font-heading)" }}>
                    {displayName}
                  </h2>
                </button>
                <p className="text-[11px] mt-0.5" style={{ color: CHROME.muted }}>{userEmail || `Member since ${joinYear}`}</p>
              </>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {stats.streak > 0 && (
                <span className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                  style={{ backgroundColor: `${CHROME.orange}25`, border: `1px solid ${CHROME.orange}40` }}>
                  🔥 {stats.streak}d Streak
                </span>
              )}
              {achievements.filter(a => a.earned).length > 0 && (
                <span className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: `${CHROME.teal}20`, color: CHROME.teal, border: `1px solid ${CHROME.teal}35` }}>
                  {achievements.filter(a => a.earned).length} Badges
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cream body ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-28">

        {/* FITNESS SUMMARY */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>Fitness Summary</p>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { label: "Sessions", value: totalSessions, unit: "", color: CHROME.orange },
                { label: "Distance", value: totalDistance.toFixed(1), unit: "km", color: CHROME.gpsGreen },
                { label: "Streak", value: stats.streak, unit: "days", color: CHROME.orange },
                { label: "Active days", value: activeDays, unit: "/ 7", color: CHROME.muted },
              ] as { label: string; value: string | number; unit: string; color: string }[]
            ).map((m, i) => (
              <motion.div
                key={m.label}
                className="rounded-2xl p-4"
                style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}
                initial={reduceProfileMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-1 h-5 w-5 rounded-md" style={{ backgroundColor: `${m.color}20` }}>
                  <div className="h-full w-full rounded-md" style={{ backgroundColor: m.color, opacity: 0.6 }} />
                </div>
                <p className="text-2xl font-black tabular-nums leading-none"
                  style={{ color: CHROME.text, fontFamily: "var(--font-display),var(--font-heading)" }}>
                  {m.value}
                  {m.unit && <span className="ml-1 text-sm font-semibold" style={{ color: CHROME.muted }}>{m.unit}</span>}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CHROME.muted }}>{m.label}</p>
              </motion.div>
            ))}
          </div>

          {/* This week bar chart */}
          <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: CHROME.text }}>This week</p>
              <span className="text-[10px] font-bold" style={{ color: CHROME.orange }}>{activeDays}/7 active</span>
            </div>
            <div className="flex items-end gap-1.5 h-12">
              {weekActivity.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <motion.div
                    className="w-full rounded-t-sm"
                    style={{ backgroundColor: d.active ? CHROME.orange : `${CHROME.orange}20`, minHeight: "4px" }}
                    initial={{ height: 0 }}
                    animate={{ height: d.count > 0 ? `${Math.min(100, d.count * 40)}%` : "4px" }}
                    transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <p className="text-[8px] font-bold uppercase" style={{ color: d.active ? CHROME.orange : CHROME.muted }}>{d.day[0]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BODY GOALS */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>Body goals</p>
          </div>
          <div className="space-y-3">
            <BodyWeightRow profile={profile} onSaved={async () => { const u = await getProfile(); setProfile(u) }} />
            {(() => {
              const runsThisWeek = weekActivity.filter(d => d.active && d.count > 0).length
              const runGoal = 5
              const pct = Math.min(100, Math.round(runsThisWeek / runGoal * 100))
              return (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-xs font-semibold" style={{ color: CHROME.text }}>Weekly runs</p>
                    <p className="text-[10px] font-bold" style={{ color: CHROME.muted }}>{runsThisWeek}/{runGoal}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${CHROME.orange}18` }}>
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: CHROME.orange }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>
              )
            })()}
            {(() => {
              const wktGoal = 15
              const pct = Math.min(100, Math.round(workouts.length / wktGoal * 100))
              return (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-xs font-semibold" style={{ color: CHROME.text }}>Workouts</p>
                    <p className="text-[10px] font-bold" style={{ color: CHROME.muted }}>{workouts.length}/{wktGoal}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${CHROME.orange}18` }}>
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: CHROME.orange }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ACHIEVEMENTS horizontal scroll */}
        {achievements.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>Achievements</p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {achievements.map((ach, i) => (
                <motion.div
                  key={ach.title}
                  className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-3 py-3"
                  style={{
                    backgroundColor: ach.earned ? `${CHROME.orange}12` : CHROME.card,
                    border: `1px solid ${ach.earned ? CHROME.orange + "40" : CHROME.cardBorder}`,
                    minWidth: "72px",
                  }}
                  initial={reduceProfileMotion ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <AchievementBadge earned={ach.earned} tier={ach.tier} title={ach.title} />
                  <p className="text-center text-[9px] font-bold leading-tight"
                    style={{ color: ach.earned ? CHROME.text : CHROME.muted, maxWidth: "60px" }}>
                    {ach.title}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ALL-TIME STATS */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>All-time Stats</p>
            <span className="text-[10px]" style={{ color: CHROME.muted }}>Overview</span>
          </div>
          <div className="space-y-3">
            {(
              [
                { label: "Distance", value: `${totalDistance.toFixed(1)} km`, pct: Math.min(100, totalDistance * 2) },
                {
                  label: "Avg Pace",
                  value: runs.length > 0 ? `${runs.length} sessions` : "—",
                  pct: 1,
                },
                { label: "Total Reps", value: String(totalReps), pct: Math.min(100, totalReps / 5) },
                { label: "Calories", value: String(stats.totalCalories), pct: Math.min(100, stats.totalCalories / 30) },
              ] as { label: string; value: string; pct: number }[]
            ).map((s, i) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold" style={{ color: CHROME.text }}>{s.label}</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: CHROME.orange }}>{s.value}</p>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${CHROME.orange}18` }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: CHROME.orange }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EXTERNAL HR DEVICES */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>External HR Devices</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${CHROME.hrRed}15` }}>
                <Heart className="h-4 w-4" style={{ color: CHROME.hrRed }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: CHROME.text }}>Fitbit</p>
                <p className="text-[10px]" style={{ color: CHROME.muted }}>
                  {wearableStatus?.connected
                    ? `Last sync: ${wearableStatus.lastSyncAt ? new Date(wearableStatus.lastSyncAt).toLocaleDateString() : "—"}`
                    : "Version 6 · no medical advice"}
                </p>
              </div>
              {wearableStatus?.configured ? (
                wearableStatus.connected ? (
                  <button type="button" onClick={handleSyncFitbit} disabled={wearableSyncing}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: CHROME.orange }}>
                    <RefreshCw className={`h-3 w-3 inline mr-1 ${wearableSyncing ? "animate-spin" : ""}`} />Sync
                  </button>
                ) : (
                  <button type="button" onClick={handleConnectFitbit}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: CHROME.orange }}>
                    Link
                  </button>
                )
              ) : (
                <span className="text-[10px]" style={{ color: CHROME.muted }}>Not configured</span>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${CHROME.gpsGreen}15` }}>
                <TrendingUp className="h-4 w-4" style={{ color: CHROME.gpsGreen }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: CHROME.text }}>Google Fit</p>
                <p className="text-[10px]" style={{ color: CHROME.muted }}>
                  {wearableGoogleFit?.connected
                    ? `Last sync: ${wearableGoogleFit.lastSyncAt ? new Date(wearableGoogleFit.lastSyncAt).toLocaleDateString() : "—"}`
                    : "Daily updates"}
                </p>
              </div>
              {wearableGoogleFit?.configured ? (
                wearableGoogleFit.connected ? (
                  <button type="button" onClick={() => void handleSyncGoogleFit()} disabled={wearableSyncing}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: CHROME.gpsGreen }}>
                    <RefreshCw className={`h-3 w-3 inline mr-1 ${wearableSyncing ? "animate-spin" : ""}`} />Sync
                  </button>
                ) : (
                  <button type="button" onClick={handleConnectGoogleFit}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-bold"
                    style={{ backgroundColor: `${CHROME.gpsGreen}20`, color: CHROME.gpsGreen }}>
                    Link
                  </button>
                )
              ) : (
                <span className="text-[10px]" style={{ color: CHROME.muted }}>Not configured</span>
              )}
            </div>
          </div>
        </div>

        {/* SETTINGS LIST */}
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
          {menuItems.map((item, i) => (
            <motion.div
              key={item.label}
              role="button"
              tabIndex={0}
              onClick={() => handleMenuAction(item.action)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleMenuAction(item.action) } }}
              whileTap={reduceProfileMotion ? undefined : { scale: 0.99 }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors"
              style={{ borderBottom: i < menuItems.length - 1 ? `1px solid ${CHROME.cardBorder}` : "none" }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${CHROME.orange}12` }}>
                <item.icon className="h-4 w-4" style={{ color: CHROME.orange }} />
              </div>
              <span className="flex-1 text-sm font-medium" style={{ color: CHROME.text }}>{item.label}</span>
              {item.toggle ? (
                <div
                  role="switch"
                  aria-checked={theme === "dark"}
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark"); toast.success(theme === "dark" ? "Light mode" : "Dark mode") }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark") } }}
                  className="relative h-6 w-11 cursor-pointer rounded-full transition-colors"
                  style={{ backgroundColor: theme === "dark" ? CHROME.orange : `${CHROME.muted}50` }}
                >
                  <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: theme === "dark" ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              ) : (
                <ChevronRight className="h-4 w-4" style={{ color: CHROME.muted }} />
              )}
            </motion.div>
          ))}
        </div>

        {/* Settings panel (notifications / support / settings) */}
        {panel && (
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
              <button type="button" onClick={() => setPanel(null)} className="p-1 -ml-1 rounded-lg" aria-label="Back">
                <ChevronLeft className="h-5 w-5" style={{ color: CHROME.text }} />
              </button>
              <h2 className="text-sm font-bold" style={{ color: CHROME.text }}>
                {panel === "notifications" ? "Notifications" : panel === "support" ? "Help & Support" : "Settings"}
              </h2>
            </div>
            <div className="p-4 space-y-3 text-sm" style={{ color: CHROME.text }}>
              {panel === "notifications" && (
                <>
                  <p style={{ color: CHROME.muted }}>Manage when you get reminders and activity alerts.</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof Notification !== "undefined" && Notification.permission === "default") {
                        Notification.requestPermission().then((p) => toast.info(p === "granted" ? "Notifications enabled." : "Permission denied."))
                      } else { toast.info("Check your device or browser settings.") }
                    }}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                    style={{ backgroundColor: CHROME.orange }}
                  >Enable notifications</button>
                  <p className="text-xs" style={{ color: CHROME.muted }}>In-app reminders and achievements may be added in a future update.</p>
                </>
              )}
              {panel === "support" && (
                <>
                  <p style={{ color: CHROME.muted }}>Frequently asked questions</p>
                  <ul className="space-y-2" style={{ color: CHROME.muted }}>
                    {faqList.map((item) => (
                      <li key={item.id} className="pb-2" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
                        <span className="font-semibold" style={{ color: CHROME.text }}>{item.question}</span>
                        <p className="text-xs mt-1">{item.answer}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="pt-3 font-bold" style={{ color: CHROME.text }}>Contact us</p>
                  <a href={`mailto:${siteConfig.supportEmail}`} className="flex items-center gap-2 text-xs" style={{ color: CHROME.orange }}>
                    <Mail className="h-3.5 w-3.5" />{siteConfig.supportEmail}
                  </a>
                  <div className="pt-2"><ContactForm /></div>
                </>
              )}
              {panel === "settings" && (
                <>
                  <p style={{ color: CHROME.muted }}>App preferences</p>
                  <div className="space-y-2">
                    <LanguageSelector />
                    <UnitSelector />
                    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: CHROME.text }}>Run voice cues</p>
                        <p className="text-xs" style={{ color: CHROME.muted }}>Spoken kilometer splits while tracking a run</p>
                      </div>
                      <Switch checked={runVoiceOn} onCheckedChange={(on) => { setRunVoiceEnabled(on); setRunVoiceOn(on); toast.success(on ? "Voice cues on" : "Voice cues off") }} />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: CHROME.text }}>Coach replay</p>
                        <p className="text-xs" style={{ color: CHROME.muted }}>Save rep clips locally for review</p>
                      </div>
                      <Switch checked={coachReplayLocalOn} onCheckedChange={(on) => { setCoachReplayLocalEnabled(on); setCoachReplayLocalOn(on); toast.success(on ? "Replay on" : "Replay off") }} />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: CHROME.text }}>Midset tips</p>
                        <p className="text-xs" style={{ color: CHROME.muted }}>Coaching tips mid-session</p>
                      </div>
                      <Switch checked={midsetTipsOn} onCheckedChange={(on) => { setCoachMidsetTipsEnabled(on); setMidsetTipsOn(on); toast.success(on ? "Tips on" : "Tips off") }} />
                    </div>
                    {coachClipsCloudFeatureFlag() && isSupabaseConfigured() && (
                      <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: `1px solid ${CHROME.cardBorder}` }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: CHROME.text }}>Cloud clip sync</p>
                          <p className="text-xs" style={{ color: CHROME.muted }}>Back up rep clips to cloud</p>
                        </div>
                        <Switch checked={coachClipSyncOn} onCheckedChange={(on) => { setCoachClipCloudSyncEnabled(on); setCoachClipSyncOn(on); toast.success(on ? "Cloud sync on" : "Cloud sync off") }} />
                      </div>
                    )}
                    {showClipEncryptRow && (
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: CHROME.text }}>Clip encryption</p>
                          <p className="text-xs" style={{ color: CHROME.muted }}>
                            {clipBackupOnServer === null ? "Checking…" : clipBackupOnServer ? "Passphrase backed up" : "No passphrase set"}
                          </p>
                        </div>
                        <button type="button" onClick={() => setClipPassphraseOpen(true)}
                          className="rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                          style={{ backgroundColor: CHROME.orange }}>
                          {clipBackupOnServer ? "Change" : "Set up"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Face recognition */}
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${CHROME.teal}15` }}>
                <UserCheck className="h-5 w-5" style={{ color: CHROME.teal }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: CHROME.text }}>Face recognition</p>
                <p className="text-xs" style={{ color: CHROME.muted }}>
                  {faceEnrolledStatus === null ? "Checking…" : faceEnrolledStatus ? "Enrolled · only your reps count" : "Enroll to lock your reps"}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setShowFaceEnrollModal(true)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white"
              style={{ backgroundColor: CHROME.teal }}>
              {faceEnrolledStatus ? "Re-enroll" : "Enroll"}
            </button>
          </div>
        </div>

        {/* Face enroll dialog */}
        {showFaceEnrollModal && (
          <Dialog open={showFaceEnrollModal} onOpenChange={setShowFaceEnrollModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Face Enrollment</DialogTitle>
                <DialogDescription>Position your face in the frame to enroll.</DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <FaceEnrollCapture
                  onEnrolled={async (sig) => {
                    if (!authUserId) return
                    try {
                      const ok = await saveFaceEnrollment(authUserId, sig)
                      if (!ok) {
                        toast.error("Could not save face enrollment. Check that this site is allowed to use storage (not private mode with storage blocked).")
                        return
                      }
                      setFaceEnrolledStatus(true)
                      setShowFaceEnrollModal(false)
                      toast.success("Face enrolled. Only your reps will count in Coach Assist.")
                    } catch { toast.error("Could not save face enrollment.") }
                  }}
                  onCancel={() => setShowFaceEnrollModal(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* EXPORT YOUR DATA */}
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: `${CHROME.gpsGreen}10`, border: `1px solid ${CHROME.gpsGreen}35` }}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Download className="h-4 w-4 shrink-0" style={{ color: CHROME.gpsGreen }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: CHROME.text }}>Export your data</p>
              <p className="text-xs" style={{ color: CHROME.muted }}>Download profile, workouts, runs and coach sessions</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const bundle = buildExportBundle({ profile, workouts, runs, coachSessions })
                const stamp = new Date().toISOString().slice(0, 10)
                downloadBlob(`fittrackgo-export-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json")
                toast.success("Export downloaded")
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: CHROME.gpsGreen, color: CHROME.white }}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: `${CHROME.hrRed}08`, border: `1px solid ${CHROME.hrRed}30` }}>
          <div className="px-4 py-3.5">
            <p className="text-sm font-bold" style={{ color: CHROME.hrRed }}>Danger</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: CHROME.muted }}>
              Permanently delete your account, all workouts, runs and coach data. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteAccountConfirm(true)}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold"
              style={{ backgroundColor: `${CHROME.hrRed}15`, color: CHROME.hrRed, border: `1px solid ${CHROME.hrRed}35` }}
            >
              Delete account
            </button>
          </div>
        </div>

        {/* Delete account confirmation dialog */}
        {showDeleteAccountConfirm && (
          <Dialog open={showDeleteAccountConfirm} onOpenChange={setShowDeleteAccountConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete account</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account, runs, workouts and Coach sessions. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setShowDeleteAccountConfirm(false)}
                  className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium">Cancel</button>
                <button
                  type="button"
                  disabled={deleteAccountLoading}
                  onClick={async () => {
                    setDeleteAccountLoading(true)
                    try {
                      await supabase.rpc("delete_user_account")
                      await supabase.auth.signOut()
                      toast.success("Account deleted.")
                      onLogout()
                    } catch { toast.error("Could not delete account.") } finally { setDeleteAccountLoading(false) }
                  }}
                  className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {deleteAccountLoading ? "Deleting…" : "Delete everything"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Passphrase dialog */}
        <PassphraseSetupDialog
          open={clipPassphraseOpen}
          onOpenChange={setClipPassphraseOpen}
          onBackedUp={() => void fetchUserClipKeyRow().then((r) => setClipBackupOnServer(!!r))}
        />

        {/* Sign out */}
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all"
          style={{ backgroundColor: `${CHROME.hrRed}10`, color: CHROME.hrRed, border: `1px solid ${CHROME.hrRed}25` }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}