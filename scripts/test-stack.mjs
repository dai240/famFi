// Disposable loopback-only integration stack. Never connects to Supabase or loads production credentials.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); revoke all on schema public from public;');
const migrations = path.resolve(process.env.INFRA_PATH ?? '../personal-apps-infra', 'supabase/migrations');
for (const file of (await readdir(migrations)).sort()) {
  if (/shared_foundation|shared_runtime_admin_membership|famfi_expense_mvp/.test(file)) await db.exec(await readFile(path.join(migrations, file), 'utf8'));
}
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
await db.exec(`insert into auth.users values ${ids.map(id => `('${id}')`).join(',')}; insert into famfi.memberships(user_id) values ('${ids[0]}'), ('${ids[1]}'); set session authorization famfi_app;`);
const pg = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55432 });
await pg.start();
function user(index) {
  return { id: ids[index], aud: 'authenticated', role: 'authenticated', email: `fixture${index}@example.invalid`,
    email_confirmed_at: '2026-01-01T00:00:00Z', confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], is_anonymous: false, created_at: '2026-01-01T00:00:00Z' };
}
function session(index) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ids[index], exp: expires, aud: 'authenticated', role: 'authenticated' })}.fixture`,
    refresh_token: `fixture-refresh-${index}`, expires_in: 3600, expires_at: expires, token_type: 'bearer', user: user(index) };
}
const auth = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  let result = {};
  let status = 200;
  if (request.url.startsWith('/auth/v1/verify')) {
    const index = ['111111', '222222', '333333'].indexOf(body.token);
    if (index < 0) { status = 400; result = { msg: 'Invalid fixture code' }; }
    else result = session(index);
  } else if (request.url.startsWith('/auth/v1/user')) {
    const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
    let sub;
    try { sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub; } catch {}
    const index = ids.indexOf(sub);
    if (index < 0 || !token.endsWith('.fixture')) { status = 401; result = { msg: 'Invalid fixture session' }; }
    else result = user(index);
  } else if (request.url.startsWith('/auth/v1/token')) {
    const index = Number(String(body.refresh_token).slice(-1));
    if (!Number.isInteger(index) || !ids[index]) { status = 401; result = { msg: 'Invalid fixture refresh' }; }
    else result = session(index);
  } else if (!request.url.startsWith('/auth/v1/otp') && !request.url.startsWith('/auth/v1/logout')) status = 404;
  response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(result));
});
await new Promise(resolve => auth.listen(55433, '127.0.0.1', resolve));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '-p', '3101'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://famfi_app:fixture@127.0.0.1:55432/postgres?schema=famfi',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55433', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
    FAMFI_ALLOWED_EMAIL: 'fixture0@example.invalid', APP_ORIGIN: 'http://127.0.0.1:3101' },
});
console.log('Disposable test stack: http://127.0.0.1:3101/login; fixture0@example.invalid / 111111');
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; child.kill('SIGTERM');
  auth.close(); await pg.stop(); await db.close(); process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop); child.on('exit', stop);
