"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COACH_EXERCISE_FAMILIES } from "@/lib/coach-exercise-catalog"
import type { FormSpec, LoadType } from "@/lib/form-engine/types"
import { saveCustomExercise } from "@/lib/custom-exercises/store"
import type { UserCustomExercise } from "@/lib/custom-exercises/types"
import { setAICoachIntent } from "@/lib/ai-coach-intent"

type GeneratePreview = {
  rulesSummary: string[]
  phasesSummary: string[]
  repPattern?: string
  cameraNote?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestMode?: boolean
  onRequestSignIn?: () => void
  onSaved?: (exercise: UserCustomExercise) => void
  onPractice?: (specId: string) => void
}

const SIMILAR_OPTIONS = COACH_EXERCISE_FAMILIES.flatMap((f) =>
  f.variants.slice(0, 2).map((v) => ({ specId: v.specId, label: `${f.name} · ${v.name}` })),
).slice(0, 24)

export function CustomExerciseBuilder({
  open,
  onOpenChange,
  guestMode,
  onRequestSignIn,
  onSaved,
  onPractice,
}: Props) {
  const reduceMotion = useReducedMotion() ?? false
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("")
  const [loadType, setLoadType] = useState<LoadType | "">("")
  const [similarTo, setSimilarTo] = useState<string>("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftSpec, setDraftSpec] = useState<FormSpec | null>(null)
  const [draftSpecId, setDraftSpecId] = useState<string | null>(null)
  const [preview, setPreview] = useState<GeneratePreview | null>(null)

  const canGenerate = name.trim().length > 0 && description.trim().length >= 12

  const similarLabel = useMemo(() => {
    if (!similarTo) return undefined
    return SIMILAR_OPTIONS.find((o) => o.specId === similarTo)?.label
  }, [similarTo])

  const resetDraft = () => {
    setDraftSpec(null)
    setDraftSpecId(null)
    setPreview(null)
  }

  const handleGenerate = async () => {
    if (guestMode) {
      onRequestSignIn?.()
      toast.message("Sign in to create custom exercises with AI form rules.")
      return
    }
    if (!canGenerate) {
      toast.error("Add a name and describe the movement (at least 12 characters).")
      return
    }
    setGenerating(true)
    resetDraft()
    try {
      const res = await fetch("/api/ai-coach/generate-form-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category: category || undefined,
          loadType: loadType || undefined,
          similarToSpecId: similarTo || undefined,
        }),
      })
      const data = (await res.json()) as {
        spec?: FormSpec
        specId?: string
        preview?: GeneratePreview
        message?: string
        error?: string
      }
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "Could not generate form rules.")
        return
      }
      if (!data.spec || !data.specId) {
        toast.error("Invalid response from server.")
        return
      }
      setDraftSpec(data.spec)
      setDraftSpecId(data.specId)
      setPreview(data.preview ?? null)
      toast.success("Form rules generated — review and save.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!draftSpec || !draftSpecId) return
    if (guestMode) {
      onRequestSignIn?.()
      return
    }
    setSaving(true)
    try {
      const result = await saveCustomExercise({
        displayName: name.trim() || draftSpec.displayName,
        description: description.trim(),
        spec: draftSpec,
        specId: draftSpecId,
        cameraNote: preview?.cameraNote,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Saved “${result.exercise.displayName}”`)
      onSaved?.(result.exercise)
      onOpenChange(false)
      setName("")
      setDescription("")
      setCategory("")
      setLoadType("")
      setSimilarTo("")
      resetDraft()
    } finally {
      setSaving(false)
    }
  }

  const handlePractice = () => {
    if (!draftSpecId) return
    setAICoachIntent({ exerciseId: draftSpecId })
    onPractice?.(draftSpecId)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[min(92vh,760px)] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Create custom exercise
          </SheetTitle>
          <SheetDescription>
            Describe how you move — AI builds form-check rules for live Coach scoring and rep counting.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="custom-ex-name">Name</Label>
            <Input
              id="custom-ex-name"
              placeholder="e.g. Band pull-apart"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                resetDraft()
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-ex-desc">Describe the movement</Label>
            <Textarea
              id="custom-ex-desc"
              rows={4}
              placeholder="Arms straight, pull band apart to shoulder blades, control the return…"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                resetDraft()
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto</SelectItem>
                  <SelectItem value="upper">Upper</SelectItem>
                  <SelectItem value="lower">Lower</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="compound">Compound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Load (optional)</Label>
              <Select
                value={loadType || "auto"}
                onValueChange={(v) => setLoadType(v === "auto" ? "" : (v as LoadType))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bodyweight">Bodyweight</SelectItem>
                  <SelectItem value="external">External weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Similar to (optional)</Label>
            <Select value={similarTo || "none"} onValueChange={(v) => setSimilarTo(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None — helps AI quality" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none">None</SelectItem>
                {SIMILAR_OPTIONS.map((o) => (
                  <SelectItem key={o.specId} value={o.specId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {similarLabel ? (
              <p className="text-xs text-muted-foreground">Using {similarLabel} as a template.</p>
            ) : null}
          </div>

          <Button type="button" className="w-full btn-lift" disabled={!canGenerate || generating} onClick={() => void handleGenerate()}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "Generating rules…" : "Generate form rules"}
          </Button>

          {generating ? <p className="text-xs text-muted-foreground">Building rules from your movement description…</p> : null}

          <AnimatePresence mode="wait">
            {preview && draftSpec ? (
              <motion.div
                key="preview"
                className="rounded-xl border border-border bg-card/60 p-4 space-y-3"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm font-semibold text-foreground">Review and save</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {preview.rulesSummary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Rep pattern: {preview.repPattern ?? draftSpec.repPattern ?? "top_bottom_top"} · Phases:{" "}
                  {preview.phasesSummary.join(" → ")}
                </p>
                {preview.cameraNote ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Camera:</span> {preview.cameraNote}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="flex-1 btn-lift" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save exercise
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={handlePractice}>
                    Practice with Coach
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {guestMode ? (
            <p className="text-xs text-center text-muted-foreground">
              Sign in to save custom exercises to your account.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
