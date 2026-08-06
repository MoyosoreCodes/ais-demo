import type { Toast } from '../app/ToastContext'
import { SimChip } from './SimChip'

const TONES: Record<Toast['tone'], { wrap: string; dot: string }> = {
  success: { wrap: 'border-brand-200 bg-white', dot: 'bg-brand-600' },
  info: { wrap: 'border-ink-200 bg-white', dot: 'bg-ink-500' },
  warning: { wrap: 'border-warn-200 bg-white', dot: 'bg-warn-500' },
  error: { wrap: 'border-danger-200 bg-white', dot: 'bg-danger-500' },
}

export function NotificationToast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = TONES[toast.tone]
  return (
    <div
      role="status"
      className={`pointer-events-auto w-full max-w-sm rounded-lg border ${tone.wrap} p-3 shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
            {toast.simulated && <SimChip />}
          </div>
          {toast.body && <p className="mt-1 text-sm text-ink-600">{toast.body}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Dismiss notification"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
