import { useEffect, useState } from 'react';

import { toApiError } from '../api/client';
import { useApi } from '../state/ApiContext';

export const HEALTH_INTERVAL_MS = 15_000;

export type HealthStatus = 'checking' | 'ok' | 'down';

export interface HealthState {
  status: HealthStatus;
  /** Why the API is considered down, when it is. */
  message: string | null;
  checkedAt: Date | null;
}

/** Poll GET /health on an interval. Polling, not push: the server offers no health stream. */
export function useHealth(intervalMs: number = HEALTH_INTERVAL_MS): HealthState {
  const client = useApi();
  const [state, setState] = useState<HealthState>({ status: 'checking', message: null, checkedAt: null });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const health = await client.health();
        if (!cancelled) {
          const ok = health.status === 'ok';
          setState({ status: ok ? 'ok' : 'down', message: ok ? null : `status ${health.status}`, checkedAt: new Date() });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'down', message: toApiError(error).message, checkedAt: new Date() });
        }
      }
    };
    void check();
    const timer = setInterval(() => void check(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [client, intervalMs]);

  return state;
}
