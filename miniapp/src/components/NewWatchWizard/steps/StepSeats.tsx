import { Chip, Field, Input } from '../../ui';
import { CLASS_OPTIONS } from '../../../types';
import type { WizardState } from '../types';

const ALIGHT_OPTIONS: { minutes: number; title: string }[] = [
  { minutes: 0, title: 'Ні' },
  { minutes: 15, title: 'до 15 хв' },
  { minutes: 30, title: 'до 30 хв' },
  { minutes: 45, title: 'до 45 хв' },
];

export function StepSeats({
  state,
  patch,
  toggleClass,
}: {
  state: WizardState;
  patch: (next: Partial<WizardState>) => void;
  toggleClass: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Класи вагонів" hint="Порожньо — будь-який клас.">
        <div className="flex flex-wrap gap-2">
          {CLASS_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              active={state.classes.includes(option.id)}
              onClick={() => toggleClass(option.id)}
            >
              {option.title}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Стеля ціни, грн" hint="Дорожчі варіанти не потурбують.">
        <Input
          type="number"
          min={0}
          placeholder="без обмеження"
          value={state.maxPrice}
          onChange={(event) => patch({ maxPrice: event.target.value })}
        />
      </Field>

      <Field label="Полиця">
        <div className="flex flex-wrap gap-2">
          <Chip active={state.berth === ''} onClick={() => patch({ berth: '' })}>
            Будь-яка
          </Chip>
          <Chip active={state.berth === 'lower'} onClick={() => patch({ berth: 'lower' })}>
            Нижня
          </Chip>
          <Chip active={state.berth === 'upper'} onClick={() => patch({ berth: 'upper' })}>
            Верхня
          </Chip>
        </div>
      </Field>

      <Field label="Скільки місць потрібно">
        <Input
          type="number"
          min={1}
          max={4}
          value={state.minSeats}
          onChange={(event) =>
            patch({ minSeats: Math.max(1, Math.min(4, Number(event.target.value))) })
          }
        />
      </Field>

      <Field
        label="Можна вийти на зупинку раніше"
        hint="Якщо до твоєї станції квитків нема, а на зупинку перед нею є — і потяг звідти їде до мети не довше за обране."
      >
        <div className="flex flex-wrap gap-2">
          {ALIGHT_OPTIONS.map((option) => (
            <Chip
              key={option.minutes}
              active={state.alightEarlierMin === option.minutes}
              onClick={() => patch({ alightEarlierMin: option.minutes })}
            >
              {option.title}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Розташування">
        <Chip active={state.adjacent} onClick={() => patch({ adjacent: !state.adjacent })}>
          Тільки місця поруч
        </Chip>
      </Field>
    </div>
  );
}
