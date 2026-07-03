// Timetable station ids are a different id space from booking.uz ids; the
// timetable is only used to obtain a train NUMBER, matched numerically later.

const ORIGIN = 'https://www.uz.gov.ua';
const PATH = '/passengers/timetable';

export interface TimetableStation {
  name: string;
  ids: string;
}

export interface TimetableBoarding {
  station: string;
  departTime: string; // "HH:MM"
}

export interface TimetableTrain {
  number: string; // "66"
  route: string; // "Київ Суми"
  periodicity: string[]; // e.g. ["з 28/06/2026 щоденно"]
  boardings: TimetableBoarding[];
  arriveStation: string; // "Суми"
  arriveTime: string; // "05:25"
}

const ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rarr: '→',
  copy: '©',
  laquo: '«',
  raquo: '»',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// `["Назва~ids", …]` (JSON text) → structured stations.
export function parseSuggestStations(text: string): TimetableStation[] {
  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: TimetableStation[] = [];
  for (const entry of arr) {
    if (typeof entry !== 'string') continue;
    const i = entry.lastIndexOf('~');
    if (i < 0) continue;
    const name = entry.slice(0, i).trim();
    const ids = entry.slice(i + 1).trim();
    if (name && ids) out.push({ name, ids });
  }
  return out;
}

// One entry per train number; boarding rows and periodicity notes are merged.
export function parseTimetableHtml(html: string): TimetableTrain[] {
  // Scope to the schedule table so unrelated tables (footer, layout) are ignored.
  const anchor = html.indexOf('id="cpn-timetable"');
  if (anchor < 0) return [];
  const region = html.slice(anchor);
  const tableMatch = /<table\b[^>]*>([\s\S]*?)<\/table>/i.exec(region);
  if (!tableMatch) return [];
  const table = tableMatch[1] ?? '';
  const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table);
  const body = bodyMatch ? (bodyMatch[1] ?? '') : table;

  const byNumber = new Map<string, TimetableTrain>();
  for (const rowMatch of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1] ?? '';
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      stripTags(c[1] ?? ''),
    );
    if (cells.length < 8) continue; // header / malformed rows

    const numberCell = row.match(/<td\b[\s\S]*?<\/td>/i)?.[0] ?? '';
    const titled = /номеру поїзда\s*&quot;([^&]+)&quot;/i.exec(numberCell);
    const number = (titled ? titled[1]! : cells[0]!).trim();
    if (!number) continue;

    const route = cells[1] ?? '';
    const periodicity = cells[2] ?? '';
    const boardingStation = cells[3] ?? '';
    const departTime = cells[5] ?? '';
    const arriveStation = cells[6] ?? '';
    const arriveTime = cells[7] ?? '';

    const train =
      byNumber.get(number) ??
      ({ number, route, periodicity: [], boardings: [], arriveStation, arriveTime } as TimetableTrain);
    if (periodicity && !train.periodicity.includes(periodicity)) {
      train.periodicity.push(periodicity);
    }
    if (
      departTime &&
      !train.boardings.some((b) => b.station === boardingStation && b.departTime === departTime)
    ) {
      train.boardings.push({ station: boardingStation, departTime });
    }
    byNumber.set(number, train);
  }
  return [...byNumber.values()];
}

// Best-effort match: exact → prefix → substring → city stem; falls back to first.
export function pickBestStation(
  suggestions: TimetableStation[],
  query: string,
): TimetableStation | null {
  if (suggestions.length === 0) return null;
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^0-9a-zа-яіїєґ']+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const q = norm(query);
  const stem = q.split(' ')[0] ?? q;
  return (
    suggestions.find((s) => norm(s.name) === q) ??
    suggestions.find((s) => norm(s.name).startsWith(q)) ??
    suggestions.find((s) => norm(s.name).includes(q)) ??
    suggestions.find((s) => norm(s.name) === stem) ??
    suggestions.find((s) => norm(s.name).startsWith(stem)) ??
    suggestions[0]!
  );
}

// booking.uz names don't match timetable naming and suggest substring-matches,
// so widen the query down to the bare city stem.
export function stationQueryCandidates(name: string): string[] {
  const trimmed = name.trim();
  const out: string[] = [];
  const push = (s: string): void => {
    const v = s.trim();
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  };
  push(trimmed);
  push(trimmed.replace(/\s*\([^)]*\)\s*/g, ''));
  push(trimmed.split('-')[0] ?? '');
  push(trimmed.split(/[\s-]/)[0] ?? '');
  return out;
}

function fetchOpts(signal?: AbortSignal): RequestInit {
  return {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    ...(signal ? { signal } : {}),
  };
}

export async function fetchStationSuggest(
  q: string,
  signal?: AbortSignal,
): Promise<TimetableStation[]> {
  const res = await fetch(`${ORIGIN}${PATH}/suggest-station/?q=${encodeURIComponent(q)}`, fetchOpts(signal));
  if (!res.ok) throw new Error(`timetable suggest ${res.status}`);
  return parseSuggestStations(await res.text());
}

export async function fetchRouteTimetable(
  fromIds: string,
  toIds: string,
  signal?: AbortSignal,
): Promise<TimetableTrain[]> {
  const params = new URLSearchParams({
    from_station: fromIds,
    to_station: toIds,
    select_time: '2',
    time_from: '00',
    time_to: '24',
    by_route: '1',
  });
  const res = await fetch(`${ORIGIN}${PATH}/?${params.toString()}`, fetchOpts(signal));
  if (!res.ok) throw new Error(`timetable ${res.status}`);
  return parseTimetableHtml(await res.text());
}

