"use client"

import { useNetworkStatus } from "@/lib/network-status"
import { Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useEffect } from "react"
import { useLocale } from "@/components/locale-provider"

export function NetworkStatusIndicator() {
  const { t } = useLocale()
  const { status, isOffline, isSlow, queuedActions } = useNetworkStatus()

  useEffect(() => {
    if (isOffline) {
      toast.error(t("network.offlineToast"), {
        duration: 5000,
      })
    } else if (isSlow) {
      toast.warning(t("network.slowToast"), {
        duration: 3000,
      })
    }
  }, [isOffline, isSlow, t])

  if (status === "online" && queuedActions.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 pointer-events-none">
      <div className="flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-sm border border-border px-4 py-2 shadow-lg pointer-events-auto">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4 text-destructive" />
              <span className="text-xs font-medium text-foreground">
                {t("network.offlineLabel")}
              </span>
              {queuedActions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({queuedActions.length} {t("network.pending")})
                </span>
              )}
            </>
          ) : isSlow ? (
            <>
              <AlertCircle className="h-4 w-4 text-chart-4" />
              <span className="text-xs font-medium text-foreground">
                {t("network.slowLabel")}
              </span>
            </>
          ) : queuedActions.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 text-primary animate-spin" />
              <span className="text-xs font-medium text-foreground">
                {t("network.syncing")} {queuedActions.length}
              </span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                {t("network.online")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
