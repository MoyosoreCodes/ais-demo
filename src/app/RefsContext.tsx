// ReqBadge mode. `?refs=1` (or the footer toggle) overlays requirement badges
// (e.g. iii.2) beside the UI elements that evidence each Appendix A6 row.
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface RefsApi {
  enabled: boolean;
  toggle: () => void;
}

const RefsContext = createContext<RefsApi>({ enabled: false, toggle: () => {} });

export function RefsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(
    () => new URLSearchParams(window.location.search).get('refs') === '1',
  );
  const toggle = useCallback(() => setEnabled((e) => !e), []);
  return <RefsContext.Provider value={{ enabled, toggle }}>{children}</RefsContext.Provider>;
}

export const useRefs = (): RefsApi => useContext(RefsContext);
