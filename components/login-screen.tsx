"use client"

import { useState, useEffect, useMemo } from "react"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome, Loader2, ScanLine, Share2, Swords } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient, invalidateSupabaseBrowserClient } from "@/lib/supabase/client"
import { markSupabaseReachable } from "@/lib/supabase/connectivity-circuit"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { invalidateAuthUserCache, saveProfile } from "@/lib/store-supabase"
import { siteConfig } from "@/lib/data"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CinematicStage } from "@/components/ui/cinematic-stage"
import { CINEMATIC, LOGO_INTRO } from "@/lib/motion"
import { clearGuestMode } from "@/lib/guest-mode"
import { SupabaseConnectivityBanner } from "@/components/supabase-connectivity-banner"
import { FittrackBrandLockup } from "@/components/brand/fittrack-brand-lockup"
import { cn } from "@/lib/utils"
import { getBrowserAuthRedirectOrigin } from "@/lib/auth-redirect-origin"

const PROOF_CARDS = [
  {
    title: "Train with proof",
    sub: "50+ camera-check movements — reps and Session DNA verified on-device, not self-reported.",
    icon: ScanLine,
  },
  {
    title: "Session DNA & replay",
    sub: "Rep traces, share cards, replay clips and optional AI review on key frames.",
    icon: Share2,
  },
  {
    title: "Arena verified duels",
    sub: "Challenge friends using the same composite score you earn in Coach — per movement.",
    icon: Swords,
  },
] as const

