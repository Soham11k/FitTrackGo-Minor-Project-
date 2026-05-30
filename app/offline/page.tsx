import Link from 'next/link'
import { CHROME } from '@/lib/app-chrome'

export default function OfflinePage() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ backgroundColor: CHROME.black }}
    >
      {/* Pulsing ECG mark */}
      <div aria-hidden>
        <svg width="80" height="36" viewBox="0 0 88 40" fill="none">
          <path
            d="M0,20 L18,20 L26,5 L34,36 L42,20 L52,12 L60,20 L88,20"
            stroke={CHROME.orange}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: CHROME.orange }}>
          FitTrack Go
        </p>
        <h1 className="text-3xl font-black uppercase text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          You&apos;re offline
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed" style={{ color: CHROME.muted }}>
          FitTrack Go caches the app shell locally. Connect to Wi-Fi or mobile data, then retry to resume sync.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
        style={{ backgroundColor: CHROME.orange }}
      >
        Retry
      </Link>
    </main>
  )
}
