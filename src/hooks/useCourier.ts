import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../api/client';
import type { Courier } from '../api/types';
import { useApi } from '../state/ApiContext';

export interface CourierState {
  courier: Courier | null;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  /** Replace the local copy with what a courier update returned. */
  apply(courier: Courier): void;
}

/** The server's current record of one courier, reloaded when the id or refreshToken changes. */
export function useCourier(courierId: string | null, refreshToken: number = 0): CourierState {
  const client = useApi();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(courierId !== null);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    if (courierId === null) {
      setCourier(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fresh = await client.getCourier(courierId);
      if (request === latestRequest.current) {
        setCourier(fresh);
        setError(null);
      }
    } catch (caught) {
      if (request === latestRequest.current) {
        setError(toApiError(caught).message);
      }
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [client, courierId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  return { courier, loading, error, reload, apply: setCourier };
}
