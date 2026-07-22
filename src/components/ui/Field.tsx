import { useId } from 'react';
import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const labelId = useId();
  // Grouping (not <label>) on purpose: children are often composite controls
  // (steppers, triggers, chip lists), and a real <label> click would activate
  // the first one. role="group" still gives screen readers the field context.
  return (
    <div className="space-y-1.5" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="block text-xs font-semibold tracking-wide text-gray-700">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs leading-snug text-gray-400">{hint}</span> : null}
    </div>
  );
}
