// reCAPTCHA is detected, never solved — a human solves it in the focused tab.

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) return true;
  // happy-dom reports 0×0 rects; fall back to inline width/height.
  const style = (el as HTMLElement).style;
  const w = parseInt(style?.width || '0', 10);
  const h = parseInt(style?.height || '0', 10);
  return w > 0 && h > 0;
}

// The interactive challenge renders in a visible `bframe` iframe; the invisible badge `aframe` stays 0×0.
export function isCaptchaChallengeVisible(doc: Document = document): boolean {
  const frames = doc.querySelectorAll<HTMLIFrameElement>('iframe');
  for (const frame of Array.from(frames)) {
    const src = frame.getAttribute('src') ?? '';
    const title = frame.getAttribute('title') ?? '';
    const isChallenge =
      /recaptcha/i.test(src) &&
      (/bframe/i.test(src) || /challenge|expires/i.test(title));
    if (isChallenge && isVisible(frame)) return true;
  }
  return false;
}
