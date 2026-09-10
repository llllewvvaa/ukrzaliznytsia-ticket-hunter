import type { StoredEvent } from '../store/history.js';
import type { Watch } from '../store/watches.js';
import { hryvnia, kyivClock, shortDate } from '../service/format.js';

export const NOTIFY_KINDS = new Set(['appeared', 'price_drop']);
export const COOLDOWN_MS = 3 * 60 * 60_000;
export const MAX_LINES = 5;
export const DIGEST_GAP_MS = 15 * 60_000;
export const PRICE_BEAT_RATIO = 0.95;

export interface DigestEntry {
  event: StoredEvent;
  key: string;
  priceKop: number;
}

export interface DigestGate {
  lastSentAt: number | null;
  lastBestPriceKop: number | null;
}

// A digest may break the quiet gap only when it carries something cheaper than
// what was already reported — otherwise a busy route would talk every cycle.
export function mayTellNow(
  gate: DigestGate,
  bestPriceKop: number,
  now: number,
  gapMs = DIGEST_GAP_MS,
): boolean {
  if (gate.lastSentAt == null) return true;
  if (now - gate.lastSentAt >= gapMs) return true;
  if (gate.lastBestPriceKop == null) return false;
  return bestPriceKop <= gate.lastBestPriceKop * PRICE_BEAT_RATIO;
}

function classFamily(classId: string): string {
  return classId.startsWith('MIX') ? 'MIX' : classId;
}

// Transfer combinations get a fresh class id per leg set, so keying on it alone
// would let one train fill the digest with near-identical lines.
export function eventKey(event: StoredEvent): string {
  const payload = event.payload as Record<string, unknown>;
  return [
    event.watchId,
    String(payload.trainNumber ?? ''),
    String(payload.date ?? ''),
    classFamily(String(payload.classId ?? '')),
    event.kind,
  ].join(':');
}

export function isWorthTelling(event: StoredEvent): boolean {
  return NOTIFY_KINDS.has(event.kind);
}

export function selectForDigest(
  events: StoredEvent[],
  lastToldAt: Map<string, number>,
  now: number,
  cooldownMs = COOLDOWN_MS,
): DigestEntry[] {
  const chosen = new Map<string, DigestEntry>();

  for (const event of events) {
    if (!isWorthTelling(event)) continue;
    const key = eventKey(event);
    const told = lastToldAt.get(key);
    if (told != null && now - told < cooldownMs) continue;

    const priceKop = Number((event.payload as Record<string, unknown>).priceKop ?? 0);
    const existing = chosen.get(key);
    if (!existing || priceKop < existing.priceKop) chosen.set(key, { event, key, priceKop });
  }

  return [...chosen.values()].sort((a, b) => a.priceKop - b.priceKop).slice(0, MAX_LINES);
}

export function digestText(watch: Watch, entries: DigestEntry[], hidden: number): string {
  const lines = [`${watch.name}`];

  for (const entry of entries) {
    const payload = entry.event.payload as Record<string, unknown>;
    const train = String(payload.trainNumber ?? '');
    const className = String(payload.className ?? payload.classId ?? '');
    const seats = Number(payload.freeSeats ?? 0);
    const date = String(payload.date ?? '');
    const departAt = Number(payload.departAt ?? 0);
    const why = String(payload.why ?? '');
    const head =
      entry.event.kind === 'price_drop'
        ? `${hryvnia(entry.priceKop)} (було ${hryvnia(Number(payload.previousPriceKop ?? 0))})`
        : hryvnia(entry.priceKop);

    lines.push(
      `· ${train} ${shortDate(date)}${departAt ? ` ${kyivClock(departAt)}` : ''} — ${className} ×${seats} — ${head}`,
    );
    if (why && why !== 'прямий напрямок') lines.push(`  ${why}`);

    const wagons = Array.isArray(payload.seats) ? (payload.seats as Record<string, unknown>[]) : [];
    const first = wagons[0];
    if (first) {
      const numbers = Array.isArray(first.seats) ? (first.seats as number[]).slice(0, 6).join(', ') : '';
      lines.push(
        `  вагон ${String(first.wagon)} · нижніх ${Number(first.lower)}, верхніх ${Number(first.upper)}${numbers ? ` · ${numbers}` : ''}`,
      );
    }
  }

  if (hidden > 0) lines.push(`ще ${hidden} змін(и) — дивись в історії`);
  return lines.join('\n');
}
