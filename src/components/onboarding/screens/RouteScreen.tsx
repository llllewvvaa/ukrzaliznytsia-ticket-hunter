import { Button } from '@/components/ui';
import { CalendarIcon, SwapIcon } from '@/components/icons';
import { ChipGroup, FieldMock } from './parts';

export function RouteScreen() {
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <FieldMock label="Звідки" value="Київ" />
        <span className="mb-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400">
          <SwapIcon className="h-5 w-5" />
        </span>
        <FieldMock label="Куди" value="Львів" />
      </div>
      <FieldMock label="Дата" value="19.07.2026" icon={<CalendarIcon className="h-4 w-4" />} />
      <ChipGroup label="Поїзди" chips={['057К', '091Л', '119О']} />
      <ChipGroup label="Типи вагонів" chips={['Купе', 'Плацкарт', 'Люкс']} />
      <Button variant="primary" className="w-full">
        Далі
      </Button>
    </div>
  );
}
