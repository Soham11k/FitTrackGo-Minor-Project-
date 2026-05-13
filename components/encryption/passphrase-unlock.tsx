"use client"

import { useEffect, useState } from "react"
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
import { restoreClipRawKeyFromPassphrase } from "@/lib/encryption/content-key"
import { fetchUserClipKeyRow } from "@/lib/user-clip-keys-supabase"

export function PassphraseUnlockDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After key is restored to this device. */
  onUnlocked: () => void
}) {
  const { open, onOpenChange, onUnlocked } = props
  const [pass, setPass] = useState("")
  const [busy, setBusy] = useState(false)
  const [missingRemote, setMissingRemote] = useState(false)

  useEffect(() => {
    if (!open) {
      setPass("")
      setMissingRemote(false)
      return
    }
    void (async () => {
      const row = await fetchUserClipKeyRow()
      setMissingRemote(!row)
    })()
  }, [open])

  async function submit() {
    setBusy(true)
    try {
      const row = await fetchUserClipKeyRow()
      if (!row?.wrapped_key || !row.salt) {
        toast.error("No backup found for this account.")
        return
      }
      await restoreClipRawKeyFromPassphrase(pass, row.salt, row.wrapped_key, row.iterations)
      toast.success("Clip key restored on this device.")
      setPass("")
      onOpenChange(false)
      onUnlocked()
    } catch {
      toast.error("Could not unlock — check your passphrase.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(op) => { if (!busy) onOpenChange(op); }}>
      <DialogContent showCloseButton className="gap-4">
        <DialogHeader className="text-left">
          <DialogTitle>Unlock encrypted clips</DialogTitle>
          <DialogDescription>
            This device does not have your clip decryption key. Enter the passphrase you used when you backed up your key.
          </DialogDescription>
        </DialogHeader>
        {missingRemote ? (
          <p className="text-sm text-destructive">
            There is no encrypted key backup linked to your account (or data is still loading). If you skipped backup, encrypted clips cannot be replayed on this browser.
          </p>
        ) : (
          <div>
            <label htmlFor="clip-unlock-pass" className="text-xs font-medium text-muted-foreground">
              Passphrase
            </label>
            <input
              id="clip-unlock-pass"
              autoComplete="off"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || missingRemote} onClick={() => void submit()}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
