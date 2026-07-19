import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dialogIn, dialogOut } from '@/lib/anim';
import { useModalA11y } from '@/lib/a11y';
import { WarnIcon } from './icons';
import { Button } from './ui';

export type ConfirmTone = 'danger' | 'default';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;
    if (open) dialogIn(backdrop, card);
    else if (mounted) dialogOut(backdrop, card, () => setMounted(false));
  }, [open, mounted]);

  // Escape, focus trap and focus return live in the shared hook. Enter is NOT
  // bound globally on purpose: focus is trapped on the dialog buttons, so
  // Enter clicks whichever button is focused — a window-level Enter handler
  // used to fire onConfirm on top of the focused Cancel button's click.
  useModalA11y(cardRef, open && mounted, onCancel);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/40 p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[320px] rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <WarnIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <h3 className="text-[15px] font-semibold leading-tight text-gray-900">{title}</h3>
            {message ? (
              <p className="break-words text-sm leading-snug text-gray-500">{message}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
