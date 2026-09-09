import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { encryptBackup, decryptBackup } from './backup.mjs';

async function main() {
const root = path.resolve(process.env.INFRA_PATH ?? '../personal-apps-infra');
const db = new PGlite();
const backupDir = await mkdtemp(path.join(tmpdir(), 'famfi-restore-test-'));
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const expense = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let checks = 0;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); revoke all on schema public from public;`);
  for (const filename of (await readdir(path.join(root, 'supabase/migrations'))).sort()) {
    if (/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_.*)\.sql$/.test(filename) && !/household_workflow|member_profiles/.test(filename)) await db.exec(await readFile(path.join(root, 'supabase/migrations', filename), 'utf8'));
  }
  await db.exec(`insert into auth.users values ('${owner}'), ('${other}'), ('${outsider}'); insert into famfi.memberships(user_id) values ('${owner}'), ('${other}'); create schema unrelated; create table unrelated.private_data(id int);`);
  async function asUser<T>(user: string, fn: () => Promise<T>) {
    await db.exec('begin; set local session authorization famfi_app;');
    await db.query("select set_config('app.user_id', $1, true)", [user]);
    try { const result = await fn(); await db.exec('commit'); return result; }
    catch (error) { await db.exec('rollback'); throw error; }
    finally { await db.exec('set session authorization postgres; reset role;'); }
  }
  async function rejects(user: string, sql: string) { await assert.rejects(asUser(user, () => db.exec(sql))); checks++; }
  async function count(user: string, sql: string, expected: number) {
    const result = await asUser(user, () => db.query<{ n: number }>(sql));
    assert.equal(Number(result.rows[0].n), expected); checks++;
  }
  await asUser(owner, () => db.exec(`insert into famfi.expenses(id,user_id,amount,date,category_id) values ('${expense}','${owner}',980,'2026-09-09','food')`)); checks++;
  await count(owner, 'select count(*) n from famfi.expenses', 1);
  await count(other, 'select count(*) n from famfi.expenses', 0);
  await count('', 'select count(*) n from famfi.expenses', 0);
  await count(outsider, 'select count(*) n from famfi.categories', 0);
  await count(owner, 'select count(*) n from famfi.categories', 10);
  await count(owner, 'select count(*) n from famfi.memberships', 1);
  await rejects(other, `insert into famfi.expenses(id,user_id,amount,date,category_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${owner}',980,'2026-09-09','food')`);
  await rejects(outsider, `insert into famfi.expenses(id,user_id,amount,date,category_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${outsider}',980,'2026-09-09','food')`);
  await rejects(owner, `update famfi.expenses set user_id='${other}' where id='${expense}'`);
  await rejects(owner, 'update famfi.memberships set active=false');
  await rejects(owner, 'delete from famfi.categories');
  await rejects(owner, 'select * from platform.apps');
  await rejects(owner, 'select * from auth.users');
  await rejects(owner, 'select * from unrelated.private_data');
  await rejects(owner, 'create table famfi.forbidden(id int)');
  await rejects(owner, 'create table public.forbidden(id int)');
  await rejects(owner, 'create schema forbidden');
  await rejects(owner, 'set role postgres');
  await rejects(owner, `update famfi.expenses set amount=0 where id='${expense}'`);
  await count(owner, "select count(*) n from famfi.expenses where date_precision='day'", 1);
  await rejects(owner, `update famfi.expenses set date_precision='year' where id='${expense}'`);
  await rejects(owner, `update famfi.expenses set date_precision='month' where id='${expense}'`);
  await asUser(owner, () => db.exec(`update famfi.expenses set date='2026-09-01',date_precision='month' where id='${expense}'`)); checks++;
  await count(owner, "select count(*) n from famfi.expenses where date_precision='month' and date >= '2026-09-01' and date < '2026-10-01'", 1);
  await count(other, 'select count(*) n from famfi.expenses', 0);
  await rejects(other, `insert into famfi.expenses(id,user_id,amount,date,date_precision,category_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${owner}',980,'2026-09-01','month','food')`);
  await asUser(other, () => db.exec(`update famfi.expenses set amount=7; delete from famfi.expenses;`));
  await count(owner, 'select amount n from famfi.expenses', 980);
  await asUser(owner, () => db.exec(`update famfi.expenses set amount=1080,version=version+1,updated_at=now() where id='${expense}' and version=1`));
  await count(owner, 'select amount n from famfi.expenses', 1080);
  await asUser(owner, () => db.exec(`update famfi.expenses set amount=7 where id='${expense}' and version=1`));
  await count(owner, 'select amount n from famfi.expenses', 1080);
  await db.exec(`set session authorization postgres; reset role; update famfi.memberships set active=false where user_id='${owner}'`);
  await count(owner, 'select count(*) n from famfi.expenses', 0);
  await db.exec(`set session authorization postgres; reset role; update famfi.memberships set active=true where user_id='${owner}'`);
  const rows = await asUser(owner, () => db.query('select * from famfi.expenses'));
  const filename = await encryptBackup({ format: 'famfi-expenses/v1', ownerId: owner, categories: [], expenses: rows.rows }, backupDir);
  const restored = await decryptBackup(filename, backupDir);
  await asUser(owner, () => db.exec(`delete from famfi.expenses where id='${expense}' and version=2`));
  await count(owner, 'select count(*) n from famfi.expenses', 0);
  // Restore verification uses a disposable local DB, never the shared remote project.
  const row = restored.expenses[0] as Record<string, unknown>;
  await db.query(`insert into famfi.expenses(id,user_id,amount,date,category_id,description,memo,version,created_at,updated_at,date_precision) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ['id','user_id','amount','date','category_id','description','memo','version','created_at','updated_at','date_precision'].map(key => row[key]));
  await count(owner, 'select amount n from famfi.expenses', 1080);
  const restoredRows = await asUser(owner, () => db.query('select * from famfi.expenses'));
  assert.deepEqual(JSON.parse(JSON.stringify(restoredRows.rows)), JSON.parse(JSON.stringify(rows.rows))); checks++;
  console.log(`PASS: ${checks} local Postgres isolation/CRUD/restore checks`);
} finally { await db.close(); await rm(backupDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
