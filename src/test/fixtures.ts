import type { Courier, Order, OrderEvent } from '../api/types';

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_0000000000000001',
    idempotency_key: 'key-1',
    merchant_id: 'mer_0000000000000001',
    customer_id: 'cus_0000000000000001',
    items: [{ sku: 'coffee-beans-1kg', quantity: 2, unit_price_cents: 1850 }],
    subtotal_cents: 3700,
    state: 'ASSIGNED',
    courier_id: 'cur_0000000000000001',
    version: 3,
    created_at: '2026-10-28T15:00:00.000Z',
    updated_at: '2026-10-28T15:05:00.000Z',
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    seq: 1,
    from_state: null,
    to_state: 'CREATED',
    actor: 'merchant:tablet',
    created_at: '2026-10-28T15:00:00.000Z',
    ...overrides,
  };
}

export function makeCourier(overrides: Partial<Courier> = {}): Courier {
  return {
    id: 'cur_0000000000000001',
    name: 'Test Courier',
    lat: 40.4406,
    lng: -79.9959,
    available: false,
    version: 1,
    ...overrides,
  };
}