export function LoginScreen({
  onLogin,
  onGuestEnter,
  supabaseCloudOffline = false,
}: {
  onLogin: () => void
  onGuestEnter?: () => void
  /** Dev: keys valid but project API unreachable — surface guest entry prominently. */
  supabaseCloudOffline?: boolean
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
  const [authClientEpoch, setAuthClientEpoch] = useState(0)
  const supabase = useMemo(() => createClient(), [authClientEpoch])

  useEffect(() => {
    markSupabaseReachable()
    invalidateSupabaseBrowserClient()
    setAuthClientEpoch((n) => n + 1)
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
            emailRedirectTo: `${getBrowserAuthRedirectOrigin()}/auth/callback`,
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
          redirectTo: `${getBrowserAuthRedirectOrigin()}/auth/callback`,
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
        redirectTo: `${getBrowserAuthRedirectOrigin()}/auth/reset-password`,
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
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <CinematicStage
        vignette
        className="relative flex min-h-[40vh] w-full shrink-0 items-center justify-center overflow-hidden pb-10 pt-4 sm:h-[42vh] sm:min-h-[300px]"
      >
        {/* Soft studio lights behind hero — replaces flat black */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-[20%] left-1/2 h-[min(520px,90vw)] w-[min(520px,90vw)] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[72px]" />
          <div className="absolute -bottom-[30%] -left-[10%] h-[45%] w-[55%] rounded-full bg-primary/[0.04] blur-[64px]" />
          <div className="absolute -bottom-[25%] -right-[5%] h-[40%] w-[48%] rounded-full bg-[oklch(0.82_0.12_290/0.06)] blur-[56px]" />
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.035]"
            style={{
              backgroundImage: `linear-gradient(oklch(1 0 0 / 0.12) 1px, transparent 1px),
                linear-gradient(90deg, oklch(1 0 0 / 0.12) 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <motion.div
          className={cn(
            "relative z-[1] flex w-full max-w-sm flex-col items-center justify-center px-6 transition-all duration-700",
            animateIn ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
          )}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            variants={LOGO_INTRO}
            initial="hidden"
            animate="show"
            className="mb-2 flex justify-center"
          >
            <FittrackBrandLockup
              markSize={84}
              variant="hero"
              animated
              tagline={siteConfig.tagline}
            />
          </motion.div>
          <div className="relative mt-7 min-h-[5.75rem] w-full max-w-[20rem]" aria-live="polite">
            <AnimatePresence mode="wait">
              {(() => {
                const c = PROOF_CARDS[proofIdx]
                const Icon = c.icon
                return (
                  <motion.div
                    key={proofIdx}
                    role="group"
                    aria-label={c.title}
                    className="absolute inset-x-0 top-0 rounded-2xl border border-[color:color-mix(in_oklab,var(--primary)_22%,white)] bg-[color:oklch(0_0_0/0.38)] px-4 py-3.5 text-left shadow-[0_14px_40px_-20px_oklch(0_0_0/0.85),inset_0_1px_0_0_oklch(1_0_0/0.06)] backdrop-blur-xl dark:border-[color:color-mix(in_oklab,var(--primary)_18%,transparent)] dark:bg-[color:oklch(0_0_0/0.45)]"
                    variants={CINEMATIC.statReveal}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/35 to-primary/10 text-primary shadow-[inset_0_-1px_0_0_oklch(1_0_0/0.08)] ring-1 ring-[color:color-mix(in_oklab,var(--primary)_25%,transparent)]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-[color:var(--surface-stage-fg)]"
                          style={{ fontFamily: "var(--font-display), var(--font-heading), ui-sans-serif, system-ui, sans-serif" }}
                        >
                          {c.title}
                        </p>
                        <p className="mt-1 text-[0.6875rem] leading-relaxed tracking-wide text-white/70">{c.sub}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
            <div className="absolute bottom-[-1.375rem] left-0 right-0 flex justify-center gap-1.5 pt-3" aria-hidden>
              {PROOF_CARDS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === proofIdx ? "w-7 bg-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_45%,transparent)]" : "w-1.5 bg-white/20",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="mt-10 h-px w-40 bg-[color:var(--surface-stage-hairline)] sm:w-52" aria-hidden />
        </motion.div>
      </CinematicStage>

      {/* Form section — lift as a sheet for depth */}
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[1.75rem] border border-border/70 border-b-0 bg-gradient-to-b from-card/95 via-card/90 to-background -mt-4 px-6 pt-8 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-32px_oklch(0_0_0/0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/82 dark:border-white/[0.08] dark:from-[oklch(0.065_0_0/0.97)] dark:via-[oklch(0.04_0_0/0.96)] dark:to-background dark:shadow-[0_-24px_56px_-28px_oklch(0_0_0/0.75)_,0_-1px_0_0_oklch(1_0_0/0.04)]">
        {/* NRC-style underline tabs */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="relative mx-auto mb-7 flex w-full max-w-sm rounded-xl border border-border/50 bg-muted/30 p-[3px] backdrop-blur-sm dark:bg-white/[0.05] dark:border-white/[0.08]"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-[3px] bottom-[3px] z-0 w-[calc(50%-6px)] rounded-lg bg-background/95 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_8%,transparent),inset_0_1px_0_0_oklch(1_0_0/0.05)] ring-1 ring-border/70 dark:bg-[oklch(0.12_0_0/0.95)] dark:ring-white/[0.09]"
            initial={false}
            animate={{ left: isSignUp ? "calc(50% + 3px)" : "3px" }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
          />
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
            className={cn(
              "relative z-[1] flex-1 rounded-lg py-3 text-typo-eyebrow font-bold uppercase tracking-[0.22em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              !isSignUp ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
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
            className={cn(
              "relative z-[1] flex-1 rounded-lg py-3 text-typo-eyebrow font-bold uppercase tracking-[0.22em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isSignUp ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sign Up
          </button>
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
          <SupabaseConnectivityBanner />
          {supabaseCloudOffline && onGuestEnter ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl border-primary/55 bg-muted/25 font-bold uppercase tracking-[0.14em] text-sm shadow-sm hover:bg-muted/40 dark:border-primary/45 dark:bg-primary/[0.06]"
              onClick={() => onGuestEnter()}
            >
              Continue as guest — works without cloud
            </Button>
          ) : null}
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
                className="h-12 rounded-xl border-border/70 bg-muted/40 pl-10 text-base font-semibold text-foreground shadow-[inset_0_1px_2px_oklch(0_0_0/0.04)] backdrop-blur-sm placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus-visible:border-primary/90 focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/12 dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)]"
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
              className="h-12 rounded-xl border-border/70 bg-muted/40 pl-10 text-base font-semibold text-foreground shadow-[inset_0_1px_2px_oklch(0_0_0/0.04)] backdrop-blur-sm placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus-visible:border-primary/90 focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/12 dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)]"
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
              className="h-12 rounded-xl border-border/70 bg-muted/40 pl-10 pr-10 text-base font-semibold text-foreground shadow-[inset_0_1px_2px_oklch(0_0_0/0.04)] backdrop-blur-sm placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-xs focus-visible:border-primary/90 focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/12 dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)]"
              aria-invalid={!!fieldError.password}
              aria-describedby={fieldError.password ? "auth-password-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-b from-primary via-primary to-[color-mix(in_oklab,var(--primary)_88%,transparent)] px-4 text-primary-foreground shadow-[0_6px_24px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent),inset_0_1px_0_0_oklch(1_0_0/0.2)] transition-[transform,box-shadow] hover:brightness-[1.03] hover:shadow-[0_8px_28px_-12px_color-mix(in_oklab,var(--primary)_58%,transparent),inset_0_1px_0_0_oklch(1_0_0/0.22)] active:translate-y-[0.5px] active:brightness-[0.98] disabled:opacity-50 font-bold uppercase tracking-[0.18em] text-sm"
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

          {onGuestEnter && !supabaseCloudOffline ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full rounded-xl border-primary/35 bg-gradient-to-br from-primary/[0.12] via-primary/[0.08] to-transparent font-semibold text-sm shadow-inner ring-1 ring-primary/25 hover:from-primary/18 hover:to-primary/5 hover:ring-primary/35"
              onClick={() => onGuestEnter()}
            >
              Try verified Coach · guest · no account yet
            </Button>
          ) : null}

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border dark:to-white/15" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/90">Or continue</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border dark:to-white/15" />
          </div>

          {/* Social buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin("google")}
              disabled={loading}
              className="h-12 flex-1 rounded-xl border-border/70 bg-muted/25 font-bold uppercase tracking-[0.14em] text-xs shadow-sm hover:bg-muted/40 hover:border-border dark:border-white/12 dark:bg-white/[0.04] disabled:opacity-50"
            >
              <Chrome className="mr-2 h-5 w-5" />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin("apple")}
              disabled={loading}
              className="h-12 flex-1 rounded-xl border-border/70 bg-muted/25 font-bold uppercase tracking-[0.14em] text-xs shadow-sm hover:bg-muted/40 hover:border-border dark:border-white/12 dark:bg-white/[0.04] disabled:opacity-50"
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
