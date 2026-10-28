# courier-app

A React Native (Expo) and TypeScript mobile client for `dispatch-service`, the order-dispatch
backend of a synthetic local-delivery marketplace. It is the courier's side of that system: a
courier registers, goes on shift, reports a position, sees the orders dispatch has assigned,
and moves each one through pickup and delivery. Every write goes through the backend's state
machine and optimistic concurrency checks, so the app is mostly about calling that API
correctly: typed requests and responses, request ids, timeouts, the error envelope, `If-Match`
on transitions and a sane reaction to `409 version_conflict`.

It runs on a phone through Expo Go and as a web build that can be deployed to Vercel.

## Status

This is an AI-assisted educational prototype built with Claude Code. There is no app-store
release and no production use. All data it shows comes from the companion API, which generates
synthetic merchants, customers, couriers and orders; nothing here refers to a real person,
business or place.

What was verified, and where, is written down in VERIFIED_RESULTS.md. In short: the type
check, lint, 80 Jest tests and the web export were run on a Linux machine with Node 22, and the
exported web bundle was booted in jsdom. The app was not run on a physical device, an emulator
or a simulator there, so the Expo Go and location-permission paths are documented from the
code, not from a device session.

## What it demonstrates

- A small typed API client (`src/api/client.ts`) that mirrors the backend's pydantic models,
  sends an `X-Request-ID` on every call, times out, and maps the backend's
  `{"error": {"code", "message"}}` envelope to a typed `ApiError`.
- Optimistic concurrency from the client side: the order version the user is looking at is sent
  as `If-Match` with each transition, and a `409 version_conflict` refetches the order and tells
  the user what happened instead of silently retrying.
- The courier's slice of the order state machine encoded once (`src/domain/orderActions.ts`), so
  the detail screen shows exactly one legal action: Pick up when ASSIGNED, Deliver when
  PICKED_UP, nothing otherwise.
- Persistence with AsyncStorage, a health poll, device location through expo-location with a
  manual fallback, pull to refresh, and pagination that follows `next_offset`.
- React hooks and context for state, expo-router for navigation, no Redux.
- 80 tests with jest-expo and Testing Library, covering the client against a fake fetch, the
  domain helpers, the hooks and all four screens, including the endpoint and headers each
  button press produces.
- A web export with a `vercel.json`, a jsdom smoke test of the exported bundle, and a CI
  workflow that runs everything on Node 22.

## Running it

Prerequisites: Node 22, npm, and the companion API. The API is a Python project; its README
explains how to start it. The short version, from the `dispatch-service` directory:

```bash
uvicorn app.main:app --port 8000 --no-access-log
```

Install the app's dependencies once:

```bash
npm install
```

### Getting an order assigned to your courier

Dispatch assigns each order to the nearest available courier, so the simplest demo is to make
the app's courier the only one. Seed merchants and customers but no couriers (the script prints
the ids it created), register a courier in the app, send a position from the Shift tab and
switch availability on, then create, accept and assign an order with curl:

```bash
python3 scripts/seed.py --base-url http://127.0.0.1:8000 --merchants 2 --customers 2 --couriers 0

curl -s -X POST http://127.0.0.1:8000/orders \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' \
  -d '{"merchant_id":"mer_...","customer_id":"cus_...","items":[{"sku":"coffee-beans-1kg","quantity":2,"unit_price_cents":1850}]}'
curl -s -X POST http://127.0.0.1:8000/orders/ord_.../accept
curl -s -X POST http://127.0.0.1:8000/orders/ord_.../assign
```

The order now shows up under "Assigned" on the My orders tab (pull to refresh), and the detail
screen offers Pick up, then Deliver. The seed script places merchants around 40.0, -75.0; if
other couriers were seeded, send a position near that point so yours is the nearest. The load
script in the API repository is not useful here: it creates its own couriers and drives every
order through delivery itself.

### On a phone with Expo Go

