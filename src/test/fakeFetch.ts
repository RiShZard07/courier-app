/**
 * A fetch stand-in for tests: routes keyed by "METHOD /path" and a record of every call, so a
 * test can assert on the exact endpoint, headers and body the app sent.
 */

import type { FetchLike, RequestInitLike, ResponseLike } from '../api/client';

export interface RecordedCall {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  /** Header names lower-cased. */
  headers: Record<string, string>;
  /** The JSON body, or null when none was sent. */
  body: unknown;
}

export interface ResponseSpec {
  status?: number;
  /** Serialized as JSON unless it is already a string; undefined sends an empty body. */
  body?: unknown;
  headers?: Record<string, string>;
}

export type RouteHandler = ResponseSpec | ((call: RecordedCall) => ResponseSpec | Promise<ResponseSpec>);

export type Routes = Record<string, RouteHandler>;

export interface FakeFetch extends FetchLike {
  calls: RecordedCall[];
  /** Mutable, so a test can change a route's behaviour part way through. */
  routes: Routes;
  callsTo(method: string, path: string): RecordedCall[];
}

function lowerCaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

export function makeResponse({ status = 200, body, headers = {} }: ResponseSpec): ResponseLike {
  const lower = lowerCaseKeys(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

export function envelope(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

export function createFakeFetch(routes: Routes = {}): FakeFetch {
  const calls: RecordedCall[] = [];
  const fake = (async (url: string, init: RequestInitLike): Promise<ResponseLike> => {
    const parsed = new URL(url);
    const call: RecordedCall = {
      method: init.method,
      url,
      path: parsed.pathname,
      query: Object.fromEntries(parsed.searchParams),
      headers: lowerCaseKeys(init.headers),
      body: init.body === undefined ? null : JSON.parse(init.body),
    };
    calls.push(call);
    const handler = fake.routes[`${call.method} ${call.path}`];
    if (handler === undefined) {
      return makeResponse({ status: 404, body: envelope('not_found', `no fake route for ${call.method} ${call.path}`) });
    }
    return makeResponse(typeof handler === 'function' ? await handler(call) : handler);
  }) as FakeFetch;
  fake.calls = calls;
  fake.routes = routes;
  fake.callsTo = (method, path) => calls.filter((call) => call.method === method && call.path === path);
  return fake;
}
