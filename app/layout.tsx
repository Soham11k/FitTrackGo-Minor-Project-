import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Inter, Space_Grotesk, Bebas_Neue } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AccentProvider } from '@/components/accent-provider'
import { LocaleProvider } from '@/components/locale-provider'
import { Toaster } from '@/components/ui/sonner'
import { ObservabilityInit } from '@/components/observability-init'
import { MediapipeConsoleBootstrap } from '@/components/mediapipe-console-bootstrap'
import { AuthListenerHostFix } from '@/components/auth-listener-host-fix'
import { SyncRunner } from '@/components/sync-runner'
import { siteConfig } from '@/lib/data'
import { alternatesLanguagesForPath, hrefForLocale } from '@/lib/locale-href'
import { normalizeLocale, getDir, openGraphAlternateLocales, openGraphLocaleTag } from '@/lib/i18n'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" })
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" })

export const viewport: Viewport = {
  themeColor: '#000000',
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

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = normalizeLocale(h.get('x-locale'))
  const pathnameRaw = (h.get('x-pathname') || '/').trim() || '/'
  const path = pathnameRaw.startsWith('/') ? pathnameRaw : `/${pathnameRaw}`
  const { canonical, languages } = alternatesLanguagesForPath(path)
  const ogLocale = openGraphLocaleTag(locale)
  const title = `${siteConfig.appName} - Your Fitness Companion`
  return {
    title,
    description: siteConfig.tagline + ' Track runs, master exercises with AI body detection, and crush your fitness goals.',
    manifest: '/manifest.json',
    metadataBase,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description: siteConfig.tagline,
      url: hrefForLocale(locale, path),
      siteName: siteConfig.appName,
      type: 'website',
      locale: ogLocale,
      alternateLocale: openGraphAlternateLocales(locale),
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${siteConfig.appName} hero` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: siteConfig.tagline,
      images: [`${siteUrl}/twitter-image`],
    },
    icons: {
      icon: [
        { url: '/brand/favicon.ico', sizes: '48x48' },
        { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/brand/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
      other: [{ rel: 'mask-icon', url: '/brand/safari-pinned-tab.svg', color: '#22c55e' }],
    },
  }
}

const buildForAndroidStatic = process.env.BUILD_FOR_ANDROID === "1"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const hdrs = await headers()
  const locale = normalizeLocale(hdrs.get('x-locale'))
  const dir = getDir(locale)
  const nonce = buildForAndroidStatic
    ? undefined
    : (hdrs.get("x-nonce") ?? undefined)

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} min-h-dvh`}
      suppressHydrationWarning
    >
      {/* Fixed full-viewport UIs do not grow body; min-h-dvh keeps the document (and a11y tree) non-zero height. */}
      <body className="min-h-dvh font-sans antialiased overflow-x-hidden">
        {/* Dev: 0.0.0.0 vs localhost are different cookie origins — normalize before auth runs. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var h=location.hostname;if(h==="0.0.0.0"||h==="[::]"||h==="::"){var u=new URL(location.href);u.hostname="localhost";location.replace(u.toString());}}catch(_){}})();',
          }}
        />
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
            __html: `(function(){var k='fittrackgo_accent';var v=localStorage.getItem(k);var o=['volt','green','blue','purple','orange','rose'];var a=o.indexOf(v)!==-1?v:'volt';document.documentElement.setAttribute('data-accent',a);})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AccentProvider>
          <LocaleProvider>
          <AuthListenerHostFix />
          <SyncRunner />
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
