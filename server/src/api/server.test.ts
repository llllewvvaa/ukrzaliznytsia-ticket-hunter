import { describe, expect, it } from 'vitest';
import { clientIp, staticRelative } from './server.js';

describe('clientIp', () => {
  it('takes the hop the local proxy appended', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 178.212.111.149' }, '127.0.0.1')).toBe(
      '178.212.111.149',
    );
  });

  it('ignores headers a caller can forge', () => {
    expect(clientIp({ 'cf-connecting-ip': '5.6.7.8', 'x-forwarded-for': '9.9.9.9' }, '::1')).toBe(
      '9.9.9.9',
    );
  });

  it('trusts forwarding only from a loopback proxy', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4' }, '203.0.113.5')).toBe('203.0.113.5');
  });

  it('falls back to the socket address', () => {
    expect(clientIp({}, '127.0.0.1')).toBe('127.0.0.1');
    expect(clientIp({}, undefined)).toBe('?');
  });
});

describe('staticRelative', () => {
  it('serves the app only under the secret prefix', () => {
    expect(staticRelative('/s3cr3t/', 's3cr3t')).toBe('index.html');
    expect(staticRelative('/s3cr3t', 's3cr3t')).toBe('index.html');
    expect(staticRelative('/s3cr3t/assets/index.js', 's3cr3t')).toBe('assets/index.js');
  });

  it('answers nothing outside the prefix', () => {
    expect(staticRelative('/', 's3cr3t')).toBeNull();
    expect(staticRelative('/index.html', 's3cr3t')).toBeNull();
    expect(staticRelative('/s3cr3tx/', 's3cr3t')).toBeNull();
  });

  it('never climbs out of the static directory', () => {
    const result = staticRelative('/s3cr3t/../../etc/passwd', 's3cr3t');
    expect(result).not.toBeNull();
    expect(result!.includes('..')).toBe(false);
    expect(result!.startsWith('/')).toBe(false);
  });

  it('keeps the old root layout when no secret is set', () => {
    expect(staticRelative('/', '')).toBe('index.html');
    expect(staticRelative('/assets/a.css', '')).toBe('assets/a.css');
  });
});
