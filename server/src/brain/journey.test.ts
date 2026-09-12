import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { saveTripRoute } from '../store/atlas.js';
import { journeyTimes } from './journey.js';

const KYIV = 1;
const LVIV = 2;
const CHERNIVTSI = 3;

describe('journeyTimes', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(
      db,
      {
        id: 70,
        trainId: 7,
        trainNumber: '007К',
        stationFromId: KYIV,
        stationToId: CHERNIVTSI,
        departAt: 0,
        arriveAt: 0,
        routePoints: [
          { seq: 0, stationId: KYIV, stationName: 'Київ', arriveAt: null, departAt: 100_000 },
          {
            seq: 1,
            stationId: LVIV,
            stationName: 'Львів',
            arriveAt: 100_000 + 7 * 3_600 - 600,
            departAt: 100_000 + 7 * 3_600,
          },
          {
            seq: 2,
            stationId: CHERNIVTSI,
            stationName: 'Чернівці',
            arriveAt: 100_000 + 12 * 3_600,
            departAt: null,
          },
        ],
      },
      1_000,
    );
  });

  it('moves a Kyiv ticket to the moment the train is in Lviv on the travel day', () => {
    const ticketDepart = 2_000_000;
    const journey = journeyTimes(
      db,
      {
        trainNumber: '007К',
        fromId: KYIV,
        departAt: ticketDepart,
        arriveAt: ticketDepart + 12 * 3_600,
      },
      LVIV,
      CHERNIVTSI,
    );
    expect(journey.exact).toBe(true);
    expect(journey.departAt).toBe(ticketDepart + 7 * 3_600);
    expect(journey.arriveAt).toBe(ticketDepart + 12 * 3_600);
    expect(journey.durationMin).toBe(300);
  });

  it('matches the ticket for a plain direct ride', () => {
    const journey = journeyTimes(
      db,
      { trainNumber: '007К', fromId: LVIV, departAt: 5_000_000, arriveAt: 5_000_000 + 5 * 3_600 },
      LVIV,
      CHERNIVTSI,
    );
    expect(journey.departAt).toBe(5_000_000);
    expect(journey.arriveAt).toBe(5_000_000 + 5 * 3_600);
  });

  it('falls back to the ticket times when the route is unknown', () => {
    const journey = journeyTimes(
      db,
      { trainNumber: 'X', fromId: LVIV, departAt: 1_000, arriveAt: 4_600 },
      LVIV,
      CHERNIVTSI,
    );
    expect(journey).toEqual({ departAt: 1_000, arriveAt: 4_600, durationMin: 60, exact: false });
  });
});
