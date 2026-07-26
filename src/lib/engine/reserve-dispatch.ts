import { browser } from 'wxt/browser';
import {
  RESERVE_METHOD,
  RESERVE_PING,
  RESERVE_STATUS,
  connectToTab,
  isCaptchaResolvedMessage,
  type RpcClient,
} from './bridge';
import { ensureBookingTab, focusBookingTab, reloadBookingTab } from './tab-manager';
import {
  releaseReserveLock,
  setReserveDispatcher,
  startJob,
  type ReserveDispatch,
} from './orchestrator';
import { onReserved, registerNotificationClick } from './success';
import { clearJobAlarms, rateLimitPauseUntil, scheduleMonitorAlarm } from './scheduler';
import { getJob, patchJob } from '@/lib/store';
import { log } from '@/lib/ui/logger';
import type { HuntJob, MatchRef, ReserveOutcome } from '@/lib/models';

export const RESERVE_TIMEOUT_MS = 6 * 60_000;
const PING_TIMEOUT_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A reused tab may not be listening (extension reloaded, tab discarded, or content
// script still initializing at document_idle). Ping with retries, reloading once.
async function openReserveClient(tabId: number): Promise<RpcClient> {
  let reloaded = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const client = connectToTab(tabId);
    try {
      await client.call(RESERVE_PING, undefined, PING_TIMEOUT_MS);
      return client;
    } catch {
      client.disconnect();
    }
    if (!reloaded && attempt >= 1) {
      reloaded = true;
      await reloadBookingTab(tabId);
    } else {
      await delay(400);
    }
  }
  throw new Error('content script unreachable');
}

export async function dispatchReserve({ job, match }: ReserveDispatch): Promise<void> {
  let tabId: number;
  try {
    tabId = await ensureBookingTab();
  } catch (err) {
    await failReserve(job, `no_booking_tab: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  // The RPC port can drop mid-reserve. Retry once only while nothing was ordered:
  // each attempt fetches a fresh encrypted wagon_id, so it can't double-book.
  let progressed = false;
  let lastError = 'reserve_rpc_error';
  for (let attempt = 0; attempt < 2; attempt++) {
    let client: RpcClient;
    try {
      client = await openReserveClient(tabId);
    } catch (err) {
      lastError = `reserve_rpc_error: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }

    const off = client.on(RESERVE_STATUS, (payload) => {
      const o = payload as ReserveOutcome;
      if (o.status === 'order_enqueued' || o.status === 'cart_pending') progressed = true;
      void handleProgress(job, o);
    });

    try {
      const final = await client.call<ReserveOutcome>(
        RESERVE_METHOD,
        { job, match },
        RESERVE_TIMEOUT_MS,
      );
      await handleTerminal(job, final, tabId);
      return;
    } catch (err) {
      lastError = `reserve_rpc_error: ${err instanceof Error ? err.message : String(err)}`;
      if (progressed) break; // an order may exist — do not retry
      await delay(600);
    } finally {
      off();
      client.disconnect();
    }
  }

  await failReserve(job, lastError);
}

async function handleProgress(job: HuntJob, o: ReserveOutcome): Promise<void> {
  if (o.status !== 'order_enqueued' && o.status !== 'cart_pending') return;
  if (o.cartId != null) await patchJob(job.id, { cartId: o.cartId });
  await log({
    jobId: job.id,
    endpoint: 'POST /api/v4/orders',
    outcome: o.status === 'order_enqueued' ? 'order_enqueued' : 'cart_pending',
    ...(o.retryInSec != null ? { detail: `retry in ${o.retryInSec}s` } : {}),
  });
}

async function handleTerminal(job: HuntJob, o: ReserveOutcome, tabId: number): Promise<void> {
  switch (o.status) {
    case 'reserve_ok':
      await onReserved(job, o, tabId);
      releaseReserveLock(job.id);
      break;
    case 'captcha':
      await onCaptcha(job, tabId);
      break;
    case 'rate_limited':
      await onRateLimited(job, o);
      break;
    default:
      await failReserve(job, o.detail ?? 'reserve_fail', o.cartId, {
        ...(o.relax ? { relax: o.relax } : {}),
        ...(o.match ? { match: o.match } : {}),
      });
      break;
  }
}

async function onCaptcha(job: HuntJob, tabId: number): Promise<void> {
  releaseReserveLock(job.id);
  await clearJobAlarms(job.id);
  await patchJob(job.id, { state: 'paused', pauseReason: 'captcha' });
  await log({
    jobId: job.id,
    endpoint: RESERVE_METHOD,
    outcome: 'captcha',
    detail: 'solve reCAPTCHA in the booking.uz tab',
  });
  await focusBookingTab(tabId);
}

async function onRateLimited(job: HuntJob, o: ReserveOutcome): Promise<void> {
  releaseReserveLock(job.id);
  const { pollIntervalMs, pausedUntil } = rateLimitPauseUntil(job, o.retryInSec);
  const updated = await patchJob(job.id, {
    state: 'hunting',
    pollIntervalMs,
    pausedUntil,
    ...(o.cartId != null ? { cartId: o.cartId } : {}),
  });
  await log({
    jobId: job.id,
    endpoint: 'POST /api/v4/orders',
    httpStatus: 429,
    outcome: 'rate_limited',
    detail: `backoff ~${Math.round((pausedUntil - Date.now()) / 1000)}s`,
  });
  if (updated) await scheduleMonitorAlarm(updated);
}

async function failReserve(
  job: HuntJob,
  detail: string,
  cartId?: number,
  extra?: { relax?: string[]; match?: MatchRef },
): Promise<void> {
  releaseReserveLock(job.id);
  const updated = await patchJob(job.id, {
    state: 'hunting',
    lastError: detail,
    relaxHint: extra?.relax ?? [],
    ...(extra?.match ? { lastMatch: extra.match } : {}),
    ...(cartId != null ? { cartId } : {}),
  });
  await log({
    jobId: job.id,
    endpoint: RESERVE_METHOD,
    outcome: 'reserve_fail',
    detail,
  });
  if (updated) await scheduleMonitorAlarm(updated);
}

async function onCaptchaResolved(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.pauseReason !== 'captcha') return;
  await log({ jobId, endpoint: 'control', outcome: 'resumed', detail: 'captcha solved' });
  await startJob({ ...job, pauseReason: undefined, pausedUntil: undefined });
}

export function installReserveDispatcher(): void {
  setReserveDispatcher(dispatchReserve);
  registerNotificationClick();
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isCaptchaResolvedMessage(message)) {
      void onCaptchaResolved(message.jobId);
    }
  });
}
