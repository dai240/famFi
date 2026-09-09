// Dedicated runtime only. Before: encrypted v2 snapshot. After: preservation + rolled-back
// financial probe + encrypted v3 snapshot. Never deletes/restores production business data.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { decryptBackup,encryptBackup } from './backup.mjs';
import { backupTables,normalizeBackupRows,sqlColumn } from './backup-model.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

async function main(){
  const [mode,filename]=process.argv.slice(2);assert.ok(['before','after'].includes(mode));
  const previous=await decryptBackup(filename);const owner=previous.ownerId;
  const connection=(await readFile(new URL('../.private/database-url',import.meta.url),'utf8')).trim();
  const client=new pg.Client(databaseOptions(connection,'production'));await client.connect();
  const oldExpenseFields=backupTables.find(t=>t.key==='expenses').fields.slice(0,11);
  const columns=fields=>fields.map(key=>`${sqlColumn(key)} as "${key}"`).join(',');
  try {
    await client.query('begin isolation level repeatable read read only');
    await client.query("select set_config('app.user_id',$1,true)",[owner]);
    assert.equal((await client.query('select current_user as role')).rows[0].role,'famfi_app');
    assert.equal((await client.query('select count(*)::int as n from famfi.memberships where active and user_id=$1',[owner])).rows[0].n,1);
    const current={format:mode==='before'?'famfi-expenses/v2':'famfi-expenses/v3',ownerId:owner,exportedAt:new Date().toISOString()};
    if(mode==='before'){
      current.categories=(await client.query('select id,name,color,sort_order as "sortOrder" from famfi.categories order by id')).rows;
      current.expenses=(await client.query(`select ${columns(oldExpenseFields)} from famfi.expenses order by id`)).rows;
    }else{
      for(const dataset of backupTables)current[dataset.key]=(await client.query(`select ${columns(dataset.fields)} from famfi.${dataset.table} order by id`)).rows;
      assert.deepEqual(normalizeBackupRows(current.expenses,oldExpenseFields),normalizeBackupRows(previous.expenses,oldExpenseFields));
      const oldCategoryFields=['id','name','color','sortOrder'];
      assert.deepEqual(normalizeBackupRows(current.categories,oldCategoryFields),normalizeBackupRows(previous.categories,oldCategoryFields));
      assert.ok(current.expenses.every(e=>e.reimbursementStatus==='unknown'&&e.reimbursementAmount===0&&!e.usedByPartyId&&!e.paymentSourceId));
    }
    await client.query('rollback');
    if(mode==='after'){
      await client.query('begin');
      try{
        await client.query("select set_config('app.user_id',$1,true)",[owner]);
        const person=randomUUID(),fund=randomUUID(),source=randomUUID(),expense=randomUUID(),settlement=randomUUID();
        await client.query("insert into famfi.parties(id,user_id,name,kind) values ($1,$3,$4,'person'),($2,$3,$5,'shared')",[person,fund,owner,`P ${person}`,`F ${fund}`]);
        await client.query("insert into famfi.payment_sources(id,user_id,name,method,funding_party_id) values ($1,$2,$3,'card',$4)",[source,owner,`ROLLBACK ${source}`,person]);
        await client.query("insert into famfi.expenses(id,user_id,amount,date,date_precision,category_id,description,used_by_party_id,payment_source_id,reimbursement_status,reimbursement_from_party_id,reimbursement_to_party_id,reimbursement_amount) values ($1,$2,3000,'2026-09-01','month','food','ROLLBACK validation',$3,$4,'required',$5,$3,3000)",[expense,owner,person,source,fund]);
        const insert="insert into famfi.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id) values ($1,$2,$3,$4,'2026-09-09',$5,$6)";
        await client.query(insert,[settlement,owner,expense,1000,fund,person]);
        await client.query('savepoint overpayment');
        await assert.rejects(client.query(insert,[randomUUID(),owner,expense,2001,fund,person]),error=>error.code==='23514');
        await client.query('rollback to savepoint overpayment');
        await client.query('update famfi.settlements set cancelled_at=now() where id=$1',[settlement]);
        await client.query(insert,[randomUUID(),owner,expense,3000,fund,person]);
        assert.equal(Number((await client.query('select sum(amount) as total from famfi.settlements where expense_id=$1 and cancelled_at is null',[expense])).rows[0].total),3000);
        await client.query("select set_config('app.user_id',$1,true)",[randomUUID()]);
        for(const dataset of backupTables)assert.equal((await client.query(`select count(*)::int as n from famfi.${dataset.table}`)).rows[0].n,0);
      }finally{await client.query('rollback');}
      console.log('PASS: original fields preserved; dedicated-role partial payment, overpayment rejection, cancellation and other-user denial; all probes rolled back.');
    }
    const output=await encryptBackup(current);await decryptBackup(output);
    if(mode==='after')await verifyBackupRestore(current);
    console.log(`Encrypted ${current.format} snapshot verified: ${output}; ${current.expenses.length} expenses, ${current.categories.length} categories. No user records printed.`);
  }finally{await client.end();}
}
main().catch(error=>{console.error('Ledger migration verification failed; no secrets printed.',{type:error?.name,code:error?.code});process.exitCode=1;});
