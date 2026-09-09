import type { SearchResult, Trip, WagonClassOffer } from '../uz/types.js';
import type { Candidate, CandidateKind } from './candidates.js';

export interface Offer {
  tripId: number;
  trainNumber: string;
  fromId: number;
  toId: number;
  date: string;
  classId: string;
  className: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
  arriveAt: number;
  durationMin: number;
  legs: number;
  kind: CandidateKind;
  why: string;
  distanceKm: number | null;
  score: number;
}

export interface RankWeights {
  pricePerKopiyka: number;
  perMinute: number;
  perLeg: number;
  kindBonus: number;
}

export const DEFAULT_WEIGHTS: RankWeights = {
  pricePerKopiyka: 1 / 500,
  perMinute: 0.25,
  perLeg: 90,
  kindBonus: 30,
};

export type SortMode = 'cheapest' | 'balanced';

export interface OfferFilter {
  classes?: string[];
  maxPriceKop?: number;
  minFreeSeats?: number;
  departAfter?: number;
  departBefore?: number;
}

function durationMin(trip: Trip): number {
  return Math.max(0, Math.round((trip.arriveAt - trip.departAt) / 60));
}

export function offersFromTrip(
  trip: Trip,
  candidate: Candidate,
  legs = 1,
  priceOverrideKop?: number,
): Offer[] {
  return trip.classes
    .filter((cls: WagonClassOffer) => cls.freeSeats > 0)
    .map((cls) => ({
      tripId: trip.id,
      trainNumber: trip.trainNumber,
      fromId: candidate.fromId,
      toId: candidate.toId,
      date: candidate.date,
      classId: cls.id,
      className: cls.name,
      freeSeats: cls.freeSeats,
      priceKop: priceOverrideKop ?? cls.priceKop,
      departAt: trip.departAt,
      arriveAt: trip.arriveAt,
      durationMin: durationMin(trip),
      legs,
      kind: candidate.kind,
      why: candidate.why,
      distanceKm: trip.distanceKm,
      score: 0,
    }));
}

export function transferClassId(legs: { id: number }[]): string {
  return `MIX:${legs.map((leg) => leg.id).join('-')}`;
}

export function isTransferClass(classId: string): boolean {
  return classId.startsWith('MIX');
}

export function offersFromSearch(result: SearchResult, candidate: Candidate): Offer[] {
  const direct = result.direct.flatMap((trip) => offersFromTrip(trip, candidate));
  if (!candidate.withTransfers) return direct;
  const transfers = result.withTransfer.flatMap((variant) => {
    if (variant.length === 0) return [];
    const first = variant[0]!;
    const last = variant[variant.length - 1]!;
    const cheapestPerLeg = variant.map((leg) => {
      const available = leg.classes.filter((c) => c.freeSeats > 0);
      if (available.length === 0) return null;
      return Math.min(...available.map((c) => c.priceKop));
    });
    if (cheapestPerLeg.some((p) => p == null)) return [];
    const total = cheapestPerLeg.reduce<number>((sum, p) => sum + (p ?? 0), 0);
    const synthetic: Trip = {
      ...first,
      arriveAt: last.arriveAt,
      stationTo: last.stationTo,
      classes: [
        {
          id: transferClassId(variant),
          name: `${variant.length} сегменти`,
          freeSeats: Math.min(...variant.map((leg) => Math.max(...leg.classes.map((c) => c.freeSeats)))),
          priceKop: total,
          amenities: [],
        },
      ],
    };
    return offersFromTrip(synthetic, candidate, variant.length, total);
  });
  return [...direct, ...transfers];
}

export function scoreOffer(offer: Offer, weights: RankWeights = DEFAULT_WEIGHTS): number {
  const kindWeight: Record<CandidateKind, number> = {
    direct: 1,
    transfers: 0.6,
    ride_further: 0.7,
    board_earlier: 0.7,
    neighbor_from: 0.5,
    neighbor_to: 0.5,
    neighbor_date: 0.4,
  };
  return (
    offer.priceKop * weights.pricePerKopiyka +
    offer.durationMin * weights.perMinute +
    (offer.legs - 1) * weights.perLeg -
    kindWeight[offer.kind] * weights.kindBonus
  );
}

export function passesFilter(offer: Offer, filter: OfferFilter): boolean {
  if (filter.classes && filter.classes.length > 0 && !filter.classes.includes(offer.classId)) return false;
  if (filter.maxPriceKop != null && offer.priceKop > filter.maxPriceKop) return false;
  if (filter.minFreeSeats != null && offer.freeSeats < filter.minFreeSeats) return false;
  if (filter.departAfter != null && offer.departAt < filter.departAfter) return false;
  if (filter.departBefore != null && offer.departAt > filter.departBefore) return false;
  return true;
}

export function rankOffers(
  offers: Offer[],
  filter: OfferFilter = {},
  weights: RankWeights = DEFAULT_WEIGHTS,
  mode: SortMode = 'cheapest',
): Offer[] {
  const scored = offers
    .filter((offer) => passesFilter(offer, filter))
    .map((offer) => ({ ...offer, score: scoreOffer(offer, weights) }));
  return mode === 'cheapest'
    ? scored.sort((a, b) => a.priceKop - b.priceKop || a.score - b.score)
    : scored.sort((a, b) => a.score - b.score || a.priceKop - b.priceKop);
}

export function cheapest(offers: Offer[]): Offer | undefined {
  return [...offers].sort((a, b) => a.priceKop - b.priceKop)[0];
}

export function pricePerKm(offer: Offer): number | null {
  if (!offer.distanceKm || offer.distanceKm <= 0) return null;
  return offer.priceKop / offer.distanceKm;
}
