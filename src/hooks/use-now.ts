import { useEffect, useState } from 'react';

// Ticks once a second while `active` so countdown labels stay live; inactive
// means no interval and no re-renders.
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
