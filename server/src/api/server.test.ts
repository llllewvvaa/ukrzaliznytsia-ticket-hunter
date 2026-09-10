import { describe, expect, it } from 'vitest';
import { staticRelative } from './server.js';

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
