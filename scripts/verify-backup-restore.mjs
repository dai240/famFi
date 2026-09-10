import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decryptBackup } from './backup.mjs';
import { backupTables, householdBackupTables, profileBackupTables, planningBackupTables, normalizeBackupRows, sqlColumn } from './backup-model.mjs';

export async function verifyBackupRestore(backup) {
  assert.match(backup.ownerId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const isV6 = backup.format === 'famfi-expenses/v6';
  const isV5 = backup.format === 'famfi-expenses/v5'||isV6;
  const isV4 = backup.format === 'famfi-expenses/v4' || isV5;
  const isV3 = backup.format === 'famfi-expenses/v3' || isV4;
  const tables = isV6?planningBackupTables:isV5 ? profileBackupTables : isV4 ? householdBackupTables : backupTables;
  if(isV4){assert.equal(backup.household?.id,backup.ownerId);for(const dataset of tables)assert.ok(Array.isArray(backup[dataset.key]));}
  if (isV3) for (const key of ['parties','paymentSources','settlements']) assert.ok(Array.isArray(backup[key]));
  const restoredExpenses = backup.expenses.map(expense => {
    // Legacy v1 snapshots predate precision and contain only exact dates.
    const datePrecision = expense.datePrecision ?? (backup.format === 'famfi-expenses/v2' || isV3 ? undefined : 'day');
    assert.ok(datePrecision === 'day' || datePrecision === 'month');
    const defaults = { usedByPartyId:null,beneficiaryPartyId:null,paidByPartyId:null,paymentSourceId:null,reimbursementStatus:'unknown',reimbursementFromPartyId:null,reimbursementToPartyId:null,reimbursementAmount:0 };
    return { ...(isV3 ? {} : defaults), ...expense, datePrecision };
  });
  const payload = { ...backup, expenses: restoredExpenses, categories: backup.categories.map(c => isV3 ? c : { userId:backup.ownerId,parentId:null,archived:false,version:1,...c }),
    parties: backup.parties ?? [], paymentSources: backup.paymentSources ?? [], settlements: backup.settlements ?? [] };
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); revoke all on schema public from public;');
    const migrations = path.resolve(process.env.INFRA_PATH ?? '../personal-apps-infra', 'supabase/migrations');
    for (const file of (await readdir(migrations)).sort()) {
      if (/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_(?!preview).*)\.sql$/.test(file) && (isV4 || !/household_workflow|member_profiles/.test(file))) await db.exec(await readFile(path.join(migrations, file), 'utf8'));
      if(isV6&&/^\d+_famfi_preview_planning\.sql$/.test(file))await db.exec((await readFile(path.join(migrations,file),'utf8')).replaceAll('famfi_preview','famfi'));
    }
    const other = randomUUID();
    await db.query('insert into auth.users(id) values ($1), ($2)', [backup.ownerId, other]);
    await db.query('insert into famfi.memberships(user_id) values ($1), ($2)', [backup.ownerId, other]);
    await db.query('delete from famfi.category_entries where user_id=$1', [backup.ownerId]);
    if(isV4)await db.query('insert into famfi.households(id,name) values($1,$2)',[backup.ownerId,backup.household.name]);
    for (const dataset of tables) {
      let rows = payload[dataset.key];
      if (dataset.key === 'categories') rows = [...rows].sort((a,b) => Number(Boolean(a.parentId))-Number(Boolean(b.parentId)));
      for (const row of rows) {
        assert.equal(row.userId,backup.ownerId);
        for (const field of dataset.fields) assert.notEqual(row[field],undefined,`Missing ${dataset.key}.${field}`);
        await db.query(`insert into famfi.${dataset.table}(${dataset.fields.map(sqlColumn).join(',')}) values (${dataset.fields.map((_,i)=>'$'+(i+1)).join(',')})`,dataset.fields.map(key=>['beforeData','afterData'].includes(key) && row[key]!==null ? JSON.stringify(row[key]) : row[key]));
      }
    }
    if(isV4){
      const ownerParty=payload.parties.find(p=>p.systemKey==='owner');assert.ok(ownerParty);
      await db.query('insert into famfi.household_members(user_id,ledger_id,party_id) values($1,$1,$2)',[backup.ownerId,ownerParty.id]);
      await db.query('select famfi.provision_household($1)',[other]);
    }
    await db.exec('begin; set local session authorization famfi_app');
    await db.query("select set_config('app.user_id', $1, true)", [backup.ownerId]);
    for (const dataset of tables) {
      const result=await db.query(`select ${dataset.fields.map(key=>`${sqlColumn(key)} as "${key}"`).join(',')} from famfi.${dataset.table}`);
      assert.deepEqual(normalizeBackupRows(result.rows,dataset.fields),normalizeBackupRows(payload[dataset.key],dataset.fields));
    }
    await db.query("select set_config('app.user_id', $1, true)", [other]);
    for (const dataset of tables) assert.equal((await db.query(`select count(*)::int as n from famfi.${dataset.table} where user_id=$1`,[backup.ownerId])).rows[0].n,0);
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
