/**
 * Device connectivity simulation (x.3 ★).
 *
 * A field officer's tablet loses signal in the valleys. The prototype models
 * that with an explicit Online/Offline switch rather than pretending to detect
 * it: while offline, submissions are queued in the store's `outbox` and the
 * pending count is surfaced in the navigation; going back online replays the
 * queue and stamps each record with the time it actually synchronised.
 *
 * The flag is device state, not application data, so it lives here and in
 * localStorage rather than in the seeded database.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDb, useDispatch } from './DataContext'
import { simulateSync } from '../lib/sim'
import type { AuditDraft } from '../lib/store'

const STORAGE_KEY = 'ais-demo:device-online'

interface OfflineContextValue {
  online: boolean
  setOnline: (on: boolean) => void
  /** Submissions waiting in the device queue. */
  pending: number
  /** True while the queue is being replayed. */
  syncing: boolean
  /** Replays the queue; resolves with the number of records synchronised. */
  sync: (audit?: AuditDraft) => Promise<number>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const dispatch = useDispatch()
  const [online, setOnlineState] = useState(() => localStorage.getItem(STORAGE_KEY) !== '0')
  const [syncing, setSyncing] = useState(false)

  const pending = db.outbox.length

  const sync = useCallback(
    async (audit?: AuditDraft) => {
      const count = db.outbox.length
      if (count === 0) return 0
      setSyncing(true)
      try {
        await simulateSync()
        dispatch({ type: 'outbox/flush', syncedOn: new Date().toISOString(), audit })
        return count
      } finally {
        setSyncing(false)
      }
    },
    [db.outbox.length, dispatch],
  )

  const setOnline = useCallback((on: boolean) => {
    setOnlineState(on)
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  }, [])

  const value = useMemo(
    () => ({ online, setOnline, pending, syncing, sync }),
    [online, setOnline, pending, syncing, sync],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used inside <OfflineProvider>')
  return ctx
}
