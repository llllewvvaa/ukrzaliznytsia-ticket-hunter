import { Section } from '../ui';
import { InsightsIcon } from '../icons';
import type { Forecast, Stats } from '../../types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 text-xs last:border-none">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

export function StatsPanel({ stats, forecast }: { stats: Stats | null; forecast: Forecast | null }) {
  if (!stats) return null;

  return (
    <div className="space-y-3">
      <Section title="Робота сторожа">
        <Row label="запитів (мережа / кеш)" value={`${stats.report.network} / ${stats.report.cached}`} />
        <Row label="частота" value={`${Math.round(stats.report.perHour)}/год`} />
        <Row label="одиниць перебору" value={`${stats.probes} (улюблених ${stats.favorites})`} />
        <Row label="економія проти брутфорсу" value={`${stats.savings.toFixed(1)}x`} />
        <Row
          label="атлас маршрутів"
          value={`${stats.atlas.stations} станцій · ${stats.atlas.trips} рейсів · ${stats.atlas.pairs} пар`}
        />
      </Section>

      {forecast ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <InsightsIcon className="h-4 w-4 text-blue-600" />
            Прогноз · {forecast.trainNumber} {forecast.classId}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            {forecast.probability == null
              ? forecast.note
              : `після порожньої перевірки місця зʼявлялися у ${Math.round(forecast.probability * 100)}% випадків (${forecast.observations} спостережень)`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
