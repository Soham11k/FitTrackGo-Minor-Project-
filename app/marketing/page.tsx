import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/data'
import { APP_BASE_URL } from '@/lib/locale-href'
import { CHROME } from '@/lib/app-chrome'

export const metadata: Metadata = {
  title: `${siteConfig.appName} · ${siteConfig.tagline}`,
  description: `${siteConfig.tagline} GPS runs, AI Coach form feedback, wearables, and cloud sync.`,
  alternates: { canonical: `${APP_BASE_URL}/marketing` },
  openGraph: {
    title: siteConfig.appName,
    description: siteConfig.tagline,
    url: `${APP_BASE_URL}/marketing`,
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.appName,
  applicationCategory: 'HealthApplication',
  description: siteConfig.tagline,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

const features = [
  {
    title: 'GPS Run Tracking',
    description: 'Live pace, kilometre splits, branded share cards, and a dark immersive HUD.',
    accent: CHROME.orange,
  },
  {
    title: 'AI Coach Assist',
    description: 'Real-time body-landmark feedback for squats, push-ups, planks, RDLs, and more.',
    accent: CHROME.teal,
  },
  {
    title: 'Arena Form Duels',
    description: 'Challenge friends with verified composite scores — no manual PR typing.',
    accent: CHROME.hrRed,
  },
  {
    title: 'Wearable Sync',
    description: 'Heart rate, readiness, and sleep from Fitbit — live on your dashboard.',
    accent: CHROME.gpsGreen,
  },
  {
    title: 'Motion DNA',
    description: 'A 6-axis biomechanical fingerprint for every session so you can track form over time.',
    accent: '#8b5cf6',
  },
  {
    title: 'Cloud Sync',
    description: 'Powered by Supabase — your data is yours, always available offline-first.',
    accent: CHROME.amber,
  },
]

export default function MarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ backgroundColor: CHROME.black, minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
        {/* Nav */}
        <nav style={{ borderBottom: `1px solid ${CHROME.border}`, backgroundColor: 'rgba(13,13,13,0.92)' }}
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden>
              <path d="M2 16 L8 16 L11 8 L16 24 L20 12 L24 16 L30 16" stroke={CHROME.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">FitTrack Go</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: CHROME.muted }}>Log in</Link>
            <Link href="/"
              className="rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white"
              style={{ backgroundColor: CHROME.orange }}>
              Open App
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em]" style={{ color: CHROME.orange }}>
            FitTrack Go
          </p>
          <h1
            className="mt-3 text-5xl font-black uppercase leading-[1.05] text-white md:text-7xl"
            style={{ fontFamily: 'var(--font-display), var(--font-heading)' }}
          >
            {siteConfig.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed" style={{ color: CHROME.muted }}>
            GPS runs, AI Coach form feedback, wearables, and cloud sync — the fitness operating system for people who take performance seriously.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/"
              className="rounded-2xl px-8 py-4 text-base font-black uppercase tracking-[0.1em] text-white"
              style={{ backgroundColor: CHROME.orange }}>
              Get Started Free
            </Link>
            <Link href="/login"
              className="rounded-2xl px-8 py-4 text-base font-bold uppercase tracking-[0.1em]"
              style={{ border: `1.5px solid ${CHROME.border}`, color: CHROME.muted }}>
              Sign In
            </Link>
          </div>
        </section>

        {/* Features grid */}
        <section className="mx-auto max-w-4xl px-6 pb-20">
          <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.32em]" style={{ color: CHROME.muted }}>
            Everything you need
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl p-5"
                style={{ backgroundColor: CHROME.cardBg, border: `1px solid ${CHROME.border}` }}
              >
                <div className="mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: f.accent }} />
                <h2 className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                  {f.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: CHROME.muted }}>
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t px-6 py-8 text-center"
          style={{ borderColor: CHROME.border }}>
          <p className="text-xs" style={{ color: CHROME.muted }}>
            &copy; {new Date().getFullYear()} {siteConfig.appName} &middot;{' '}
            <Link href="/privacy" style={{ color: CHROME.muted }} className="hover:text-white transition-colors">Privacy</Link>
            {' '}&middot;{' '}
            <Link href="/terms" style={{ color: CHROME.muted }} className="hover:text-white transition-colors">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  )
}
