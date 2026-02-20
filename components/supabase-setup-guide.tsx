"use client"

import { AlertCircle, ExternalLink, Copy, Check } from "lucide-react"
import { useState } from "react"

export function SupabaseSetupGuide() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="max-w-2xl w-full rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/15 shrink-0">
            <AlertCircle className="h-5 w-5 text-chart-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">Supabase Setup Required</h2>
            <p className="text-sm text-muted-foreground">
              To use real authentication and cloud features, you need to configure Supabase.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Step 1: Get Your Supabase Credentials</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to your Supabase project dashboard</li>
              <li>Navigate to <strong className="text-foreground">Settings → API</strong></li>
              <li>Copy your <strong className="text-foreground">Project URL</strong> and <strong className="text-foreground">anon public</strong> key</li>
            </ol>
            <a
              href="https://supabase.com/dashboard/project/_/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              Open Supabase API Settings <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Step 2: Create .env.local File</h3>
            <p className="text-sm text-muted-foreground mb-2">Create a file named <code className="px-1.5 py-0.5 rounded bg-background text-xs">.env.local</code> in your project root:</p>
            <div className="relative">
              <pre className="text-xs bg-background p-3 rounded-lg border border-border overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`}
              </pre>
              <button
                onClick={() => copyToClipboard(`NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`)}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-secondary"
                title="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Step 3: Run Database Schema</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>In Supabase, go to <strong className="text-foreground">SQL Editor</strong></li>
              <li>Click <strong className="text-foreground">New Query</strong></li>
              <li>Copy the contents of <code className="px-1.5 py-0.5 rounded bg-background text-xs">supabase/schema.sql</code></li>
              <li>Paste and click <strong className="text-foreground">Run</strong></li>
            </ol>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Step 4: Restart Dev Server</h3>
            <p className="text-sm text-muted-foreground">
              After setting up <code className="px-1.5 py-0.5 rounded bg-background text-xs">.env.local</code>, restart your dev server:
            </p>
            <div className="relative">
              <pre className="text-xs bg-background p-3 rounded-lg border border-border">
                npm run dev
              </pre>
              <button
                onClick={() => copyToClipboard("npm run dev")}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-secondary"
                title="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex-1">
            Need help? Check <code className="px-1.5 py-0.5 rounded bg-background text-xs">README-SETUP.md</code> for detailed instructions.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Reload After Setup
          </button>
        </div>
      </div>
    </div>
  )
}
