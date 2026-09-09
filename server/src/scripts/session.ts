import { createContext, type AppContext } from '../runtime/context.js';

export async function openProbeContext(): Promise<AppContext> {
  return createContext();
}
