import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decryptBackup } from './backup.mjs';

const fields = ['id', 'userId', 'amount', 'date', 'categoryId', 'description', 'memo', 'version', 'createdAt', 'updatedAt'];
const normalize = row => ({ ...Object.fromEntries(fields.map(key => [key, row[key]])),
  date: new Date(row.date).toISOString().slice(0, 10), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() });

export async function verifyBackupRestore(backup) {
  assert.match(backup.ownerId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); revoke all on schema public from public;');
    const migrations = path.resolve(process.env.INFRA_PATH ?? '../personal-apps-infra', 'supabase/migrations');
    for (const file of (await readdir(migrations)).sort()) {
      if (/shared_foundation|shared_runtime_admin_membership|famfi_expense_mvp/.test(file)) await db.exec(await readFile(path.join(migrations, file), 'utf8'));
    }
    const other = randomUUID();
    await db.query('insert into auth.users(id) values ($1), ($2)', [backup.ownerId, other]);
    await db.query('insert into famfi.memberships(user_id) values ($1), ($2)', [backup.ownerId, other]);
    await db.exec('delete from famfi.categories');
    for (const category of backup.categories) {
      await db.query('insert into famfi.categories(id,name,color,sort_order) values ($1,$2,$3,$4)', [category.id, category.name, category.color, category.sortOrder]);
    }
    for (const expense of backup.expenses) {
      assert.equal(expense.userId, backup.ownerId);
      await db.query('insert into famfi.expenses(id,user_id,amount,date,category_id,description,memo,version,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', fields.map(key => expense[key]));
    }
    await db.exec('begin; set local session authorization famfi_app');
    await db.query("select set_config('app.user_id', $1, true)", [backup.ownerId]);
    const categories = await db.query('select id,name,color,sort_order as "sortOrder" from famfi.categories order by id');
    const expenses = await db.query('select id,user_id as "userId",amount,date,category_id as "categoryId",description,memo,version,created_at as "createdAt",updated_at as "updatedAt" from famfi.expenses order by id');
    const sort = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(categories.rows, sort(backup.categories));
    assert.deepEqual(expenses.rows.map(normalize), sort(backup.expenses).map(normalize));
    await db.query("select set_config('app.user_id', $1, true)", [other]);
    assert.equal((await db.query('select count(*)::int as n from famfi.expenses')).rows[0].n, 0);
    await db.exec('rollback');
    return { expenses: backup.expenses.length, categories: backup.categories.length };
  } finally { await db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  (async () => {
    const counts = await verifyBackupRestore(await decryptBackup(process.argv[2]));
    console.log(`PASS: encrypted backup restored in memory; ${counts.expenses} expenses, ${counts.categories} categories match; another user sees no expenses. Production DB untouched.`);
  })().catch(() => { console.error('Backup restore verification failed. Backup contents are not displayed.'); process.exitCode = 1; });
}
