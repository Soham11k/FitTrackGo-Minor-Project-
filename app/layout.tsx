import type { Metadata, Viewport } from 'next'
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { headers } from 'next/headers'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AccentProvider } from '@/components/accent-provider'
import { LocaleProvider } from '@/components/locale-provider'
import { Toaster } from '@/components/ui/sonner'
import { ObservabilityInit } from '@/components/observability-init'
import { MediapipeConsoleBootstrap } from '@/components/mediapipe-console-bootstrap'
import { siteConfig } from '@/lib/data'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-to-zoom for accessibility (WCAG 1.4.4)
  maximumScale: 5,
  userScalable: true,
}

/** Resolve OG / favicon absolute URLs to the current host (avoids localhost tab using production icons). */
function getMetadataBase(): URL {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || '3000'
    return new URL(`http://localhost:${port}`)
  }
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (raw) {
    const u = raw.replace(/\/$/, '')
    return new URL(u.startsWith('http') ? u : `https://${u}`)
  }
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`)
  return new URL('https://fittrackgo.com')
}

const metadataBase = getMetadataBase()
const siteUrl = metadataBase.origin

export const metadata: Metadata = {
  title: `${siteConfig.appName} - Your Fitness Companion`,
  description: siteConfig.tagline + ' Track runs, master exercises with AI body detection, and crush your fitness goals.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  metadataBase,
  openGraph: {
    title: `${siteConfig.appName} - Your Fitness Companion`,
    description: siteConfig.tagline,
    url: siteUrl,
    siteName: siteConfig.appName,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: `${siteConfig.appName} - Your Fitness Companion`,
    description: siteConfig.tagline,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
}

const buildForAndroidStatic = process.env.BUILD_FOR_ANDROID === "1"

// #region agent log (module init — avoids render-time side effects in RootLayout)
if (process.env.NODE_ENV === "development" && !buildForAndroidStatic) {
  try {
    const dirPath = join(process.cwd(), ".cursor")
    mkdirSync(dirPath, { recursive: true })
    appendFileSync(
      join(dirPath, "debug-35ceb6.log"),
      `${JSON.stringify({
        sessionId: "35ceb6",
        hypothesisId: "H-PING",
        runId: "layout-module-eval",
        message: "layout.tsx module evaluated (Node)",
        NODE_ENV: process.env.NODE_ENV,
        ts: Date.now(),
      })}\n`
    )
    console.warn("[fittrack-debug-35ceb6-ping] root-layout-module-eval")
  } catch (err) {
    console.warn("[fittrack-debug-35ceb6-ping-err]", err)
  }
}
// #endregion

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = buildForAndroidStatic
    ? undefined
    : ((await headers()).get("x-nonce") ?? undefined)

  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${inter.variable} ${spaceGrotesk.variable} min-h-dvh`}
      suppressHydrationWarning
    >
      {/* Fixed full-viewport UIs do not grow body; min-h-dvh keeps the document (and a11y tree) non-zero height. */}
      <body className="min-h-dvh font-sans antialiased overflow-x-hidden">
        {/* Earliest inline hook: must stay aligned with lib/mediapipe-console-noise.ts `isIgnorableMediapipeBrowserNoise`. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function T(a){return[].slice.call(a).map(function(x){return typeof x==="string"?x:(x&&x.message)||String(x)}).join(" ");}function ig(t){if(!t)return !1;if(t.indexOf("gl_context.cc")>=0&&t.indexOf("OpenGL error checking is disabled")>=0)return !0;if(t.indexOf("FaceBlendshapesGraph")>=0&&t.indexOf("xnnpack")>=0)return !0;if(t.indexOf("face_landmarker_graph")>=0)return !0;if(t.indexOf("vision_wasm_internal")>=0)return !0;if(t.indexOf("landmark_projection_calculator")>=0&&t.indexOf("NORM_RECT")>=0)return !0;if(t.indexOf("inference_feedback_manager")>=0&&t.indexOf("Disabling support for feedback tensors")>=0)return !0;if(t.indexOf("inference_feedback_manager")>=0&&t.indexOf("Feedback manager")>=0)return !0;var g=/\\bW\\d+\\s+[\\d:.]+\\s+\\d+\\s+\\S+\\.cc:\\d+\\]/.test(t)||(/\\.cc:\\d+\\]/.test(t)&&/\\bW\\d{4}\\s/.test(t));if(g&&(t.indexOf("tasks-vision")>=0||t.indexOf("vision_wasm_internal")>=0||t.indexOf("mediapipe-models")>=0||t.indexOf("wasm/vision")>=0))return !0;return !1;}function W(k){var o=console[k].bind(console);console[k]=function(){var s=T(arguments);if(ig(s))return;return o.apply(console,arguments);};}["warn","error","log","info","debug"].forEach(W);}catch(_){}})();`,
          }}
        />
        {/* Browsers strip the `nonce` attribute from the DOM after parsing
            (CSP nonce-hiding), so `element.nonce` reads back as "" during
            hydration. Suppress the mismatch — the nonce still works for CSP. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='fittrackgo_accent';var v=localStorage.getItem(k);var o=['green','blue','purple','orange','rose'];var a=o.indexOf(v)!==-1?v:'green';document.documentElement.setAttribute('data-accent',a);})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AccentProvider>
          <LocaleProvider>
          <ObservabilityInit />
          <MediapipeConsoleBootstrap />
          {children}
          <div id="supabase-setup-root" />
          <Toaster position="top-center" richColors closeButton />
          <Analytics />
          </LocaleProvider>
          </AccentProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
