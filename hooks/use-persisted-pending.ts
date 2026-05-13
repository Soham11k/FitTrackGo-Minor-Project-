'use client'

import { useCallback, useEffect, useState } from 'react'
import { listPendingWrites } from '@/lib/offline-queue'

/** IndexedDB-backed pending mutations (shown alongside in-memory retries). */
export function usePersistedPendingCount() {
  const [n, setN] = useState(0)
  const refresh = useCallback(() => {
    void listPendingWrites()
      .then((w) => setN(w.length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const id = typeof window !== 'undefined' ? window.setInterval(refresh, 6000) : 0
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      if (id) window.clearInterval(id)
    }
  }, [refresh])

  return { count: n, refresh }
}
