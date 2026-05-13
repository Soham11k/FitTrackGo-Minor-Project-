"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome, Loader2, MapPin, ScanLine, Trophy } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { invalidateAuthUserCache, saveProfile } from "@/lib/store-supabase"
import { siteConfig } from "@/lib/data"
import { StatDisplay } from "@/components/ui/stat-display"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC } from "@/lib/motion"
import { clearGuestMode } from "@/lib/guest-mode"

const PROOF_CARDS = [
  {
    title: "Run with AI splits",
    sub: "GPS route, km laps, and recap you can share.",
    icon: MapPin,
  },
  {
    title: "Form check in your camera",
    sub: "On-device pose with rep traces and coaching cues.",
    icon: ScanLine,
  },
  {
    title: "Compete with friends",
    sub: "Arena duels and verified form scores.",
    icon: Trophy,
  },
] as const

export function LoginScreen({
  onLogin,
  onGuestEnter,
}: {
  onLogin: () => void
  onGuestEnter?: () => void
}) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [animateIn] = useState(true)
  const [proofIdx, setProofIdx] = useState(0)
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string; name?: string }>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const id = window.setInterval(() => setProofIdx((i) => (i + 1) % PROOF_CARDS.length), 4000)
    return () => window.clearInterval(id)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError({})
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    const trimmedName = name.trim()

    if (!trimmedEmail) {
      setFieldError((e) => ({ ...e, email: "Enter your email address." }))
      return
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setFieldError((e) => ({ ...e, password: "Use at least 6 characters." }))
      return
    }
    if (isSignUp && !trimmedName) {
      setFieldError((e) => ({ ...e, name: "Enter your name to sign up." }))
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
          options: {
            data: {
              name: trimmedName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        if (data.user) {
          // No JWT until the user confirms email — getProfile() will create the row on first real sign-in (uses user_metadata.name).
          if (data.session) {
            invalidateAuthUserCache()
            try {
              await saveProfile({ name: trimmedName, onboarded: false })
            } catch (err) {
              console.error("Profile save error:", err)
              toast.warning("Account created, but we couldn't save your profile yet. You can finish onboarding after signing in.")
            }
          }

          // If the project requires email confirmation, the session won't be set.
          if (!data.session) {
            toast.success("Account created! Check your email to verify, then sign in.")
            setIsSignUp(false)
            return
          }

          toast.success("Account created!")
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          })
          if (signInError) {
            toast.error(getAuthErrorMessage(signInError, "Could not sign in after signup. Please try logging in."))
            return
          }
          invalidateAuthUserCache()
          clearGuestMode()
          onLogin()
          router.refresh()
        }
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        })

        if (error) throw error

        invalidateAuthUserCache()
        clearGuestMode()
        toast.success("Signed in successfully!")
        onLogin()
        router.refresh()
      }
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, "Authentication failed. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, `Sign in with ${provider} failed.`))
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error("Please enter your email address first.")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      toast.success("Password reset email sent! Check your inbox.")
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, "Failed to send reset email."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <CinematicStage
        vignette
        className="relative flex h-[46vh] min-h-[272px] w-full shrink-0 items-center justify-center overflow-hidden pb-6"
      >
        <motion.div
          className={`flex w-full max-w-sm flex-col items-center justify-center px-6 transition-all duration-700 ${
            animateIn ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <StatDisplay
            eyebrow="FITTRACK"
            value={<>
              GO<span className="text-primary">.</span>
            </>}
            tone="stage"
            size="lg"
            secondary={siteConfig.tagline}
          />
          <div className="relative mt-8 min-h-[5.25rem] w-full max-w-[19rem]" aria-live="polite">
            <AnimatePresence mode="wait">
              {(() => {
                const c = PROOF_CARDS[proofIdx]
                const Icon = c.icon
                return (
                  <motion.div
                    key={proofIdx}
                    role="group"
                    aria-label={c.title}
                    className="absolute inset-x-0 top-0 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left backdrop-blur-md"
                    variants={CINEMATIC.statReveal}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--surface-stage-fg)]">{c.title}</p>
                        <p className="mt-0.5 text-typo-caption leading-snug text-white/65">{c.sub}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>
          <div className="mt-4 h-px w-44 bg-[color:var(--surface-stage-hairline)] sm:w-56" aria-hidden />
        </motion.div>
      </CinematicStage>

      {/* Form section */}
      <div className="flex flex-1 flex-col px-6 pt-6 pb-8">
        {/* NRC-style underline tabs */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="relative mx-auto mb-6 flex w-full max-w-sm border-b border-border"
        >
          <button
            type="button"
            role="tab"
            id="auth-tab-signin"
            aria-selected={!isSignUp}
            aria-controls="auth-panel"
            tabIndex={!isSignUp ? 0 : -1}
            onClick={() => {
              setIsSignUp(false)
              setFieldError({})
            }}
            className={`flex-1 py-3 text-typo-eyebrow font-bold uppercase tracking-[0.24em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              !isSignUp ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-signup"
            aria-selected={isSignUp}
            aria-controls="auth-panel"
            tabIndex={isSignUp ? 0 : -1}
            onClick={() => {
              setIsSignUp(true)
              setFieldError({})
            }}
            className={`flex-1 py-3 text-typo-eyebrow font-bold uppercase tracking-[0.24em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isSignUp ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-1/2 bg-primary"
            animate={{ x: isSignUp ? "100%" : "0%" }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isSignUp ? "signup" : "signin"}
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={isSignUp ? "auth-tab-signup" : "auth-tab-signin"}
            onSubmit={handleSubmit}
            className="mx-auto w-full max-w-sm space-y-4"
            variants={CINEMATIC.statReveal}
            initial="hidden"
            animate="show"
            exit="hidden"
          >
          {/* Name field (sign up only) */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              isSignUp ? "max-h-36 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="FULL NAME"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setFieldError((err) => ({ ...err, name: undefined }))
                }}
                className="h-12 rounded-lg border-border bg-transparent pl-10 text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus:border-primary focus:ring-primary"
                aria-invalid={!!fieldError.name}
                aria-describedby={fieldError.name ? "auth-name-error" : undefined}
              />
            </div>
            {fieldError.name ? (
              <p id="auth-name-error" className="mt-1 text-xs text-destructive" role="alert">
                {fieldError.name}
              </p>
            ) : null}
          </div>

          {/* Email field */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="EMAIL ADDRESS"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFieldError((err) => ({ ...err, email: undefined }))
              }}
              className="h-12 rounded-lg border-border bg-transparent pl-10 text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus:border-primary focus:ring-primary"
              aria-invalid={!!fieldError.email}
              aria-describedby={fieldError.email ? "auth-email-error" : undefined}
            />
          </div>
          {fieldError.email ? (
            <p id="auth-email-error" className="-mt-2 text-xs text-destructive pl-1" role="alert">
              {fieldError.email}
            </p>
          ) : null}

          {/* Password field */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setFieldError((err) => ({ ...err, password: undefined }))
              }}
              className="h-12 rounded-lg border-border bg-transparent pl-10 pr-10 text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus:border-primary focus:ring-primary"
              aria-invalid={!!fieldError.password}
              aria-describedby={fieldError.password ? "auth-password-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          {fieldError.password ? (
            <p id="auth-password-error" className="-mt-2 text-xs text-destructive pl-1" role="alert">
              {fieldError.password}
            </p>
          ) : null}

          {/* Forgot password */}
          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-[0.18em] text-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isSignUp ? "Creating..." : "Signing in..."}
              </>
            ) : (
              <>
                {isSignUp ? "Create Account" : "Sign In"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Social buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin("google")}
              disabled={loading}
              className="h-12 flex-1 rounded-lg border-border bg-transparent text-foreground font-bold uppercase tracking-[0.16em] text-xs hover:bg-secondary disabled:opacity-50"
            >
              <Chrome className="mr-2 h-5 w-5" />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin("apple")}
              disabled={loading}
              className="h-12 flex-1 rounded-lg border-border bg-transparent text-foreground font-bold uppercase tracking-[0.16em] text-xs hover:bg-secondary disabled:opacity-50"
            >
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.5C5.55 8.01 7.13 7.07 8.82 7.05C10.1 7.03 11.32 7.92 12.11 7.92C12.89 7.92 14.37 6.85 15.92 7.01C16.54 7.04 18.31 7.26 19.44 8.93C19.35 8.99 17.22 10.23 17.25 12.78C17.28 15.84 19.95 16.89 19.98 16.9C19.96 16.97 19.53 18.45 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              Apple
            </Button>
          </div>

          {onGuestEnter ? (
            <div className="pt-1 text-center">
              <button
                type="button"
                className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => onGuestEnter()}
              >
                Continue as guest
              </button>
              <p className="mt-1 text-typo-caption text-muted-foreground">Limited to this device. Sign in to sync.</p>
            </div>
          ) : null}
        </motion.form>
        </AnimatePresence>
      </div>
    </div>
  )
}
