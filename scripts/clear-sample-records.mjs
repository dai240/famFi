// Operator-only cleanup of an explicitly approved snapshot, never a database reset.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup, cashBackupTables, normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = { exports: {} };
const { withLedgerDb, getPrisma } = require('../lib/prisma.ts');

function capture(tx, actor) {
  return captureHouseholdBackup(async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe(sql, ...values) }), actor, undefined, 'famfi');
}
export function captureCleanupHousehold(actor) {
  return withLedgerDb(actor, tx => capture(tx, actor));
}
export function assertSameSnapshot(before, after) {
  for (const key of ['format', 'environment', 'ownerId', 'exportedByPartyId', 'household']) assert.deepEqual(after[key], before[key], key + ' changed');
  for (const t of cashBackupTables) assert.deepEqual(normalizeBackupRows(after[t.key], t.fields), normalizeBackupRows(before[t.key], t.fields), t.key + ' changed');
}
export function validateCleanupSnapshot(snapshot, batch, count) {
  assert.equal(snapshot.format, 'famfi-expenses/v8');
  assert.equal(snapshot.environment, 'famfi');
  assert.match(batch, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(count) && count > 0);
  assert.equal(snapshot.cashMovements.length, count, 'Unexpected cash movements require review');
  assert.ok(snapshot.cashMovements.every(row => row.importBatch === batch && row.importKey && !row.voided), 'Only the reviewed import may remain');
  // This one-time operation is deliberately narrower than a general-purpose purge.
  for (const key of ['settlements', 'plannedExpenses', 'expenseSummaries', 'householdNotes']) assert.equal(snapshot[key].length, 0, key + ' requires a separate reviewed cleanup');
  assert.ok(snapshot.expenses.length <= 250 && snapshot.recurringRules.length <= 200, 'Cleanup exceeds a short atomic transaction');
  const expenseIds = new Set(snapshot.expenses.map(row => row.id));
  assert.ok(snapshot.recurringOccurrences.every(row => !row.expenseId || expenseIds.has(row.expenseId)), 'Unexpected recurring link');
}
export function verifyCleanupResult(before, after) {
  for (const key of ['format', 'environment', 'ownerId', 'exportedByPartyId', 'household']) assert.deepEqual(after[key], before[key]);
  assert.equal(after.expenses.length, 0);
  const changed = new Set(['expenses', 'recurringRules', 'recurringOccurrences', 'auditEvents']);
  for (const t of cashBackupTables.filter(t => !changed.has(t.key))) assert.deepEqual(normalizeBackupRows(after[t.key], t.fields), normalizeBackupRows(before[t.key], t.fields), t.key + ' preservation');
  const rules = cashBackupTables.find(t => t.key === 'recurringRules');
  assert.equal(after.recurringRules.length, before.recurringRules.length);
  for (const old of before.recurringRules) {
    const row = after.recurringRules.find(r => r.id === old.id);
    assert.ok(row?.archived);
    assert.equal(row.version, old.version + Number(!old.archived));
    const fields = rules.fields.filter(k => !['archived', 'version', 'updatedAt'].includes(k));
    assert.deepEqual(normalizeBackupRows([row], fields), normalizeBackupRows([old], fields));
  }
  const occurrences = cashBackupTables.find(t => t.key === 'recurringOccurrences');
  assert.equal(after.recurringOccurrences.length, before.recurringOccurrences.length);
  for (const old of before.recurringOccurrences) {
    const row = after.recurringOccurrences.find(r => r.id === old.id);
    assert.ok(row);
    const expected = old.expenseId ? { ...old, expenseId: null, state: 'open', version: old.version + 1 } : old;
    const fields = occurrences.fields.filter(k => k !== 'updatedAt');
    assert.deepEqual(normalizeBackupRows([row], fields), normalizeBackupRows([expected], fields));
  }
  const audit = cashBackupTables.find(t => t.key === 'auditEvents'), oldIds = new Set(before.auditEvents.map(r => r.id));
  assert.deepEqual(normalizeBackupRows(after.auditEvents.filter(r => oldIds.has(r.id)), audit.fields), normalizeBackupRows(before.auditEvents, audit.fields));
  const additions = after.auditEvents.filter(r => !oldIds.has(r.id));
  const expectedEvents = [
    ...before.expenses.map(r => ['expenses', r.id, 'DELETE']),
    ...before.recurringRules.filter(r => !r.archived).map(r => ['recurring_rules', r.id, 'UPDATE']),
    ...before.recurringOccurrences.filter(r => r.expenseId).map(r => ['recurring_occurrences', r.id, 'UPDATE']),
  ];
  assert.deepEqual(additions.map(r => [r.entityType, r.entityId, r.action]).sort(), expectedEvents.sort());
  assert.ok(additions.every(r => r.actorPartyId === before.exportedByPartyId));
}
export function applyReviewedCleanup(actor, before, batch, count) {
  validateCleanupSnapshot(before, batch, count);
  return withLedgerDb(actor, async (tx, scope) => {
    assert.equal(scope.ledgerId, before.ownerId);
    assertSameSnapshot(before, await capture(tx, actor));
    const removed = await tx.expense.deleteMany({ where: { userId: scope.ledgerId, id: { in: before.expenses.map(r => r.id) } } });
    assert.equal(removed.count, before.expenses.length);
    // Existing triggers reopen linked periods; stopping their rules removes future reminders.
    const active = before.recurringRules.filter(r => !r.archived);
    const stopped = await tx.recurringRule.updateMany({ where: { userId: scope.ledgerId, archived: false, id: { in: active.map(r => r.id) } },
      data: { archived: true, version: { increment: 1 }, updatedAt: new Date() } });
    assert.equal(stopped.count, active.length);
    const after = await capture(tx, actor);
    verifyCleanupResult(before, after);
    return after;
  });
}
async function checkedBackup(snapshot) {
  const file = await encryptBackup(snapshot);
  await verifyBackupRestore(await decryptBackup(file));
  console.log('Encrypted backup and isolated restore verified: ' + file);
  return file;
}
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    'keep-import-batch': { type: 'string' }, 'expected-cash-count': { type: 'string' },
    backup: { type: 'string' }, 'allow-production-cleanup': { type: 'boolean' },
  } });
  const [mode] = positionals, batch = values['keep-import-batch'], count = Number(values['expected-cash-count']);
  assert.equal(positionals.length, 1); assert.ok(['prepare', 'apply'].includes(mode));
  assert.equal(process.env.NODE_ENV, 'production'); assert.equal(process.env.FAMFI_DB_SCHEMA, 'famfi');
  process.env.DATABASE_URL = (await readFile('.private/database-url', 'utf8')).trim();
  const owners = await adminQuery("select hm.user_id from famfi.household_members hm join famfi.parties p on p.id=hm.party_id and p.user_id=hm.ledger_id join famfi.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())");
  assert.equal(owners.length, 1);
  const actor = owners[0].user_id;
  try {
    const current = await captureCleanupHousehold(actor);
    validateCleanupSnapshot(current, batch, count);
    console.log(JSON.stringify({ expensesToDelete: current.expenses.length, recurringRulesToStop: current.recurringRules.filter(r => !r.archived).length,
      cashMovementsToKeep: current.cashMovements.length, mastersAndAuditPreserved: true }));
    if (mode === 'prepare') { await checkedBackup(current); return; }
    assert.equal(values['allow-production-cleanup'], true);
    const before = await decryptBackup(values.backup);
    validateCleanupSnapshot(before, batch, count);
    assertSameSnapshot(before, current);
    await verifyBackupRestore(before);
    const after = await applyReviewedCleanup(actor, before, batch, count);
    await checkedBackup(after);
    assertSameSnapshot(after, await captureCleanupHousehold(actor));
    console.log(JSON.stringify({ verified: true, expenses: after.expenses.length, activeRecurringRules: after.recurringRules.filter(r => !r.archived).length,
      cashMovements: after.cashMovements.length, auditRetained: true, mastersUnchanged: true }));
  } finally { await getPrisma().$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main().catch(error => {
  console.error('Cleanup stopped; inspect current state before retrying. No automatic retry or restore.', { type: error?.name, code: error?.code, sqlState: error?.meta?.code });
  process.exitCode = 1;
});
