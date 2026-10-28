import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeCourier, makeOrder } from '../../test/fixtures';
import { ApiError, DispatchClient, errorFromResponse, isErrorEnvelope, newRequestId, normalizeBaseUrl } from '../client';

const BASE = 'http://api.test:8000';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function makeClient(fetchImpl: ReturnType<typeof createFakeFetch>, extra: Partial<ConstructorParameters<typeof DispatchClient>[0]> = {}) {
  return new DispatchClient({ baseUrl: BASE, fetchImpl, ...extra });
}

describe('DispatchClient requests', () => {
  it('GETs /health and returns the typed body', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { body: { status: 'ok', database: 'ok' } } });
    const health = await makeClient(fetchImpl).health();
    expect(health).toEqual({ status: 'ok', database: 'ok' });
    expect(fetchImpl.calls[0]?.url).toBe(`${BASE}/health`);
  });

  it('strips trailing slashes from the base URL', () => {
    expect(normalizeBaseUrl('http://localhost:8000///')).toBe('http://localhost:8000');
    expect(new DispatchClient({ baseUrl: ' http://localhost:8000/ ' }).baseUrl).toBe('http://localhost:8000');
  });

  it('sends an X-Request-ID the server accepts on every request', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { body: { status: 'ok', database: 'ok' } } });
    const client = makeClient(fetchImpl);
    await client.health();
    await client.health();
    const ids = fetchImpl.calls.map((call) => call.headers['x-request-id']);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(id).toMatch(REQUEST_ID_PATTERN);
    }
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('uses the injected request id factory', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { body: { status: 'ok', database: 'ok' } } });
    await makeClient(fetchImpl, { requestIdFactory: () => 'fixed-id' }).health();
    expect(fetchImpl.calls[0]?.headers['x-request-id']).toBe('fixed-id');
  });

  it('sends JSON bodies with a Content-Type and none on GET', async () => {
    const fetchImpl = createFakeFetch({
      'POST /couriers': { status: 201, body: makeCourier() },
      'GET /health': { body: { status: 'ok', database: 'ok' } },
    });
    const client = makeClient(fetchImpl);
    await client.createCourier({ name: 'Test Courier', lat: 0, lng: 0, available: false });
    await client.health();
    const [post, get] = fetchImpl.calls;
    expect(post?.headers['content-type']).toBe('application/json');
    expect(post?.headers.accept).toBe('application/json');
    expect(post?.body).toEqual({ name: 'Test Courier', lat: 0, lng: 0, available: false });
    expect(get?.headers['content-type']).toBeUndefined();
    expect(get?.body).toBeNull();
  });

  it('builds the orders query string and omits undefined filters', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': { body: { items: [], limit: 20, offset: 0, next_offset: null } } });
    await makeClient(fetchImpl).listOrders({ courier_id: 'cur_1', state: 'ASSIGNED', limit: 20, offset: 40 });
    expect(fetchImpl.calls[0]?.query).toEqual({ courier_id: 'cur_1', state: 'ASSIGNED', limit: '20', offset: '40' });
    await makeClient(fetchImpl).listOrders();
    expect(fetchImpl.calls[1]?.url).toBe(`${BASE}/orders`);
  });

  it('follows next_offset when listing a courier\'s orders and stops at null', async () => {
    const first = makeOrder({ id: 'ord_1' });
    const second = makeOrder({ id: 'ord_2' });
    const fetchImpl = createFakeFetch({
      'GET /orders': (call) =>
        call.query.offset === '0'
          ? { body: { items: [first], limit: 100, offset: 0, next_offset: 1 } }
          : { body: { items: [second], limit: 100, offset: 1, next_offset: null } },
    });
    const orders = await makeClient(fetchImpl).listCourierOrders('cur_1');
    expect(orders.map((order) => order.id)).toEqual(['ord_1', 'ord_2']);
    expect(fetchImpl.calls).toHaveLength(2);
    expect(fetchImpl.calls.every((call) => call.query.courier_id === 'cur_1' && call.query.limit === '100')).toBe(true);
  });

  it('posts a transition with If-Match carrying the version and an X-Actor', async () => {
    const fetchImpl = createFakeFetch({ 'POST /orders/ord_1/pickup': { body: makeOrder({ state: 'PICKED_UP', version: 4 }) } });
    const updated = await makeClient(fetchImpl, { actor: 'courier:phone' }).pickupOrder('ord_1', 3);
    expect(updated.state).toBe('PICKED_UP');
    const call = fetchImpl.calls[0];
    expect(call?.method).toBe('POST');
    expect(call?.path).toBe('/orders/ord_1/pickup');
    expect(call?.headers['if-match']).toBe('3');
    expect(call?.headers['x-actor']).toBe('courier:phone');
  });

  it('routes deliver to the deliver endpoint', async () => {
    const fetchImpl = createFakeFetch({ 'POST /orders/ord_1/deliver': { body: makeOrder({ state: 'DELIVERED', version: 5 }) } });
    await makeClient(fetchImpl).deliverOrder('ord_1', 4);
    expect(fetchImpl.calls[0]?.path).toBe('/orders/ord_1/deliver');
    expect(fetchImpl.calls[0]?.headers['if-match']).toBe('4');
  });

  it('posts courier availability and location to their endpoints', async () => {
    const fetchImpl = createFakeFetch({
      'POST /couriers/cur_1/availability': { body: makeCourier({ available: true }) },
      'POST /couriers/cur_1/location': { body: makeCourier({ lat: 1.5, lng: 2.5 }) },
    });
    const client = makeClient(fetchImpl);
    await client.setCourierAvailability('cur_1', true);
    await client.setCourierLocation('cur_1', { lat: 1.5, lng: 2.5 });
    expect(fetchImpl.calls[0]?.body).toEqual({ available: true });
    expect(fetchImpl.calls[1]?.body).toEqual({ lat: 1.5, lng: 2.5 });
  });
});

