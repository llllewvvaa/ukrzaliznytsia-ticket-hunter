import { ExternalIcon, HeartIcon } from '@/components/icons';
export const DONATE_URL = 'https://send.monobank.ua/jar/8daDL7FGDe';



// monobank-style cat head — react-icons has nothing close, so a tiny custom glyph.
export function MonoCatIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21c-4.4 0-8-3.2-8-7.2V6.4c0-.5.55-.76.9-.45l3.4 2.6A9.6 9.6 0 0 1 12 7.2c1.4 0 2.7.3 3.7 1.35l3.4-2.6c.35-.31.9-.05.9.45v7.4c0 4-3.6 7.2-8 7.2z" />
    </svg>
  );
}

// Persistent header pill, always visible next to the session badge.
export function DonateButton() {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noreferrer"
      title="Подякувати розробнику — monobank банка"
      className="donate-halo donate-beat-parent inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
    >
      <MonoCatIcon className="donate-beat h-3.5 w-3.5" />
      <span>банка</span>
      <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[9px] font-black text-amber-950">
        ₴
      </span>
    </a>
  );
}

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

