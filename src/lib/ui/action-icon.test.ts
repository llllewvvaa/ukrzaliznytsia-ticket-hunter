import { describe, expect, it } from 'vitest';
import { actionTitle, resolveActionState, type ActionInput } from './action-icon';

const base: ActionInput = { sessionActive: true, activeJobs: 0, reservedJobs: 0 };

describe('resolveActionState', () => {
  it('prioritizes an unpaid reservation over everything', () => {
    expect(resolveActionState({ sessionActive: true, activeJobs: 3, reservedJobs: 1 })).toBe(
      'reserved',
    );
  });

  it('shows hunts when jobs are scheduled/hunting/reserving', () => {
    expect(resolveActionState({ ...base, activeJobs: 2 })).toBe('hunts');
    expect(resolveActionState({ sessionActive: false, activeJobs: 1, reservedJobs: 0 })).toBe(
      'hunts',
    );
  });

  it('falls back to the session state when nothing is running', () => {
    expect(resolveActionState(base)).toBe('active');
    expect(resolveActionState({ ...base, sessionActive: false })).toBe('off');
  });
});

describe('actionTitle', () => {
  it('includes the hunt count', () => {
    expect(actionTitle('hunts', { ...base, activeJobs: 2 })).toContain('2');
  });

  it('includes the reservation count when more than one', () => {
    expect(actionTitle('reserved', { ...base, reservedJobs: 3 })).toContain('3');
  });

  it('has a static title otherwise', () => {
    expect(actionTitle('active', base)).toContain('активна');
    expect(actionTitle('off', { ...base, sessionActive: false })).toContain('немає');
  });
});
