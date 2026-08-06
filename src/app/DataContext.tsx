import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { loadDatabase, persistDatabase, reducer } from '../lib/store'
import type { Action } from '../lib/store'
import type { AisDatabase } from '../lib/types'

interface DataContextValue {
  db: AisDatabase
  dispatch: Dispatch<Action>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, undefined, loadDatabase)

  useEffect(() => {
    persistDatabase(db)
  }, [db])

  const value = useMemo(() => ({ db, dispatch }), [db])
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useDb must be used inside <DataProvider>')
  return ctx
}

export const useDb = (): AisDatabase => useDataContext().db
export const useDispatch = (): Dispatch<Action> => useDataContext().dispatch