1. Put the phone and the laptop on the same Wi-Fi network.
2. Find the laptop's LAN address (for example `192.168.1.20`; `ipconfig` on Windows,
   `ifconfig` or `ip addr` on macOS and Linux). The phone cannot reach `localhost`, because on
   the phone that means the phone itself.
3. Start the API bound to all interfaces so the phone can reach it:
   `uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log`.
4. Start the bundler: `npx expo start`. Scan the QR code with the Expo Go app (Android) or the
   camera app (iOS).
5. On the Setup tab, set the base URL to `http://192.168.1.20:8000` (your address) and save,
   then register a courier or paste an existing `cur_...` id. Both are remembered on the phone.

Setting `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start` makes that URL the
default so the Setup step is just confirming it.

Expo Go only runs projects on the SDK it was built for, and the app-store build tracks the
newest SDK. This project pins Expo SDK 53 (see "Dependency choices" below). If your Expo Go
says the SDK does not match, either install the SDK 53 build of Expo Go from expo.dev/go
(Android APK, or an iOS simulator build on a Mac), or move the project to the current SDK with
`npx expo install expo@latest` followed by `npx expo install --fix`, and re-run the checks.

### The web build

For development with hot reload:

```bash
npx expo start --web
```

For a static build, which is what Vercel serves:

```bash
npx expo export --platform web      # writes dist/
node scripts/smoke-web.js           # boots dist/ in jsdom and checks it rendered
npx serve dist                      # or any static file server
```

Two things differ from the phone. First, the browser enforces CORS, and the companion API as
shipped sends no CORS headers, so a web build served from one origin cannot call an API on
another. Either add Starlette's `CORSMiddleware` to the FastAPI app for the web origin (the
headers the app sends are `Content-Type`, `Accept`, `X-Request-ID`, `X-Actor` and `If-Match`;
exposing `X-Request-ID` in the response is useful too), or put the API and the static files
behind one reverse proxy. Second, a page served over `https` (as Vercel does) cannot call an
`http` API; the API must be reachable over `https` for the deployed web build.

## Screens

**Setup.** The API base URL (default `http://localhost:8000`, or `EXPO_PUBLIC_API_URL` when it
was set at build time) and the courier this device acts as. Register a new courier by name
(`POST /couriers`, created off shift at 0,0) or paste an existing id, which is checked with
`GET /couriers/{id}`. Both values persist in AsyncStorage; the current courier is shown and can
be forgotten on the device without touching the server.

**Shift.** A health indicator that polls `GET /health` every 15 seconds; an availability switch
(`POST /couriers/{id}/availability`); and location reporting
(`POST /couriers/{id}/location`), either from the device through expo-location when permission
is granted or from a manual latitude and longitude form, which is also the fallback when
permission is refused. The screen shows the courier's server record (position, version) and
reloads it whenever the tab regains focus, because the server also flips availability when it
assigns and delivers.

**My orders.** `GET /orders?courier_id=...`, following `next_offset` until the server reports
no more pages, grouped by state with active work (Assigned, Picked up) first. Each row shows
the id, merchant, subtotal in dollars and the state. Pull down to refresh; the list also
refreshes when the tab regains focus. Tapping a row opens the order.

**Order detail.** Items with line totals, the current state, the audit trail from
`GET /orders/{id}/events`, and the single legal next action as a button: Pick up when ASSIGNED
(`POST /orders/{id}/pickup`), Deliver when PICKED_UP (`POST /orders/{id}/deliver`). The request
carries `If-Match: <version>` and `X-Actor: courier-app`. On `409 version_conflict` the screen
refetches the order and the trail and explains that the order changed on the server. Any other
failure shows the API's own error message.

## API contract summary

The full contract is in the `dispatch-service` README ("API" and "State machine"). The parts
this app depends on:

