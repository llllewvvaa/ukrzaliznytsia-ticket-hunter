import { DONATE_URL } from './constants';
import { MonoCatIcon } from './MonoCatIcon';

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
