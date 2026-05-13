"use client"

import { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

export function PwaInstallPrompt() {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPrompt | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    void navigator.serviceWorker?.register("/sw.js").catch(() => {})

    const onBip = (e: Event) => {
      e.preventDefault()
      setBipEvent(e as BeforeInstallPrompt)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [])

  const install = useCallback(async () => {
    if (!bipEvent?.prompt) return
    await bipEvent.prompt()
    await bipEvent.userChoice?.catch(() => {})
    setBipEvent(null)
  }, [bipEvent])

  if (dismissed || !bipEvent) return null

  return (
    <div className="fixed bottom-24 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur pointer-events-auto">
        <div className="flex-1 text-sm font-medium">
          Install FitTrack Go for faster reopen and offline splash.
        </div>
        <Button size="sm" variant="outline" type="button" onClick={() => void install()} className="shrink-0">
          Install
        </Button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          className="-mr-1 rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
