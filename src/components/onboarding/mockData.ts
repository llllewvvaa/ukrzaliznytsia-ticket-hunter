import type { HuntJob, Wagon } from '@/lib/models';

const MIN = 60_000;

function job(over: Partial<HuntJob>): HuntJob {
  return {
    id: `demo-${over.id ?? 'x'}`,
    name: 'Демо',
    state: 'hunting',
    mode: 'monitor',
    from: { id: 1, name: 'Київ' },
    to: { id: 2, name: 'Львів' },
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [1],
    bedding: true,
    attempts: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

export function demoJobs(now = Date.now()): HuntJob[] {
  return [
    job({
      id: 'hunt',
      state: 'hunting',
      preferredTrains: ['057К'],
      coachTypes: ['К'],
      attempts: 34,
      lastAttemptAt: now - 7_000,
    }),
    job({
      id: 'done',
      to: { id: 3, name: 'Одеса' },
      date: '2026-07-20',
      state: 'reserved',
      attempts: 61,
      lastAttemptAt: now - 40_000,
      cartId: 111683131,
      reservedUntil: now + 12 * MIN,
    }),
  ];
}

export function demoReservedJob(now = Date.now()): HuntJob {
  return job({
    id: 'reserved',
    state: 'reserved',
    preferredTrains: ['057К'],
    coachTypes: ['К'],
    passengerIds: [1, 2],
    attempts: 48,
    lastAttemptAt: now - 5_000,
    cartId: 111683131,
    reservedUntil: now + 14 * MIN,
  });
}

export const demoWagon: Wagon = {
  id: 'demo-wagon',
  number: '7',
  seats: [3, 5, 9, 12, 14, 17, 18, 20, 24, 27, 30, 33],
  free_seats_top: 6,
  free_seats_lower: 6,
  price: 68000,
  air_conditioner: true,
  mockup_name: 'Купейний вагон 36 місць',
};

export const demoSeatSelection = [17, 18];
