import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { captureHouseholdBackup, planningBackupTables, normalizeBackupRows } from '../scripts/backup-model.mjs';
import { verifyBackupRestore } from '../scripts/verify-backup-restore.mjs';
test('notes migration preserves v6, guards shared history, and restores all v7 note fields',async()=>{
  const db=new PGlite(),dir='../personal-apps-infra/supabase/migrations',owner='11111111-1111-4111-8111-111111111111';
  try{
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
    const files=(await readdir(dir)).sort();
    for(const file of files.filter(f=>/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_(?!notes).*)\.sql$/.test(f)))await db.exec(await readFile(dir+'/'+file,'utf8'));
    await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into famfi.memberships(user_id) values($1)',[owner]);await db.query('select famfi.provision_household($1)',[owner]);
    const capture=async()=>{await db.exec('begin;set local role famfi_app');try{await db.query("select set_config('app.user_id',$1,true)",[owner]);return await captureHouseholdBackup((sql:string,values:unknown[])=>db.query(sql,values),owner,undefined,'famfi');}finally{await db.exec('rollback');}};
    const before=await capture();assert.equal(before.format,'famfi-expenses/v6');await verifyBackupRestore(before);
    const migration=await readFile(dir+'/'+files.find(f=>/_famfi_notes\.sql$/.test(f)),'utf8');
    await db.exec("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);insert into supabase_migrations.schema_migrations values('unexpected')");
    await assert.rejects(db.exec(migration),/Migration history changed/);await db.exec('delete from supabase_migrations.schema_migrations');
    for(const file of files.filter(f=>!/_famfi_notes\.sql$/.test(f)))await db.query('insert into supabase_migrations.schema_migrations values($1)',[file.split('_')[0]]);
    await db.exec(migration);
    const after=await capture();assert.equal(after.format,'famfi-expenses/v7');
    const oldRows=before as unknown as Record<string,Record<string,unknown>[]>;
    const newRows=after as unknown as Record<string,Record<string,unknown>[]>;
    for(const t of planningBackupTables)assert.deepEqual(normalizeBackupRows(newRows[t.key],t.fields),normalizeBackupRows(oldRows[t.key],t.fields));
    await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[owner]);
    for(const [i,date,precision] of [[1,null,'none'],[2,'2037-09-01','month'],[3,'2037-09-21','day']] as const){await db.query("insert into famfi.household_notes(id,user_id,name,memo,kind,date,date_precision) values(gen_random_uuid(),$1,$2,'shared memo','task',$3,$4)",[owner,'note'+i,date,precision]);}
    await db.exec('update famfi.household_notes set completed=true,version=2;commit;');
    const notes=await capture();const rows=notes as unknown as Record<string,Record<string,unknown>[]>;assert.equal(rows.householdNotes.length,3);assert.equal(rows.auditEvents.length,6);await verifyBackupRestore(notes);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from famfi_preview.household_notes')).rows[0].n,0);
    assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','famfi.household_roster()','execute') as allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});