describe('DispatchClient errors', () => {
  it('maps the error envelope to an ApiError with the response request id', async () => {
    const fetchImpl = createFakeFetch({
      'POST /orders/ord_1/pickup': {
        status: 409,
        body: envelope('version_conflict', 'order ord_1 is at version 4, not 3'),
        headers: { 'X-Request-ID': 'srv-123' },
      },
    });
    const failure = await makeClient(fetchImpl).pickupOrder('ord_1', 3).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    const apiError = failure as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.code).toBe('version_conflict');
    expect(apiError.message).toBe('order ord_1 is at version 4, not 3');
    expect(apiError.requestId).toBe('srv-123');
    expect(apiError.isVersionConflict).toBe(true);
  });

  it('falls back to a generic code when the error body is not the envelope', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { status: 502, body: '<html>bad gateway</html>' } });
    const failure = (await makeClient(fetchImpl).health().catch((error: unknown) => error)) as ApiError;
    expect(failure.code).toBe('http_error');
    expect(failure.status).toBe(502);
    expect(failure.message).toBe('request failed with HTTP 502');
    expect(failure.isVersionConflict).toBe(false);
  });

  it('reports a network failure as a status 0 ApiError', async () => {
    const fetchImpl = createFakeFetch();
    const broken = Object.assign(
      async () => {
        throw new TypeError('Network request failed');
      },
      fetchImpl,
    );
    const failure = (await makeClient(broken).health().catch((error: unknown) => error)) as ApiError;
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(0);
    expect(failure.code).toBe('network_error');
    expect(failure.message).toContain('Network request failed');
  });

  it('aborts after the timeout and reports it as a timeout', async () => {
    const hanging = async (_url: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    const client = new DispatchClient({ baseUrl: BASE, fetchImpl: hanging, timeoutMs: 20 });
    const failure = (await client.health().catch((error: unknown) => error)) as ApiError;
    expect(failure.code).toBe('timeout');
    expect(failure.message).toBe('request timed out after 20 ms');
  });

  it('rejects a 2xx response that is not JSON', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { status: 200, body: 'not json' } });
    const failure = (await makeClient(fetchImpl).health().catch((error: unknown) => error)) as ApiError;
    expect(failure.code).toBe('invalid_response');
  });

  it('recognises only well-formed envelopes', () => {
    expect(isErrorEnvelope(envelope('not_found', 'missing'))).toBe(true);
    expect(isErrorEnvelope({ error: 'missing' })).toBe(false);
    expect(isErrorEnvelope({ error: { code: 1, message: 'x' } })).toBe(false);
    expect(isErrorEnvelope(null)).toBe(false);
    expect(errorFromResponse(404, envelope('not_found', 'order missing'), null).code).toBe('not_found');
    expect(errorFromResponse(500, null, 'rid').code).toBe('http_error');
  });
});

describe('newRequestId', () => {
  it('produces distinct ids in the server\'s accepted character set', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRequestId()));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(REQUEST_ID_PATTERN);
    }
  });
});
