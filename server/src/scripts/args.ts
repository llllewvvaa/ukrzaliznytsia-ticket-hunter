export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

export function resolveDate(value: string | undefined, today = new Date()): string {
  if (!value) return isoDate(addDays(today, 7));
  if (/^\+\d+$/.test(value)) return isoDate(addDays(today, Number(value.slice(1))));
  return value;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