| Call | Used for |
| --- | --- |
| `GET /health` | Health indicator, polled every 15 s; 503 with the envelope when the database is down |
| `POST /couriers` | Register a courier (`name`, `lat`, `lng`, `available`) |
| `GET /couriers/{id}` | Validate a pasted id; reload the courier record |
| `POST /couriers/{id}/location` | `{lat, lng}`; bumps the courier's version |
| `POST /couriers/{id}/availability` | `{available}`; bumps the courier's version |
| `GET /orders?courier_id=&state=&limit=&offset=` | The courier's orders; `{items, limit, offset, next_offset}` |
| `GET /orders/{id}` | Order detail |
| `GET /orders/{id}/events` | Audit trail: `seq`, `from_state`, `to_state`, `actor`, `created_at` |
| `POST /orders/{id}/pickup` | ASSIGNED to PICKED_UP, with `If-Match` |
| `POST /orders/{id}/deliver` | PICKED_UP to DELIVERED, with `If-Match` |

Ids are opaque strings from the server (`ord_...`, `cur_...`, `mer_...`, `cus_...`). Money is
`subtotal_cents` and `unit_price_cents` as integers; the app formats them as dollars. Order
states are `CREATED`, `ACCEPTED`, `ASSIGNED`, `PICKED_UP`, `DELIVERED`, `CANCELED`; a courier
only ever moves ASSIGNED to PICKED_UP and PICKED_UP to DELIVERED, and the server rejects
anything else with `409 invalid_transition`. Every failure body is
`{"error": {"code": "...", "message": "..."}}`; the client turns it into an `ApiError` with
`status`, `code`, `message` and the request id, and uses status 0 with the codes
`network_error`, `timeout` and `invalid_response` for failures that produced no usable
response. The `courier_id` filter on `GET /orders` was being added to the backend in parallel
with this app; the client is written against it.

## Project layout

```
app/                         expo-router routes: thin wrappers around the screens
  _layout.tsx                providers, hydration gate, root Stack
  (tabs)/_layout.tsx         My orders, Shift, Setup tabs
  (tabs)/index.tsx           orders tab (pushes /orders/[id] on tap)
  (tabs)/shift.tsx, setup.tsx
  orders/[id].tsx            order detail
  +not-found.tsx
src/
  api/client.ts              DispatchClient, ApiError, envelope mapping, request ids, timeouts
  api/types.ts               types mirroring the backend models
  domain/                    next legal action, grouping, money, coordinates, timestamps
  state/                     settings model, SettingsProvider (AsyncStorage), ApiProvider, HydrationGate
  storage/                   AsyncStorage persistence plus an in-memory version for tests
  hooks/                     useHealth, useCourier, useCourierOrders, useOrderDetail, useRefocusToken
  location/                  expo-location wrapper returning a result instead of throwing
  components/                Button, Field, Banner, Card, StateBadge, OrderRow, HealthIndicator, ...
  screens/                   SetupScreen, ShiftScreen, OrdersScreen, OrderDetailScreen
  test/                      fake fetch with recorded calls, fixtures, provider wrapper
  **/__tests__/              80 tests
scripts/smoke-web.js         boots the exported web bundle in jsdom
.github/workflows/ci.yml     Node 22: npm ci, tsc, lint, tests, web export, smoke test
vercel.json                  static deployment of dist/ with an SPA rewrite
```

The route files contain no logic. Screens take plain props (`orderId`, `onOpenOrder`, a
`refreshToken` that the tab bumps on focus) and get the API client and settings from context,
so tests render a screen inside the real providers with an injected fetch and assert on the
exact request each press produces.

## Tests and checks

```bash
npx tsc --noEmit                  # TypeScript strict mode
npx expo lint                     # eslint-config-expo, flat config
npm test                          # Jest with jest-expo (npm test -- --ci in CI)
npx expo export --platform web    # produces dist/
node scripts/smoke-web.js         # loads dist/ in jsdom
```

