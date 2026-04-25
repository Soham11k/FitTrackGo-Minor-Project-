"use client"

import { useState, useEffect, useCallback } from "react"

export type NetworkStatus = "online" | "offline" | "slow"

interface QueuedAction {
  id: string
  action: () => Promise<void>
  retries: number
  timestamp: number
  /** Earliest time (ms since epoch) this item may be retried. */
  nextAttemptAt: number
}

class OfflineQueue {
  private queue: QueuedAction[] = []
  private maxRetries = 5
  /** Base delay for exponential backoff (ms). Doubles per retry, capped at 5 min. */
  private baseBackoffMs = 1000
  private maxBackoffMs = 5 * 60 * 1000
  private listeners: Set<() => void> = new Set()
  private processing = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  add(action: () => Promise<void>, id?: string): string {
    const actionId = id || `action-${Date.now()}-${Math.random()}`
    const now = Date.now()
    this.queue.push({
      id: actionId,
      action,
      retries: 0,
      timestamp: now,
      nextAttemptAt: now,
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

  private scheduleRetry(): void {
    if (this.retryTimer || this.queue.length === 0) return
    const now = Date.now()
    const next = this.queue.reduce((min, q) => Math.min(min, q.nextAttemptAt), Infinity)
    const wait = Math.max(0, next - now)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.processQueue()
    }, wait)
  }

  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true
    try {
      const now = Date.now()
      const items = this.queue.filter((q) => q.nextAttemptAt <= now)
      for (const item of items) {
        try {
          await item.action()
          this.remove(item.id)
        } catch (error) {
          item.retries++
          if (item.retries >= this.maxRetries) {
            console.error(
              `[offlineQueue] dropping ${item.id} after ${this.maxRetries} retries:`,
              error
            )
            this.remove(item.id)
            continue
          }
          const backoff = Math.min(
            this.maxBackoffMs,
            this.baseBackoffMs * 2 ** (item.retries - 1)
          )
          const jitter = Math.floor(Math.random() * 250)
          item.nextAttemptAt = Date.now() + backoff + jitter
        }
      }
    } finally {
      this.processing = false
      this.scheduleRetry()
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

export function isNetworkError(error: unknown): boolean {
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

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error)
  if (networkErrorPatterns.some((pattern) => pattern.test(errorMessage))) {
    return true
  }

  // Check if it's a fetch error without a response
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true
  }

  // Check Supabase errors
  const maybeError = error as { code?: string; message?: string } | null
  if (maybeError?.code === "PGRST301" || maybeError?.message?.includes("JWT")) {
    // These are auth errors, not network errors
    return false
  }

  return false
}
