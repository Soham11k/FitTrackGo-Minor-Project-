"use client"

import { Link2, Share2, Sparkles } from "lucide-react"
import { composeShareCard, type CoachSharePayload } from "@/lib/share-card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"

export type CoachFinishShareBarProps = {
  savedSessionId: string | null
  pngPayload: CoachSharePayload
  /** Triggers opening the replay sheet with the AI-review tab focused. */
  onRequestAiReview?: () => void
}

export function CoachFinishShareBar({ savedSessionId, pngPayload, onRequestAiReview }: CoachFinishShareBarProps) {
  const { locale, t } = useLocale()

  async function sharePng() {
    const faultNote = pngPayload.topFaults?.slice(0, 2).join(" · ") ?? ""
    const text = `${pngPayload.exercise} · ${pngPayload.score}% · ${pngPayload.reps} reps · FitTrack Go${faultNote ? ` · ${faultNote}` : ""}`
    try {
      const png = await composeShareCard({
        kind: "coach",
        payload: pngPayload,
        locale,
      })
      if (png && typeof navigator.share === "function" && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ title: t("coach.share.title"), files: [png], text })
        return
      }
      if (png && typeof navigator.share === "function") {
        await navigator.share({ title: t("coach.share.title"), text })
        return
      }
    } catch {
      /* cancelled */
    }
    toast.message(t("coach.share.failed"))
  }

  async function copyReportLink() {
    if (!savedSessionId || typeof window === "undefined") return
    const url = `${window.location.origin}/r/c/${savedSessionId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("coach.share.copiedReport"))
    } catch {
      toast.error(t("coach.share.failed"))
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] w-full max-w-sm space-y-2">
      <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">Share form report</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="flex-1 gap-2 rounded-xl" onClick={() => void sharePng()}>
          <Share2 className="h-4 w-4" aria-hidden />
          {t("coach.share.png")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 rounded-xl"
          disabled={!savedSessionId}
          onClick={() => void copyReportLink()}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          {t("coach.share.reportLink")}
        </Button>
      </div>
      {!savedSessionId ? (
        <p className="text-xs text-muted-foreground">Sign in and stay online when saving to unlock a preview link.</p>
      ) : null}
      {onRequestAiReview ? (
        <Button type="button" variant="ghost" className="w-full gap-2 rounded-xl" onClick={onRequestAiReview}>
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Review this set with AI
        </Button>
      ) : null}
    </div>
  )
}
