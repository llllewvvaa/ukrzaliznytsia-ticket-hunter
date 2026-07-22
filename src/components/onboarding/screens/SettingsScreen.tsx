import { Button, Toggle } from '@/components/ui';
import { SidebarIcon } from '@/components/icons';
import { noop } from './parts';

export function SettingsScreen() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Бічна панель</p>
        <Toggle
          checked
          onChange={noop}
          label="Відкривати бічну панель за кліком на іконку"
          hint="Панель лишається відкритою поряд з booking.uz."
        />
        <Button size="sm">
          <SidebarIcon className="h-4 w-4" /> Відкрити зараз у бічній панелі
        </Button>
      </div>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Дебаг-запис</p>
        <Toggle
          checked={false}
          onChange={noop}
          label="Записувати запити та події"
          hint="Для діагностики. Експорт у файл — без паролів."
        />
        <div className="flex gap-2">
          <Button size="sm">Експортувати</Button>
          <Button size="sm" variant="danger">
            Очистити
          </Button>
        </div>
      </div>
    </div>
  );
}
