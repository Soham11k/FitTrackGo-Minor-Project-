import { siteConfig } from "@/lib/data"
import Link from "next/link"

export const metadata = {
  title: `Privacy Policy | ${siteConfig.appName}`,
  description: `Privacy policy for ${siteConfig.appName}.`,
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to app">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">{siteConfig.appName} — Privacy Policy</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">Last updated: May 2026</p>
        <h2 id="who-we-are">1. Who we are</h2>
        <p>
          {siteConfig.companyName} (“we”, “our”) operates the {siteConfig.appName} app and related services. This policy explains how we handle
          your information when you use our app — including{" "}
          <strong className="font-semibold text-foreground">Supabase-hosted sync</strong> when you sign in (auth + Postgres),{" "}
          <strong className="font-semibold text-foreground">on-device</strong> pose analysis, and{" "}
          <strong className="font-semibold text-foreground">optional cloud AI</strong> features where enabled.
        </p>
        <h2 id="what-we-collect">2. What we collect</h2>
        <p>
          <strong>Account &amp; identity:</strong> When you register, Supabase authentication stores identifiers such as your email (and optionally
          profile fields you edit in the app). Row-level security (RLS) in our database restricts reads/writes per user — that is{" "}
          <strong className="font-semibold text-foreground">server-enforced access control</strong>, not end-to-end encryption of the database by the
          client.
        </p>
        <p id="cloud-sync">
          <strong>Fitness records you sync:</strong> When logged in and online, workouts, runs, coach session summaries, Arena-related records, wearable
          tokens/cursors (where wired), favorites, goals, settings, programs, replay metadata, clip reviews, push subscription rows, etc.{" "}
          <strong className="font-semibold text-foreground">may sync to Postgres</strong> as needed for backups, cross-device use, dashboards, Arena, and Coach
          history. Rows are keyed to your Supabase identity; operational staff rely on hosted platform access policies — they are{" "}
          <strong className="font-semibold text-foreground">not intentionally published</strong> publicly.
        </p>
        <p id="sensitive-fields">
          <strong>Selective encryption (client-side envelopes):</strong> For some fields — for example GPS path payloads and profile names when the feature flag and local
          key chain are present — we may encrypt the{" "}
          <strong className="font-semibold text-foreground">stored column value client-side before writing</strong> while keeping other columns plaintext for queries and
          product features. Turning off or losing the device key means those ciphertext fields may remain unreadable locally.
        </p>
        <p>
          <strong>On-device processing:</strong> MediaPipe pose, rep traces used for Arena and Coach proofs, recordings you choose to retain with **Coach set clips**,
          and similar processing run locally in your browser (or packaged WebView/Capacitor shell). Frames used for scoring are{" "}
          <strong className="font-semibold text-foreground">not</strong> uploaded for on-device Coach analysis by default — see in-app captions.
        </p>
        <p id="coach-replay-and-ai">
          <strong>Coach replay &amp; AI review:</strong> If you enable local coach clip recording / replay exports, snippets or derived frames **you submit** via the
          in-app flows may reach our server APIs (see OpenAI-backed routes in project docs).{" "}
          <code className="text-sm">POST /api/ai-coach/review-clip</code> sends sampled{" "}
          <strong className="font-semibold text-foreground">still frames</strong> (as structured data URLs) to a hosted vision-capable LLM — only when configured and only
          for signed-in workflows that invoke it — and persists a summarized result when the coach clip reviews pathway is available.
        </p>
        <p>
          <strong>Support:</strong> If you email support, we receive the contents of your message and any identifiers you supply.
        </p>
        <p>
          <strong>Technical &amp; abuse prevention:</strong> We may derive IP-derived rate limits from API traffic, store minimal webhook/cron payloads, and collect
          anonymous telemetry if you separately opt into analytics tooling.
        </p>
        <h2 id="use">3. How we use your information</h2>
        <p>
          To provide syncing, personalization, wearable bridges, reminders, Arena, Coach tooling, troubleshooting, billing (if introduced), regulatory compliance, fraud
          prevention, reliability, abuse resistance, safety, analytics (where enabled), customer support responses, notifications, aggregated research excluding direct
          sale of diary-level rows as an advertising product unless separately disclosed — and to improve FitTrackGo.
        </p>
        <h2 id="retention-deletion">4. Data retention and deletion</h2>
        <p>
          Cached data persists on your devices until cleared. Server-side rows remain until deleted through in-app/account deletion tooling (where wired), admin retention
          windows, contractual obligations, or legal holds. Replay packages you never upload remain local-only until you initiate sync/export.
        </p>
        <h2 id="rights">5. Your rights</h2>
        <p>
          Depending on where you live, you may request access, correction, portability, objection, deletion, restriction, or appeal processing. Reach us via{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline">
            {siteConfig.supportEmail}
          </a>.
        </p>
        <p>
          Industry-grade hosting (Supabase, OpenAI subcontractors when AI routes are invoked, CDN/WASM distributors for MediaPipe) may process payloads under their DPAs /
          SCCs depending on geography.
        </p>
        <h2 id="children">6. Children</h2>
        <p>
          FitTrackGo is aimed at teens/adults supervising their training. Parents should configure accounts for minors consistent with COPPA/regional statutes.
        </p>
        <h2 id="changes">7. Changes</h2>
        <p>
          We may revise this statement; we will revise the updated date atop this policy and materially highlight changes in-product when practical.
        </p>
        <p className="pt-4">
          <Link href="/" className="text-primary underline">
            Return to app
          </Link>
          {" · "}
          <a href={siteConfig.termsUrl} className="text-primary underline">
            Terms of Service
          </a>
        </p>
      </main>
    </div>
  )
}
