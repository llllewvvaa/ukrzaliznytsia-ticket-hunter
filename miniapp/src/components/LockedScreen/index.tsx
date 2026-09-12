export function LockedScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
        УЗ
      </span>
      <p className="text-sm font-semibold text-gray-900">Доступ закритий</p>
      <p className="text-xs leading-relaxed text-gray-500">
        Цей сторож працює лише для власника. Відкрий його кнопкою меню в своєму Telegram-боті.
      </p>
    </div>
  );
}
