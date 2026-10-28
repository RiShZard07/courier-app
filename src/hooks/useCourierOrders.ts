import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../api/client';
import type { Order } from '../api/types';
import { useApi } from '../state/ApiContext';

export interface CourierOrdersState {
  orders: Order[];
  /** True while the first load is in flight. */
  loading: boolean;
  /** True while a later load is in flight (pull to refresh, focus). */
  refreshing: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

/** All orders assigned to one courier. Reloads when the courier or refreshToken changes. */
export function useCourierOrders(courierId: string | null, refreshToken: number = 0): CourierOrdersState {
  const client = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may update state; older responses arriving late are ignored.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    if (courierId === null) {
      setOrders([]);
      setError(null);
      setLoaded(true);
      return;
    }
    setBusy(true);
    try {
      const result = await client.listCourierOrders(courierId);
      if (request === latestRequest.current) {
        setOrders(result);
        setError(null);
      }
    } catch (caught) {
      if (request === latestRequest.current) {
        setError(toApiError(caught).message);
      }
    } finally {
      if (request === latestRequest.current) {
        setBusy(false);
        setLoaded(true);
      }
    }
  }, [client, courierId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  return { orders, loading: busy && !loaded, refreshing: busy && loaded, error, refresh };
}
