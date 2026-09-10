import { clockTime, waitBetween } from '../../lib/format';
import type { Segment } from '../../types';

export function Segments({ segments }: { segments: Segment[] }) {
  return (
    <div className="mt-2 rounded-lg bg-violet-50/70 p-2.5">
      {segments.map((segment, index) => {
        const next = segments[index + 1];
        return (
          <div key={`${segment.trainNumber}-${index}`}>
            <div className="flex items-baseline justify-between gap-2 text-[11px] leading-snug text-violet-900">
              <span className="font-semibold">{segment.trainNumber}</span>
              <span>
                {segment.from} {clockTime(segment.departAt)} → {segment.to} {clockTime(segment.arriveAt)}
              </span>
            </div>
            {next ? (
              <div className="my-1 text-[11px] font-medium text-violet-700">
                пересадка у {segment.to} · чекати {waitBetween(segment.arriveAt, next.departAt)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
