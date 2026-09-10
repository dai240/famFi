import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
let checks=0;
const ok=(value)=>{assert.ok(value);checks++;};
const owner='11111111-1111-4111-8111-111111111111', outsider='22222222-2222-4222-8222-222222222222';
try {
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
  const dir='../personal-apps-infra/supabase/migrations';
  const files=(await readdir(dir)).sort();
  for(const file of files.filter(f=>/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_(?!preview).*)\.sql$/.test(f)))await db.exec(await readFile(dir+'/'+file,'utf8'));
  await db.exec(`insert into auth.users values('${owner}'),('${outsider}');insert into famfi.memberships(user_id)values('${owner}');select famfi.provision_household('${owner}');`);
  const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(t) from famfi.parties t) parties,(select jsonb_agg(t) from famfi.payment_sources t) sources,(select jsonb_agg(t) from famfi.category_entries t) categories")).rows);
  const before=await snapshot();
  for(const file of files.filter(f=>/^\d+_famfi_preview.*\.sql$/.test(f)))await db.exec(await readFile(dir+'/'+file,'utf8'));
  ok(before===await snapshot());
  for(const table of ['memberships','households','household_members','expenses','parties','payment_sources','recurring_rules','audit_events'])ok((await db.query(`select count(*)::int n from famfi_preview.${table}`)).rows[0].n===0);
  await db.exec(`insert into famfi_preview.memberships(user_id)values('${owner}');select famfi_preview.provision_household('${owner}','検証用家計');`);
  for(const role of ['famfi_app','famfi_preview_app']){
    const schema=role==='famfi_app'?'famfi':'famfi_preview';
    await db.exec(`set role ${role};begin;select set_config('app.user_id','${owner}',true);`);
    ok((await db.query(`select count(*)::int n from ${schema}.parties`)).rows[0].n===3);
    await db.exec('rollback;reset role;');
    for(const forbidden of [schema==='famfi'?'famfi_preview':'famfi','platform']){
      await db.exec(`begin;set local role ${role};`);
      await assert.rejects(db.query(`select * from ${forbidden}.${forbidden==='platform'?'apps':'expenses'}`));checks++;
      await db.exec('rollback;');
    }
    for(const actor of ['',outsider]){
      await db.exec(`begin;set local role ${role};select set_config('app.user_id','${actor}',true);`);
      ok((await db.query(`select count(*)::int n from ${schema}.parties`)).rows[0].n===0);
      await db.exec('rollback;');
    }
  }
  ok((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='famfi_preview' and c.relkind='r' and not(c.relrowsecurity and c.relforcerowsecurity)")).rows[0].n===0);
  ok((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='famfi_preview' and (p.prosecdef or p.prosrc ~ '\\mfamfi\\M')")).rows[0].n===0);
  console.log(`PASS: ${checks} preview isolation, empty bootstrap and production preservation checks`);
} finally {await db.close();}
