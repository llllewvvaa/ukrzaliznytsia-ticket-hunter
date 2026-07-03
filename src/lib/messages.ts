import { browser } from 'wxt/browser';
import type { DebugEvent } from './models';

function hasType(msg: unknown, type: string): msg is Record<string, unknown> {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: unknown }).type === type
  );
}

export const JOB_CONTROL = 'jobControl' as const;

export type ControlAction = 'start' | 'pause' | 'resume' | 'cancel' | 'delete';

export interface JobControlMessage {
  type: typeof JOB_CONTROL;
  action: ControlAction;
  jobId: string;
}

export function isJobControlMessage(msg: unknown): msg is JobControlMessage {
  return hasType(msg, JOB_CONTROL) && typeof msg.jobId === 'string';
}

export function sendControl(action: ControlAction, jobId: string): Promise<void> {
  const msg: JobControlMessage = { type: JOB_CONTROL, action, jobId };
  return browser.runtime.sendMessage(msg).then(() => undefined).catch(() => undefined);
}

export const QUERY = 'uzQuery' as const;

export type QueryName =
  | 'authStatus'
  | 'profile'
  | 'passengers'
  | 'stations'
  | 'trips'
  | 'wagons'
  | 'activeOrders'
  | 'archivedOrders'
  | 'openCheckout'
  | 'timetableStations'
  | 'timetable'
  | 'debugLog'
  | 'debugClear';

export interface QueryMessage {
  type: typeof QUERY;
  name: QueryName;
  params?: unknown;
}

export type QueryErrorCode =
  | 'not_authenticated'
  | 'not_discovered'
  | 'rate_limited'
  | 'error';

export interface QueryResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: QueryErrorCode;
}

export function isQueryMessage(msg: unknown): msg is QueryMessage {
  return hasType(msg, QUERY) && typeof msg.name === 'string';
}

export const SEED_CART = 'uzSeedCart' as const;

// SW → content script: write booking-store.cartId into the tab's sessionStorage.
export interface SeedCartMessage {
  type: typeof SEED_CART;
  cartId: number;
}

export function isSeedCartMessage(msg: unknown): msg is SeedCartMessage {
  return hasType(msg, SEED_CART) && typeof msg.cartId === 'number';
}

export const DEBUG_EVENT = 'uzDebugEvent' as const;

export interface DebugEventMessage {
  type: typeof DEBUG_EVENT;
  event: DebugEvent;
}

export function isDebugEventMessage(msg: unknown): msg is DebugEventMessage {
  return hasType(msg, DEBUG_EVENT) && typeof msg.event === 'object';
}

export async function query<T = unknown>(
  name: QueryName,
  params?: unknown,
): Promise<QueryResult<T>> {
  const msg: QueryMessage = { type: QUERY, name, ...(params !== undefined ? { params } : {}) };
  try {
    const res = (await browser.runtime.sendMessage(msg)) as QueryResult<T> | undefined;
    return res ?? { ok: false, code: 'error', error: 'no response' };
  } catch (err) {
    return { ok: false, code: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
