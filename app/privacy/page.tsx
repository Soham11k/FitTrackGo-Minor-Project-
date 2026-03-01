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
        <p className="text-sm text-muted-foreground">Last updated: February 2025</p>
        <h2>1. Who we are</h2>
        <p>
          {siteConfig.companyName} (“we”, “our”) operates the {siteConfig.appName} app and related services. This policy explains how we handle your information when you use our app.
        </p>
        <h2>2. Information we collect</h2>
        <p>
          <strong>Data you provide:</strong> When you sign up, we may collect your name and email. When you contact support, we receive the content of your message and contact details you provide.
        </p>
        <p>
          <strong>Data stored on your device:</strong> Workouts, runs, Coach Assist sessions, and profile data are stored locally on your device. We do not upload this data to our servers unless you use an optional cloud backup feature (if we offer it in the future).
        </p>
        <p>
          <strong>Technical data:</strong> We may collect anonymous usage and analytics data (e.g. app version, device type) to improve the product. This does not include your personal fitness data unless you opt in.
        </p>
        <h2>3. How we use your information</h2>
        <p>
          We use your information to provide the app, respond to support requests, send important service updates (if you have agreed), and improve our services. We do not sell your personal data.
        </p>
        <h2>4. Data retention and deletion</h2>
        <p>
          Local data stays on your device until you clear app data or uninstall. For any data we hold on our servers (e.g. support emails), we retain it only as long as needed to fulfill the purpose or as required by law.
        </p>
        <h2>5. Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct, or delete your personal data, or to object to or restrict certain processing. Contact us at{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline">{siteConfig.supportEmail}</a> to exercise these rights.
        </p>
        <h2>6. Changes</h2>
        <p>
          We may update this policy from time to time. We will post the updated version in the app or on our website and indicate the date of the last update.
        </p>
        <p className="pt-4">
          <Link href="/" className="text-primary underline">Return to app</Link>
          {" · "}
          <a href={siteConfig.termsUrl} className="text-primary underline">Terms of Service</a>
        </p>
      </main>
    </div>
  )
}
