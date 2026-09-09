// Real Next route handlers + Prisma + disposable Postgres; Auth is a loopback-only test double.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://127.0.0.1:3101';
let checks = 0;
function session() {
  const cookies = new Map();
  return async function request(path, method = 'GET', body, origin = base) {
    const response = await fetch(base + path, { method, headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '), origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const part = value.split(';')[0]; const index = part.indexOf('='); cookies.set(part.slice(0,index), part.slice(index+1));
    }
    return response;
  };
}
function status(response, expected) { assert.equal(response.status, expected); checks++; return response; }
const owner = session(), other = session(), outsider = session(), anonymous = session();
const login = (request, token) => request('/api/auth/verify', 'POST', { email: 'fixture0@example.invalid', token });
const invited = session(), unapprovedInvite = session();
status(await invited('/api/auth/verify', 'POST', { email: 'fixture0@example.invalid', token: '444444', type: 'invite' }), 200);
status(await invited('/api/expenses?month=2026-09'), 200);
status(await unapprovedInvite('/api/auth/verify', 'POST', { email: 'fixture0@example.invalid', token: '666666', type: 'invite' }), 403);
status(await unapprovedInvite('/api/expenses?month=2026-09'), 401);
status(await anonymous('/api/auth/verify', 'POST', { email: 'fixture0@example.invalid', token: '444444', type: 'email' }), 401);
status(await anonymous('/api/auth/verify', 'POST', { email: 'fixture0@example.invalid', token: '111111', type: 'recovery' }), 400);
status(await anonymous('/api/auth/verify', 'POST', { email: 'not-allowed@example.invalid', token: '444444', type: 'invite' }), 401);
status(await invited('/api/auth/logout', 'POST'), 200);
status(await anonymous('/api/expenses?month=2026-09'), 401);
status(await login(owner, '111111'), 200);
status(await login(other, '222222'), 200);
status(await login(outsider, '333333'), 403);
status(await outsider('/api/expenses?month=2026-09'), 401);
const before = await (await owner('/api/expenses?month=2026-09')).json();
const id = randomUUID();
const data = { id, amount: 1234, date: '2026-09-09', categoryId: 'food', description: '=1+1', memo: 'test,"quoted"\nline' };
status(await owner('/api/expenses', 'POST', data, 'https://evil.example'), 403);
status(await owner('/api/expenses', 'POST', { ...data, userId: '22222222-2222-4222-8222-222222222222' }), 400);
status(await owner('/api/expenses?month=2026-09&userId=someone'), 400);
for (const override of [{ amount: 0 }, { amount: 1.1 }, { amount: '1234' }, { date: '2026-02-31' }, { categoryId: 'unknown' }]) status(await owner('/api/expenses', 'POST', { ...data, ...override }), 400);
const first = await status(await owner('/api/expenses', 'POST', data), 201).json();
assert.equal(first.version, 1); checks++;
status(await owner('/api/expenses', 'POST', data), 200);
status(await owner('/api/expenses', 'POST', { ...data, amount: 100 }), 409);
const after = await (await owner('/api/expenses?month=2026-09')).json();
assert.equal(after.total, before.total + 1234); assert.equal(after.count, before.count + 1); checks += 2;
status(await other(`/api/expenses/${id}`), 404);
const { id: ignored, ...fields } = data;
status(await other(`/api/expenses/${id}`, 'PUT', { ...fields, version: 1 }), 404);
status(await other(`/api/expenses/${id}`, 'DELETE', { version: 1 }), 404);
const updated = await status(await owner(`/api/expenses/${id}`, 'PUT', { ...fields, amount: 2234, version: 1 }), 200).json();
assert.equal(updated.version, 2); checks++;
status(await owner(`/api/expenses/${id}`, 'PUT', { ...fields, amount: 3, version: 1 }), 409);
status(await owner(`/api/expenses/${id}`, 'DELETE', { version: 1 }), 409);
const csvResponse = status(await owner('/api/expenses/export?month=2026-09'), 200);
assert.match(csvResponse.headers.get('cache-control'), /no-store/); checks++;
const csv = await csvResponse.text(); assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('2234')); checks += 2;
status(await anonymous('/api/expenses/export'), 401);
status(await owner('/api/categories', 'POST', { name: 'not allowed' }), 405);
status(await owner('/api/people'), 404);
status(await owner('/api/expenses', 'POST', { ...data, memo: 'x'.repeat(20000) }), 413);
status(await owner(`/api/expenses/${id}`, 'DELETE', { version: 2 }), 200);
const restored = await (await owner('/api/expenses?month=2026-09')).json(); assert.equal(restored.total, before.total); checks++;
status(await owner('/api/auth/logout', 'POST'), 200);
status(await owner('/api/expenses?month=2026-09'), 401);
console.log(`PASS: ${checks} HTTP auth/CRUD/isolation/idempotency/conflict/CSV checks`);
