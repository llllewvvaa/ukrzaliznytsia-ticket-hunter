// Recomputes the action icon from jobs + cached session and keeps it fresh:
// subscribes to job changes, and arms a one-shot alarm for the nearest
// reservation-hold expiry so the amber icon doesn't linger after it lapses.
import { browser } from 'wxt/browser';
import { hasSession } from '@/lib/api/auth';
import { actionTitle, applyActionState, resolveActionState, type ActionInput } from './action-icon';
import { holdExpired } from '@/lib/format/job-format';
import { ACTIVE_STATES } from '@/lib/models';
import { listJobs, subscribe } from '@/lib/store';

const EXPIRY_ALARM = 'icon:reserved-expiry';
const EXPIRY_GRACE_MS = 5_000;

export async function refreshActionIcon(): Promise<void> {
  const [jobs, sessionActive] = await Promise.all([listJobs(), hasSession()]);
  const now = Date.now();
  let activeJobs = 0;
  let reservedJobs = 0;
  let nextExpiry: number | undefined;
  for (const job of jobs) {
    if (ACTIVE_STATES.includes(job.state)) {
      activeJobs += 1;
    } else if (job.state === 'reserved' && !holdExpired(job.reservedUntil, now)) {
      reservedJobs += 1;
      if (
        job.reservedUntil != null &&
        (nextExpiry === undefined || job.reservedUntil < nextExpiry)
      ) {
        nextExpiry = job.reservedUntil;
      }
    }
  }
  const input: ActionInput = { sessionActive, activeJobs, reservedJobs };
  const state = resolveActionState(input);
  await applyActionState(state, actionTitle(state, input));
  await syncExpiryAlarm(nextExpiry);
}

async function syncExpiryAlarm(at: number | undefined): Promise<void> {
  const existing = await browser.alarms.get(EXPIRY_ALARM);
  if (at === undefined) {
    if (existing) await browser.alarms.clear(EXPIRY_ALARM);
    return;
  }
  if (existing?.scheduledTime === at + EXPIRY_GRACE_MS) return;
  await browser.alarms.create(EXPIRY_ALARM, { when: at + EXPIRY_GRACE_MS });
}

export function isIconAlarm(name: string): boolean {
  return name === EXPIRY_ALARM;
}

export function registerIconSync(): void {
  subscribe((change) => {
    if (change.jobs) void refreshActionIcon();
  });
}
