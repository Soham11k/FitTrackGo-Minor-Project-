import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/data'
import { APP_BASE_URL } from '@/lib/locale-href'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: `${siteConfig.appName} · ${siteConfig.tagline}`,
  description: `${siteConfig.tagline} GPS runs, AI Coach form feedback, wearables, and cloud sync.`,
  alternates: {
    canonical: `${APP_BASE_URL}/marketing`,
  },
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

export default function MarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto flex min-h-[80vh] max-w-4xl flex-col gap-10 px-6 py-16 text-foreground">
        <header className="space-y-3 text-center md:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary">FitTrack Go</p>
          <h1 className="text-4xl font-bold md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {siteConfig.tagline}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:mx-0">
            Track GPS runs, log workouts, sync wearables, and get real-time pose feedback in the browser—backed by Supabase and ready for web or Android builds.
          </p>
          <div className="flex flex-wrap justify-center gap-3 md:justify-start">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/">Open app</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { t: 'Run tracking', d: 'Live pace, splits, branded share cards.' },
            { t: 'AI Coach Assist', d: 'Body landmark feedback for squats, push-ups, planks, and more.' },
            { t: 'Arena + wearables', d: 'Coach sessions leaderboards plus Fitbit heart & readiness signals.' },
          ].map((c) => (
            <article key={c.t} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {c.t}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  )
}
