import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSearch, parseStations, parseTripDetail, parseWagons } from './parse.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf-8'));
}

describe('parseSearch', () => {
  const result = parseSearch(fixture('search-kyiv-lviv.json'));

  it('reads every direct trip', () => {
    expect(result.direct).toHaveLength(31);
  });

  it('keeps trips with zero free seats as candidates', () => {
    const soldOut = result.direct.filter((t) => t.classes.every((c) => c.freeSeats === 0));
    expect(soldOut.length).toBeGreaterThan(0);
  });

  it('reads price in kopiykas and class ids', () => {
    const trip = result.direct[0]!;
    expect(trip.trainNumber).toBe('021О');
    const kupe = trip.classes.find((c) => c.id === 'К');
    expect(kupe?.priceKop).toBe(78203);
    expect(kupe?.name).toBe('Купе');
  });

  it('reads distance and monitoring flags', () => {
    const trip = result.direct[0]!;
    expect(trip.distanceKm).toBe(627);
    expect(trip.monitoringAllowed).toBe(false);
  });

  it('returns an empty transfer list when the response has none', () => {
    expect(result.withTransfer).toEqual([]);
  });
});

describe('parseTripDetail', () => {
  const detail = parseTripDetail(fixture('trip-detail.json'));

  it('reads the full stop list', () => {
    expect(detail.routePoints).toHaveLength(11);
  });

  it('numbers stops in order and keeps booking station ids', () => {
    expect(detail.routePoints[0]!.seq).toBe(0);
    expect(detail.routePoints[0]!.stationId).toBe(2204001);
    expect(detail.routePoints[0]!.stationName).toBe('Харків-Пасажирський');
  });

  it('reads endpoints of the searched leg', () => {
    expect(detail.stationFromId).toBe(2200001);
    expect(detail.stationToId).toBe(2218000);
  });
});

describe('parseWagons', () => {
  const wagons = parseWagons(fixture('wagons-kupe.json'));

  it('reads every wagon of the class', () => {
    expect(wagons.length).toBeGreaterThan(0);
  });

  it('reads free seat numbers and berth split', () => {
    const wagon = wagons[0]!;
    expect(wagon.number).toBe('11');
    expect(wagon.seats).toContain(15);
    expect(wagon.freeSeatsLower).toBe(9);
    expect(wagon.freeSeatsTop).toBe(20);
    expect(wagon.priceKop).toBe(74926);
  });

  it('reads services as ids', () => {
    expect(wagons[0]!.services).toContain('bedding');
  });
});

describe('parseStations', () => {
  it('maps id and name', () => {
    expect(parseStations([{ id: 2200001, name: 'Київ-Пасажирський' }])).toEqual([
      { id: 2200001, name: 'Київ-Пасажирський' },
    ]);
  });

  it('tolerates a non-list payload', () => {
    expect(parseStations(null)).toEqual([]);
  });
});
