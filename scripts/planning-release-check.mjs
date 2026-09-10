// Production capture and rollback-only probes. Never restores or deletes live records.
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {databaseOptions} from '../lib/database-config.ts';
import {adminQuery} from './supabase-admin.mjs';
import {captureHouseholdBackup,profileBackupTables,planningBackupTables,normalizeBackupRows} from './backup-model.mjs';
import {encryptBackup,decryptBackup} from './backup.mjs';
import {verifyBackupRestore} from './verify-backup-restore.mjs';

async function main(){
  const [mode,filename]=process.argv.slice(2);
  assert.equal(process.env.FAMFI_DB_SCHEMA,'famfi');assert.ok(['before','after'].includes(mode));
  const owners=await adminQuery("select hm.user_id from famfi.household_members hm join famfi.parties p on p.id=hm.party_id join famfi.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null");
  assert.equal(owners.length,1);const actor=owners[0].user_id;
  const previous=mode==='after'?await decryptBackup(filename):null;
  if(previous)assert.equal(previous.format,'famfi-expenses/v5');
  const db=new pg.Client(databaseOptions((await readFile('.private/database-url','utf8')).trim(),'production'));
  await db.connect();
  const capture=async(format)=>{
    await db.query('begin isolation level repeatable read read only');
    try{await db.query("select set_config('app.user_id',$1,true)",[actor]);return await captureHouseholdBackup((sql,values)=>db.query(sql,values),actor,format,'famfi');}
    finally{await db.query('rollback');}
  };
  try{
    assert.equal((await db.query('select current_user as role')).rows[0].role,'famfi_app');
    const snapshot=await capture();assert.equal(snapshot.format,mode==='before'?'famfi-expenses/v5':'famfi-expenses/v6');
    if(previous){assert.equal(snapshot.ownerId,previous.ownerId);for(const dataset of profileBackupTables)assert.deepEqual(normalizeBackupRows(snapshot[dataset.key],dataset.fields),normalizeBackupRows(previous[dataset.key],dataset.fields),dataset.key+' preservation');}
    const output=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(output));
    console.log('PASS: encrypted '+snapshot.format+' backup and isolated local restore: '+output);
    if(mode==='before')return;
    for(const table of planningBackupTables)assert.equal((await db.query(`select count(*)::int n from famfi.${table.table}`)).rows[0].n,0);
    for(const sql of ['select * from famfi_preview.expenses','select * from compath.owner_states','select * from auth.users','select * from platform.apps','set role postgres','set role service_role','set role famfi_preview_app','update famfi.memberships set active=false']){
      await db.query('begin');try{await assert.rejects(db.query(sql));}finally{await db.query('rollback');}
    }
    await db.query('begin');
    try{
      await db.query("select set_config('app.user_id',$1,true)",[actor]);
      const source=(await db.query('select id,funding_party_id from famfi.payment_sources where is_default')).rows[0];assert.ok(source);
      const category=snapshot.categories.find(c=>!c.archived);assert.ok(category);
      // A temporary source avoids conflicting with a user's existing monthly summary.
      const sourceId=randomUUID(),summaryId=randomUUID(),expenseId=randomUUID();
      await db.query("insert into famfi.payment_sources(id,user_id,name,method,funding_party_id,default_treatment) values($1,$2,$3,'card',$4,'shared')",[sourceId,snapshot.ownerId,'Probe '+sourceId,source.funding_party_id]);
      await db.query("insert into famfi.expense_summaries(id,user_id,payment_source_id,month,amount,name) values($1,$2,$3,'2026-09-01',10000,'ROLLBACK probe')",[summaryId,snapshot.ownerId,sourceId]);
      await db.query("insert into famfi.expenses(id,user_id,amount,date,category_id,payment_source_id,paid_by_party_id,used_by_party_id,beneficiary_kind,payment_treatment,reimbursement_status,cost_class) values($1,$2,3000,'2026-09-01',$3,$4,$5,$6,'family','shared','not_required','variable')",[expenseId,snapshot.ownerId,category.id,sourceId,source.funding_party_id,snapshot.exportedByPartyId]);
      await db.query('update famfi.expenses set summary_id=$1 where id=$2',[summaryId,expenseId]);
      assert.equal((await db.query('select amount-(select sum(amount) from famfi.expenses where summary_id=$1)::int remainder from famfi.expense_summaries where id=$1',[summaryId])).rows[0].remainder,7000);
      await db.query('savepoint denied');await assert.rejects(db.query('update famfi.expense_summaries set amount=2000 where id=$1',[summaryId]));await db.query('rollback to savepoint denied');
      await db.query("select set_config('app.user_id',$1,true)",[randomUUID()]);
      for(const table of planningBackupTables)assert.equal((await db.query(`select count(*)::int n from famfi.${table.table}`)).rows[0].n,0);
    }finally{await db.query('rollback');}
    const final=await capture();
    for(const dataset of planningBackupTables)assert.deepEqual(normalizeBackupRows(final[dataset.key],dataset.fields),normalizeBackupRows(snapshot[dataset.key],dataset.fields),dataset.key+' rollback');
    console.log('PASS: all original fields preserved; runtime TLS, summary constraints, unauthenticated/outsider/other-schema denial; all probes rolled back and v6 fields rechecked.');
  }finally{await db.end();}
}
main().catch(error=>{console.error('Planning release check failed; no records or credentials displayed.',{type:error?.name,code:error?.code});process.exitCode=1;});
