/**
 * Typed HTTP client for dispatch-service.
 *
 * Every request carries an X-Request-ID (echoed back by the server and written into its
 * request log) and is abandoned after a timeout. Non-2xx responses are turned into ApiError
 * by reading the server's error envelope, so screens can switch on `error.code` without
 * parsing prose. Network failures and timeouts are ApiErrors too, with status 0.
 */

import type {
  Courier,
  CourierCreate,
  CourierLocation,
  ErrorEnvelope,
  Health,
  ListOrdersParams,
  Order,
  OrderEvent,
  OrderPage,
  OrderTransition,
} from './types';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_ACTOR = 'courier-app';

/** The slice of a fetch Response the client relies on. Tests implement it with plain objects. */
export interface ResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface RequestInitLike {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export type FetchLike = (url: string, init: RequestInitLike) => Promise<ResponseLike>;

export interface ClientOptions {
  /** Origin of the API, for example http://192.168.1.20:8000. A trailing slash is ignored. */
  baseUrl: string;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: FetchLike;
  /** Injected in tests; defaults to newRequestId. */
  requestIdFactory?: () => string;
  /** Recorded by the server in the audit trail of every transition (X-Actor header). */
  actor?: string;
}

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status, or 0 when no response was received (network failure, timeout). */
    readonly status: number,
    /** The server's machine-readable code, or network_error / timeout / invalid_response. */
    readonly code: string,
    message: string,
    /** The X-Request-ID of the failed request, useful when matching against server logs. */
    readonly requestId: string | null,
  ) {
    super(message);
  }

  get isVersionConflict(): boolean {
    return this.status === 409 && this.code === 'version_conflict';
  }
}

export function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const error = (body as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

/** Map a non-2xx response to a typed error, falling back to a generic code when the body is not the envelope. */
export function errorFromResponse(status: number, body: unknown, requestId: string | null): ApiError {
  if (isErrorEnvelope(body)) {
    return new ApiError(status, body.error.code, body.error.message, requestId);
  }
  return new ApiError(status, 'http_error', `request failed with HTTP ${status}`, requestId);
}

/** Turn anything thrown while talking to the API into an ApiError so callers handle one type. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(0, 'network_error', message, null);
}

const REQUEST_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A request id the server accepts: [A-Za-z0-9._-]{1,128}, unique enough to find in a log. */
export function newRequestId(): string {
  let random = '';
  for (let i = 0; i < 12; i += 1) {
    random += REQUEST_ID_ALPHABET[Math.floor(Math.random() * REQUEST_ID_ALPHABET.length)];
  }
  return `cour-${Date.now().toString(36)}-${random}`;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

type Query = Record<string, string | number | undefined>;

function buildQuery(query: Query | undefined): string {
  if (!query) {
    return '';
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

interface RequestSpec {
  method: 'GET' | 'POST';
  path: string;
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
}

export class DispatchClient {
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly requestIdFactory: () => string;
  private readonly actor: string;

  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Wrapped in an arrow so the browser's fetch is called unbound-safe (window.fetch
    // throws "Illegal invocation" when invoked as a method of another object).
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.requestIdFactory = options.requestIdFactory ?? newRequestId;
    this.actor = options.actor ?? DEFAULT_ACTOR;
  }

  health(): Promise<Health> {
    return this.request<Health>({ method: 'GET', path: '/health' });
  }

  createCourier(input: CourierCreate): Promise<Courier> {
    return this.request<Courier>({ method: 'POST', path: '/couriers', body: input });
  }

  getCourier(courierId: string): Promise<Courier> {
    return this.request<Courier>({ method: 'GET', path: `/couriers/${encodeURIComponent(courierId)}` });
  }

  setCourierLocation(courierId: string, location: CourierLocation): Promise<Courier> {
    return this.request<Courier>({
      method: 'POST',
      path: `/couriers/${encodeURIComponent(courierId)}/location`,
      body: location,
    });
  }

  setCourierAvailability(courierId: string, available: boolean): Promise<Courier> {
    return this.request<Courier>({
      method: 'POST',
      path: `/couriers/${encodeURIComponent(courierId)}/availability`,
      body: { available },
    });
  }

  listOrders(params: ListOrdersParams = {}): Promise<OrderPage> {
    return this.request<OrderPage>({ method: 'GET', path: '/orders', query: { ...params } });
  }

  /** Every order of one courier, following next_offset until the server reports no more pages. */
  async listCourierOrders(courierId: string, maxPages = 10): Promise<Order[]> {
    const orders: Order[] = [];
    let offset: number | null = 0;
    let pages = 0;
    while (offset !== null && pages < maxPages) {
      const page: OrderPage = await this.listOrders({ courier_id: courierId, limit: 100, offset });
      orders.push(...page.items);
      offset = page.next_offset;
      pages += 1;
    }
    return orders;
  }

  getOrder(orderId: string): Promise<Order> {
    return this.request<Order>({ method: 'GET', path: `/orders/${encodeURIComponent(orderId)}` });
  }

  listOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return this.request<OrderEvent[]>({ method: 'GET', path: `/orders/${encodeURIComponent(orderId)}/events` });
  }

  /**
   * Move an order along the state machine. `version` is sent as If-Match so the server refuses
   * the move (409 version_conflict) if the order changed since the client last read it.
   */
  transitionOrder(orderId: string, transition: OrderTransition, version: number): Promise<Order> {
    return this.request<Order>({
      method: 'POST',
      path: `/orders/${encodeURIComponent(orderId)}/${transition}`,
      headers: { 'If-Match': String(version), 'X-Actor': this.actor },
    });
  }

  pickupOrder(orderId: string, version: number): Promise<Order> {
    return this.transitionOrder(orderId, 'pickup', version);
  }

  deliverOrder(orderId: string, version: number): Promise<Order> {
    return this.transitionOrder(orderId, 'deliver', version);
  }

  private async request<T>(spec: RequestSpec): Promise<T> {
    const requestId = this.requestIdFactory();
    const url = `${this.baseUrl}${spec.path}${buildQuery(spec.query)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-ID': requestId,
      ...spec.headers,
    };
    // React Native's AbortController polyfill has no AbortSignal.timeout, so the timer is explicit.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const init: RequestInitLike = { method: spec.method, headers, signal: controller.signal };
    if (spec.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(spec.body);
    }

    let response: ResponseLike;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) {
        throw new ApiError(0, 'timeout', `request timed out after ${this.timeoutMs} ms`, requestId);
      }
      throw new ApiError(0, 'network_error', describeNetworkError(error), requestId);
    } finally {
      clearTimeout(timer);
    }

    const responseRequestId = response.headers.get('x-request-id') ?? requestId;
    const text = await response.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ApiError(response.status, 'invalid_response', 'response was not valid JSON', responseRequestId);
        }
      }
    }
    if (!response.ok) {
      throw errorFromResponse(response.status, body, responseRequestId);
    }
    return body as T;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function describeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `could not reach the API (${message})`;
}
