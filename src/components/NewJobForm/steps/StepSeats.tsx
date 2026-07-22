import { Button, Field, Toggle } from '@/components/ui';
import { Select } from '@/components/Select';
import { AcIcon, ToiletIcon, TogetherIcon } from '@/components/icons';
import { IconLabel } from '../IconLabel';
import type { Berth, NewJobFormState } from '../types';

export function StepSeats({ form }: { form: NewJobFormState }) {
  const { seatSelection } = form;

  const handleBerthChange = (v: string): void => form.setBerth(v as Berth);

  if (seatSelection) {
    return (
      <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">Конкретні місця обрано</p>
        <p className="text-xs leading-relaxed text-blue-700">
          Вагон {seatSelection.wagonNumber} · місця {seatSelection.seats.join(', ')}. Преференції
          нижче не застосовуються.
        </p>
        <Button size="sm" onClick={() => form.setSeatSelection(null)}>
          Скинути й обрати преференції
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Полиця" hint="Купе/плацкарт: непарні місця — нижні, парні — верхні">
        <Select
          ariaLabel="Полиця"
          value={form.berth}
          options={[
            { value: 'any', label: 'Будь-яка' },
            { value: 'lower', label: 'Тільки нижні' },
            { value: 'upper', label: 'Тільки верхні' },
          ]}
          onChange={handleBerthChange}
        />
      </Field>
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <Toggle
          checked={form.airConditioned}
          onChange={form.setAirConditioned}
          label={<IconLabel icon={<AcIcon className="h-4 w-4" />} text="З кондиціонером" />}
          hint="Тільки вагони з кондиціонером"
        />
        <Toggle
          checked={form.avoidToilet}
          onChange={form.setAvoidToilet}
          label={<IconLabel icon={<ToiletIcon className="h-4 w-4" />} text="Подалі від туалету" />}
          hint="Уникати крайніх купе; автовибір: спершу центр, потім початок, потім кінець"
        />
        <Toggle
          checked={form.adjacent}
          onChange={form.setAdjacent}
          label={<IconLabel icon={<TogetherIcon className="h-4 w-4" />} text="Місця поряд" />}
          hint="Для 2+ пасажирів — в одному купе"
        />
      </div>
      <p className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
        Жорсткі умови: якщо вільних місць за цими критеріями немає, бронювання не виконується —
        пошук триває далі.
      </p>
    </div>
  );
}
