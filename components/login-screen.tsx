"use client"

import { useState, useEffect, useMemo } from "react"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient, invalidateSupabaseBrowserClient } from "@/lib/supabase/client"
import { markSupabaseReachable } from "@/lib/supabase/connectivity-circuit"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { invalidateAuthUserCache, saveProfile } from "@/lib/store-supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { EASE } from "@/lib/motion"
import { clearGuestMode } from "@/lib/guest-mode"
import { SupabaseConnectivityBanner } from "@/components/supabase-connectivity-banner"
import { cn } from "@/lib/utils"
import { getBrowserAuthRedirectOrigin } from "@/lib/auth-redirect-origin"
import { CHROME } from "@/lib/app-chrome"
import { siteConfig } from "@/lib/data"
import Link from "next/link"

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.76-3.74 4.25z" />
    </svg>
  )
}

/** Cream-sheet inputs must stay dark-on-light even when the app theme is dark. */
const loginFieldClass =
  "rounded-xl border-[#e8e4dc] bg-[#f5f5f3] text-[#111111] caret-[#111111] placeholder:text-[#9a9a9a] shadow-none focus-visible:border-[#111111]/25 focus-visible:ring-[#111111]/10 autofill:text-[#111111] autofill:shadow-[inset_0_0_0px_1000px_#f5f5f3] [-webkit-text-fill-color:#111111]"

function AnimatedEcgIcon({ size = 28, animate = true }: { size?: number; animate?: boolean }) {
  const reduce = useReducedMotion() ?? false
  const d = "M2 16 L8 16 L11 8 L16 24 L20 12 L24 16 L30 16"

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      {animate && !reduce ? (
        <motion.path
          d={d}
          stroke={CHROME.orange}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.5 }}
          animate={{ pathLength: [0, 1, 1, 0.85, 1], opacity: 1 }}
          transition={{
            pathLength: { duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.55, 0.75, 1] },
            opacity: { duration: 0.6 },
          }}
        />
      ) : (
        <path d={d} stroke={CHROME.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

/** Three diagonal lines fanning from top-right — matches reference image. */
function HeroAccentLines() {
  const reduce = useReducedMotion() ?? false
  const paths = [
    "M 320 0 L 155 155",
    "M 320 28 L 168 172",
    "M 300 0 L 140 148",
  ]

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 320"
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden
    >
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={CHROME.orange}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          initial={reduce ? { pathLength: 1, opacity: 0.4 } : { pathLength: 0, opacity: 0 }}
          animate={
            reduce
              ? { pathLength: 1, opacity: 0.4 }
              : { pathLength: 1, opacity: [0.25, 0.55, 0.25] }
          }
          transition={
            reduce
              ? {}
              : {
                  pathLength: { duration: 0.85, delay: 0.25 + i * 0.12, ease: [...EASE.cinematic] },
                  opacity: { duration: 3, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" },
                }
          }
        />
      ))}
    </svg>
  )
}

