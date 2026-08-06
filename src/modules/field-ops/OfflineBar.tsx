import { useOffline } from '../../app/OfflineContext'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'

/**
 * The device connectivity control (x.3 ★).
 *
 * Shown on every field-operations screen so an evaluator can flip the device
 * offline, capture an inspection, watch the queue grow, and then reconnect and
 * watch it drain — the whole claim, in one control.
 */
export function OfflineBar() {
  const { online, setOnline, pending, syncing, sync } = useOffline()
  const { user } = useAuth()
  const { toast } = useToast()

  const runSync = async () => {
    const count = await sync(
      user
        ? {
            actorUserId: user.id,
            actorName: user.fullName,
            actorRole: user.role,
            action: 'inspection.synced',
            entityType: 'inspection',
            entityId: `${pending} queued`,
            detail: `${pending} offline capture${pending === 1 ? '' : 's'} synchronised from device (simulated)`,
          }
        : undefined,
    )
    if (count > 0) {
      toast({
        tone: 'success',
        title: `${count} submission${count === 1 ? '' : 's'} synchronised`,
        body: 'Each record is stamped with the time it reached the server.',
        simulated: true,
      })
    }
  }

  return (
    <div
      className={`mb-4 rounded-lg border p-3 ${
        online
          ? pending > 0
            ? 'border-warn-300 bg-warn-50'
            : 'border-ink-200 bg-white'
          : 'border-warn-400 bg-warn-50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* ---------------------------------------------- connectivity */}
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              online ? 'bg-brand-100 text-brand-700' : 'bg-warn-200 text-warn-800'
            }`}
            aria-hidden
          >
            {online ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8.5a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0" strokeLinecap="round" />
                <circle cx="12" cy="19" r="1" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8.5a15 15 0 015.5-3.6M16.5 5A15 15 0 0122 8.5M8.5 15.5a5 5 0 017 0" strokeLinecap="round" />
                <path d="M3 3l18 18" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div>
            <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
              {online ? 'Device online' : 'Device offline'}
              <SimChip label="connectivity simulated" />
              <ReqBadge refs="x.3" screen="S10" />
            </p>
            <p className="text-xs text-ink-600">
              {online
                ? 'Captures are saved to the central register immediately.'
                : 'Captures are held on the device and sent when the signal returns.'}
            </p>
          </div>
        </div>

        {/* -------------------------------------------------- the queue */}
        {pending > 0 && (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-warn-400 bg-white px-3 py-1.5 text-sm font-semibold text-warn-800"
            role="status"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warn-500 text-[11px] font-bold text-white">
              {pending}
            </span>
            pending sync
          </span>
        )}

        {/* ------------------------------------------------- the switch */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {online && pending > 0 && (
            <button type="button" className="ais-btn-primary" onClick={() => void runSync()} disabled={syncing}>
              {syncing ? 'Synchronising…' : `Sync ${pending} now`}
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={online}
            onClick={() => {
              const next = !online
              setOnline(next)
              if (!next) {
                toast({
                  tone: 'warning',
                  title: 'Device offline',
                  body: 'Captures will be queued until the signal returns.',
                  simulated: true,
                })
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
          >
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${online ? 'bg-brand-600' : 'bg-ink-300'}`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${online ? 'left-4.5' : 'left-0.5'}`}
                style={{ left: online ? '1.125rem' : '0.125rem' }}
              />
            </span>
            {online ? 'Go offline' : 'Go online'}
          </button>
        </div>
      </div>

      {!online && pending > 0 && (
        <p className="mt-3 border-t border-warn-300 pt-3 text-sm text-warn-800">
          {pending} completed inspection{pending === 1 ? '' : 's'} waiting on the device. Switch back
          online and press <strong>Sync</strong> to send them; each record is stamped with the time it
          actually reached the server, not the time it was captured.
        </p>
      )}
    </div>
  )
}
