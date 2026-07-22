// Toolbar action icon mirrors what needs attention most:
// unpaid reservation (amber) > active hunts (blue) > session (green / gray).
// Icon PNGs are pregenerated in public/icon/states/ (scripts/generate-state-icons.py).
// Cosmetic only — failures must never break the flows feeding it.
import { browser } from 'wxt/browser';

export type ActionState = 'reserved' | 'hunts' | 'active' | 'off';

export interface ActionInput {
  sessionActive: boolean;
  activeJobs: number; // scheduled + hunting + reserving
  reservedJobs: number; // awaiting manual payment, hold not expired
}

const TITLES: Record<ActionState, string> = {
  reserved: 'UZ Ticket Hunter — бронь очікує оплати на booking.uz!',
  hunts: 'UZ Ticket Hunter — йде полювання за квитками',
  active: 'UZ Ticket Hunter — сесія booking.uz активна',
  off: 'UZ Ticket Hunter — немає активної сесії booking.uz',
};

const SIZES = [16, 32, 48, 128] as const;

// Pure: pick the icon state by priority; counts only feed the tooltip.
export function resolveActionState(input: ActionInput): ActionState {
  if (input.reservedJobs > 0) return 'reserved';
  if (input.activeJobs > 0) return 'hunts';
  return input.sessionActive ? 'active' : 'off';
}

export function actionTitle(state: ActionState, input: ActionInput): string {
  if (state === 'reserved' && input.reservedJobs > 1) {
    return `UZ Ticket Hunter — броней очікує оплати: ${input.reservedJobs}!`;
  }
  if (state === 'hunts') {
    return `UZ Ticket Hunter — активних полювань: ${input.activeJobs}`;
  }
  return TITLES[state];
}

export async function applyActionState(state: ActionState, title: string): Promise<void> {
  try {
    await browser.action.setIcon({
      path: Object.fromEntries(SIZES.map((s) => [s, `/icon/states/${state}-${s}.png`])),
    });
    await browser.action.setTitle({ title });
    // earlier builds signaled state via a text badge — make sure it's gone
    await browser.action.setBadgeText({ text: '' });
  } catch {
    // action API unavailable — ignore
  }
}
