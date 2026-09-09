import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('date precision migration preserves existing expenses and rejects changed shared history', async () => {
  const db = new PGlite();
  try {
    const directory = path.resolve(process.env.INFRA_PATH ?? '../personal-apps-infra', 'supabase/migrations');
    const files = (await readdir(directory)).sort();
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); revoke all on schema public from public');
    for (const filename of files.filter(file => /_(shared_foundation|shared_runtime_admin_membership|famfi_expense_mvp)\.sql$/.test(file))) {
      await db.exec(await readFile(path.join(directory, filename), 'utf8'));
    }
    const owner = '11111111-1111-4111-8111-111111111111';
    await db.query('insert into auth.users(id) values ($1)', [owner]);
    await db.query('insert into famfi.memberships(user_id) values ($1)', [owner]);
    await db.query("insert into famfi.expenses(id,user_id,amount,date,category_id,description) values ($1,$1,2500,'2026-09-09','food','Existing fixture')", [owner]);
    const before = (await db.query('select * from famfi.expenses')).rows[0];
    await db.exec("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key); insert into supabase_migrations.schema_migrations values ('unexpected')");
    const filename = files.find(file => /_famfi_expense_date_precision\.sql$/.test(file));
    assert.ok(filename);
    const migration = await readFile(path.join(directory, filename), 'utf8');
    await assert.rejects(db.exec(migration), /Shared migration history changed/);
    await db.exec("delete from supabase_migrations.schema_migrations; insert into supabase_migrations.schema_migrations values ('20260909090314'),('20260909090553'),('20260909095423'),('20260909105437')");
    await db.exec(migration);
    const { date_precision, ...after } = (await db.query<Record<string, unknown>>('select * from famfi.expenses')).rows[0];
    assert.equal(date_precision, 'day');
    assert.deepEqual(after, before);
  } finally { await db.close(); }
});
