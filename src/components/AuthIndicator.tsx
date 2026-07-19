import { browser } from 'wxt/browser';
import { useAuthStatus } from '@/lib/use-store';
import { BOOKING_URL } from '@/lib/job-format';

export function AuthIndicator() {
  const authed = useAuthStatus();

  const openBooking = (): void => {
    void browser.tabs.create({ url: BOOKING_URL, active: true });
  };

  if (authed === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Перевірка…
      </span>
    );
  }

  if (authed) {
    return (
      <span
        title="Сесію booking.uz знайдено — можна шукати квитки"
        className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
      >
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Сесія активна
        <span className="sr-only">Сесію booking.uz знайдено — можна шукати квитки</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={openBooking}
      title="Відкрити booking.uz, щоб увійти в акаунт"
      aria-label="Відкрити booking.uz, щоб увійти в акаунт"
      className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
    >
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Увійти на booking.uz
    </button>
  );
}
