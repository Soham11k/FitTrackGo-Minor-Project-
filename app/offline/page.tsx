import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#060606] px-6 text-center text-foreground">
      <div
        aria-hidden
        className="h-16 w-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin"
      />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          You&apos;re offline
        </h1>
        <p className="max-w-sm text-muted-foreground">
          FitTrack Go caches the dashboard shell locally. Connect to Wi‑Fi or mobile data, then reopen the tab to resume sync.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Retry
      </Link>
    </main>
  )
}
