import { useCallback, useState } from 'react';
import { api, type WaysRequest } from '../lib/api';
import type { Offer } from '../types';

export interface WaysState {
  offers: Offer[];
  requests: number;
  candidates: number;
  gated: boolean;
}

export function useWays() {
  const [state, setState] = useState<WaysState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async (request: WaysRequest): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      setState(await api.ways(request));
    } catch (err) {
      setError(String(err));
      setState(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback((): void => {
    setState(null);
    setError('');
  }, []);

  return { state, busy, error, search, reset };
}
