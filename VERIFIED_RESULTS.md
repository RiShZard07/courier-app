# Verified results

What was run, where, and what came out. Everything below was executed on 2026-10-28 in the
environment where the project was written. Numbers are from that single machine and session.

## Environment

- Linux (kernel 6.18), x86_64, a sandboxed container
- Node v22.23.4, npm 10.9.9
- Network access limited to the npm registry (no Expo services, no device, no browser)
- Expo SDK 53: `expo` 53.0.27, `expo-router` 5.1.11, `react-native` 0.79.6, `react` 19.0.0,
  `react-native-web` 0.20.0, `jest-expo` 53.0.14, `jest` 29.7.0,
  `@testing-library/react-native` 13.3.3, `eslint` 9.39.5, `eslint-config-expo` 9.2.0,
  `typescript` 5.8.3, `expo-location` 18.1.6, `@react-native-async-storage/async-storage` 2.1.2

## Commands and results

Run from the repository root, in this order, starting from no `node_modules`, `dist` or
`.expo` directory.

```
$ npm ci --no-audit --no-fund
added 1111 packages in 14s

$ npx tsc --noEmit
(no output)                                   exit code 0

$ npx expo lint
(no output; 0 problems)                       exit code 0

$ npm test -- --ci
Test Suites: 12 passed, 12 total
Tests:       80 passed, 80 total
Time:        3.911 s                          exit code 0

$ EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web
> web bundles (1):
_expo/static/js/web/entry-5baecbb1401e616e288348f4de01da3b.js (1.49 MB)
> Files (2):
index.html (1.17 kB)
metadata.json (49 B)
Exported: dist                                exit code 0

$ node scripts/smoke-web.js
smoke-web: ok (bundle entry-5baecbb1401e616e288348f4de01da3b.js, 1.42 MB, rendered tabs and
the Orders empty state)                       exit code 0
```

`dist/` after the export: `index.html`, `metadata.json`, one JavaScript bundle, the vector
icon fonts and the navigation and router images under `assets/`; 5.4 MB in total, of which
the icon fonts are most. The export was run several times during development, with and
without `--clear`; the figures above are from the clean-install run.

The Jest suite passed 80 of 80 on every run after the timing fix described below, including
three consecutive runs and the clean-install run. Test output contained no React warnings
(no "not wrapped in act", no deprecation notices).

## Test inventory (80 tests, 12 files)

| File | Tests | What they cover |
| --- | --- | --- |
| `src/api/__tests__/client.test.ts` | 17 | URL building, `X-Request-ID` on every call and its format, JSON body and headers, query string, following `next_offset`, `If-Match` and `X-Actor` on pickup and deliver, availability and location bodies, envelope to `ApiError` mapping with the response's request id, non-envelope bodies, network failure, timeout via `AbortController`, non-JSON 2xx, envelope detection, request id uniqueness |
| `src/domain/__tests__/orderActions.test.ts` | 10 | next legal action for all six states (table test), labels and target states, terminal states, grouping order and sort, labels |
| `src/domain/__tests__/money.test.ts` | 6 | cents to dollars including grouping and negatives |
| `src/domain/__tests__/coordinates.test.ts` | 4 | coordinate parsing, ranges, messages, formatting |
| `src/state/__tests__/settings.test.ts` | 5 | `EXPO_PUBLIC_API_URL` fallback, base URL parsing, stored settings validation |
| `src/storage/__tests__/settingsStorage.test.ts` | 4 | AsyncStorage round trip (package mock), corrupted values, in-memory storage |
| `src/hooks/__tests__/useHealth.test.tsx` | 3 | immediate check and a second one after 15 s with fake timers, down with the server's message, no polling after unmount |
| `src/hooks/__tests__/useCourierOrders.test.tsx` | 4 | `courier_id` filter, no call without a courier, error then recovery on refresh, reload on token change |
| `src/screens/__tests__/OrdersScreen.test.tsx` | 5 | fetch and grouped rendering with dollar amounts, tap opens the order, pull to refresh refetches, API error shown, setup prompt without a courier |
| `src/screens/__tests__/OrderDetailScreen.test.tsx` | 7 | items, trail and Pick up button; pickup sends `If-Match: 3` and shows Deliver; deliver sends `If-Match: 4`; 409 version_conflict refetches and explains; other errors show the server message without a refetch; no action when not assigned; load error |
| `src/screens/__tests__/ShiftScreen.test.tsx` | 8 | courier load, health text and last position; toggle posts `{available: true}` and reflects the server; toggle failure keeps server state; manual location posts parsed numbers; invalid latitude blocked without a call; device location (mocked wrapper) sent; permission refusal falls back to the form; no courier shows the setup hint |
| `src/screens/__tests__/SetupScreen.test.tsx` | 6 | register posts `{name, lat: 0, lng: 0, available: false}` and persists; adopt an existing id after `GET /couriers/{id}`; unknown id shows the server message; URL validation and save; forget courier; name required |

