import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../api/client';
import type { Order, OrderEvent } from '../api/types';
import { useApi } from '../state/ApiContext';

export interface OrderDetailState {
  order: Order | null;
  events: OrderEvent[];
  loading: boolean;
  error: string | null;
  /** Re-read the order and its audit trail from the server. */
  reload(): Promise<void>;
  /** Show the order a transition returned right away, then refresh the audit trail. */
  applyTransitionResult(order: Order): Promise<void>;
}

export function useOrderDetail(orderId: string): OrderDetailState {
  const client = useApi();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    setLoading(true);
    try {
      const [freshOrder, freshEvents] = await Promise.all([client.getOrder(orderId), client.listOrderEvents(orderId)]);
      if (request === latestRequest.current) {
        setOrder(freshOrder);
        setEvents(freshEvents);
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
  }, [client, orderId]);

  const applyTransitionResult = useCallback(
    async (updated: Order) => {
      setOrder(updated);
      try {
        setEvents(await client.listOrderEvents(orderId));
      } catch (caught) {
        setError(toApiError(caught).message);
      }
    },
    [client, orderId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { order, events, loading, error, reload, applyTransitionResult };
}
