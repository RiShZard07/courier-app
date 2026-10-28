/**
 * Types mirroring the dispatch-service response and request models (app/schemas.py).
 * Field names are kept in the backend's snake_case so a response can be used as is.
 */

export const ORDER_STATES = ['CREATED', 'ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELED'] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export interface OrderItem {
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Order {
  id: string;
  idempotency_key: string;
  merchant_id: string;
  customer_id: string;
  items: OrderItem[];
  subtotal_cents: number;
  state: OrderState;
  courier_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  next_offset: number | null;
}

export type OrderPage = Page<Order>;

export interface OrderEvent {
  /** Global event id and owning order; present on newer backend versions, unused by this app. */
  id?: number;
  order_id?: string;
  seq: number;
  from_state: OrderState | null;
  to_state: OrderState;
  actor: string;
  created_at: string;
}

export interface Courier {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
  version: number;
}

export interface CourierCreate {
  name: string;
  lat: number;
  lng: number;
  available?: boolean;
}

export interface CourierLocation {
  lat: number;
  lng: number;
}

export interface Health {
  status: string;
  database: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export interface ListOrdersParams {
  courier_id?: string;
  state?: OrderState;
  merchant_id?: string;
  limit?: number;
  offset?: number;
}

/** The transitions exposed as POST /orders/{id}/{transition}. */
export type OrderTransition = 'accept' | 'assign' | 'pickup' | 'deliver' | 'cancel';
