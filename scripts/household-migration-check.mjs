// The only production writes here are isolated probes that always roll back.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { decryptBackup,encryptBackup } from './backup.mjs';
import { backupTables,householdBackupTables,captureHouseholdBackup,normalizeBackupRows,sqlColumn } from './backup-model.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

async function main(){
  const [mode,filename]=process.argv.slice(2);assert.ok(['before','after'].includes(mode));
  const previous=await decryptBackup(filename);const owner=previous.ownerId;
  const connection=(await readFile(new URL('../.private/database-url',import.meta.url),'utf8')).trim();
  const client=new pg.Client(databaseOptions(connection,'production'));await client.connect();
  try{
    await client.query('begin isolation level repeatable read read only');
    await client.query("select set_config('app.user_id',$1,true)",[owner]);
    assert.equal((await client.query('select current_user as role')).rows[0].role,'famfi_app');
    assert.equal((await client.query('select count(*)::int n from famfi.memberships where active and user_id=$1',[owner])).rows[0].n,1);
    let snapshot;
    if(mode==='before'){
      assert.equal(previous.format,'famfi-expenses/v3');snapshot={format:'famfi-expenses/v3',ownerId:owner,exportedAt:new Date().toISOString()};
      for(const dataset of backupTables)snapshot[dataset.key]=(await client.query(`select ${dataset.fields.map(key=>`${sqlColumn(key)} as "${key}"`).join(',')} from famfi.${dataset.table} order by id`)).rows;
    }else{
      assert.equal(previous.format,'famfi-expenses/v3');snapshot=await captureHouseholdBackup((sql,values)=>client.query(sql,values),owner);
      for(const dataset of backupTables){const ids=new Set(previous[dataset.key].map(row=>row.id));assert.deepEqual(normalizeBackupRows(snapshot[dataset.key].filter(row=>ids.has(row.id)),dataset.fields),normalizeBackupRows(previous[dataset.key],dataset.fields));}
      assert.equal(snapshot.paymentSources.filter(s=>s.isDefault).length,1);assert.equal(snapshot.parties.filter(p=>p.systemKey).length,3);
    }
    await client.query('rollback');
    const output=await encryptBackup(snapshot);await decryptBackup(output);await verifyBackupRestore(snapshot);
    console.log(`Encrypted ${snapshot.format} snapshot verified and locally restored: ${output}; ${snapshot.expenses.length} expenses, ${snapshot.categories.length} categories. Contents not printed.`);
    if(mode==='after'){
      await client.query('begin');
      try{
        await client.query("select set_config('app.user_id',$1,true)",[owner]);
        const expense=randomUUID(),source=snapshot.paymentSources.find(s=>s.name==='妻のカード'),partner=snapshot.parties.find(p=>p.systemKey==='partner').id,fund=snapshot.parties.find(p=>p.systemKey==='shared').id;
        await client.query(`insert into famfi.expenses(id,user_id,amount,date,date_precision,category_id,description,used_by_party_id,payment_source_id,paid_by_party_id,payment_treatment,beneficiary_kind,reimbursement_status,reimbursement_from_party_id,reimbursement_to_party_id,reimbursement_amount) values($1,$2,3000,'2026-09-01','month','food','ROLLBACK validation',$3,$4,$3,'advance','family','required',$5,$3,3000)`,[expense,owner,partner,source.id,fund]);
        const events=(await client.query('select actor_party_id,action from famfi.audit_events where entity_id=$1',[expense])).rows;assert.equal(events.length,1);assert.equal(events[0].actor_party_id,snapshot.exportedByPartyId);
        const payment=randomUUID();await client.query("insert into famfi.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id) values($1,$2,$3,1000,'2026-09-10',$4,$5)",[payment,owner,expense,fund,partner]);
        for(const sql of ["update famfi.expenses set amount=4000 where id=$1","delete from famfi.audit_events where entity_id=$1"]){await client.query('savepoint denied');await assert.rejects(client.query(sql,[expense]));await client.query('rollback to savepoint denied');}
        await client.query('update famfi.settlements set cancelled_at=now() where id=$1',[payment]);
        await client.query("update famfi.expenses set payment_treatment='direct',reimbursement_status='not_required',reimbursement_amount=0,reimbursement_from_party_id=null,reimbursement_to_party_id=null where id=$1",[expense]);
        assert.equal((await client.query('select payment_treatment from famfi.expenses where id=$1',[expense])).rows[0].payment_treatment,'direct');
        await client.query("select set_config('app.user_id',$1,true)",[randomUUID()]);for(const dataset of householdBackupTables)assert.equal((await client.query(`select count(*)::int n from famfi.${dataset.table}`)).rows[0].n,0);
      }finally{await client.query('rollback');}
      console.log('PASS: original fields preserved; actual runtime sharing context, advance/direct modes, audit, financial lock and outsider denial verified; every probe rolled back.');
    }
  }finally{await client.end();}
}
main().catch(error=>{console.error('Household migration verification failed; secrets and records are not displayed.',{type:error?.name,code:error?.code});process.exitCode=1;});
