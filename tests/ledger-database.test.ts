import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backupTables,sqlColumn } from '../scripts/backup-model.mjs';
import { verifyBackupRestore } from '../scripts/verify-backup-restore.mjs';
import { encryptBackup,decryptBackup } from '../scripts/backup.mjs';

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const person='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',fund='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',source='cccccccc-cccc-4ccc-8ccc-cccccccccccc',expense='dddddddd-dddd-4ddd-8ddd-dddddddddddd',payment='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
test('ledger migration preserves data, isolates masters, constrains settlement and restores v3',async()=>{
  const db=new PGlite();let checks=0;
  async function asUser(user:string,sql:string,values:unknown[]=[]) {
    await db.exec('begin; set local session authorization famfi_app');
    try {await db.query("select set_config('app.user_id',$1,true)",[user]);const result=await db.query<Record<string,unknown>>(sql,values);await db.exec('commit');return result.rows;}
    catch(error){await db.exec('rollback');throw error;}
    finally{await db.exec('set session authorization postgres;reset role');}
  }
  async function reject(user:string,sql:string,values:unknown[]=[]) {await assert.rejects(asUser(user,sql,values));checks++;}
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);revoke all on schema public from public;');
    const dir=path.resolve(process.env.INFRA_PATH??'../personal-apps-infra','supabase/migrations');
    const files=(await readdir(dir)).sort();
    for(const file of files.filter(f=>/_(shared_foundation|shared_runtime_admin_membership|famfi_expense_mvp|famfi_expense_date_precision)\.sql$/.test(f))) await db.exec(await readFile(path.join(dir,file),'utf8'));
    await db.query('insert into auth.users values ($1),($2)',[owner,other]);await db.query('insert into famfi.memberships(user_id) values ($1),($2)',[owner,other]);
    await db.query("insert into famfi.expenses(id,user_id,amount,date,date_precision,category_id,description) values ($1,$2,3000,'2026-09-01','month','food','preserve fixture')",[expense,owner]);
    const before=(await db.query('select * from famfi.expenses')).rows[0];
    const migration=await readFile(path.join(dir,files.find(f=>f.endsWith('_famfi_expense_management.sql'))!),'utf8');
    await db.exec("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key); insert into supabase_migrations.schema_migrations values ('unexpected')");
    await assert.rejects(db.exec(migration),/Shared migration history changed/);checks++;
    await db.exec("delete from supabase_migrations.schema_migrations; insert into supabase_migrations.schema_migrations values ('20260909090314'),('20260909090553'),('20260909095423'),('20260909105437'),('20260909122110')");
    await db.exec(migration);
    const after=(await db.query<Record<string,unknown>>('select * from famfi.expenses')).rows[0];
    for(const [key,value] of Object.entries(before as object)) assert.deepEqual(after[key],value);checks++;
    assert.equal(after.reimbursement_status,'unknown');checks++;
    for(const table of ['category_entries','parties','payment_sources','settlements']) {
      const info=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>(`select relrowsecurity,relforcerowsecurity from pg_class where oid='famfi.${table}'::regclass`);
      assert.ok(info.rows[0].relrowsecurity && info.rows[0].relforcerowsecurity);checks++;
      assert.equal((await asUser('',`select * from famfi.${table}`)).length,0);checks++;
      await reject(owner,`delete from famfi.${table}`);
      await reject(owner,`update famfi.${table} set user_id=$1`,[other]);
    }
    assert.equal((await asUser(owner,'select * from famfi.category_entries')).length,10);checks++;
    await asUser(owner,"update famfi.category_entries set name='My food',color='#112233' where id='food'");
    assert.equal((await asUser(other,"select name from famfi.category_entries where id='food'"))[0].name,'食費');checks++;
    await asUser(owner,"insert into famfi.category_entries(user_id,id,name,color,sort_order,parent_id) values ($1,'child','Child','#123456',11,'food')",[owner]);
    await reject(owner,"insert into famfi.category_entries(user_id,id,name,color,sort_order,parent_id) values ($1,'grandchild','Grandchild','#123456',1,'child')",[owner]);
    await reject(owner,"update famfi.category_entries set parent_id='child' where id='food'");
    await reject(other,"insert into famfi.expenses(id,user_id,amount,date,category_id) values ($1,$2,1,'2026-09-09','child')",[person,other]);
    await asUser(owner,"insert into famfi.parties(id,user_id,name,kind) values ($1,$3,'Person','person'),($2,$3,'Shared','shared')",[person,fund,owner]);
    await reject(other,"insert into famfi.payment_sources(id,user_id,name,method,funding_party_id) values ($1,$2,'Foreign card','card',$3)",[source,other,person]);
    await asUser(owner,"insert into famfi.payment_sources(id,user_id,name,method,funding_party_id) values ($1,$2,'Card','card',$3)",[source,owner,person]);
    await reject(owner,"update famfi.parties set kind='shared' where id=$1",[person]);
    await asUser(owner,"update famfi.expenses set used_by_party_id=$1,beneficiary_party_id=$2,paid_by_party_id=$1,payment_source_id=$3,reimbursement_status='required',reimbursement_from_party_id=$2,reimbursement_to_party_id=$1,reimbursement_amount=3000 where id=$4",[person,fund,source,expense]);
    await reject(owner,'update famfi.expenses set reimbursement_amount=3001 where id=$1',[expense]);
    await reject(owner,'update famfi.expenses set reimbursement_from_party_id=reimbursement_to_party_id where id=$1',[expense]);
    await reject(owner,'insert into famfi.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id) values ($1,$2,$3,1,\'2026-09-10\',$4,$5)',[payment,owner,expense,person,fund]);
    const insert='insert into famfi.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id) values ($1,$2,$3,$4,\'2026-09-10\',$5,$6)';
    await asUser(owner,insert,[payment,owner,expense,1000,fund,person]);checks++;
    await reject(owner,insert,[source,owner,expense,2001,fund,person]);
    await reject(owner,'update famfi.expenses set amount=4000 where id=$1',[expense]);
    await reject(owner,"update famfi.expenses set reimbursement_status='not_required',reimbursement_amount=0,reimbursement_from_party_id=null,reimbursement_to_party_id=null where id=$1",[expense]);
    await reject(owner,'delete from famfi.expenses where id=$1',[expense]);
    await reject(owner,'update famfi.settlements set amount=1 where id=$1',[payment]);
    await reject(other,insert,[source,other,expense,1,fund,person]);
    assert.equal((await asUser(other,'select * from famfi.settlements')).length,0);checks++;
    await asUser(owner,'update famfi.settlements set cancelled_at=now() where id=$1',[payment]);checks++;
    await reject(owner,'update famfi.settlements set cancelled_at=null where id=$1',[payment]);
    await asUser(owner,'update famfi.expenses set amount=4000,reimbursement_amount=4000 where id=$1',[expense]);checks++;
    await asUser(owner,insert,[source,owner,expense,4000,fund,person]);checks++;
    await reject(owner,insert,[person,owner,expense,1,fund,person]);
    const snapshot:Record<string,unknown>={format:'famfi-expenses/v3',ownerId:owner};
    for(const dataset of backupTables) snapshot[dataset.key]=await asUser(owner,`select ${dataset.fields.map((key:string)=>`${sqlColumn(key)} as "${key}"`).join(',')} from famfi.${dataset.table}`);
    const backupDir=await mkdtemp(path.join(tmpdir(),'famfi-ledger-backup-'));
    try {const filename=await encryptBackup(snapshot,backupDir);assert.deepEqual(await verifyBackupRestore(await decryptBackup(filename,backupDir)),{expenses:1,categories:11});checks++;}
    finally {await rm(backupDir,{recursive:true,force:true});}
    for(const dataset of backupTables) {
      if(dataset.key==='categories')continue;
      await db.query('update famfi.memberships set active=false where user_id=$1',[owner]);
      assert.equal((await asUser(owner,`select * from famfi.${dataset.table}`)).length,0);checks++;
      await db.query('update famfi.memberships set active=true where user_id=$1',[owner]);
    }
    console.log(`PASS: ${checks} new ledger DB constraints/isolation/migration/backup checks`);
  } finally {await db.close();}
});
