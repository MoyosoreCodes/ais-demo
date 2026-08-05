// Single source of truth for demo state: React context + reducer, persisted to
// localStorage. `reset()` reseeds from the /src/data JSON via freshDb().
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import { freshDb } from './seed';
import type { CollectionKey, Database } from './types';

const KEY = 'ais-demo-db-v1';

interface HasId {
  id: string;
}

type Action =
  | { type: 'RESET' }
  | { type: 'REPLACE'; db: Database }
  | { type: 'UPSERT'; collection: CollectionKey; item: HasId }
  | { type: 'PATCH'; collection: CollectionKey; id: string; patch: Record<string, unknown> }
  | { type: 'REMOVE'; collection: CollectionKey; id: string };

function reducer(db: Database, action: Action): Database {
  switch (action.type) {
    case 'RESET':
      return freshDb();
    case 'REPLACE':
      return action.db;
    case 'UPSERT': {
      const list = db[action.collection] as unknown as HasId[];
      const exists = list.some((x) => x.id === action.item.id);
      const next = exists
        ? list.map((x) => (x.id === action.item.id ? action.item : x))
        : [...list, action.item];
      return { ...db, [action.collection]: next } as Database;
    }
    case 'PATCH': {
      const list = db[action.collection] as unknown as HasId[];
      const next = list.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x));
      return { ...db, [action.collection]: next } as Database;
    }
    case 'REMOVE': {
      const list = db[action.collection] as unknown as HasId[];
      return { ...db, [action.collection]: list.filter((x) => x.id !== action.id) } as Database;
    }
    default:
      return db;
  }
}

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Database;
  } catch {
    // ignore corrupt storage; fall back to seed
  }
  return freshDb();
}

export interface StoreApi {
  db: Database;
  upsert: <K extends CollectionKey>(collection: K, item: Database[K][number]) => void;
  patch: <K extends CollectionKey>(
    collection: K,
    id: string,
    patch: Partial<Database[K][number]>,
  ) => void;
  remove: (collection: CollectionKey, id: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // storage may be full/unavailable in the demo environment; non-fatal
    }
  }, [db]);

  const upsert = useCallback<StoreApi['upsert']>((collection, item) => {
    dispatch({ type: 'UPSERT', collection, item: item as unknown as HasId });
  }, []);

  const patch = useCallback<StoreApi['patch']>((collection, id, p) => {
    dispatch({ type: 'PATCH', collection, id, patch: p as unknown as Record<string, unknown> });
  }, []);

  const remove = useCallback<StoreApi['remove']>((collection, id) => {
    dispatch({ type: 'REMOVE', collection, id });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const api = useMemo<StoreApi>(
    () => ({ db, upsert, patch, remove, reset }),
    [db, upsert, patch, remove, reset],
  );

  return createElement(StoreContext.Provider, { value: api }, children);
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
