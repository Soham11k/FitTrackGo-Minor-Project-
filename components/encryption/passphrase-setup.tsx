"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { exportWrappedClipKey } from "@/lib/encryption/content-key"
import { upsertUserClipKeyBackup } from "@/lib/user-clip-keys-supabase"

function passphraseOk(s: string): boolean {
  return s.trim().length >= 10
}

export function PassphraseSetupDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after Supabase upsert succeeds. */
  onBackedUp?: () => void
}) {
  const { open, onOpenChange, onBackedUp } = props
  const [p1, setP1] = useState("")
  const [p2, setP2] = useState("")
  const [busy, setBusy] = useState(false)

  function resetFields() {
    setP1("")
    setP2("")
  }

  async function submit() {
    if (!passphraseOk(p1)) {
      toast.error("Use at least 10 characters for your passphrase.")
      return
    }
    if (p1 !== p2) {
      toast.error("Passphrases must match.")
      return
    }
    setBusy(true)
    try {
      const wrapped = await exportWrappedClipKey(p1)
      const ok = await upsertUserClipKeyBackup({
        wrapped: wrapped.wrapped,
        salt: wrapped.salt,
        iterations: wrapped.iterations,
      })
      if (!ok) throw new Error("upsert_failed")
      toast.success("Clip encryption key backed up.")
      resetFields()
      onOpenChange(false)
      onBackedUp?.()
    } catch {
      toast.error("Could not save backup — check you're signed in and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(op) => { if (!busy) onOpenChange(op); if (!op) resetFields(); }}>
      <DialogContent showCloseButton className="gap-4">
        <DialogHeader className="text-left">
          <DialogTitle>Back up your clip encryption key</DialogTitle>
          <DialogDescription>
            Only someone with this passphrase can unlock your uploaded coach clips on a new browser. FitTrack Go never receives the passphrase — we only store an encrypted blob of your key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="clip-passphrase" className="text-xs font-medium text-muted-foreground">
              Passphrase (min 10 characters)
            </label>
            <input
              id="clip-passphrase"
              autoComplete="new-password"
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="clip-passphrase-confirm" className="text-xs font-medium text-muted-foreground">
              Confirm passphrase
            </label>
            <input
              id="clip-passphrase-confirm"
              autoComplete="new-password"
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Saving…" : "Save encrypted backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
