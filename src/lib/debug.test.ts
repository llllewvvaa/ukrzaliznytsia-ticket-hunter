import { describe, expect, it } from 'vitest';
import { redactBody, redactEvent, redactHeaders } from './debug';
import type { DebugEvent } from './models';

const SESSION = '11111111-2222-4333-8444-555555555555';
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N';

describe('redactBody', () => {
  it('strips JWTs anywhere in the text', () => {
    const out = redactBody(`prefix ${JWT} suffix`);
    expect(out).not.toContain('eyJ');
    expect(out).toContain('jwt…');
  });

  it('masks emails and known personal fields', () => {
    const body = JSON.stringify({
      first_name: 'Іван',
      last_name: 'Тестенко',
      email: 'ivan@example.com',
      phone: '+380501234567',
      birthday: '1990-01-01',
      document_number: 'AA123456',
    });
    const out = redactBody(body);
    for (const leak of ['Іван', 'Тестенко', 'ivan@example.com', '+380501234567', '1990-01-01', 'AA123456']) {
      expect(out).not.toContain(leak);
    }
  });

  it('masks payment and token fields', () => {
    const body = JSON.stringify({ card_number: '4111111111111111', cvv: '123', access_token: 'supersecret' });
    const out = redactBody(body);
    expect(out).not.toContain('4111111111111111');
    expect(out).not.toContain('supersecret');
    expect(out).toContain('"card_number":"…"');
  });

  it('keeps non-personal names (station, train, coach class)', () => {
    const body = JSON.stringify({ name: 'Київ-Пасажирський', station: 'Львів', coach_class: 'Купе' });
    const out = redactBody(body);
    expect(out).toContain('Київ-Пасажирський');
    expect(out).toContain('Львів');
    expect(out).toContain('Купе');
  });

  it('hashes UUIDs stably and reversibly-consistently', () => {
    const a = redactBody(SESSION);
    expect(a).not.toContain(SESSION);
    expect(a).toContain('uuid:');
    expect(redactBody(SESSION)).toBe(a);
  });
});

describe('redactHeaders', () => {
  it('strips Authorization to a length hint only', () => {
    const out = redactHeaders({ authorization: `Bearer ${JWT}` });
    expect(out.authorization).not.toContain('eyJ');
    expect(out.authorization).toMatch(/jwt/);
  });

  it('pseudonymizes x-session-id without exposing the raw value', () => {
    const out = redactHeaders({ 'x-session-id': SESSION });
    expect(out['x-session-id']).not.toContain(SESSION);
    expect(out['x-session-id']).toMatch(/^sid:/);
    // deterministic → a reviewer can still tell two requests share a session
    expect(redactHeaders({ 'x-session-id': SESSION })['x-session-id']).toBe(out['x-session-id']);
  });

  it('masks the account id inside x-user-agent but keeps the client info', () => {
    const out = redactHeaders({ 'x-user-agent': 'UZ/2 Web/1 User/4651294' });
    expect(out['x-user-agent']).not.toContain('4651294');
    expect(out['x-user-agent']).toContain('User/#');
    expect(out['x-user-agent']).toContain('UZ/2');
  });
});

describe('redactEvent', () => {
  it('scrubs raw sessionId and userId from session events', () => {
    const ev: DebugEvent = {
      t: 1,
      ctx: 'content',
      kind: 'session',
      sessionId: SESSION,
      hasToken: true,
      userId: 4651294,
    };
    const out = redactEvent(ev);
    expect(String(out.sessionId)).toMatch(/^sid:/);
    expect(String(out.sessionId)).not.toContain('11111111');
    expect(String(out.userId)).toMatch(/^usr:/);
    expect(String(out.userId)).not.toContain('4651294');
    expect(out.hasToken).toBe(true);
  });

  it('correlates a session id seen as a header and as a session-event field', () => {
    const header = redactHeaders({ 'x-session-id': SESSION })['x-session-id'];
    const field = redactEvent({ t: 1, ctx: 'content', kind: 'session', sessionId: SESSION }).sessionId;
    expect(field).toBe(header); // same underlying session → same pseudonym
  });

  it('scrubs nav URLs without mutating the original event', () => {
    const ev: DebugEvent = {
      t: 1,
      ctx: 'sw',
      kind: 'nav',
      to: 'https://booking.uz.gov.ua/cart?email=ivan@example.com',
    };
    const out = redactEvent(ev);
    expect(out.to).not.toContain('ivan@example.com');
    expect(ev.to).toContain('ivan@example.com');
  });
});
