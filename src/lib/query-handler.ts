import { hasSession } from './auth';
import {
  AuthError,
  NotDiscoveredError,
  RateLimitError,
  getActiveOrders,
  getArchivedOrders,
  getPassengers,
  getProfile,
  getWagonsForClass,
  searchStations,
  searchTrips,
} from './uz-api';
import { clearDebugLog, getDebugLog } from './debug';
import { openCheckoutForCart } from './success';
import { fetchRouteTimetable, fetchStationSuggest } from './timetable';
import type { QueryMessage, QueryResult } from './messages';
import type { SearchTripsParams } from './models';

function classify(err: unknown): QueryResult {
  if (err instanceof AuthError) return { ok: false, code: 'not_authenticated', error: err.message };
  if (err instanceof NotDiscoveredError) return { ok: false, code: 'not_discovered', error: err.message };
  if (err instanceof RateLimitError) return { ok: false, code: 'rate_limited', error: err.message };
  return { ok: false, code: 'error', error: err instanceof Error ? err.message : String(err) };
}

export async function handleQuery(msg: QueryMessage): Promise<QueryResult> {
  try {
    switch (msg.name) {
      case 'authStatus':
        return { ok: true, data: await hasSession() };
      case 'profile':
        return { ok: true, data: await getProfile() };
      case 'passengers':
        return { ok: true, data: await getPassengers() };
      case 'stations': {
        const q = String((msg.params as { query?: unknown })?.query ?? '');
        return { ok: true, data: await searchStations(q) };
      }
      case 'trips':
        return { ok: true, data: await searchTrips(msg.params as SearchTripsParams) };
      case 'wagons': {
        const p = msg.params as { tripId?: unknown; classId?: unknown };
        return {
          ok: true,
          data: await getWagonsForClass(Number(p?.tripId), String(p?.classId)),
        };
      }
      case 'activeOrders':
        return { ok: true, data: await getActiveOrders() };
      case 'archivedOrders': {
        const page = Number((msg.params as { page?: unknown })?.page ?? 1) || 1;
        return { ok: true, data: await getArchivedOrders(page) };
      }
      case 'openCheckout': {
        const p = msg.params as { cartId?: unknown; paymentUrl?: unknown };
        await openCheckoutForCart(
          typeof p?.cartId === 'number' ? p.cartId : undefined,
          typeof p?.paymentUrl === 'string' ? p.paymentUrl : undefined,
        );
        return { ok: true };
      }
      case 'timetableStations': {
        const q = String((msg.params as { q?: unknown })?.q ?? '').trim();
        return { ok: true, data: q ? await fetchStationSuggest(q) : [] };
      }
      case 'timetable': {
        const p = msg.params as { fromIds?: unknown; toIds?: unknown };
        return {
          ok: true,
          data: await fetchRouteTimetable(String(p?.fromIds ?? ''), String(p?.toIds ?? '')),
        };
      }
      case 'debugLog': {
        const events = await getDebugLog();
        const countOnly = (msg.params as { countOnly?: unknown })?.countOnly === true;
        return { ok: true, data: countOnly ? events.length : events };
      }
      case 'debugClear':
        await clearDebugLog();
        return { ok: true };
      default:
        return { ok: false, code: 'error', error: `unknown query: ${String(msg.name)}` };
    }
  } catch (err) {
    return classify(err);
  }
}
