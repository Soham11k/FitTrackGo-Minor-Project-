"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome, Loader2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient, invalidateSupabaseBrowserClient } from "@/lib/supabase/client"
import { markSupabaseReachable } from "@/lib/supabase/connectivity-circuit"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { invalidateAuthUserCache, saveProfile } from "@/lib/store-supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CINEMATIC, EASE } from "@/lib/motion"
import { clearGuestMode } from "@/lib/guest-mode"
import { SupabaseConnectivityBanner } from "@/components/supabase-connectivity-banner"
import { FittrackBrandLockup } from "@/components/brand/fittrack-brand-lockup"
import { cn } from "@/lib/utils"
import { getBrowserAuthRedirectOrigin } from "@/lib/auth-redirect-origin"

const TAGLINES = [
  "Your fitness. Your data. Your way.",
  "Train smart. Move strong.",
  "Every rep counts.",
] as const

function LoginHero() {
  const reduce = useReducedMotion() ?? false
  const [taglineIdx, setTaglineIdx] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setTaglineIdx((i) => (i + 1) % TAGLINES.length), 3000)
    return () => clearInterval(id)
  }, [reduce])

  return (
    <div className="relative min-h-[56vh] shrink-0 overflow-hidden bg-black select-none">
      {/* Deep radial background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.72 0.22 130 / 0.12) 0%, transparent 65%)" }}
        aria-hidden
      />

      {/* Runner figure — animated SVG at low opacity */}
      {!reduce && (
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-full opacity-[0.06]"
          viewBox="0 0 320 320"
          fill="none"
          aria-hidden
        >
          {/* Simplified runner silhouette */}
          <motion.g
            animate={{ x: [-10, 10, -10] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
          >
            <circle cx="200" cy="60" r="22" fill="white" />
            <motion.path
              d="M200 82 L195 130 L165 175 M200 130 L215 175 M200 105 L170 118 M200 105 L230 118"
              stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"
              animate={{ d: [
                "M200 82 L195 130 L165 175 M200 130 L215 175 M200 105 L170 118 M200 105 L230 118",
                "M200 82 L200 130 L175 175 M200 130 L220 172 M200 105 L172 112 M200 105 L228 122",
              ]}}
              transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", repeatType: "mirror" }}
            />
          </motion.g>
        </svg>
      )}

      {/* Rotating Volt energy ring behind logo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <motion.div
          className="rounded-full border-2 border-primary/20"
          style={{ width: 200, height: 200 }}
          animate={reduce ? {} : { rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute rounded-full border border-primary/10"
          style={{ width: 280, height: 280 }}
          animate={reduce ? {} : { rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        {/* Volt dot on the ring */}
        {!reduce && (
          <motion.div
            className="absolute h-3 w-3 rounded-full bg-primary shadow-[0_0_8px_4px_oklch(0.72_0.22_130/0.6)]"
            style={{ x: 100 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(100px)`}
          />
        )}
      </div>

      {/* Floating accent circles */}
      <motion.div
        className="pointer-events-none absolute top-8 right-8 h-14 w-14 rounded-full border-2 border-primary/30"
        animate={reduce ? {} : { y: [0, -8, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute bottom-20 left-6 h-8 w-8 rounded-full bg-primary/20"
        animate={reduce ? {} : { y: [0, 10, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute top-16 left-1/4 h-5 w-5 rounded-full border border-primary/40"
        animate={reduce ? {} : { scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        aria-hidden
      />

      {/* Brand mark — pulse-glyph draws in then heartbeat-loops */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [...EASE.cinematic] }}
          className="flex flex-col items-center gap-3"
        >
          {/* Animated ECG Logo mark */}
          <div className="relative flex items-center justify-center">
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_32px_oklch(0.72_0.22_130/0.3)]"
              animate={reduce ? {} : { boxShadow: [
                "0 0 16px oklch(0.72 0.22 130 / 0.2)",
                "0 0 32px oklch(0.72 0.22 130 / 0.5)",
                "0 0 16px oklch(0.72 0.22 130 / 0.2)",
              ]}}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" aria-hidden>
                <motion.path
                  d="M2 16 L8 16 L11 8 L16 24 L20 12 L24 16 L30 16"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: [...EASE.cinematic] }}
                />
              </svg>
            </motion.div>
          </div>

          <p
            className="text-3xl font-black uppercase tracking-[-0.04em] text-white"
            style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
          >
            FitTrack <span className="text-primary">Go</span>
          </p>

          {/* Cycling animated tagline */}
          <div className="h-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={taglineIdx}
                className="text-center text-sm font-medium tracking-[0.04em] text-white/55"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? {} : { opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [...EASE.cinematic] }}
              >
                {TAGLINES[taglineIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Gradient fade to sheet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black to-transparent" aria-hidden />
    </div>
  )
}

export function LoginScreen({
  onLogin,
  onGuestEnter,
  supabaseCloudOffline = false,
}: {
  onLogin: () => void
  onGuestEnter?: () => void
  supabaseCloudOffline?: boolean
}) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string; name?: string }>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [authClientEpoch, setAuthClientEpoch] = useState(0)
  const supabase = useMemo(() => createClient(), [authClientEpoch])

  useEffect(() => {
    markSupabaseReachable()
    invalidateSupabaseBrowserClient()
    setAuthClientEpoch((n) => n + 1)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError({})
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    const trimmedName = name.trim()

    if (!trimmedEmail) {
      setFieldError((err) => ({ ...err, email: "Enter your email address." }))
      return
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setFieldError((err) => ({ ...err, password: "Use at least 6 characters." }))
      return
    }
    if (isSignUp && !trimmedName) {
      setFieldError((err) => ({ ...err, name: "Enter your name to sign up." }))
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
          options: {
            data: { name: trimmedName },
            emailRedirectTo: `${getBrowserAuthRedirectOrigin()}/auth/callback`,
          },
        })
        if (error) throw error
        if (data.user) {
          if (data.session) {
            invalidateAuthUserCache()
            try {
              await saveProfile({ name: trimmedName, onboarded: false })
            } catch (err) {
              console.error("Profile save error:", err)
              toast.warning("Account created, but we couldn't save your profile yet.")
            }
          }
          if (!data.session) {
            toast.success("Account created! Check your email to verify, then sign in.")
            setIsSignUp(false)
            return
          }
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          })
          if (signInError) {
            toast.error(getAuthErrorMessage(signInError, "Could not sign in after signup."))
            return
          }
          invalidateAuthUserCache()
          clearGuestMode()
          onLogin()
          router.refresh()
        }
      } else {
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
        options: { redirectTo: `${getBrowserAuthRedirectOrigin()}/auth/callback` },
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
      <LoginHero />

      <motion.div
        className="relative z-[2] -mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[2rem] border border-border border-b-0 bg-background px-6 pt-8 shadow-[0_-24px_60px_-12px_oklch(0_0_0/0.35)] pb-[max(1.75rem,env(safe-area-inset-bottom))]"
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.15 }}
      >
        <div className="-mt-14 mb-6 flex justify-center">
          <FittrackBrandLockup markSize={64} layout="stack" showWordmark animated />
        </div>

        <h1
          className="text-center text-xl font-bold leading-snug text-foreground sm:text-2xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Take the next step toward a healthier, more active life
        </h1>

        <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3">
          <SupabaseConnectivityBanner />

          {supabaseCloudOffline && onGuestEnter ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => onGuestEnter()}>
              Continue as guest — works without cloud
            </Button>
          ) : null}

          {/* Google button with periodic shimmer sweep */}
          <div className="relative overflow-hidden rounded-lg">
            <Button
              type="button"
              variant="default"
              className="w-full"
              disabled={loading}
              onClick={() => handleSocialLogin("google")}
            >
              <Chrome className="h-5 w-5" />
              Sign in with Google
            </Button>
            <motion.div
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-white/15"
              animate={{ x: ["-110%", "210%"] }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", repeatDelay: 5.5 }}
              aria-hidden
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => setShowEmailForm((v) => !v)}
          >
            Sign in with FitTrack
          </Button>

          <AnimatePresence initial={false}>
            {showEmailForm ? (
              <motion.form
                key={isSignUp ? "signup" : "signin"}
                onSubmit={handleSubmit}
                className="nrc-card space-y-3 p-4"
                variants={CINEMATIC.statReveal}
                initial="hidden"
                animate="show"
                exit="hidden"
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg py-2 text-typo-eyebrow font-bold uppercase tracking-[0.18em]",
                      !isSignUp ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                    onClick={() => {
                      setIsSignUp(false)
                      setFieldError({})
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg py-2 text-typo-eyebrow font-bold uppercase tracking-[0.18em]",
                      isSignUp ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                    onClick={() => {
                      setIsSignUp(true)
                      setFieldError({})
                    }}
                  >
                    Sign up
                  </button>
                </div>

                {isSignUp ? (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setFieldError((err) => ({ ...err, name: undefined }))
                      }}
                      className="pl-10"
                      aria-invalid={!!fieldError.name}
                    />
                    {fieldError.name ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {fieldError.name}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFieldError((err) => ({ ...err, email: undefined }))
                    }}
                    className="pl-10"
                    aria-invalid={!!fieldError.email}
                  />
                </div>
                {fieldError.email ? (
                  <p className="-mt-1 text-xs text-destructive" role="alert">
                    {fieldError.email}
                  </p>
                ) : null}

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setFieldError((err) => ({ ...err, password: undefined }))
                    }}
                    className="pl-10 pr-10"
                    aria-invalid={!!fieldError.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldError.password ? (
                  <p className="-mt-1 text-xs text-destructive" role="alert">
                    {fieldError.password}
                  </p>
                ) : null}

                {!isSignUp ? (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}

                <Button type="submit" variant="nrcPrimary" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating…" : "Signing in…"}
                    </>
                  ) : (
                    <>
                      {isSignUp ? "Create account" : "Sign in"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => handleSocialLogin("apple")}
                >
                  Continue with Apple
                </Button>
              </motion.form>
            ) : null}
          </AnimatePresence>

          {onGuestEnter && !supabaseCloudOffline ? (
            <button
              type="button"
              className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => onGuestEnter()}
            >
              Continue as guest
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
