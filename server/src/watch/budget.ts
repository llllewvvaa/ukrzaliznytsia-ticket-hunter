export interface BudgetState {
  tokens: number;
  updatedAt: number;
  perHour: number;
  burst: number;
}

export function createBudget(perHour: number, now: number, burst = Math.max(1, Math.round(perHour / 12))): BudgetState {
  return { tokens: burst, updatedAt: now, perHour, burst };
}

export function refill(state: BudgetState, now: number): BudgetState {
  const elapsed = Math.max(0, now - state.updatedAt);
  const gained = (elapsed / 3_600_000) * state.perHour;
  return {
    ...state,
    tokens: Math.min(state.burst, state.tokens + gained),
    updatedAt: now,
  };
}

export function take(state: BudgetState, now: number, count = 1): { state: BudgetState; granted: number } {
  const filled = refill(state, now);
  const granted = Math.min(count, Math.floor(filled.tokens));
  return { state: { ...filled, tokens: filled.tokens - granted }, granted };
}

export function msUntilToken(state: BudgetState, now: number): number {
  const filled = refill(state, now);
  if (filled.tokens >= 1) return 0;
  const missing = 1 - filled.tokens;
  return Math.ceil((missing / state.perHour) * 3_600_000);
}
