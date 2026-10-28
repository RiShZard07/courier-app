#!/usr/bin/env node
/**
 * Boot the exported web bundle (dist/) inside jsdom and check that the app rendered.
 *
 * This is not a browser test. jsdom has no layout engine and lacks a few APIs that
 * react-native-web and expo-font touch, so those are stubbed below. What it proves is that the
 * bundle Metro produced loads without throwing, mounts the router, and renders the Orders tab.
 *
 * Usage: npx expo export --platform web && node scripts/smoke-web.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dist = path.resolve(__dirname, '..', 'dist');
const bundleDir = path.join(dist, '_expo', 'static', 'js', 'web');

function fail(message) {
  console.error(`smoke-web: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  fail('dist/index.html not found; run "npx expo export --platform web" first');
}
const bundleName = fs.readdirSync(bundleDir).find((name) => name.endsWith('.js'));
if (!bundleName) {
  fail('no JavaScript bundle found under dist/_expo/static/js/web');
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/, '');
const bundle = fs.readFileSync(path.join(bundleDir, bundleName), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost:8081/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = NoopObserver;
window.IntersectionObserver = NoopObserver;
window.CSSFontFaceRule = class {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
// No courier is configured on a fresh load, so the app must not call the API at all.
let fetchCalls = 0;
window.fetch = async () => {
  fetchCalls += 1;
  return { ok: false, status: 0, headers: { get: () => null }, text: async () => '' };
};

const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
window.eval(bundle);

setTimeout(() => {
  const text = window.document.body.textContent.replace(/\s+/g, ' ');
  const expected = ['My orders', 'Shift', 'Setup', 'No courier yet'];
  const missing = expected.filter((needle) => !text.includes(needle));
  if (errors.length > 0) {
    fail(`bundle raised errors: ${errors.join('; ')}`);
  }
  if (missing.length > 0) {
    fail(`rendered text is missing ${missing.join(', ')}; got: ${text.slice(0, 300)}`);
  }
  if (fetchCalls > 0) {
    fail(`expected no API calls before a courier is set up, saw ${fetchCalls}`);
  }
  console.log(`smoke-web: ok (bundle ${bundleName}, ${(bundle.length / 1024 / 1024).toFixed(2)} MB, rendered tabs and the Orders empty state)`);
  process.exit(0);
}, 3000);
