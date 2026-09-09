import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '../lib/api';
test('mutations require the exact configured origin', () => {
  process.env.APP_ORIGIN = 'https://famfi-nu.vercel.app';
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://internal/api', { headers: { origin: process.env.APP_ORIGIN! } })));
  for (const origin of ['', 'https://evil.example', 'https://famfi-nu.vercel.app.evil.example']) {
    assert.throws(() => assertSameOrigin(new Request('https://internal/api', { headers: { origin } })), ApiError);
  }
  delete process.env.APP_ORIGIN;
  assert.throws(() => assertSameOrigin(new Request('https://internal/api')), ApiError);
});
test('body limits and JSON content type enforced', async () => {
  const request = (body: string, contentType = 'application/json') => new Request('https://app/api', { method: 'POST', body, headers: { 'content-type': contentType } });
  assert.deepEqual(await readJson(request('{"amount":980}')), { amount: 980 });
  await assert.rejects(readJson(request('{}', 'text/plain')), ApiError);
  await assert.rejects(readJson(request('x'.repeat(17000))), ApiError);
  await assert.rejects(readJson(request('{')), SyntaxError);
});
test('private responses are never cached and errors do not leak details', async () => {
  assert.equal(json({}).headers.get('cache-control'), 'private, no-store, max-age=0');
  const response = apiError(new ApiError(403, 'Forbidden'));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Forbidden' });
});
