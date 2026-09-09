import { createBudget, msUntilToken, take, type BudgetState } from '../watch/budget.js';

export interface RateLimiter {
  acquire(): Promise<void>;
  tokens(): number;
  perHour: number;
}

export interface LimiterDeps {
  perHour: number;
  burst?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createRateLimiter(deps: LimiterDeps): RateLimiter {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let state: BudgetState = createBudget(deps.perHour, now(), deps.burst);

  return {
    perHour: deps.perHour,
    tokens: () => state.tokens,
    async acquire(): Promise<void> {
      for (;;) {
        const attempt = take(state, now(), 1);
        state = attempt.state;
        if (attempt.granted === 1) return;
        const wait = msUntilToken(state, now());
        await sleep(Math.max(wait, 50));
      }
    },
  };
}
