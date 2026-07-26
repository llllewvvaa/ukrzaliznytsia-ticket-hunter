import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StationCombobox } from './StationCombobox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/messages', () => ({
  query: vi.fn(async () => ({
    ok: true,
    data: [
      { id: 2200001, name: 'Київ-Пасажирський' },
      { id: 2200002, name: 'Київ-Деміївський' },
    ],
  })),
}));

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('StationCombobox keyboard navigation', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function renderAndOpen() {
    vi.useFakeTimers();
    const onChange = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<StationCombobox label="Звідки" value={null} onChange={onChange} />);
    });
    const input = container.querySelector('input')!;
    await act(async () => {
      typeInto(input, 'київ');
      vi.advanceTimersByTime(400);
    });
    return { input, onChange };
  }

  it('opens the listbox with the first option pre-highlighted', async () => {
    await renderAndOpen();
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowDown/ArrowUp move the highlight between options', async () => {
    const { input } = await renderAndOpen();
    // first option is pre-highlighted; Down moves to the second
    await act(async () => press(input, 'ArrowDown'));
    let options = document.body.querySelectorAll('[role="option"]');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.className).toContain('bg-blue-100');

    // wraps around to the first
    await act(async () => press(input, 'ArrowDown'));
    options = document.body.querySelectorAll('[role="option"]');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    // Up from the first wraps to the last
    await act(async () => press(input, 'ArrowUp'));
    options = document.body.querySelectorAll('[role="option"]');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('Enter picks the highlighted option and closes the list', async () => {
    const { input, onChange } = await renderAndOpen();
    await act(async () => press(input, 'ArrowDown'));
    await act(async () => press(input, 'Enter'));
    expect(onChange).toHaveBeenCalledWith({ id: 2200002, name: 'Київ-Деміївський' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape closes the listbox', async () => {
    const { input } = await renderAndOpen();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await act(async () => press(input, 'Escape'));
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
