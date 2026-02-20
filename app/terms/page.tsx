import { siteConfig } from "@/lib/data"
import Link from "next/link"

export const metadata = {
  title: `Terms of Service | ${siteConfig.appName}`,
  description: `Terms of service for ${siteConfig.appName}.`,
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to app">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">{siteConfig.appName} — Terms of Service</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">Last updated: February 2025</p>
        <h2>1. Acceptance</h2>
        <p>
          By using the {siteConfig.appName} app and related services (“Services”) provided by {siteConfig.companyName}, you agree to these Terms of Service. If you do not agree, do not use the Services.
        </p>
        <h2>2. Use of the Services</h2>
        <p>
          You must use the Services only for lawful purposes and in accordance with these terms. You are responsible for your own health and safety when performing any exercises or activities suggested or tracked in the app. We are not liable for any injury or loss resulting from your use of the app.
        </p>
        <h2>3. Account and data</h2>
        <p>
          You may need to create an account to use certain features. You are responsible for keeping your account credentials secure. Data you create (workouts, runs, etc.) may be stored on your device; we describe our data practices in our <Link href={siteConfig.privacyUrl} className="text-primary underline">Privacy Policy</Link>.
        </p>
        <h2>4. Intellectual property</h2>
        <p>
          The app, its design, content, and branding are owned by {siteConfig.companyName} or its licensors. You may not copy, modify, or distribute our content without permission.
        </p>
        <h2>5. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, {siteConfig.companyName} and its affiliates shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Services. Our total liability shall not exceed the amount you paid us in the twelve months before the claim (if any).
        </p>
        <h2>6. Changes and termination</h2>
        <p>
          We may change these terms or the Services at any time. Continued use after changes constitutes acceptance. We may suspend or terminate your access if you breach these terms.
        </p>
        <h2>7. Contact</h2>
        <p>
          For questions about these terms, contact us at{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline">{siteConfig.supportEmail}</a>.
        </p>
        <p className="pt-4">
          <Link href="/" className="text-primary underline">Return to app</Link>
          {" · "}
          <Link href={siteConfig.privacyUrl} className="text-primary underline">Privacy Policy</Link>
        </p>
      </main>
    </div>
  )
}