## Findings during verification

1. **Web export failed on a fresh install: `query-string` missing.** expo-router 5.1.11's
   fork of `getPathFromState` imports `query-string`, which it used to get transitively from
   `@react-navigation/core`; the 7.24 release that npm resolved no longer depends on it. Fixed
   by declaring `query-string ^7.1.3` directly.
2. **Web export then failed: `expo-asset` not found from `expo-font`.** `@expo/vector-icons`
   has a wildcard peer dependency on `expo-font`, so npm hoisted `expo-font` 58.0.11 (a later
   SDK's) to the top level and nested the SDK 53 copy under `node_modules/expo/`. The hoisted
   copy's web font loader imports `expo-asset`, which only existed in the nested tree. Fixed
   by declaring `expo-font ~13.3.2` and `expo-asset ~11.1.7` (the SDK 53 versions) directly.
3. **`EXPO_PUBLIC_API_URL` and the Metro cache.** Exporting a second time with a different
   `EXPO_PUBLIC_API_URL` reused the cached transform and kept the old value; `--clear` fixed
   it. Documented in the README's Vercel section.
4. **One screen test was timing dependent.** A press fired immediately after `findBy*`
   resolved was sometimes ignored, because `Pressable` applies its `disabled` prop in a
   passive effect and Testing Library's `waitFor` runs outside `act`. A helper that flushes
   effects before such presses (`src/test/effects.ts`) made the suite pass three times in a
   row and again after the clean install.

## Not verified here

- The app was not run on a physical device, an Android emulator or an iOS simulator. The
  Expo Go instructions, the location permission prompt, AsyncStorage on a real device and
  the native tab and stack navigators are documented from the code and the Expo SDK 53
  behaviour, not from a session on a device.
- The web bundle was booted in jsdom with `ResizeObserver`, `IntersectionObserver`,
  `CSSFontFaceRule`, `matchMedia` and `fetch` stubbed. It was not opened in a real browser,
  so layout, fonts and the browser geolocation prompt were not seen.
- The app was never pointed at a running instance of the companion API. The request contract
  was checked against the API's README and pydantic models and exercised with a fake fetch;
  the `courier_id` filter on `GET /orders` was being added to the backend in parallel and
  was not called.
- No Vercel deployment was made. `vercel.json` and the dashboard steps follow Vercel's
  documented static-site configuration and were not exercised.
- `npx expo start` (the development server and QR code) was not run, because nothing could
  connect to it in this environment.

## Size

About 3,975 lines across the TypeScript, JavaScript, JSON, YAML and Markdown files
(excluding `package-lock.json`): roughly 2,040 lines of application source under `src/`,
130 lines of routes under `app/`, 1,080 lines of tests and test helpers, 70 lines for the
smoke script, 180 lines of configuration and 480 lines of documentation.
