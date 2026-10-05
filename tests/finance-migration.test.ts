import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { captureHouseholdBackup,cashBackupTables,normalizeBackupRows } from '../scripts/backup-model.mjs';
import { verifyBackupRestore } from '../scripts/verify-backup-restore.mjs';

test('finance migration preserves v8, enforces final bank totals, repayments, isolation and v9 restore',async()=>{
  const db=new PGlite(),dir='../personal-apps-infra/supabase/migrations',owner=randomUUID(),other=randomUUID();
  try{
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
    const files=(await readdir(dir)).sort().filter(f=>/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_.*)\.sql$/.test(f));
    for(const file of files.filter(f=>!f.endsWith('_famfi_household_finance.sql')))await db.exec(await readFile(dir+'/'+file,'utf8'));
    for(const actor of [owner,other]){await db.query('insert into auth.users values($1)',[actor]);await db.query('insert into famfi.memberships(user_id) values($1)',[actor]);await db.query('select famfi.provision_household($1)',[actor]);}
    async function begin(actor:string=owner){await db.exec('begin;set local role famfi_app');await db.query("select set_config('app.user_id',$1,true)",[actor]);}
    async function capture(){await begin();try{return await captureHouseholdBackup((sql:string,args:unknown[])=>db.query(sql,args),owner,undefined,'famfi');}finally{await db.exec('rollback');}}
    const before=await capture();assert.equal(before.format,'famfi-expenses/v8');
    await db.exec(await readFile(dir+'/'+files.find(f=>f.endsWith('_famfi_household_finance.sql')),'utf8'));
    const after=await capture();assert.equal(after.format,'famfi-expenses/v9');
    for(const table of cashBackupTables)assert.deepEqual(normalizeBackupRows(after[table.key as keyof typeof after] as unknown[],table.fields),normalizeBackupRows(before[table.key as keyof typeof before] as unknown[],table.fields));
    const sources=(await db.query<{id:string;method:string;funding_party_id:string;kind:string}>('select s.*,p.kind from famfi.payment_sources s join famfi.parties p on p.id=s.funding_party_id where s.user_id=$1',[owner])).rows;
    const people=(await db.query<{id:string;system_key:string}>('select id,system_key from famfi.parties where user_id=$1',[owner])).rows;
    const husband=people.find(p=>p.system_key==='owner')!.id,wife=people.find(p=>p.system_key==='partner')!.id,shared=people.find(p=>p.system_key==='shared')!.id;
    const bank=sources.find(s=>s.method==='bank'&&s.kind==='shared')!.id,card=sources.find(s=>s.method==='card'&&s.kind==='shared')!.id,cash=sources.find(s=>s.method==='cash'&&s.funding_party_id===husband)!.id;
    const summary=randomUUID(),movement=randomUUID(),expense=randomUUID(),debt=randomUUID(),repayment=randomUUID();
    await begin();
    await db.query("insert into famfi.expense_summaries(id,user_id,payment_source_id,month,amount,name,basis) values($1,$2,$3,'2034-08-01',3000,'Synthetic bank summary','bank')",[summary,owner,card]);
    await db.query("insert into famfi.cash_movements(id,user_id,payment_source_id,date,amount,kind,description,import_key,import_batch) values($1,$2,$3,'2034-09-27',-3000,'card_payment','Synthetic bank debit',$4,$4)",[movement,owner,bank,'a'.repeat(64)]);
    await db.query('update famfi.cash_movements set summary_id=$1,version=2 where id=$2',[summary,movement]);
    await db.query("insert into famfi.expenses(id,user_id,amount,date,category_id,payment_source_id,paid_by_party_id,used_by_text,beneficiary_kind,payment_treatment,reimbursement_status) values($1,$2,400,'2034-09-02','food',$3,$4,'不明','family','shared','not_required')",[expense,owner,card,shared]);
    await db.query('update famfi.expenses set summary_id=$1,version=version+1 where id=$2',[summary,expense]);
    await db.query("insert into famfi.personal_debts(id,user_id,date,name,amount,debtor_party_id,creditor_party_id) values($1,$2,'2034-09-01','Synthetic private loan',1000,$3,$4)",[debt,owner,husband,wife]);
    await db.query("insert into famfi.personal_repayments(id,user_id,debt_id,amount,date,payment_source_id) values($1,$2,$3,400,'2034-09-03',$4)",[repayment,owner,debt,cash]);
    await db.query("insert into famfi.card_month_reviews(id,user_id,month,complete) values($1,$2,'2034-08-01',true)",[randomUUID(),owner]);
    await db.exec('commit');
    assert.equal((await db.query<{date:string}>('select ledger_date::text as date from famfi.expenses where id=$1',[expense])).rows[0].date,'2034-08-01');
    async function denied(sql:string,args:unknown[]=[]){await begin();try{await assert.rejects(async()=>{await db.query(sql,args);await db.exec('set constraints all immediate');});}finally{await db.exec('rollback');}}
    await denied('update famfi.expense_summaries set amount=9999,version=version+1 where id=$1',[summary]);
    await denied("update famfi.expense_summaries set month='2034-07-01',version=version+1 where id=$1",[summary]);
    await denied('update famfi.cash_movements set voided=true,version=3 where id=$1',[movement]);
    await denied('update famfi.expenses set accounting_month=null where id=$1',[expense]);
    await denied('update famfi.personal_debts set amount=1100,version=2 where id=$1',[debt]);
    await denied("insert into famfi.personal_repayments(id,user_id,debt_id,amount,date,payment_source_id) values($1,$2,$3,601,'2034-09-04',$4)",[randomUUID(),owner,debt,cash]);
    await denied("insert into famfi.personal_repayments(id,user_id,debt_id,amount,date,payment_source_id) values($1,$2,$3,1,'2034-09-04',$4)",[randomUUID(),owner,debt,bank]);
    await denied('update famfi.personal_repayments set amount=1 where id=$1',[repayment]);
    await denied('delete from famfi.personal_debts');
    await denied('select * from famfi_preview.personal_debts');
    await denied("update famfi.payment_sources set funding_party_id=$1,version=version+1 where id=$2",[wife,cash]);
    for(const actor of ['',other,randomUUID()]){await begin(actor);for(const t of ['personal_debts','personal_repayments','card_month_reviews'])assert.equal((await db.query(`select * from famfi.${t}`)).rows.length,0);await db.exec('rollback');}
    for(const schema of ['famfi','famfi_preview'])for(const role of ['anon','authenticated','service_role'])for(const t of ['personal_debts','personal_repayments','card_month_reviews'])assert.equal((await db.query<{ok:boolean}>('select has_table_privilege($1,$2,\'select\') ok',[role,schema+'.'+t])).rows[0].ok,false);
    await begin();await db.query('update famfi.personal_repayments set cancelled_at=now() where id=$1',[repayment]);await db.exec('commit');
    await verifyBackupRestore(await capture());
    await verifyBackupRestore(before);
  }finally{await db.close();}
});
