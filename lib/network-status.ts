"use client"

import { useState, useEffect, useCallback } from "react"

export type NetworkStatus = "online" | "offline" | "slow"

interface QueuedAction {
  id: string
  action: () => Promise<void>
  retries: number
  timestamp: number
}

class OfflineQueue {
  private queue: QueuedAction[] = []
  private maxRetries = 3
  private listeners: Set<() => void> = new Set()

  add(action: () => Promise<void>, id?: string): string {
    const actionId = id || `action-${Date.now()}-${Math.random()}`
    this.queue.push({
      id: actionId,
      action,
      retries: 0,
      timestamp: Date.now(),
    })
    this.notifyListeners()
    return actionId
  }

  remove(id: string): void {
    this.queue = this.queue.filter((item) => item.id !== id)
    this.notifyListeners()
  }

  getAll(): QueuedAction[] {
    return [...this.queue]
  }

  async processQueue(): Promise<void> {
    const items = [...this.queue]
    for (const item of items) {
      try {
        await item.action()
        this.remove(item.id)
      } catch (error) {
        item.retries++
        if (item.retries >= this.maxRetries) {
          console.error(`Failed to process queued action ${item.id} after ${this.maxRetries} retries:`, error)
          this.remove(item.id)
        }
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  clear(): void {
    this.queue = []
    this.notifyListeners()
  }
}

export const offlineQueue = new OfflineQueue()

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>("online")
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([])

  useEffect(() => {
    // Initial check
    setStatus(navigator.onLine ? "online" : "offline")

    const handleOnline = () => {
      setStatus("online")
      // Process queued actions when back online
      offlineQueue.processQueue().catch(console.error)
    }

    const handleOffline = () => {
      setStatus("offline")
    }

    // Listen for network changes
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Subscribe to queue changes
    const unsubscribe = offlineQueue.subscribe(() => {
      setQueuedActions(offlineQueue.getAll())
    })

    // Check connection quality periodically (simple check)
    let qualityCheckInterval: ReturnType<typeof setInterval> | null = null
    const checkConnectionQuality = () => {
      if (!navigator.onLine) {
        setStatus("offline")
      } else {
        // Simple check: if we're online, assume good connection
        // In the future, could ping a lightweight endpoint
        setStatus("online")
      }
    }

    // Check every 30 seconds
    qualityCheckInterval = setInterval(checkConnectionQuality, 30000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      unsubscribe()
      if (qualityCheckInterval) clearInterval(qualityCheckInterval)
    }
  }, [])

  const queueAction = useCallback((action: () => Promise<void>, id?: string) => {
    return offlineQueue.add(action, id)
  }, [])

  const removeQueuedAction = useCallback((id: string) => {
    offlineQueue.remove(id)
  }, [])

  const clearQueue = useCallback(() => {
    offlineQueue.clear()
  }, [])

  return {
    status,
    isOnline: status === "online",
    isOffline: status === "offline",
    isSlow: status === "slow",
    queuedActions,
    queueAction,
    removeQueuedAction,
    clearQueue,
  }
}

export function isNetworkError(error: any): boolean {
  if (!error) return false
  
  // Check for network-related error messages
  const networkErrorPatterns = [
    /network/i,
    /fetch/i,
    /connection/i,
    /timeout/i,
    /failed to fetch/i,
    /networkerror/i,
    /network request failed/i,
    /ERR_INTERNET_DISCONNECTED/i,
    /ERR_NETWORK_CHANGED/i,
    /ERR_CONNECTION_REFUSED/i,
    /ERR_CONNECTION_RESET/i,
  ]

  const errorMessage = error?.message || error?.toString() || ""
  if (networkErrorPatterns.some((pattern) => pattern.test(errorMessage))) {
    return true
  }

  // Check if it's a fetch error without a response
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true
  }

  // Check Supabase errors
  if (error?.code === "PGRST301" || error?.message?.includes("JWT")) {
    // These are auth errors, not network errors
    return false
  }

  return false
}