function LoginHero() {
  const reduce = useReducedMotion() ?? false

  return (
    <div
      className="relative flex min-h-0 flex-[1.32] flex-col items-center overflow-hidden pt-[max(3.5rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: CHROME.black }}
    >
      <HeroAccentLines />

      {/* Two accent dots on the left — as in reference */}
      {[
        { top: "22%", left: "14%" },
        { top: "38%", left: "10%" },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
          style={{ ...pos, backgroundColor: CHROME.orange }}
          initial={reduce ? { opacity: 0.6 } : { opacity: 0, scale: 0 }}
          animate={
            reduce
              ? { opacity: 0.6 }
              : { opacity: [0.4, 1, 0.4], scale: [1, 1.25, 1] }
          }
          transition={
            reduce
              ? {}
              : {
                  duration: 2.6,
                  repeat: Infinity,
                  delay: 0.6 + i * 0.5,
                  ease: "easeInOut",
                }
          }
          aria-hidden
        />
      ))}

      {/* Icon — top center, rounded square with orange border */}
      <motion.div
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-[1.1rem] border-2 bg-black/40"
        style={{ borderColor: CHROME.orangeDim, boxShadow: `0 0 24px ${CHROME.orangeDim}` }}
        initial={reduce ? false : { opacity: 0, scale: 0.6, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [...EASE.cinematic] }}
      >
        <AnimatedEcgIcon size={30} />
      </motion.div>

      {/* FITTRACK + GO */}
      <div className="relative z-10 mt-8 flex flex-col items-center">
        <motion.p
          className="text-[2.15rem] font-black uppercase leading-[0.95] tracking-[-0.05em] text-white sm:text-[2.5rem]"
          style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [...EASE.cinematic] }}
        >
          FitTrack
        </motion.p>
        <motion.p
          className="text-[2.15rem] font-black uppercase leading-[0.95] tracking-[-0.05em] sm:text-[2.5rem]"
          style={{ fontFamily: "var(--font-display), var(--font-heading)", color: CHROME.orange }}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22, ease: [...EASE.cinematic] }}
        >
          Go
        </motion.p>
      </div>

      {/* Tagline */}
      <motion.p
        className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.28em]"
        style={{ color: CHROME.tagline }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.38, ease: [...EASE.cinematic] }}
      >
        Your fitness · Your data
      </motion.p>

      <div className="flex-1" aria-hidden />
    </div>
  )
}

