import type { ReactNode } from 'react';

export interface Step {
  tab: 'hunts' | 'orders' | 'settings';
  authOk?: boolean;
  eyebrow: string;
  title: string;
  body: string;
  pills: string[];
  screen: ReactNode;
}
