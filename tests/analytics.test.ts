import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_ORIGIN, analyticsMeasurementId, analyticsPage, recordAnalyticsPage, type AnalyticsRuntime } from '../lib/analytics';

const id = 'G-D4LJPG83ZY';
const runtime = (origin = ANALYTICS_ORIGIN, pathname = '/expenses'): AnalyticsRuntime => ({ location: { origin, pathname }, navigator: {} });
const commands = (value: AnalyticsRuntime) => (value.dataLayer ?? []).map(entry => Array.from(entry as IArguments));

test('GA4 is configured only for the production app with a valid public ID', () => {
  assert.equal(analyticsMeasurementId({ VERCEL_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: id }), id);
  for (const VERCEL_ENV of [undefined, 'development', 'preview']) {
    assert.equal(analyticsMeasurementId({ VERCEL_ENV, NEXT_PUBLIC_GA_MEASUREMENT_ID: id }), undefined);
  }
  assert.equal(analyticsMeasurementId({ VERCEL_ENV: 'production', FAMFI_DB_SCHEMA: 'famfi_preview', NEXT_PUBLIC_GA_MEASUREMENT_ID: id }), undefined);
  for (const value of [undefined, '', 'G-INVALID<script>', 'UA-123', ' G-123']) {
    assert.equal(analyticsMeasurementId({ VERCEL_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: value }), undefined);
  }
});

test('GA4 screen metadata is a fixed allowlist without data or URL parameters', () => {
  for (const view of ['expenses', 'cash', 'finance', 'settlements', 'recurring', 'notes', 'household', 'history']) {
    const page = analyticsPage(view)!;
    assert.equal(new URL(page.page_location).origin, ANALYTICS_ORIGIN);
    assert.equal(new URL(page.page_location).search, '');
    assert.equal(new URL(page.page_location).hash, '');
    assert.equal(page.page_referrer, '');
    assert.deepEqual(Object.keys(page).sort(), ['page_location', 'page_referrer', 'page_title']);
  }
  assert.equal(analyticsPage('expenses', 'calendar')?.page_location, ANALYTICS_ORIGIN + '/expenses/calendar');
  for (const view of ['constructor', '__proto__', 'login', 'private@example.invalid', '/expenses?search=private']) {
    assert.equal(analyticsPage(view), null);
  }
});

test('GA4 refuses local, preview, auth, unknown routes, invalid IDs and privacy opt-outs', () => {
  for (const origin of ['http://localhost:3000', 'https://famfi-preview.vercel.app', 'https://famfi-nu.vercel.app.evil.invalid']) {
    const value = runtime(origin);
    assert.equal(recordAnalyticsPage(value, id, 'expenses'), false);
    assert.equal(value.dataLayer, undefined);
  }
  for (const path of ['/login', '/auth/callback', '/', '/expenses/private-id']) {
    const value = runtime(ANALYTICS_ORIGIN, path);
    assert.equal(recordAnalyticsPage(value, id, 'expenses'), false);
    assert.equal(value.dataLayer, undefined);
  }
  for (const value of [undefined, '', 'G-<script>']) assert.equal(recordAnalyticsPage(runtime(), value, 'expenses'), false);
  for (const navigator of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
    const value = { ...runtime(), navigator };
    assert.equal(recordAnalyticsPage(value, id, 'expenses'), false);
    assert.equal(value.dataLayer, undefined);
  }
});

test('GA4 config disables default pageviews and advertising; repeated renders do not duplicate views', () => {
  const value = runtime();
  assert.equal(recordAnalyticsPage(value, id, 'expenses'), true);
  assert.equal(recordAnalyticsPage(value, id, 'expenses'), true);
  assert.equal(recordAnalyticsPage(value, id, 'finance'), true);
  assert.equal(recordAnalyticsPage(value, id, 'finance'), true);
  assert.equal(recordAnalyticsPage(value, id, 'expenses'), true);
  const queue = commands(value);
  assert.equal(queue.filter(entry => entry[0] === 'config').length, 1);
  const config = queue.find(entry => entry[0] === 'config')![2] as Record<string, unknown>;
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_referrer, '');
  assert.equal(config.cookie_domain, 'none');
  assert.deepEqual(queue[0], ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  const events = queue.filter(entry => entry[0] === 'event');
  assert.deepEqual(events.map(entry => entry[1]), ['page_view', 'page_view', 'page_view']);
  assert.deepEqual(events.map(entry => (entry[2] as Record<string, unknown>).page_location), ['/expenses', '/expenses/summary', '/expenses'].map(path => ANALYTICS_ORIGIN + path));
  for (const event of events) {
    assert.deepEqual(Object.keys(event[2] as object).sort(), ['page_location', 'page_referrer', 'page_title', 'send_to']);
  }
  assert.equal(recordAnalyticsPage(value, 'G-OTHER', 'expenses'), false);
});
