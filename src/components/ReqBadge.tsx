// Requirement badge overlay (?refs=1). Renders the Appendix A6 ref codes beside
// the UI elements that evidence them, for the bid-annex screenshots.
import { useRefs } from '../app/RefsContext';
import { REFS } from '../lib/refs';
import { cx } from './ui';

export function ReqBadge({ id, className }: { id: string | string[]; className?: string }) {
  const { enabled } = useRefs();
  if (!enabled) return null;
  const ids = Array.isArray(id) ? id : [id];
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-1 align-middle', className)}>
      {ids.map((ref) => {
        const def = REFS[ref];
        return (
          <span
            key={ref}
            title={def?.text ?? ref}
            className={cx(
              'rounded px-1 py-0.5 font-mono text-[10px] font-semibold leading-none ring-1',
              def?.exceeds
                ? 'bg-amber-100 text-amber-700 ring-amber-300'
                : 'bg-primary-100 text-primary-700 ring-primary-200',
            )}
          >
            {ref}
            {def?.exceeds ? '★' : ''}
          </span>
        );
      })}
    </span>
  );
}
