import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  badge?: ReactNode
}

export function TextField({
  label,
  hint,
  error,
  required,
  badge,
  ...rest
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="ais-label">
        <span className="inline-flex flex-wrap items-center gap-2">
          {label}
          {required && <span className="text-danger-600" aria-hidden>*</span>}
          {badge}
        </span>
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`ais-input ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} className="ais-error">{error}</p>
      ) : hint ? (
        <div id={`${id}-hint`} className="ais-hint">{hint}</div>
      ) : null}
    </div>
  )
}

export function SelectField({
  label,
  hint,
  error,
  required,
  badge,
  children,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="ais-label">
        <span className="inline-flex flex-wrap items-center gap-2">
          {label}
          {required && <span className="text-danger-600" aria-hidden>*</span>}
          {badge}
        </span>
      </label>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`ais-input ${error ? 'border-danger-500' : ''}`}
        {...rest}
      >
        {children}
      </select>
      {error ? <p className="ais-error">{error}</p> : hint ? <div className="ais-hint">{hint}</div> : null}
    </div>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  badge,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="ais-label">
        <span className="inline-flex flex-wrap items-center gap-2">
          {label}
          {required && <span className="text-danger-600" aria-hidden>*</span>}
          {badge}
        </span>
      </label>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`ais-input ${error ? 'border-danger-500' : ''}`}
        {...rest}
      />
      {error ? <p className="ais-error">{error}</p> : hint ? <div className="ais-hint">{hint}</div> : null}
    </div>
  )
}

export function CheckboxField({
  label,
  hint,
  ...rest
}: { label: ReactNode; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
        {...rest}
      />
      <label htmlFor={id} className="text-sm text-ink-800">
        {label}
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </label>
    </div>
  )
}

/** A read-only key/value pair — the workhorse of every profile panel. */
export function ReadOnlyField({
  label,
  value,
  badge,
  className = '',
}: {
  label: string
  value: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {label}
          {badge}
        </span>
      </dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value || <span className="text-ink-400">—</span>}</dd>
    </div>
  )
}
