import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localPostgres } from './local-postgres.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

assert.ok(process.env.FAMFI_TEST_PG_BIN);
process.env.NODE_ENV = 'development'; process.env.FAMFI_DB_SCHEMA = 'famfi';
process.env.DATABASE_URL = 'postgresql://famfi_app:fixture@127.0.0.1:55434/postgres';
const db = await localPostgres(process.env.FAMFI_TEST_PG_BIN, 55434);
const directory = await mkdtemp(path.join(tmpdir(), 'famfi-cleanup-test-'));
let getPrisma;
try {
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);revoke all on schema public from public;');
  const migrations = path.resolve('../personal-apps-infra/supabase/migrations');
  for (const file of (await readdir(migrations)).sort()) if (/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_.*)\.sql$/.test(file)) await db.exec(await readFile(path.join(migrations, file), 'utf8'));
  const owner = randomUUID(), other = randomUUID(), batch = 'b'.repeat(64);
  await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
  await db.query('insert into famfi.memberships(user_id) values($1),($2)', [owner, other]);
  await db.query('select famfi.provision_household($1),famfi.provision_household($2)', [owner, other]);
  const { prepareSample, applySample } = await import('./seed-summer-sample.mjs');
  const { captureCleanupHousehold, assertSameSnapshot, validateCleanupSnapshot, applyReviewedCleanup, verifyCleanupResult } = await import('./clear-sample-records.mjs');
  const require = createRequire(import.meta.url), prisma = require('../lib/prisma.ts');
  getPrisma = prisma.getPrisma;
  const { insertCash } = require('../lib/cash-movement-service.ts');
  const { readAttention } = require('../lib/planning-service.ts');
  const plan = await prepareSample(owner);
  await applySample(owner, plan);
  const otherPlan = await prepareSample(other);
  await applySample(other, { ...otherPlan, rules: [], rows: otherPlan.rows.slice(0, 1) });
  await prisma.withLedgerDb(owner, async (tx, scope) => {
    const shared = await tx.party.findFirstOrThrow({ where: { systemKey: 'shared' } });
    const bank = await tx.paymentSource.findFirstOrThrow({ where: { method: 'bank', fundingPartyId: shared.id } });
    for (const [index, amount] of [12345, -678].entries()) await insertCash(tx, scope.ledgerId, randomUUID(),
      { date: '2026-09-01', amount, kind: 'unknown', description: 'Synthetic bank fixture', memo: '', partyId: null, paymentSourceId: bank.id },
      { key: String(index + 1).repeat(64), batch });
  });
  const before = await captureCleanupHousehold(owner), otherBefore = await captureCleanupHousehold(other);
  validateCleanupSnapshot(before, batch, 2);
  assert.throws(() => validateCleanupSnapshot(before, 'a'.repeat(64), 2));
  assert.throws(() => validateCleanupSnapshot(before, batch, 3));
  assert.throws(() => validateCleanupSnapshot({ ...before, settlements: [{}] }, batch, 2));
  assert.throws(() => validateCleanupSnapshot({ ...before, environment: 'famfi_preview' }, batch, 2));
  await assert.rejects(applyReviewedCleanup(other, before, batch, 2));
  await assert.rejects(applyReviewedCleanup(randomUUID(), before, batch, 2));
  const file = await encryptBackup(before, directory);
  await verifyBackupRestore(await decryptBackup(file, directory));
  // A reviewed snapshot must become unusable if a family member changes even a memo.
  await prisma.withLedgerDb(owner, tx => tx.expense.update({ where: { id: before.expenses[0].id }, data: { memo: 'changed after backup', version: { increment: 1 } } }));
  const fresh = await captureCleanupHousehold(owner);
  await assert.rejects(applyReviewedCleanup(owner, before, batch, 2));
  assertSameSnapshot(fresh, await captureCleanupHousehold(owner));
  const after = await applyReviewedCleanup(owner, fresh, batch, 2);
  verifyCleanupResult(fresh, after);
  assert.equal(after.expenses.length, 0); assert.equal(after.recurringRules.length, 10);
  assert.ok(after.recurringRules.every(r => r.archived)); assert.equal(after.cashMovements.length, 2);
  const attention = await prisma.withUserDb(owner, tx => readAttention(tx));
  assert.equal(attention.items.length, 0);
  assertSameSnapshot(otherBefore, await captureCleanupHousehold(other));
  const final = await encryptBackup(after, directory);
  await verifyBackupRestore(await decryptBackup(final, directory));
  await assert.rejects(prisma.withUserDb(owner, tx => tx.$executeRawUnsafe('delete from famfi.audit_events')));
  console.log('PASS: synthetic cleanup removes 85 expenses, stops 10 rules, retains imported cash/masters/audit, rejects stale snapshots/outsiders/unsupported records, isolates other household, clears reminders, and restores both v8 backups.');
} finally { await getPrisma?.().$disconnect(); await db.close(); await rm(directory, { recursive: true, force: true }); }
