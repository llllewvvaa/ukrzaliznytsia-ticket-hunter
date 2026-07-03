import { describe, it, expect, afterEach } from 'vitest';
import { isCaptchaChallengeVisible } from './recaptcha';

function addIframe(attrs: {
  src: string;
  title?: string;
  width?: number;
  height?: number;
}): void {
  const f = document.createElement('iframe');
  f.setAttribute('src', attrs.src);
  if (attrs.title) f.setAttribute('title', attrs.title);
  f.style.width = `${attrs.width ?? 0}px`;
  f.style.height = `${attrs.height ?? 0}px`;
  document.body.appendChild(f);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isCaptchaChallengeVisible', () => {
  it('is false with no iframes', () => {
    expect(isCaptchaChallengeVisible(document)).toBe(false);
  });

  it('is false for the invisible recaptcha anchor/badge', () => {
    addIframe({
      src: 'https://www.google.com/recaptcha/api2/anchor?k=site',
      title: 'reCAPTCHA',
      width: 0,
      height: 0,
    });
    expect(isCaptchaChallengeVisible(document)).toBe(false);
  });

  it('is true for a visible bframe challenge', () => {
    addIframe({
      src: 'https://www.google.com/recaptcha/api2/bframe?k=site',
      title: 'recaptcha challenge expires in two minutes',
      width: 400,
      height: 580,
    });
    expect(isCaptchaChallengeVisible(document)).toBe(true);
  });

  it('ignores unrelated visible iframes', () => {
    addIframe({ src: 'https://example.com/ad', title: 'ad', width: 300, height: 250 });
    expect(isCaptchaChallengeVisible(document)).toBe(false);
  });

  it('detects a challenge by title even without bframe in src', () => {
    addIframe({
      src: 'https://www.google.com/recaptcha/api2/somewhere',
      title: 'challenge expires in two minutes',
      width: 320,
      height: 480,
    });
    expect(isCaptchaChallengeVisible(document)).toBe(true);
  });
});