The tests use a fake `fetch` that records every call (method, path, query, headers, body) and
answers from a small route table, so they check behaviour such as "pressing Pick up sends
`POST /orders/{id}/pickup` with `If-Match: 3`" and "a 409 version_conflict triggers a second
`GET /orders/{id}`" rather than mocking the client itself. Screens that use expo-location are
tested with that one wrapper module mocked. The health poll test uses fake timers to advance
15 seconds. One helper worth knowing about, `src/test/effects.ts`, flushes React's passive
effects before pressing a button that was disabled while data loaded; the reason is explained
in the file.

## Deploying the web build to Vercel

`vercel.json` already sets the build command, the output directory and a rewrite of every path
to `index.html`, which the client-side router needs for deep links. The steps in the Vercel
dashboard:

1. Push this repository to GitHub, GitLab or Bitbucket.
2. In Vercel choose "Add New Project" and "Import Git Repository", then pick the repository.
3. Framework preset: **Other**.
4. Build command: `npx expo export --platform web`.
5. Output directory: `dist`.
6. Install command: leave the default (`npm install`), or `npm ci`.
7. Environment variable: `EXPO_PUBLIC_API_URL` set to the public `https` URL of the API.
   The value is inlined into the bundle at build time, so changing it later means
   redeploying; when redeploying for that reason, untick "Use existing Build Cache", because
   Metro's transform cache can otherwise keep the old value (locally, pass `--clear` to the
   export command).
8. Deploy. The static site is served from `dist/`; unknown paths such as
   `/orders/ord_...` are rewritten to `index.html` and resolved by expo-router in the browser.

The API must allow CORS from the Vercel origin and be reachable over `https` (see "The web
build" above). Without that the deployed page loads, but every request from it fails.

## Dependency choices

The project pins Expo SDK 53 (`expo ~53.0.27`, React Native 0.79, React 19, expo-router 5,
jest-expo 53, Testing Library 13). Newer SDKs exist; 53 was chosen because its tool chain is
known to work together for tests, lint and the web export, which matters more here than being
current. Two pins deserve a note because they are not obvious from the SDK list:

- `query-string` is declared directly. expo-router 5 imports it inside its fork of React
  Navigation's `getPathFromState`, relying on `@react-navigation/core` to bring it in, but
  newer 7.x releases of React Navigation dropped that dependency, so a fresh install failed to
  bundle for web until it was added.
- `expo-font` and `expo-asset` are declared at the SDK 53 versions. `@expo/vector-icons` has a
  wildcard peer dependency on `expo-font`, which made npm hoist the newest `expo-font` (from a
  later SDK) to the top level while the SDK 53 copy was nested under `expo/`; the hoisted copy
  could not find `expo-asset` and the web export failed. Declaring both at the right versions
  makes the tree consistent.

Everything else is what the SDK ships. There is no state library, no form library and no UI
kit; the components are a few hundred lines of plain React Native.

## Limitations

- No authentication or authorization, matching the API: anyone who knows a courier id can act
  as that courier, and the id is stored in plain AsyncStorage.
- No offline queue. A transition attempted without a connection fails with a network error
  and must be retried by hand; nothing is stored for later.
- Polling, not push. Health is polled every 15 seconds and lists refresh on focus or pull; new
  assignments do not appear until the courier refreshes.
- Location is sent only when the app is open and the courier presses the button. There is no
  background tracking.
- The web build needs CORS enabled on the API and an `https` API when served over `https`.
- Expo Go must match the pinned SDK (53); see "On a phone with Expo Go".
- Courier updates (availability, location) do not send `If-Match`, because the server itself
  changes the courier's availability and version on assignment and delivery; LEARNING_GUIDE.md
  explains the reasoning.
- Not run on a physical device, emulator or simulator in the environment where it was built.
- Synthetic data only, by construction of the companion API.

## Reproduce and explain before using on a resume

Run the checks yourself (VERIFIED_RESULTS.md lists the exact commands), run the API and the
app together on your own machine and phone, then work through LEARNING_GUIDE.md and answer
each item aloud. The defensible claim is "built a typed mobile client for an order-dispatch
API with optimistic concurrency handling and tested the request contract", not anything about
users or releases.
