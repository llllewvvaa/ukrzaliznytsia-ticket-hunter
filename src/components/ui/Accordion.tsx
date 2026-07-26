import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { collapse } from '@/lib/ui/anim';
import { ExpandIcon } from '../icons';

export function Accordion({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    collapse(el, open, !mounted.current); // first mount: apply state without animating
    mounted.current = true;
  }, [open]);

  const handleToggle = (): void => setOpen((o) => !o);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors ${
          open ? '' : 'hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {title}
          {count != null ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {count}
            </span>
          ) : null}
        </span>
        <ExpandIcon
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div ref={bodyRef} style={{ overflow: 'hidden' }}>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
