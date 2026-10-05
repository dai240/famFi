// Live migration verification. Only synthetic probe writes, all rolled back.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup,cashBackupTables,financeBackupTables,normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup,decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

async function main(){
  const [mode,file]=process.argv.slice(2),schema=process.env.FAMFI_DB_SCHEMA;
  assert.equal(process.env.NODE_ENV,'production');assert.ok(['famfi','famfi_preview'].includes(schema));assert.ok(['before','after'].includes(mode));
  const owners=await adminQuery(`select hm.user_id from ${schema}.household_members hm join ${schema}.parties p on p.id=hm.party_id and p.user_id=hm.ledger_id join ${schema}.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())`);
  assert.equal(owners.length,1);const actor=owners[0].user_id;
  const db=new pg.Client(databaseOptions((await readFile(schema==='famfi'?'.private/database-url':'.private/preview-database-url','utf8')).trim(),'production'));
  await db.connect();
  async function capture(){await db.query('begin isolation level repeatable read read only');try{await db.query("select set_config('app.user_id',$1,true)",[actor]);return await captureHouseholdBackup((sql,args)=>db.query(sql,args),actor,undefined,schema);}finally{await db.query('rollback');}}
  try{
    assert.equal((await db.query('select current_user role')).rows[0].role,schema+'_app');
    const snapshot=await capture();assert.equal(snapshot.format,mode==='before'?'famfi-expenses/v8':'famfi-expenses/v9');
    if(mode==='after'){
      const previous=await decryptBackup(file);assert.equal(previous.environment,schema);assert.equal(previous.format,'famfi-expenses/v8');assert.equal(previous.ownerId,snapshot.ownerId);
      for(const t of cashBackupTables)assert.deepEqual(normalizeBackupRows(snapshot[t.key],t.fields),normalizeBackupRows(previous[t.key],t.fields),t.key+' preservation');
      for(const key of ['personalDebts','personalRepayments','cardMonthReviews'])assert.equal(snapshot[key].length,0);
      for(const t of financeBackupTables)assert.equal((await db.query(`select count(*)::int n from ${schema}.${t.table}`)).rows[0].n,0);
      for(const sql of [`select * from ${schema==='famfi'?'famfi_preview':'famfi'}.personal_debts`,'select * from compath.owner_states','select * from auth.users','select * from platform.apps','set role postgres','set role service_role',`update ${schema}.memberships set active=false`]){await db.query('begin');try{await assert.rejects(db.query(sql));}finally{await db.query('rollback');}}
      await db.query('begin');
      try{
        await db.query("select set_config('app.user_id',$1,true)",[actor]);
        const owner=snapshot.parties.find(p=>p.systemKey==='owner'),wife=snapshot.parties.find(p=>p.systemKey==='partner'),cash=snapshot.paymentSources.find(p=>p.method==='cash'&&p.fundingPartyId===owner.id);
        const id=randomUUID(),payment=randomUUID();
        await db.query(`insert into ${schema}.personal_debts(id,user_id,date,name,amount,debtor_party_id,creditor_party_id) values($1,$2,'2037-10-01','ROLLBACK finance probe',100,$3,$4)`,[id,snapshot.ownerId,owner.id,wife.id]);
        await db.query(`insert into ${schema}.personal_repayments(id,user_id,debt_id,amount,date,payment_source_id) values($1,$2,$3,40,'2037-10-02',$4)`,[payment,snapshot.ownerId,id,cash.id]);
        await db.query('savepoint denied');await assert.rejects(db.query(`update ${schema}.personal_debts set amount=1,version=2 where id=$1`,[id]));await db.query('rollback to savepoint denied');
        await db.query(`update ${schema}.personal_repayments set cancelled_at=now() where id=$1`,[payment]);
        assert.equal((await db.query(`select count(*)::int n from ${schema}.audit_events where entity_id in ($1,$2)`,[id,payment])).rows[0].n,3);
        await db.query("select set_config('app.user_id',$1,true)",[randomUUID()]);
        for(const t of financeBackupTables)assert.equal((await db.query(`select count(*)::int n from ${schema}.${t.table}`)).rows[0].n,0);
      }finally{await db.query('rollback');}
      const final=await capture();for(const t of financeBackupTables)assert.deepEqual(normalizeBackupRows(final[t.key],t.fields),normalizeBackupRows(snapshot[t.key],t.fields),t.key+' rollback');
    }
    const output=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(output));
    console.log(`PASS: ${schema} ${snapshot.format} encrypted backup, isolated restore${mode==='after'?', old fields preserved, runtime/audit/isolation probes rolled back':''}: ${output}`);
  }finally{await db.end();}
}
main().catch(e=>{console.error('Finance release check stopped; records and credentials suppressed.',{type:e?.name,code:e?.code});process.exitCode=1;});
