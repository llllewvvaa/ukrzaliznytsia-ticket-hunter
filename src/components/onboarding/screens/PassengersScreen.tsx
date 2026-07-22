import { ModeCard, PassengerRow } from './parts';

export function PassengersScreen() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">Режим</p>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard active title="Моніторинг" desc="Стежити 24/7" />
          <ModeCard active={false} title="Запланований" desc="До відкриття продажу" />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">Пасажири</p>
        <div className="space-y-2">
          <PassengerRow checked name="Іван Тестенко" tag="Дорослий" />
          <PassengerRow checked name="Олена Тестенко" tag="Дорослий" />
          <PassengerRow checked={false} name="Петро Тестенко" tag="Дитячий" />
        </div>
        <p className="mt-2 text-xs font-medium text-green-600">Обрано 2 — вистачає на 2 місця</p>
      </div>
    </div>
  );
}
