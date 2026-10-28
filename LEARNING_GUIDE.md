# Learning guide

Ten questions an interviewer could ask about this project, with the answer the code supports
and where to look. Read the file named in each item before answering aloud; the point is to be
able to explain the behaviour, not to recite this page.

## 1. Why send If-Match on transitions, when the server already serialises writes?

The server's locks guarantee that two requests do not corrupt the row; they do not guarantee
that a request is still about the order the user was looking at. A courier opens an order at
version 3, gets distracted, and meanwhile a dispatcher cancels it or a colleague on a shared
account picks it up. Without `If-Match`, the courier's "Pick up" would be evaluated against
whatever the row is now; with `If-Match: 3`, the server compares the version it holds against
the one the client last read and refuses the move with `409 version_conflict` if they differ.
Nothing is held open between requests, so the check costs one header and one predicate.

Where: `DispatchClient.transitionOrder` in `src/api/client.ts` sets the header from the
`version` the screen rendered; `OrderDetailScreen.act` passes `order.version`. The test
"posts the pickup with If-Match" asserts the header value.

## 2. What does the client do on 409 version_conflict, and why not retry automatically?

It refetches the order and its audit trail and shows a message saying the order changed on
the server and has been reloaded. It does not retry the transition. A retry would re-send the
same intent against a state the user has not seen: if the order was cancelled, retrying
"pickup" would just fail again with `invalid_transition`; if it was picked up by someone else,
a retry of "deliver" could complete an order the courier never handled. The conflict is
information for the human, so the screen puts the fresh state in front of them and lets them
decide. Other errors (invalid transition, not found, network) show the server's message text
and leave the order as it was, because nothing is known to have changed.

Where: `OrderDetailScreen.act` branches on `ApiError.isVersionConflict`; `useOrderDetail.reload`
does the refetch. Tests: "refetches and explains when the server answers 409 version_conflict"
and "shows the API error message on any other failure".

## 3. Polling versus server-sent events: why poll, and what would change?

The app polls `GET /health` every 15 seconds and reloads lists when a tab regains focus or the
user pulls to refresh. Polling is simple, works through any proxy, needs no connection
management, and costs almost nothing at this scale: one small request per 15 seconds. Its
weakness is latency and waste: a new assignment is invisible until the next refresh, and most
polls return nothing new.

