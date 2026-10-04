import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { captureHouseholdBackup, notesBackupTables, normalizeBackupRows } from '../scripts/backup-model.mjs';
import { encryptBackup, decryptBackup } from '../scripts/backup.mjs';
import { verifyBackupRestore } from '../scripts/verify-backup-restore.mjs';

test('cash migration isolates households and preserves import facts, tombstones, audit and v8 restore',async()=>{
  const db=new PGlite(),dir='../personal-apps-infra/supabase/migrations',owner=randomUUID(),other=randomUUID();
  const backupDir=await mkdtemp(path.join(tmpdir(),'famfi-cash-test-'));
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
    const files=(await readdir(dir)).sort();
    for(const file of files.filter(f=>/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_(?!cash_movements).*)\.sql$/.test(f)))await db.exec(await readFile(dir+'/'+file,'utf8'));
    for(const actor of [owner,other]){await db.query('insert into auth.users values($1)',[actor]);await db.query('insert into famfi.memberships(user_id) values($1)',[actor]);await db.query('select famfi.provision_household($1)',[actor]);}
    const capture=async()=>{await db.exec('begin;set local role famfi_app');try{await db.query("select set_config('app.user_id',$1,true)",[owner]);return await captureHouseholdBackup((sql:string,values:unknown[])=>db.query(sql,values),owner,undefined,'famfi');}finally{await db.exec('rollback');}};
    const before=await capture();assert.equal(before.format,'famfi-expenses/v7');await verifyBackupRestore(before);
    const migration=await readFile(dir+'/'+files.find(f=>/_famfi_cash_movements\.sql$/.test(f)),'utf8');
    await db.exec("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);insert into supabase_migrations.schema_migrations values('unexpected');");
    await assert.rejects(db.exec(migration),/Migration history changed/);
    await db.exec('drop schema supabase_migrations cascade');
    await db.exec(migration);
    const after=await capture();assert.equal(after.format,'famfi-expenses/v8');
    const beforeRows=before as unknown as Record<string,Record<string,unknown>[]>;
    const afterRows=after as unknown as Record<string,Record<string,unknown>[]>;
    for(const table of notesBackupTables)assert.deepEqual(normalizeBackupRows(afterRows[table.key],table.fields),normalizeBackupRows(beforeRows[table.key],table.fields));
    const source=(await db.query<{id:string}>("select id from famfi.payment_sources where user_id=$1 and method='bank' limit 1",[owner])).rows[0].id;
    const outsiderSource=(await db.query<{id:string}>("select id from famfi.payment_sources where user_id=$1 and method='bank' limit 1",[other])).rows[0].id;
    const id=randomUUID();
    await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[owner]);
    const insert="insert into famfi.cash_movements(id,user_id,payment_source_id,date,amount,kind,description,import_key,import_batch) values($1,$2,$3,'2025-01-27',-1234,'card_payment','Synthetic bank import',$4,$5)";
    await db.query(insert,[id,owner,source,'a'.repeat(64),'b'.repeat(64)]);await db.exec('commit');
    const deny=async(sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[owner]);try{await assert.rejects(db.query(sql,args));}finally{await db.exec('rollback');}};
    await deny(insert,[randomUUID(),owner,outsiderSource,'c'.repeat(64),'d'.repeat(64)]);
    await deny(insert,[randomUUID(),owner,source,'a'.repeat(64),'e'.repeat(64)]);
    await deny('update famfi.cash_movements set amount=-100,version=2');
    await deny("update famfi.cash_movements set date='2025-01-28',version=2");
    await deny('update famfi.cash_movements set version=9');
    await deny('delete from famfi.cash_movements');
    await deny('update famfi.cash_movements set user_id=$1',[other]);
    await deny('update famfi.cash_movements set import_key=null');
    await deny("update famfi.payment_sources set method='card',version=version+1 where id=$1",[source]);
    await deny('select * from famfi_preview.cash_movements');
    await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[owner]);
    await db.exec("update famfi.cash_movements set memo='Later note',version=2;update famfi.cash_movements set voided=true,version=3;commit");
    await deny('update famfi.cash_movements set voided=false,version=4');
    const snapshot=await capture(),rows=snapshot as unknown as Record<string,Record<string,unknown>[]>;
    assert.equal(rows.cashMovements.length,1);assert.equal(rows.cashMovements[0].voided,true);
    assert.equal(rows.cashMovements[0].partyId,null);assert.equal(rows.auditEvents.filter(e=>e.entityType==='cash_movements').length,3);
    assert.equal(rows.expenses.length,0);assert.equal(rows.settlements.length,0);
    await verifyBackupRestore(await decryptBackup(await encryptBackup(snapshot,backupDir),backupDir));
    for(const actor of ['',other,randomUUID()]){await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[actor]);assert.equal((await db.query('select * from famfi.cash_movements')).rows.length,0);await db.exec('rollback');}
    for(const schema of ['famfi','famfi_preview'])for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query<{ok:boolean}>("select has_table_privilege($1,$2,'select') as ok",[role,schema+'.cash_movements'])).rows[0].ok,false);
    await db.query('insert into famfi_preview.memberships(user_id) values($1)',[owner]);await db.query('select famfi_preview.provision_household($1)',[owner]);
    await db.exec('begin;set local role famfi_preview_app');await db.query("select set_config('app.user_id',$1,true)",[owner]);
    const previewSource=(await db.query<{id:string}>("select id from famfi_preview.payment_sources where method='bank' limit 1")).rows[0].id;
    await db.query("insert into famfi_preview.cash_movements(id,user_id,payment_source_id,date,amount,description) values($1,$2,$3,'2025-02-01',100,'Synthetic preview')",[randomUUID(),owner,previewSource]);
    const preview=await captureHouseholdBackup((sql:string,values:unknown[])=>db.query(sql,values),owner,undefined,'famfi_preview');await db.exec('commit');
    assert.equal(preview.format,'famfi-expenses/v8');assert.equal(preview.environment,'famfi_preview');
    await verifyBackupRestore(preview);
    assert.deepEqual((await capture() as unknown as Record<string,unknown>).cashMovements,rows.cashMovements);
  } finally {await db.close();await rm(backupDir,{recursive:true,force:true});}
});
