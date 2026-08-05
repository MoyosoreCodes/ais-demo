// Lightweight toast host. Used to surface simulated SMS/email sends and saves.
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

import { Icon } from './Icon';
import { cx } from './ui';

type Tone = 'info' | 'success' | 'sms' | 'email';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  push: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++seq;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'flex items-start gap-2 rounded-md px-3 py-2 text-sm text-white shadow-lg',
              t.tone === 'success'
                ? 'bg-primary-600'
                : t.tone === 'sms'
                  ? 'bg-violet-600'
                  : t.tone === 'email'
                    ? 'bg-blue-600'
                    : 'bg-slate-800',
            )}
          >
            <Icon
              name={t.tone === 'sms' || t.tone === 'email' ? 'notifications' : 'check'}
              size={16}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastApi => useContext(ToastContext);
