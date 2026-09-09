import { describe, expect, it } from 'vitest';
import { parseArgs, resolveDate } from './args.js';

describe('parseArgs', () => {
  it('reads flag pairs and bare flags', () => {
    expect(parseArgs(['--from', '2200001', '--verbose'])).toEqual({ from: '2200001', verbose: 'true' });
  });
});

describe('resolveDate', () => {
  const today = new Date('2026-09-09T10:00:00Z');

  it('defaults to a week out', () => {
    expect(resolveDate(undefined, today)).toBe('2026-09-16');
  });

  it('understands a relative offset', () => {
    expect(resolveDate('+3', today)).toBe('2026-09-12');
  });

  it('passes an explicit date through', () => {
    expect(resolveDate('2026-12-31', today)).toBe('2026-12-31');
  });
});
