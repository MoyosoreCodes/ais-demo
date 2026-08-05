// Split-screen wrapper for the public S01 portal (sign-in + self-registration).
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary-700 p-10 text-primary-50 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 text-xl">
            🌾
          </span>
          <div>
            <div className="font-semibold text-white">Agriculture Information System</div>
            <div className="text-xs text-primary-100">Republic of Seychelles</div>
          </div>
        </div>
        <div>
          <span className="mb-4 inline-block rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Prototype · Demonstration build
          </span>
          <h2 className="text-2xl font-bold leading-snug text-white">
            One farmer identity, entered once, reused everywhere.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-primary-100">
            Register a farmer, their farm, loans, samples, livestock and inspections — all linked to
            a single client record and visible on one national dashboard.
          </p>
        </div>
        <p className="text-xs text-primary-200">
          Fictional demonstration data. Invented names, 999- NINs, simulated integrations.
        </p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-600 text-lg text-white">
              🌾
            </span>
            <span className="font-semibold text-slate-800">AIS · Seychelles</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
