import {
  AuthError,
  RateLimitError,
  createOrder,
  getPassengers,
  getWagonsForClass,
  holdSeats,
} from './uz-api';
import { diagnoseRelaxations, selectSeats, type SeatChoice } from './seat-prefs';
import { CartTimeoutError, pollCart, type CartPollOptions } from './cart-poller';
import type {
  HuntJob,
  MatchRef,
  Passenger,
  Reservation,
  ReservationService,
  ReserveOutcome,
  Wagon,
} from './models';
import type { TripMatch } from './orchestrator';

function beddingService(): ReservationService {
  return {
    id: 'bedding',
    title: 'Постіль',
    details: {
      photo: null,
      content: [
        {
          title: 'У комплекті:',
          description:
            'Матрац, подушка, ковдра, 2 простирадла, наволочка та рушник. Якщо відмовитися від постілі, не можна користуватися матрацом, подушкою та ковдрою.\n',
        },
      ],
    },
    price: 9500,
    select_type: 'checkbox',
    select_units_max: null,
    selected_by_default: true,
    value: true,
  };
}

export function buildReservations(
  passengers: Passenger[],
  passengerIds: number[],
  wagonId: string,
  seats: number[],
  bedding: boolean,
): Reservation[] {
  const byId = new Map(passengers.map((p) => [p.id, p]));
  return passengerIds.map((pid, i) => {
    const p = byId.get(pid);
    return {
      passenger_id: pid,
      wagon_id: wagonId,
      seat_number: seats[i] ?? 0,
      first_name: p?.first_name ?? '',
      last_name: p?.last_name ?? '',
      input_type: null,
      privilege: null,
      privilege_data: {},
      privilege_id: null,
      companion_id: null,
      services: bedding ? [beddingService()] : [],
      passenger_options: [],
      save_in_passengers: false,
    };
  });
}

export interface ReserveExecOptions {
  emit?: (outcome: ReserveOutcome) => void;
  pollOptions?: CartPollOptions;
  // x-session-id of the live SPA session, used as the hold `uuid`; omit to skip the hold.
  uuid?: string;
}

function mapReserveError(err: unknown, cartId?: number): ReserveOutcome {
  if (err instanceof RateLimitError) {
    return {
      status: 'rate_limited',
      ...(cartId != null ? { cartId } : {}),
      ...(err.retryAfterSec != null ? { retryInSec: err.retryAfterSec } : {}),
      detail: err.message,
    };
  }
  if (err instanceof AuthError) return reserveFail('not_authenticated', cartId);
  return reserveFail(err instanceof Error ? err.message : String(err), cartId);
}

function reserveFail(detail: string, cartId?: number): ReserveOutcome {
  return { status: 'reserve_fail', detail, ...(cartId != null ? { cartId } : {}) };
}

function pickManualSeats(
  wagons: Wagon[],
  manual: { wagonNumber: string; seats: number[] },
  need: number,
): SeatChoice | null {
  const wagon = wagons.find((w) => w.number === manual.wagonNumber);
  if (!wagon || manual.seats.length !== need) return null;
  const free = new Set(wagon.seats);
  if (!manual.seats.every((s) => free.has(s))) return null;
  return { wagon, seats: [...manual.seats] };
}

// Never throws: resolves a terminal outcome, streaming intermediate states via emit.
export async function executeReserve(
  job: HuntJob,
  match: TripMatch,
  opts: ReserveExecOptions = {},
): Promise<ReserveOutcome> {
  const emit = opts.emit ?? (() => {});
  const need = Math.max(1, job.passengerIds.length);

  const finish = (o: ReserveOutcome): ReserveOutcome => {
    emit(o);
    return o;
  };

  try {
    // Fresh encrypted wagon_id + free seats; the wagon_id can't be precomputed.
    let wagons: Wagon[];
    try {
      wagons = await getWagonsForClass(match.trip.id, String(match.wagonClass.id));
    } catch (err) {
      return finish(mapReserveError(err));
    }

    const matchInfo: MatchRef = {
      tripId: match.trip.id,
      trainNumber: match.trip.train.number,
      classId: String(match.wagonClass.id),
    };

    const choice: SeatChoice | null = job.manualSeats
      ? pickManualSeats(wagons, job.manualSeats, need)
      : selectSeats(wagons, need, job.seatPrefs ?? {});
    if (!choice) {
      if (job.manualSeats) {
        return finish({
          status: 'reserve_fail',
          detail: `manual_seats_gone (місця ${job.manualSeats.seats.join(', ')} у вагоні ${job.manualSeats.wagonNumber} зайнято)`,
          match: matchInfo,
        });
      }
      const totalFree = wagons.reduce((sum, w) => sum + w.seats.length, 0);
      const prefs = JSON.stringify(job.seatPrefs ?? {});
      const relax = diagnoseRelaxations(wagons, need, job.seatPrefs ?? {});
      return finish({
        status: 'reserve_fail',
        detail: `no_seats (wagons=${wagons.length}, free=${totalFree}, prefs=${prefs})`,
        ...(relax.length ? { relax } : {}),
        match: matchInfo,
      });
    }

    const { wagon, seats } = choice;
    if (opts.uuid) {
      // Hold identifies the coach by its plain number, not the encrypted wagon_id.
      try {
        await holdSeats(
          match.trip.id,
          seats.map((place) => ({ wagon_number: wagon.number, place })),
          opts.uuid,
        );
      } catch (err) {
        return finish(mapReserveError(err));
      }
    }

    const passengers = await getPassengers();
    const reservations = buildReservations(
      passengers,
      job.passengerIds,
      wagon.id,
      seats,
      job.bedding,
    );

    let cartId: number;
    try {
      const res = await createOrder({ trip_id: match.trip.id, reservations });
      cartId = res.cart_id;
    } catch (err) {
      return finish(mapReserveError(err));
    }

    emit({ status: 'order_enqueued', cartId });

    try {
      const ready = await pollCart(cartId, {
        ...opts.pollOptions,
        onPending: (retryIn) =>
          emit({ status: 'cart_pending', cartId, retryInSec: retryIn }),
      });
      return finish({
        status: 'reserve_ok',
        cartId,
        ...(ready.payment_url ? { paymentUrl: ready.payment_url } : {}),
        ...(typeof ready.expire_at === 'number'
          ? { reservedUntil: ready.expire_at * 1000 }
          : {}),
      });
    } catch (err) {
      if (err instanceof RateLimitError) {
        return finish({
          status: 'rate_limited',
          cartId,
          ...(err.retryAfterSec != null ? { retryInSec: err.retryAfterSec } : {}),
        });
      }
      const detail =
        err instanceof CartTimeoutError
          ? 'cart_timeout'
          : err instanceof Error
            ? err.message
            : String(err);
      return finish(reserveFail(detail, cartId));
    }
  } catch (err) {
    return finish(reserveFail(err instanceof Error ? err.message : String(err)));
  }
}
