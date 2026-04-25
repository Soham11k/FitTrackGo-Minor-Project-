"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { ProviderId } from "@/lib/wearables/providers/types"

interface Connection {
  provider: ProviderId
  last_sync_at: string | null
  scopes: string
}

const PROVIDER_META: Record<ProviderId, { label: string; subtitle: string; icon: string }> = {
  fitbit: { label: "Fitbit", subtitle: "Steps, heart rate, SpO₂, sleep", icon: "⌚" },
  google_fit: { label: "Google Fit", subtitle: "Android / Wear OS metrics", icon: "🟢" },
  apple_health: { label: "Apple Health", subtitle: "iOS import or Capacitor plugin", icon: "🍎" },
  garmin: { label: "Garmin", subtitle: "Connect account (beta)", icon: "🟦" },
}

export function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data } = await supabase
        .from("wearable_connections")
        .select("provider, last_sync_at, scopes")
        .eq("user_id", user.id)
      if (!cancelled) {
        setConnections((data ?? []) as Connection[])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.provider)),
    [connections]
  )

  const handleConnect = (id: ProviderId) => {
    window.location.assign(`/api/wearables/${id}/auth`)
  }

  const handleDisconnect = async (id: ProviderId) => {
    const res = await fetch(`/api/wearables/${id}/disconnect`, { method: "POST" })
    if (!res.ok) {
      toast.error("Couldn't disconnect. Try again.")
      return
    }
    setConnections((prev) => prev.filter((c) => c.provider !== id))
    toast.success(`${PROVIDER_META[id].label} disconnected`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex items-center gap-4 p-4 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect a wearable to see live heart rate, sleep, and SpO₂ inside FitTrackGo.
        </p>
      </div>

      <div className="grid gap-3">
        {(Object.keys(PROVIDER_META) as ProviderId[]).map((id) => {
          const meta = PROVIDER_META[id]
          const conn = connections.find((c) => c.provider === id)
          const isConnected = connectedIds.has(id)
          return (
            <Card key={id} className="flex items-center gap-4 p-4 shadow-[var(--shadow-card)] transition-all active:scale-[0.99]">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl leading-none"
                aria-hidden
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{meta.label}</h3>
                  {isConnected ? (
                    <Badge variant="secondary" className="bg-metric-move/15 text-metric-move text-[10px] font-bold uppercase tracking-[0.12em]">
                      Connected
                    </Badge>
                  ) : null}
                </div>
                {conn?.last_sync_at ? (
                  <p className="mt-0.5 text-xs font-semibold text-foreground">
                    Last synced <span className="tabular-nums">{new Date(conn.last_sync_at).toLocaleString()}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.subtitle}</p>
                )}
                {conn?.last_sync_at ? (
                  <p className="text-[11px] text-muted-foreground">{meta.subtitle}</p>
                ) : null}
              </div>
              {isConnected ? (
                <Button variant="outline" size="sm" onClick={() => handleDisconnect(id)} className="active:scale-[0.97]">
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleConnect(id)} className="active:scale-[0.97]">
                  Connect
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Fitbit is the primary live source while the other adapters roll out. Daily aggregates land
        in your dashboard within minutes of each sync.
      </p>
    </div>
  )
}
