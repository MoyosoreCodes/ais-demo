import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { SimChip } from '../../components/SimChip'
import type { OtpChallenge } from '../../lib/sim'

/**
 * Second-factor / SeyID one-time passcode step (i.8) — SIMULATED.
 *
 * Because no SMS or email is actually sent, the generated code is displayed in
 * the dialog. That is the honest way to demonstrate an OTP flow offline, and
 * the panel says so explicitly.
 */
export function OtpDialog({
  open,
  challenge,
  heading,
  description,
  userName,
  onVerify,
  onResend,
  onCancel,
}: {
  open: boolean
  challenge: OtpChallenge | null
  heading: string
  description?: string
  userName?: string | null
  onVerify: (code: string) => 'ok' | 'expired' | 'mismatch'
  onResend: () => Promise<void>
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (open) {
      setCode('')
      setError(null)
    }
  }, [open, challenge])

  if (!challenge) return null

  const channelLabel =
    challenge.channel === 'sms'
      ? `SMS to ${challenge.sentTo}`
      : challenge.channel === 'email'
        ? `Email to ${challenge.sentTo}`
        : 'Authenticator app (TOTP)'

  const submit = () => {
    const result = onVerify(code)
    if (result === 'mismatch') setError('That passcode does not match. Check the code and try again.')
    else if (result === 'expired') setError('That passcode has expired. Request a new one.')
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    try {
      await onResend()
      setCode('')
    } finally {
      setResending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={heading}
      size="sm"
      description={description}
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="ais-btn-primary" onClick={submit} disabled={code.length < 6}>
            Verify and continue
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-warn-200 bg-warn-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-warn-800">One-time passcode</p>
            <SimChip label="delivery simulated" />
          </div>
          <p className="mt-1 text-xs text-warn-700">
            Nothing is sent to a real handset or mailbox. In production this code would arrive by{' '}
            {channelLabel.toLowerCase()}; here it is shown so the flow can be completed offline.
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em] text-warn-800">
            {challenge.code}
          </p>
        </div>

        {userName && (
          <p className="text-sm text-ink-600">
            Verifying <strong className="text-ink-900">{userName}</strong> · {channelLabel}
          </p>
        )}

        <div>
          <label htmlFor="otp-code" className="ais-label">
            Enter the 6-digit passcode
          </label>
          <input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6) submit()
            }}
            className="ais-input text-center font-mono text-xl tracking-[0.4em]"
            placeholder="000000"
          />
          {error && <p className="ais-error">{error}</p>}
        </div>

        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
        >
          {resending ? 'Sending a new code…' : 'Send a new passcode'}
        </button>
      </div>
    </Modal>
  )
}
