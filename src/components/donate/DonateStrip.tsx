import { ExternalIcon, HeartIcon } from '@/components/icons';
import { DONATE_URL } from './constants';

// Compact strip inside a reserved job card — the gratitude moment right after a catch.
export function DonateStrip() {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noreferrer"
      className="donate-beat-parent mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-200 transition-colors hover:bg-amber-100/70 hover:ring-amber-300"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-900">
        <HeartIcon className="donate-beat h-3.5 w-3.5 text-amber-500" />
        Зловив квиток? Скажи «дякую»
      </span>
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700">
        монобанка
        <ExternalIcon className="h-3 w-3" />
      </span>
    </a>
  );
}
