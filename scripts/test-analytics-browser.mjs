// Local production build, synthetic API responses, intercepted GA delivery. No DB or live events.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:3113';
const origin = 'https://famfi-nu.vercel.app';
const id = 'G-D4LJPG83ZY';
const tagUrl = `https://www.googletagmanager.com/gtag/js?id=${id}`;
const response = await fetch(tagUrl);
assert.equal(response.status, 200);
const tag = await response.text();
const marker = 'PRIVATE_ANALYTICS_CANARY';
const fixture = {
  categories: [], parties: [], paymentSources: [], expenses: [],
  householdName: marker, total: 0, count: 0, filteredCount: 0, filteredTotal: 0,
  breakdown: [], summaryRemainder: 0, summaryCount: 0,
};
const output = 'test-results/analytics';
await mkdir(output, { recursive: true });
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  try {
    for (const mode of ['enabled', 'preview-host', 'local', 'login', 'unauthorized', 'dnt', 'gpc', 'blocked']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 680 }, locale: 'ja-JP' });
      const page = await context.newPage();
      const collected = [], errors = [], scripts = [], unexpected = [];
      const waitForViews = async count => {
        for (let attempt = 0; attempt < 100 && collected.filter(item => item.event === 'page_view').length < count; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(collected.filter(item => item.event === 'page_view').length, count, `${name}: GA delivery for view ${count}`);
      };
      page.on('pageerror', error => errors.push(error.message));
      if (mode === 'dnt') await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
      if (mode === 'gpc') await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
      const appOrigin = mode === 'preview-host' ? 'https://famfi-preview.example.invalid' : mode === 'local' ? base : origin;
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.url() === tagUrl) {
          scripts.push(request.url());
          if (mode === 'blocked') return route.abort();
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: tag });
        }
        if (/(^|\.)google-analytics\.com$/.test(url.hostname) && url.pathname.endsWith('/collect')) {
          for (const line of (request.postData() ?? '').split('\n')) {
            const raw = url.search.slice(1) + '&' + line;
            const params = new URLSearchParams(raw);
            collected.push({ event: params.get('en'), id: params.get('tid'), location: params.get('dl'), title: params.get('dt'), referrer: params.get('dr') });
            check(![...params.values()].some(value => value.includes(marker)), 'Private fixture content never enters the GA request');
          }
          return route.fulfill({ status: 204 });
        }
        if (url.origin !== appOrigin) {
          unexpected.push(url.origin + url.pathname);
          return route.abort();
        }
        if (url.pathname.startsWith('/api/')) {
          check(request.method() === 'GET', 'Browser test is read-only');
          let body;
          if (url.pathname === '/api/expenses') {
            if (mode === 'unauthorized') return route.fulfill({ status: 401, json: { error: 'Synthetic sign-in required' } });
            body = fixture;
          } else if (url.pathname === '/api/attention') body = { count: 0 };
          else if (url.pathname === '/api/summaries') body = [];
          else if (url.pathname === '/api/finance/bank') body = { amount: 0, review: { complete: false, version: 0 } };
          else return route.fulfill({ status: 503, json: { error: 'Synthetic screen response unavailable' } });
          return route.fulfill({ status: 200, json: body });
        }
        const local = await route.fetch({ url: base + url.pathname + url.search, maxRedirects: 0 });
        await route.fulfill({ response: local });
      });
      await page.goto(appOrigin + (mode === 'login' ? '/login' : '/expenses') + '?search=' + marker + '#token=' + marker);
      if (['login', 'unauthorized'].includes(mode)) {
        await page.waitForURL('**/login*');
        await page.getByRole('heading', { name: 'ログイン', exact: true }).waitFor();
      } else await page.getByTestId('monthly-total').waitFor();

      if (mode === 'enabled') {
        await page.waitForFunction(() => window.famfiAnalytics?.lastLocation.endsWith('/expenses'));
        await waitForViews(1);
        await page.getByRole('button', { name: '一覧を更新', exact: true }).click();
        await page.getByRole('button', { name: '詳細な絞り込み', exact: true }).click();
        await page.getByLabel('内容・メモを検索', { exact: true }).fill(marker);
        await page.getByRole('button', { name: '検索', exact: true }).click();
        await page.getByTestId('monthly-total').waitFor();
        await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: '家計サマリー', exact: true }).click();
        await page.waitForFunction(() => window.famfiAnalytics?.lastLocation.endsWith('/summary'));
        await waitForViews(2);
        await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: '支出', exact: true }).click();
        await page.waitForFunction(() => window.famfiAnalytics?.lastLocation.endsWith('/expenses'));
        await waitForViews(3);
        await page.screenshot({ path: `${output}/${name}-enabled.png` });
        // Leave the visible page to also exercise engagement delivery, intercepted above.
        await page.goto(appOrigin + '/login');
        await page.getByRole('heading', { name: 'ログイン', exact: true }).waitFor();
        const views = collected.filter(item => item.event === 'page_view');
        check(views.length === 3, `${name}: exactly three screen views, got ${views.length}`);
        check(views.every(item => item.id === id), 'Correct measurement ID in actual GA payloads');
        assert.deepEqual(views.map(item => item.location), ['/expenses', '/expenses/summary', '/expenses'].map(path => origin + path)); checks++;
        check(views.every(item => !item.referrer && !item.location.includes('?') && !item.location.includes('#')), 'Clean virtual URLs and no referrer');
        check(collected.every(item => ['page_view', 'user_engagement'].includes(item.event)), 'No form, search, click, or download events');
        check(scripts.length === 1, 'One tag load per document');
      } else if (mode === 'blocked') {
        await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: '支出を記録', exact: true }).click();
        await page.getByRole('dialog', { name: '支出を記録', exact: true }).waitFor();
        check(!collected.length, 'Blocked analytics sends no events and entry still opens');
      } else {
        check(!await page.locator('#famfi-google-analytics').count(), `${mode}: no GA script`);
        check(!scripts.length && !collected.length, `${mode}: no external tracking requests`);
      }
      check(!errors.length, `${mode}: no page errors: ${errors.join(', ')}`);
      check(!unexpected.length, `${mode}: no unexpected external requests: ${unexpected.join(', ')}`);
      await page.goto('about:blank');
      await page.unrouteAll({ behavior: 'wait' });
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(`PASS: ${checks} GA4 browser checks (Chromium/WebKit); synthetic data, no DB, all collection intercepted.`);
