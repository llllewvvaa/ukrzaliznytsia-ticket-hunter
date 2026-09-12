import { describe, expect, it } from 'vitest';
import {
  departureDatesPath,
  searchTripsPath,
  stationsPath,
  tripDetailPath,
  wagonsByClassPath,
} from './paths.js';
import { buildGuestHeaders, isUuidV4 } from './headers.js';

describe('paths', () => {
  it('builds the search path the SPA uses', () => {
    expect(searchTripsPath({ fromId: 2200001, toId: 2218000, date: '2026-09-15' })).toBe(
      '/v3/trips?with_transfers=0&date=2026-09-15&station_from_id=2200001&station_to_id=2218000',
    );
  });

  it('asks for transfers when requested', () => {
    expect(
      searchTripsPath({ fromId: 1, toId: 2, date: '2026-01-01', withTransfers: true }),
    ).toContain('with_transfers=1');
  });

  it('percent-encodes the cyrillic class id', () => {
    expect(wagonsByClassPath(13453982, 'К')).toBe('/v3/trips/13453982/wagons-by-class/%D0%9A');
  });

  it('builds detail, stations and dates paths', () => {
    expect(tripDetailPath(13453982)).toBe('/v3/trips/13453982');
    expect(stationsPath('Київ')).toBe('/stations?search=%D0%9A%D0%B8%D1%97%D0%B2');
    expect(departureDatesPath(1, 2)).toBe(
      '/trips/departure-dates?station_from_id=1&station_to_id=2',
    );
  });
});

describe('guest headers', () => {
  it('carries no authorization and identifies as guest', () => {
    const headers = buildGuestHeaders('83815f7e-4d74-450d-b074-b9f79873e66a');
    expect(headers['x-user-agent']).toBe('UZ/2 Web/1 User/guest');
    expect(Object.keys(headers)).not.toContain('authorization');
  });

  it('accepts a uuid v4 session id', () => {
    expect(isUuidV4('83815f7e-4d74-450d-b074-b9f79873e66a')).toBe(true);
    expect(isUuidV4('not-a-uuid')).toBe(false);
  });
});