With server-sent events the server would keep one HTTP response open and push an event per
change, so the orders list could update within a second of an assignment. The client would
need reconnection with backoff, a cursor so a reconnect resumes where it left off (the newer
backend's audit events carry a global id meant for exactly that), and a way to reconcile the
stream with the initial list fetch. On React Native there is no built-in `EventSource`, so a
small polyfill or a fetch-with-streaming reader is required, and the connection drops whenever
the app goes to the background. The change would be contained: `useCourierOrders` would
subscribe instead of refetch, and the screens would not notice.

Where: `src/hooks/useHealth.ts` (interval and cleanup), `src/hooks/useRefocusToken.ts` and
the `refreshToken` props.

## 4. AsyncStorage versus secure storage: what is stored and why is that acceptable here?

The app stores the API base URL and the courier's id and name in AsyncStorage, which is a
plain key-value store (SQLite on Android, files on iOS, `localStorage` on the web). It is not
encrypted and other code in the same app can read it. That is fine for this data: the API has
no authentication, so the courier id is an identifier, not a secret, and the values are
synthetic. The moment the API issued a token or session, that token would belong in
`expo-secure-store` (Keychain on iOS, Keystore-backed encryption on Android), and it would be
read into memory when needed rather than kept in React state longer than necessary. Secure
storage has no web implementation, which is one reason to keep the two kinds of data apart
from the start.

Where: `src/storage/settingsStorage.ts` validates what it reads back (`parseStoredSettings`),
because storage contents are input, not trusted state.

## 5. What can Expo Go do, and what can it not do?

Expo Go is a prebuilt app that contains the native modules of one SDK version and loads your
JavaScript bundle from the development server. It lets you run this project on a phone with
no Xcode, no Android Studio and no signing, which is why the README's phone instructions are
four steps. Its limits follow from that design: it can only run the modules it ships with, so
any native dependency outside the Expo SDK (or custom native code) needs a development build;
it only runs the SDK version it was built for, so a project on an older SDK needs the matching
Expo Go build; it cannot be published, because it is Expo's app, not yours; and some
capabilities (background location, push notification entitlements, certain permissions) are
either unavailable or behave differently than in a standalone build. Everything this app uses
(expo-location in the foreground, AsyncStorage, expo-router) is inside Expo Go's module set.

## 6. How does the web build differ from the native app?

Same TypeScript, different runtime. `react-native-web` maps `View`, `Text`, `Pressable` and
friends to DOM elements, and expo-router drives the browser's history instead of native
navigators. The differences that matter for this app:

- The browser enforces CORS, so the API must send `Access-Control-Allow-*` headers for the
  page's origin; the phone's fetch has no such rule. A page on `https` cannot call an `http`
  API either.
- AsyncStorage becomes `localStorage`; expo-location becomes the browser's geolocation API,
  which prompts for permission in the same way.
- `fetch` on the web is `window.fetch`, which throws "Illegal invocation" when called as a
  method of another object. The client wraps it in an arrow function for that reason.
- React Native's `AbortController` polyfill has no `AbortSignal.timeout`, so the client builds
  the timeout from `setTimeout` and `controller.abort()`; that code is the same on both.
- Fonts (the tab icons) are loaded through generated `@font-face` rules on the web rather
  than bundled native fonts.
- The export is a single `index.html` plus one JavaScript bundle, so every deep link must be
  rewritten to `index.html` by the host; `vercel.json` does that.

Where: `src/api/client.ts` (the fetch wrapper and timeout), `scripts/smoke-web.js` (what has
to be stubbed for the bundle to boot outside a browser).

## 7. How would you add an offline queue?

Keep an append-only queue of intended writes in storage, each entry holding the endpoint, the
body, the `If-Match` version the user saw, a client-generated id to use as the request id, and
a timestamp. The screen appends to the queue and shows the order in a "pending" state
immediately; a single drainer sends entries in order whenever the network comes back, removing
each one on success. The interesting part is failure handling. A `409 version_conflict` or
`invalid_transition` must not be retried; the entry is dropped and the order refetched, and
the user is told what did not happen (they may have delivered a parcel the system thinks was
cancelled). A network error keeps the entry for the next attempt. The request id doubles as an
idempotency key on the client side, which matters because the API has no idempotency on
transitions: a transition whose response was lost will come back as `409 invalid_transition`
on retry, and the drainer has to recognise that as "already done" by checking the order's
state rather than as a failure. Ordering is per order, so a queue per order id avoids one
stuck entry blocking everything else.

What would change here: `useOrderDetail` and `OrderDetailScreen` would write to the queue
instead of calling the client directly, and a small `useQueueDrainer` hook at the root would
own the retry loop. The current design keeps `ApiError` as the single failure type, which is
what the drainer would switch on.

## 8. Why do courier updates (availability, location) not send If-Match?

Because the courier's version is not something the app controls. The server bumps it itself
when it books the courier for an order (availability goes to false) and when a delivery frees
the courier (availability goes back to true). If the Shift screen sent the version it last
saw, the first update after any assignment would fail with a version conflict that carries no
useful information for the courier, who would be told "something changed" when the something
is their own order arriving. The semantics of these two endpoints are also last-writer-wins by
nature: the latest position is the right position. So the app reads the courier record back
from every response, reloads it when the Shift tab regains focus, and shows the version only
as a diagnostic. Order transitions are different: there the version encodes which state the
user believed the order was in, and a stale belief is exactly what must be caught.

Where: `DispatchClient.setCourierAvailability` and `setCourierLocation` take no version;
`useCourier.apply` replaces the local record with the server's answer.

## 9. How are the screens tested without a device?

Screens are plain components that take props and read the API client and settings from
context. Tests render a screen inside the real `SettingsProvider` and `ApiProvider`, with an
in-memory storage and a fake `fetch` that records every call and answers from a route table
keyed by `"METHOD /path"`. A test then presses a button and asserts on the recorded request:
method, path, query, headers (`If-Match`, `X-Request-ID`) and JSON body. This tests the
contract the backend sees, which is what a mock of the client would hide. Modules with native
dependencies are isolated behind one wrapper (`src/location/getDeviceLocation.ts`) that
returns a result object instead of throwing, so a test mocks that one module and never loads
expo-location. The health poll test uses fake timers to advance 15 seconds and count calls.

One gotcha is documented in `src/test/effects.ts`: `findBy*` resolves outside of React's
`act`, and `Pressable` applies its `disabled` prop in a passive effect, so a press fired the
instant a loading button becomes enabled can be ignored. Flushing effects first makes those
tests deterministic.

## 10. Why does the client decide which button to show, if the server is the source of truth?

Because a good client never offers an action the server will reject, and a safe client never
trusts itself. `nextCourierAction` encodes the courier's two legal moves (ASSIGNED to
PICKED_UP, PICKED_UP to DELIVERED) so the screen shows one button or none; the server's
`assert_transition` still runs inside the write transaction against the committed state, so
if the client's table were wrong or stale, the answer would be a clean `409
invalid_transition` rather than a corrupted order. The same split applies to pagination: the
server says where the next page starts (`next_offset`) and the client just follows it, with a
page cap so a bug on either side cannot loop forever.

Where: `src/domain/orderActions.ts` (the table and its tests), `DispatchClient.listCourierOrders`.
