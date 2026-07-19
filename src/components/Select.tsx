import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { FloatingPanel } from './FloatingPanel';
import { ExpandIcon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const indexOfValue = (): number => {
    const i = options.findIndex((o) => o.value === value);
    return i < 0 ? 0 : i;
  };

  const openMenu = (): void => {
    setActiveIdx(indexOfValue());
    setOpen(true);
  };

  const choose = (v: string): void => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIdx((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActiveIdx((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (!open) {
          openMenu();
          break;
        }
        const opt = options[activeIdx];
        if (opt) choose(opt.value);
        break;
      }
      case 'Escape':
        setOpen(false);
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActiveIdx(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIdx(options.length - 1);
        }
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIdx}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      >
        <span className={selected ? '' : 'text-gray-400'}>{selected?.label ?? '—'}</span>
        <ExpandIcon
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <FloatingPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} matchWidth>
        <ul
          role="listbox"
          id={listId}
          aria-label={ariaLabel}
          className="max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              id={`${listId}-${i}`}
              aria-selected={o.value === value}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => choose(o.value)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                o.value === value ? 'font-semibold text-blue-700' : 'text-gray-800'
              } ${i === activeIdx ? 'bg-blue-50' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </>
  );
}
