import { listPendingWrites, removePendingWrite } from '@/lib/offline-queue'
import { commitCoachInsert, commitRunInsert, commitWorkoutInsert } from '@/lib/store-supabase'

/**
 * Replay IndexedDB mutations when back online (complements volatile in-memory `offlineQueue`).
 */
export async function flushOfflineWrites(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  let items: Awaited<ReturnType<typeof listPendingWrites>>
  try {
    items = await listPendingWrites()
  } catch {
    return
  }
  items.sort((a, b) => a.createdAt - b.createdAt)
  for (const w of items) {
    try {
      if (w.kind === 'run') await commitRunInsert(w.payload)
      else if (w.kind === 'workout') await commitWorkoutInsert(w.payload)
      else await commitCoachInsert(w.payload)
      await removePendingWrite(w.id)
    } catch {
      /* transient network / backoff until next SyncRunner tick */
    }
  }
}