const sheetStagger = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.35 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
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
  const reduce = useReducedMotion() ?? false
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
  // authClientEpoch intentionally triggers supabase client recreation on auth errors
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const btnBase =
    "flex h-[3.25rem] w-full items-center justify-center gap-3 rounded-2xl border bg-white text-[0.9375rem] font-semibold transition-colors hover:bg-[#f5f5f3] disabled:opacity-50"

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{ backgroundColor: CHROME.black }}>
      <LoginHero />

      {/* Bottom sheet — ~42% of screen, white, large rounded top */}
      <motion.div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[2rem] px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ backgroundColor: CHROME.sheet }}
        initial={reduce ? false : { y: "105%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30, delay: 0.05 }}
      >
        {/* Grabber */}
        <motion.div
          className="mx-auto mb-7 h-[0.28rem] w-10 rounded-full bg-black/12"
          initial={reduce ? false : { scaleX: 0.3, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          aria-hidden
        />

        <motion.div className="mx-auto w-full max-w-sm" initial="hidden" animate="show">
          <motion.h1
            custom={0}
            variants={sheetStagger}
            className="text-center text-[1.4rem] font-bold leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: CHROME.text }}
          >
            Welcome back
          </motion.h1>
          <motion.p
            custom={1}
            variants={sheetStagger}
            className="mt-1.5 text-center text-[0.9375rem]"
            style={{ color: CHROME.mutedDark }}
          >
            Sign in to continue your journey
          </motion.p>

          <div className="mt-9 flex flex-col gap-3">
            <motion.div custom={2} variants={sheetStagger} className="empty:hidden">
              <SupabaseConnectivityBanner />
            </motion.div>

            {supabaseCloudOffline && onGuestEnter ? (
              <motion.div custom={2} variants={sheetStagger}>
                <button
                  type="button"
                  className={btnBase}
                  style={{ borderColor: CHROME.cardBorder, color: CHROME.text }}
                  onClick={() => onGuestEnter()}
                >
                  Continue as guest — works without cloud
                </button>
              </motion.div>
            ) : null}

            {/* Apple */}
            <motion.div custom={3} variants={sheetStagger}>
              <motion.button
                type="button"
                disabled={loading}
                onClick={() => handleSocialLogin("apple")}
                whileTap={reduce ? {} : { scale: 0.985 }}
                className={btnBase}
                style={{ borderColor: CHROME.cardBorder, color: CHROME.text }}
              >
                <AppleGlyph className="h-[1.35rem] w-[1.35rem] shrink-0" />
                Continue with Apple
              </motion.button>
            </motion.div>

            {/* Google */}
            <motion.div custom={4} variants={sheetStagger}>
              <motion.button
                type="button"
                disabled={loading}
                onClick={() => handleSocialLogin("google")}
                whileTap={reduce ? {} : { scale: 0.985 }}
                className={btnBase}
                style={{ borderColor: CHROME.cardBorder, color: CHROME.text }}
              >
                <GoogleGlyph className="h-[1.35rem] w-[1.35rem] shrink-0" />
                Continue with Google
              </motion.button>
            </motion.div>

            {/* OR */}
            <motion.div custom={5} variants={sheetStagger} className="flex items-center gap-4 py-1">
              <div className="h-px flex-1" style={{ backgroundColor: CHROME.cardBorder }} />
              <span className="text-xs font-medium uppercase tracking-[0.15em]" style={{ color: CHROME.mutedDark }}>
                Or
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: CHROME.cardBorder }} />
            </motion.div>

            {/* FitTrack — orange icon + orange label like reference */}
            <motion.div custom={6} variants={sheetStagger}>
              <motion.button
                type="button"
                disabled={loading}
                onClick={() => setShowEmailForm((v) => !v)}
                whileTap={reduce ? {} : { scale: 0.985 }}
                className={btnBase}
                style={{ borderColor: CHROME.cardBorder, color: CHROME.orange }}
              >
                <AnimatedEcgIcon size={22} animate={!reduce} />
                Sign in with FitTrack
              </motion.button>
            </motion.div>

            <AnimatePresence initial={false}>
              {showEmailForm ? (
                <motion.form
                  key={isSignUp ? "signup" : "signin"}
                  onSubmit={handleSubmit}
                  className="space-y-3 rounded-2xl border bg-white p-4"
                  style={{ borderColor: CHROME.cardBorder }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [...EASE.cinematic] }}
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "flex-1 rounded-xl py-2 text-xs font-bold uppercase tracking-[0.14em]",
                        !isSignUp ? "text-white" : "text-[#737373]",
                      )}
                      style={{ backgroundColor: !isSignUp ? CHROME.text : "transparent" }}
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
                        "flex-1 rounded-xl py-2 text-xs font-bold uppercase tracking-[0.14em]",
                        isSignUp ? "text-white" : "text-[#737373]",
                      )}
                      style={{ backgroundColor: isSignUp ? CHROME.text : "transparent" }}
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
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
                      <Input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          setFieldError((err) => ({ ...err, name: undefined }))
                        }}
                        className={cn(loginFieldClass, "pl-10")}
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
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setFieldError((err) => ({ ...err, email: undefined }))
                      }}
                      className={cn(loginFieldClass, "pl-10")}
                      aria-invalid={!!fieldError.email}
                    />
                  </div>
                  {fieldError.email ? (
                    <p className="-mt-1 text-xs text-destructive" role="alert">
                      {fieldError.email}
                    </p>
                  ) : null}

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setFieldError((err) => ({ ...err, password: undefined }))
                      }}
                      className={cn(loginFieldClass, "pl-10 pr-10")}
                      aria-invalid={!!fieldError.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]"
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
                        className="text-xs hover:underline"
                        style={{ color: CHROME.orange }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-2xl text-white hover:opacity-90"
                    style={{ backgroundColor: CHROME.text }}
                    disabled={loading}
                  >
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

                  <motion.button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSocialLogin("apple")}
                    whileTap={reduce ? {} : { scale: 0.985 }}
                    className={btnBase}
                    style={{ borderColor: CHROME.cardBorder, color: CHROME.text }}
                  >
                    <AppleGlyph className="h-[1.35rem] w-[1.35rem] shrink-0" />
                    Continue with Apple
                  </motion.button>
                </motion.form>
              ) : null}
            </AnimatePresence>

            {onGuestEnter && !supabaseCloudOffline ? (
              <motion.button
                custom={7}
                variants={sheetStagger}
                type="button"
                className="mt-3 w-full py-2 text-center text-[0.9375rem] font-medium transition-colors hover:opacity-80"
                style={{ color: CHROME.mutedDark }}
                onClick={() => onGuestEnter()}
              >
                Continue as guest
              </motion.button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
