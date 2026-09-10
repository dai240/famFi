import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {databaseOptions} from '../lib/database-config.ts';
import {captureHouseholdBackup} from './backup-model.mjs';
import {encryptBackup,decryptBackup} from './backup.mjs';
import {verifyBackupRestore} from './verify-backup-restore.mjs';
if(process.env.FAMFI_DB_SCHEMA!=='famfi_preview')throw new Error('Explicit preview mode required');
const url=(await readFile('.private/preview-database-url','utf8')).trim();
const actor=(await readFile('.private/preview-owner-id','utf8')).trim();
const db=new pg.Client(databaseOptions(url,'production'));let checks=0;
const ok=value=>{assert.ok(value);checks++;};
try{
  await db.connect();ok((await db.query('select current_user::text as role')).rows[0].role==='famfi_preview_app');
  for(const table of ['memberships','parties','expenses','planned_expenses','expense_summaries'])ok((await db.query(`select count(*)::int n from famfi_preview.${table}`)).rows[0].n===0);
  for(const sql of ['select * from famfi.expenses','select * from compath.owner_states','select * from auth.users','select * from platform.apps','set role famfi_app','set role postgres','set role service_role','create table famfi_preview.forbidden(id int)','update famfi_preview.memberships set active=false']){
    await db.query('begin');let rejected=false;try{await db.query(sql);}catch{rejected=true;}await db.query('rollback');ok(rejected);
  }
  await db.query('begin');await db.query("select set_config('app.user_id',$1,true)",[actor]);
  const [{ledger_id:ledgerId,party_id:partyId}]=(await db.query('select ledger_id,party_id from famfi_preview.household_members where user_id=$1',[actor])).rows;
  ok((await db.query('select count(*)::int n from famfi_preview.parties')).rows[0].n===3);
  const source=(await db.query('select id,funding_party_id from famfi_preview.payment_sources where is_default')).rows[0];
  const summaryId=randomUUID(),expenseId=randomUUID();
  await db.query("insert into famfi_preview.expense_summaries(id,user_id,payment_source_id,month,amount,name) values($1,$2,$3,'2026-09-01',10000,'ROLLBACK probe')",[summaryId,ledgerId,source.id]);
  await db.query("insert into famfi_preview.expenses(id,user_id,amount,date,category_id,payment_source_id,paid_by_party_id,used_by_party_id,beneficiary_kind,payment_treatment,reimbursement_status,cost_class) values($1,$2,3000,'2026-09-01','food',$3,$4,$5,'family','shared','not_required','variable')",[expenseId,ledgerId,source.id,source.funding_party_id,partyId]);
  await db.query('update famfi_preview.expenses set summary_id=$1 where id=$2',[summaryId,expenseId]);
  ok((await db.query('select amount-(select sum(amount) from famfi_preview.expenses where summary_id=$1)::int as remainder from famfi_preview.expense_summaries where id=$1',[summaryId])).rows[0].remainder===7000);
  await db.query('rollback');
  await db.query('begin isolation level repeatable read read only');await db.query("select set_config('app.user_id',$1,true)",[actor]);
  const backup=await captureHouseholdBackup((sql,values)=>db.query(sql,values),actor,'famfi-expenses/v6','famfi_preview');await db.query('rollback');
  const file=await encryptBackup(backup);await verifyBackupRestore(await decryptBackup(file));checks++;
  console.log(`PASS: ${checks} actual preview TLS/runtime/isolation and rollback-only summary checks; encrypted v6 backup/restore: ${file}`);
}catch{console.error('Preview runtime verification failed; no credentials or records displayed.');process.exitCode=1;}finally{await db.end();}
