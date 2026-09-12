import { createBudget, msUntilToken, take, type BudgetState } from '../watch/budget.js';

export type RequestPriority = 'interactive' | 'background';

export interface RateLimiter {
  acquire(priority?: RequestPriority): Promise<void>;
  tokens(): number;
  perHour: number;
}

export interface LimiterDeps {
  perHour: number;
  burst?: number;
  overdraft?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createRateLimiter(deps: LimiterDeps): RateLimiter {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let state: BudgetState = createBudget(deps.perHour, now(), deps.burst);
  const overdraft = deps.overdraft ?? 6;

  return {
    perHour: deps.perHour,
    tokens: () => state.tokens,
    async acquire(priority: RequestPriority = 'background'): Promise<void> {
      for (;;) {
        const attempt = take(state, now(), 1);
        state = attempt.state;
        if (attempt.granted === 1) return;

        // A person is waiting on the answer, so an interactive call may borrow
        // against the bucket; the background loop then waits until it is repaid.
        if (priority === 'interactive' && state.tokens > -overdraft) {
          state = { ...state, tokens: state.tokens - 1 };
          return;
        }

        const wait = msUntilToken(state, now());
        await sleep(Math.max(wait, 50));
      }
    },
  };
}
