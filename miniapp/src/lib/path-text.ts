import type { WatchOption } from '../types';

export function routeEnds(watchName: string): { origin: string; destination: string } {
  const [origin = '', destination = ''] = watchName.split(' → ');
  return { origin, destination };
}

// The stored reason reads like the planner's shorthand ("сісти раніше на X");
// the owner needs to know which ticket to buy and where to actually get on/off.
export function pathText(option: WatchOption, origin: string, destination: string): string {
  switch (option.kind) {
    case 'direct':
    case 'neighbor_date':
      return 'прямий квиток';
    case 'transfers':
      return option.classId.startsWith('MIX') ? 'з пересадкою' : 'прямий квиток';
    case 'ride_further':
    case 'board_earlier':
    case 'alight_earlier':
      return (
        option.why ||
        `квиток ${option.fromName} → ${option.toName}, їдеш ${origin} → ${destination}`
      );
    default:
      return option.why || option.kind;
  }
}

export interface TrainGroup {
  trainNumber: string;
  best: WatchOption;
  options: WatchOption[];
  isNew: boolean;
}

export function groupByTrain(options: WatchOption[]): TrainGroup[] {
  const groups = new Map<string, WatchOption[]>();
  for (const option of options)
    groups.set(option.trainNumber, [...(groups.get(option.trainNumber) ?? []), option]);
  return [...groups.entries()]
    .map(([trainNumber, items]) => {
      const sorted = [...items].sort((a, b) => a.priceKop - b.priceKop);
      return {
        trainNumber,
        best: sorted[0]!,
        options: sorted,
        isNew: sorted.some((item) => item.isNew),
      };
    })
    .sort((a, b) => a.best.priceKop - b.best.priceKop);
}

export interface DateSection {
  date: string;
  inWindow: boolean;
  trains: TrainGroup[];
}

export function sectionsFor(
  options: WatchOption[],
  dateFrom: string,
  dateTo: string,
): DateSection[] {
  const byDate = new Map<string, WatchOption[]>();
  for (const option of options)
    byDate.set(option.date, [...(byDate.get(option.date) ?? []), option]);
  return [...byDate.entries()]
    .map(([date, items]) => ({
      date,
      inWindow: date >= dateFrom && date <= dateTo,
      trains: groupByTrain(items),
    }))
    .sort((a, b) => Number(b.inWindow) - Number(a.inWindow) || a.date.localeCompare(b.date));
}
