// Stand-in for screens scheduled in a later wave. Still shows the exact
// Appendix A6 rows the screen will evidence, so the plan stays visible.
import type { ScreenMeta } from '../lib/rbac';
import { MODULES, REFS } from '../lib/refs';
import { Icon, type IconName } from './Icon';
import { Card, PageHeader } from './ui';

export function Placeholder({ screen, wave }: { screen: ScreenMeta; wave: string }) {
  const rows = Object.entries(REFS).filter(([, d]) => d.module === screen.module);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={screen.label}
        code={screen.code}
        icon={screen.key as IconName}
        subtitle={screen.desc}
      />
      <Card className="p-5">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
          <Icon name="reset" size={16} /> Scheduled for <strong>{wave}</strong> —{' '}
          {MODULES[screen.module]}
        </div>
        <p className="text-sm text-slate-500">Requirements this screen will demonstrate:</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {rows.map(([ref, d]) => (
            <li key={ref} className="flex items-start gap-2">
              <span
                className={
                  'mt-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold ' +
                  (d.exceeds ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700')
                }
              >
                {ref}
                {d.exceeds ? '★' : ''}
              </span>
              <span className="text-slate-600">{d.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
