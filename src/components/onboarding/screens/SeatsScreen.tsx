import { Chip, Toggle } from '@/components/ui';
import { SeatMap } from '@/components/SeatMap';
import { LowerBerthIcon, UpperBerthIcon } from '@/components/icons';
import { demoSeatSelection, demoWagon } from '../mockData';
import { noop } from './parts';

export function SeatsScreen() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Вподобання місць
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active onClick={noop}>
            <span className="inline-flex items-center gap-1">
              <LowerBerthIcon className="h-4 w-4" /> Нижнє
            </span>
          </Chip>
          <Chip active={false} onClick={noop}>
            <span className="inline-flex items-center gap-1">
              <UpperBerthIcon className="h-4 w-4" /> Верхнє
            </span>
          </Chip>
        </div>
        <Toggle
          checked
          onChange={noop}
          label="Подалі від туалету"
          hint="Автовибір: спершу центр, потім початок, потім кінець"
        />
        <Toggle checked onChange={noop} label="Кондиціонер" />
      </div>
      <SeatMap wagon={demoWagon} selected={demoSeatSelection} onToggle={noop} maxReached={false} />
    </div>
  );
}
