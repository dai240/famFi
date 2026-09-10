import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {captureHouseholdBackup,profileBackupTables,normalizeBackupRows} from '../scripts/backup-model.mjs';
import {verifyBackupRestore} from '../scripts/verify-backup-restore.mjs';

test('production planning preserves v5 fields, validates shared history and restores v6',async()=>{
  const db=new PGlite();const dir='../personal-apps-infra/supabase/migrations';const owner='11111111-1111-4111-8111-111111111111';
  try{
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
    const files=(await readdir(dir)).sort();
    for(const file of files.filter(f=>/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_(?!planning).*)\.sql$/.test(f)))await db.exec(await readFile(dir+'/'+file,'utf8'));
    await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into famfi.memberships(user_id) values($1)',[owner]);await db.query('select famfi.provision_household($1)',[owner]);
    await db.query("insert into famfi.expenses(id,user_id,amount,date,category_id,description) values($1,$1,4321,'2026-09-01','food','Preservation fixture')",[owner]);
    await db.query("insert into famfi.recurring_rules(id,user_id,name,amount_mode,amount,frequency,start_month,category_id,payment_source_id,payment_treatment,used_by_party_id,beneficiary_kind) select $1,$1,'Existing fixed rule','fixed',1234,'monthly','2026-09-01','food',s.id,'shared',p.id,'family' from famfi.payment_sources s cross join famfi.parties p where s.user_id=$1 and s.is_default and p.user_id=$1 and p.system_key='owner'",[owner]);
    const capture=async()=>{await db.exec('begin;set local session authorization famfi_app');try{await db.query("select set_config('app.user_id',$1,true)",[owner]);return await captureHouseholdBackup((sql:string,values:unknown[])=>db.query(sql,values),owner,undefined,'famfi');}finally{await db.exec('rollback;set session authorization postgres;reset role');}};
    const before=await capture();assert.equal(before.format,'famfi-expenses/v5');await verifyBackupRestore(before);
    const migration=await readFile(dir+'/'+files.find(f=>/_famfi_planning\.sql$/.test(f)),'utf8');
    await db.exec("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);insert into supabase_migrations.schema_migrations values('unexpected')");
    await assert.rejects(db.exec(migration),/Migration history changed/);
    await db.exec('delete from supabase_migrations.schema_migrations');
    for(const file of files.filter(f=>!/_famfi_planning\.sql$/.test(f)))await db.query('insert into supabase_migrations.schema_migrations values($1)',[file.split('_')[0]]);
    await db.exec(migration);
    const after=await capture();assert.equal(after.format,'famfi-expenses/v6');
    const oldRows=before as unknown as Record<string,Record<string,unknown>[]>;
    const newRows=after as unknown as Record<string,Record<string,unknown>[]>;
    for(const dataset of profileBackupTables)assert.deepEqual(normalizeBackupRows(newRows[dataset.key],dataset.fields),normalizeBackupRows(oldRows[dataset.key],dataset.fields));
    assert.equal(newRows.expenses[0].costClass,'unknown');assert.equal(newRows.recurringRules[0].reviewDay,null);
    assert.equal(newRows.expenseSummaries.length,0);assert.equal(newRows.plannedExpenses.length,0);
    await verifyBackupRestore(after);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from famfi_preview.expenses')).rows[0].n,0);
  }finally{await db.close();}
});
