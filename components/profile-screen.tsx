"use client"

import { useState, useEffect } from "react"
import {
  User,
  Settings,
  Bell,
  Award,
  TrendingUp,
  Calendar,
  MapPin,
  Dumbbell,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Moon,
  Shield,
  HelpCircle,
  Mail,
  FileText,
  UserCheck,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAccent } from "@/components/accent-provider"
import { ACCENT_OPTIONS, type AccentId } from "@/lib/accent"
import type { UserProfile } from "@/lib/store"
import { getProfile, saveProfile, getTotalStats, getWeeklyActivity, getRuns, getWorkouts, getCoachSessions, formatErr } from "@/lib/store-supabase"
import { getFaq, getAchievements, siteConfig } from "@/lib/data"
import { ContactForm } from "@/components/contact-form"
import { toast } from "sonner"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getFaceEnrollment, saveFaceEnrollment, deleteFaceEnrollment } from "@/lib/face-verification"
import { FaceEnrollCapture } from "@/components/face-enroll-capture"

const menuItems = [
  { icon: Bell, label: "Notifications", action: "notifications" },
  { icon: Moon, label: "Dark mode", action: "theme", toggle: true },
  { icon: Shield, label: "Privacy", action: "privacy" },
  { icon: FileText, label: "Terms of Service", action: "terms" },
  { icon: HelpCircle, label: "Help & Support", action: "help" },
  { icon: Settings, label: "Settings", action: "settings" },
]

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
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
  const [runs, setRuns] = useState<any[]>([])
  const [workouts, setWorkouts] = useState<any[]>([])
  const [coachSessions, setCoachSessions] = useState<any[]>([])
  const [achievements, setAchievements] = useState<{ title: string; description: string; earned: boolean; progress: number }[]>([])
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
  // Use singleton client to prevent lock conflicts
  const supabase = createClient()

  const faqList = getFaq()
  const achievementDefs = getAchievements()

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
        const faceSig = await getFaceEnrollment(user.id)
        setFaceEnrolledStatus(!!faceSig?.length)

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
          return { title: def.title, description: def.description, earned, progress }
        })
        setAchievements(ach)
      } catch (error: unknown) {
        const errorMessage = (error as Error)?.message ?? formatErr(error)
        console.error("Failed to load profile data:", errorMessage)
        
        // Check for database schema errors
        if (errorMessage.includes("Could not find the table") || errorMessage.includes("does not exist")) {
          toast.error("Database tables not set up. Please run the SQL schema.", {
            duration: 8000,
            action: {
              label: "View Instructions",
              onClick: () => {
                window.open("https://app.supabase.com/project/extblftryftjjitcetvq/sql/new", "_blank")
                toast.info("1. Copy contents of supabase/schema.sql\n2. Paste in SQL Editor\n3. Click Run", { duration: 10000 })
              }
            }
          })
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
  }, [achievementDefs, retryCount])

  const displayName = profile?.name?.trim() || "Athlete"
  const joinYear = profile?.joinDate ? new Date(profile.joinDate).getFullYear() : new Date().getFullYear()
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
      <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 animate-pulse">
            <User className="h-8 w-8 text-primary/50" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-6 w-32 bg-secondary rounded animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
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
          {(loadError.includes("fetch") || loadError.includes("Failed to fetch")) && (
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
        </div>
      </div>
    )
  }

  // Show database setup message if profile is null and we're not loading
  if (!profile && !loading) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
              <Settings className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Database Setup Required</h2>
              <p className="text-sm text-muted-foreground">Your database tables need to be created</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            <p className="text-foreground">To fix this, run the database schema in Supabase:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
              <li>Go to <a href="https://app.supabase.com/project/extblftryftjjitcetvq/sql/new" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase SQL Editor</a></li>
              <li>Open <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">supabase/schema.sql</code> in your project</li>
              <li>Copy the entire contents</li>
              <li>Paste into SQL Editor and click <strong>Run</strong></li>
              <li>Refresh this page</li>
            </ol>
          </div>
          
          <div className="flex gap-2">
            <a
              href="https://app.supabase.com/project/extblftryftjjitcetvq/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground text-center hover:bg-primary/90 transition-colors"
            >
              Open SQL Editor
            </a>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
            >
              Refresh
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            See <code className="bg-secondary px-1.5 py-0.5 rounded">DATABASE-SETUP.md</code> for detailed instructions
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-28 animate-fade-in-up">
      <div className="flex items-center gap-4 opacity-0 animate-slide-in-left" style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 transition-transform duration-300 hover:scale-105">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={displayName}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") { setEditingName(false); setNameInput("") }
                }}
              />
              <button onClick={handleSaveName} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Save</button>
              <button onClick={() => { setEditingName(false); setNameInput("") }} className="text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground truncate" style={{ fontFamily: "var(--font-heading)" }}>{displayName}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setEditingName(true); setNameInput(profile?.name || "") }} className="text-xs text-muted-foreground hover:text-foreground">Edit name</button>
                {userEmail && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                  </>
                )}
              </div>
            </>
          )}
          <p className="text-sm text-muted-foreground">Member since {joinYear}</p>
        </div>
        <button onClick={() => handleMenuAction("settings")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border" aria-label="Settings">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Profile Details Section */}
      <section className="rounded-2xl bg-card p-4 border border-border space-y-4 opacity-0 animate-fade-in-up transition-shadow duration-300 hover:shadow-md" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
        <h2 className="text-sm font-semibold text-foreground">Profile Details</h2>
        
        {/* Level Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Fitness Level</span>
            {!editingLevel && (
              <button onClick={() => setEditingLevel(true)} className="text-xs text-primary hover:underline">Change</button>
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
            <div className="text-sm font-medium text-foreground capitalize">{profile?.level || "beginner"}</div>
          )}
        </div>

        {/* Goals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Goals</span>
            {!editingGoals && (
              <button onClick={() => setEditingGoals(true)} className="text-xs text-primary hover:underline">Edit</button>
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
                <span className="text-xs text-muted-foreground">No goals set</span>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 border border-border" title="Total runs">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">{stats.totalRuns}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide text-center leading-tight">Runs</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 border border-border" title="Workouts + AI sessions">
          <Dumbbell className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">{stats.totalWorkouts}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide text-center leading-tight">Workouts</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 border border-border" title="Current streak">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">{stats.streak}d</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide text-center leading-tight">Streak</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 border border-border" title="Earned achievements">
          <Award className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-foreground">{achievements.filter((a) => a.earned).length}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide text-center leading-tight">Badges</span>
        </div>
      </div>

      <section className="rounded-2xl bg-card p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">This Week</h2>
          <span className="text-xs text-primary font-medium">{activeDays}/7 days</span>
        </div>
        <div className="flex justify-between gap-2">
          {weekActivity.length > 0 ? (
            weekActivity.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${day.active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {day.active ? <Dumbbell className="h-4 w-4" /> : <span className="text-xs">-</span>}
                </div>
                <span className="text-[10px] text-muted-foreground">{day.day}</span>
              </div>
            ))
          ) : (
            <div className="w-full text-center py-4 text-sm text-muted-foreground">No activity data available</div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Achievements</h2>
          <span className="text-xs text-muted-foreground">{achievements.filter((a) => a.earned).length}/{achievements.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {achievements.length > 0 ? (
            achievements.map((ach) => (
            <button
              key={ach.title}
              onClick={() => toast.info(ach.earned ? ach.title : `${ach.title}: ${Math.round(ach.progress)}%`)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 border text-center transition-all ${ach.earned ? "bg-card border-primary/30" : "bg-card border-border opacity-75"}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ach.earned ? "bg-primary/15" : "bg-secondary"}`}>
                <Award className={`h-5 w-5 ${ach.earned ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className="text-[10px] font-semibold text-foreground leading-tight">{ach.title}</span>
              {!ach.earned && ach.progress > 0 && (
                <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${ach.progress}%` }} />
                </div>
              )}
            </button>
            ))
          ) : (
            <div className="col-span-3 text-center py-4 text-sm text-muted-foreground">No achievements available</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">All-time</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Distance</span>
                <span className="text-foreground font-medium">{totalDistance.toFixed(1)} km</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (totalDistance / 42) * 100)}%` }} />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Activities</span>
              <span className="text-foreground font-medium">{workouts.length + runs.length + coachSessions.length}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Total Reps</span>
              <span className="text-foreground font-medium">{totalReps}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Calories</span>
              <span className="text-foreground font-medium">{stats.totalCalories || 0}</span>
            </div>
          </div>
        </div>
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
          <div
            key={item.label}
            role="button"
            tabIndex={0}
            onClick={() => handleMenuAction(item.action)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleMenuAction(item.action) } }}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${i < menuItems.length - 1 ? "border-b border-border" : ""}`}
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
          </div>
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
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span>Distance units</span>
                    <span className="text-muted-foreground">km</span>
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

      {showFaceEnrollModal && authUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Enroll your face</h2>
              <button type="button" onClick={() => setShowFaceEnrollModal(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground" aria-label="Close">
                ×
              </button>
            </div>
            <FaceEnrollCapture
              onEnrolled={async (signature) => {
                try {
                  await saveFaceEnrollment(authUserId, signature)
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
        </div>
      )}

      {/* Danger zone: Delete account */}
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
                  } catch (e) {
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

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  )
}
