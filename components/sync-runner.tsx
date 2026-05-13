'use client'

import { useEffect } from 'react'
import { flushOfflineWrites } from '@/lib/offline-sync'

/** Background drain for IndexedDB pending writes → Supabase when online. */
export function SyncRunner() {
  useEffect(() => {
    const run = () => {
      void flushOfflineWrites().catch(() => {})
    }
    run()
    const id = typeof window !== 'undefined' ? window.setInterval(run, 20_000) : 0
    const onOnline = () => run()
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      if (id) window.clearInterval(id)
    }
  }, [])
  return null
}
