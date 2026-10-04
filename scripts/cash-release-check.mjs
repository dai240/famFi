// Live v7 -> v8 rollout checks. Every probe write, including audit, is rolled back.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup, notesBackupTables, cashBackupTables, normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

async function main() {
  const [mode, filename] = process.argv.slice(2), schema = process.env.FAMFI_DB_SCHEMA;
  assert.ok(['famfi', 'famfi_preview'].includes(schema));
  assert.ok(['before', 'after'].includes(mode));
  assert.equal(process.env.NODE_ENV, 'production');
  const owners = await adminQuery(`select hm.user_id from ${schema}.household_members hm
    join ${schema}.parties p on p.id=hm.party_id
    join ${schema}.memberships m on m.user_id=hm.user_id
    join auth.users u on u.id=hm.user_id
    where p.system_key='owner' and m.active and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())`);
  assert.equal(owners.length, 1);
  const actor = owners[0].user_id;
  const previous = mode === 'after' ? await decryptBackup(filename) : null;
  if (previous) {
    assert.equal(previous.format, 'famfi-expenses/v7');
    assert.equal(previous.environment, schema);
  }
  const db = new pg.Client(databaseOptions((await readFile(schema === 'famfi'
    ? '.private/database-url' : '.private/preview-database-url', 'utf8')).trim(), 'production'));
  await db.connect();
  const capture = async () => {
    await db.query('begin isolation level repeatable read read only');
    try {
      await db.query("select set_config('app.user_id',$1,true)", [actor]);
      return await captureHouseholdBackup((sql, values) => db.query(sql, values), actor, undefined, schema);
    } finally { await db.query('rollback'); }
  };
  try {
    assert.equal((await db.query('select current_user as role')).rows[0].role, schema + '_app');
    const snapshot = await capture();
    assert.equal(snapshot.format, mode === 'before' ? 'famfi-expenses/v7' : 'famfi-expenses/v8');
    if (previous) {
      assert.equal(snapshot.ownerId, previous.ownerId);
      assert.deepEqual(snapshot.household, previous.household);
      for (const t of notesBackupTables) assert.deepEqual(normalizeBackupRows(snapshot[t.key], t.fields),
        normalizeBackupRows(previous[t.key], t.fields), t.key + ' preservation');
      assert.equal(snapshot.cashMovements.length, 0);
    }
    const output = await encryptBackup(snapshot);
    await verifyBackupRestore(await decryptBackup(output));
    console.log('PASS: ' + schema + ' ' + snapshot.format + ' encrypted backup and isolated restore: ' + output);
    if (mode === 'before') return;
    for (const t of cashBackupTables) assert.equal((await db.query(`select count(*)::int n from ${schema}.${t.table}`)).rows[0].n, 0);
    for (const sql of [
      'select * from ' + (schema === 'famfi' ? 'famfi_preview' : 'famfi') + '.cash_movements',
      'select * from compath.owner_states', 'select * from auth.users', 'select * from platform.apps',
      'set role postgres', 'set role service_role', 'set role ' + (schema === 'famfi' ? 'famfi_preview_app' : 'famfi_app'),
      `update ${schema}.memberships set active=false`,
    ]) {
      await db.query('begin');
      try { await assert.rejects(db.query(sql)); } finally { await db.query('rollback'); }
    }
    await db.query('begin');
    try {
      const denied = async (sql, values = []) => {
        await db.query('savepoint denied');
        await assert.rejects(db.query(sql, values));
        await db.query('rollback to savepoint denied');
      };
      await db.query("select set_config('app.user_id',$1,true)", [actor]);
      const shared = snapshot.parties.find(p => p.systemKey === 'shared');
      assert.ok(shared);
      const sourceId = randomUUID(), cashId = randomUUID(), key = 'a'.repeat(64);
      await db.query(`insert into ${schema}.payment_sources(id,user_id,name,method,funding_party_id,default_treatment)
        values($1,$2,$3,'bank',$4,'shared')`, [sourceId, snapshot.ownerId, 'ROLLBACK bank ' + sourceId, shared.id]);
      await db.query(`insert into ${schema}.cash_movements(id,user_id,payment_source_id,date,amount,kind,description,import_key,import_batch)
        values($1,$2,$3,'2037-09-01',-100,'card_payment','ROLLBACK cash probe',$4,$4)`, [cashId, snapshot.ownerId, sourceId, key]);
      await db.query(`update ${schema}.cash_movements set memo='checked',version=version+1 where id=$1`, [cashId]);
      assert.deepEqual((await db.query(`select amount,memo,version,party_id from ${schema}.cash_movements where id=$1`, [cashId])).rows[0],
        { amount: -100, memo: 'checked', version: 2, party_id: null });
      assert.equal((await db.query(`select count(*)::int n from ${schema}.audit_events where entity_type='cash_movements' and entity_id=$1`, [cashId])).rows[0].n, 2);
      await denied(`update ${schema}.cash_movements set amount=-200,version=version+1 where id=$1`, [cashId]);
      await denied(`update ${schema}.cash_movements set memo='stale' where id=$1`, [cashId]);
      await denied(`delete from ${schema}.cash_movements where id=$1`, [cashId]);
      await denied(`update ${schema}.payment_sources set method='card',version=version+1 where id=$1`, [sourceId]);
      await denied(`insert into ${schema}.cash_movements(id,user_id,payment_source_id,date,amount,description,created_at)
        values($1,$2,$3,'2037-09-01',1,'denied',now())`, [randomUUID(), snapshot.ownerId, sourceId]);
      await db.query(`update ${schema}.cash_movements set voided=true,version=version+1 where id=$1`, [cashId]);
      await denied(`update ${schema}.cash_movements set voided=false,version=version+1 where id=$1`, [cashId]);
      await denied(`insert into ${schema}.cash_movements(id,user_id,payment_source_id,date,amount,description,import_key,import_batch)
        values($1,$2,$3,'2037-09-01',-100,'duplicate',$4,$4)`, [randomUUID(), snapshot.ownerId, sourceId, key]);
      await db.query("select set_config('app.user_id',$1,true)", [randomUUID()]);
      for (const t of cashBackupTables) assert.equal((await db.query(`select count(*)::int n from ${schema}.${t.table}`)).rows[0].n, 0);
      await denied(`insert into ${schema}.cash_movements(id,user_id,payment_source_id,date,amount,description)
        values($1,$2,$3,'2037-09-01',-100,'denied')`, [randomUUID(), snapshot.ownerId, sourceId]);
    } finally { await db.query('rollback'); }
    const final = await capture();
    for (const t of cashBackupTables) assert.deepEqual(normalizeBackupRows(final[t.key], t.fields),
      normalizeBackupRows(snapshot[t.key], t.fields), t.key + ' rollback');
    console.log('PASS: ' + schema + ' old fields preserved; runtime TLS, CRUD/audit, immutable imports, deduplication, outsider and cross-schema denial. All probes rolled back.');
  } finally { await db.end(); }
}
main().catch(error => {
  console.error('Cash release check failed; records and credentials suppressed.', { type: error?.name, code: error?.code });
  process.exitCode = 1;
});
