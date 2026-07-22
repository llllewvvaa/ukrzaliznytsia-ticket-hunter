import { describe, it, expect } from 'vitest';
import { focusableIn, moveHighlight } from './a11y';

describe('moveHighlight', () => {
  it('returns -1 for an empty list', () => {
    expect(moveHighlight(0, 1, 0)).toBe(-1);
    expect(moveHighlight(-1, -1, 0)).toBe(-1);
  });

  it('starts at the first row on Down and the last on Up when nothing is highlighted', () => {
    expect(moveHighlight(-1, 1, 5)).toBe(0);
    expect(moveHighlight(-1, -1, 5)).toBe(4);
  });

  it('moves within bounds', () => {
    expect(moveHighlight(2, 1, 5)).toBe(3);
    expect(moveHighlight(2, -1, 5)).toBe(1);
  });

  it('wraps around both ends', () => {
    expect(moveHighlight(4, 1, 5)).toBe(0);
    expect(moveHighlight(0, -1, 5)).toBe(4);
  });

  it('recovers from a stale out-of-range index', () => {
    expect(moveHighlight(10, 1, 5)).toBe(0);
    expect(moveHighlight(10, -1, 5)).toBe(4);
  });
});

describe('focusableIn', () => {
  function host(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  it('collects natively focusable elements in DOM order', () => {
    const el = host(
      '<button>one</button><a href="/x">two</a><input value="three"><textarea></textarea>',
    );
    expect(focusableIn(el).map((n) => n.tagName)).toEqual(['BUTTON', 'A', 'INPUT', 'TEXTAREA']);
    el.remove();
  });

  it('skips disabled controls and tabindex="-1"', () => {
    const el = host(
      '<button disabled>dead</button><div tabindex="-1">dead</div><div tabindex="0">live</div>',
    );
    const found = focusableIn(el);
    expect(found).toHaveLength(1);
    expect(found[0]?.textContent).toBe('live');
    el.remove();
  });

  it('returns an empty list when nothing is focusable', () => {
    const el = host('<span>text</span>');
    expect(focusableIn(el)).toEqual([]);
    el.remove();
  });
});
