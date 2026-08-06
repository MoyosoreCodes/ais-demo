/**
 * ReqBadge mode (CLAUDE.md §7.5).
 *
 * `?refs=1` turns on small requirement badges beside the UI elements that
 * evidence each Appendix A6 row. Every `<ReqBadge>` that renders also registers
 * itself here, so the coverage view can prove which of the 91 rows are
 * annotated somewhere in the built app.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface RefsContextValue {
  enabled: boolean
  setEnabled: (on: boolean) => void
  /** Refs seen since the app loaded, in insertion order. */
  seen: string[]
  register: (refs: string[], screen?: string) => void
  screensFor: (ref: string) => string[]
}

const RefsContext = createContext<RefsContextValue | null>(null)

const STORAGE_KEY = 'ais-demo:refs-mode'

/**
 * Reads `refs` from the real query string *or* from a query appended inside the
 * hash route, so both `?refs=1#/signin` and `#/signin?refs=1` switch badge mode
 * on — the annex capture instructions say `?refs=1` without pinning where.
 */
const readRefsParam = (): string | null => {
  const fromSearch = new URLSearchParams(window.location.search).get('refs')
  if (fromSearch !== null) return fromSearch
  const hash = window.location.hash
  const q = hash.indexOf('?')
  return q === -1 ? null : new URLSearchParams(hash.slice(q + 1)).get('refs')
}

const initialEnabled = (): boolean => {
  const param = readRefsParam()
  if (param === '1' || param === 'true') return true
  if (param === '0' || param === 'false') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function RefsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(initialEnabled)
  const [seen, setSeen] = useState<string[]>([])
  const screenMap = useRef(new Map<string, Set<string>>())

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on)
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
    // Keep the canonical `?refs=1` on the URL so a screenshot's address bar
    // shows how badge mode was switched on.
    const url = new URL(window.location.href)
    if (on) url.searchParams.set('refs', '1')
    else url.searchParams.delete('refs')
    window.history.replaceState({}, '', url)
  }, [])

  /**
   * Called from every `<ReqBadge>` effect. React 18 batches the state updates
   * from a single commit, so a screen mounting several dozen badges still
   * produces one re-render — no manual frame batching needed (and none that
   * could stall in a headless renderer during screenshot capture).
   */
  const register = useCallback((refs: string[], screen?: string) => {
    for (const r of refs) {
      if (!screen) continue
      const set = screenMap.current.get(r) ?? new Set<string>()
      set.add(screen)
      screenMap.current.set(r, set)
    }
    setSeen((prev) => {
      const fresh = refs.filter((r) => r && !prev.includes(r))
      return fresh.length ? [...prev, ...new Set(fresh)] : prev
    })
  }, [])

  const screensFor = useCallback((ref: string) => [...(screenMap.current.get(ref) ?? [])], [])

  const value = useMemo(
    () => ({ enabled, setEnabled, seen, register, screensFor }),
    [enabled, setEnabled, seen, register, screensFor],
  )
  return <RefsContext.Provider value={value}>{children}</RefsContext.Provider>
}

export function useRefsMode(): RefsContextValue {
  const ctx = useContext(RefsContext)
  if (!ctx) throw new Error('useRefsMode must be used inside <RefsProvider>')
  return ctx
}
