export const GUEST_USER_AGENT = 'UZ/2 Web/1 User/guest';
export const BOOKING_ORIGIN = 'https://booking.uz.gov.ua';
export const API_BASE = 'https://app.uz.gov.ua/api';

export interface GuestHeaders extends Record<string, string> {
  accept: string;
  'x-client-locale': string;
  'x-session-id': string;
  'x-user-agent': string;
}

export function buildGuestHeaders(sessionId: string, locale = 'uk'): GuestHeaders {
  return {
    accept: 'application/json',
    'x-client-locale': locale,
    'x-session-id': sessionId,
    'x-user-agent': GUEST_USER_AGENT,
  };
}

export function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
