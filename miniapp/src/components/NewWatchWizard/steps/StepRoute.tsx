import { StationCombobox } from '../../StationCombobox';
import type { WizardState } from '../types';
import type { Station } from '../../../types';

export function StepRoute({
  state,
  patch,
}: {
  state: WizardState;
  patch: (next: Partial<WizardState>) => void;
}) {
  const handleFrom = (station: Station | null): void => patch({ from: station });
  const handleTo = (station: Station | null): void => patch({ to: station });

  return (
    <div className="space-y-4">
      <StationCombobox
        label="Звідки"
        placeholder="Київ-Пасажирський"
        value={state.from}
        onPick={handleFrom}
      />
      <StationCombobox label="Куди" placeholder="Львів" value={state.to} onPick={handleTo} />
      {state.from && state.to && state.from.id === state.to.id ? (
        <p className="text-xs text-red-600">Станції збігаються — обери різні.</p>
      ) : null}
    </div>
  );
}
