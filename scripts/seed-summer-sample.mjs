// Explicitly authorized operational seed; never included in web deployments.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup, notesBackupTables, normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';
import { sampleBatch, sampleMemo, sampleRules, sampleExpenses } from './sample-summer-data.mjs';

// This trusted Node CLI is server-side. Only the bundler marker is neutralized;
// withUserDb, membership validation, TLS and the actual runtime role stay intact.
const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = { exports: {} };
const { withUserDb, withLedgerDb, getPrisma } = require('../lib/prisma.ts');
const { readMasters, insertExpense } = require('../lib/expense-service.ts');
const { insertRule } = require('../lib/recurring-service.ts');
const { validatedExpenseFields } = require('../lib/expenses.ts');
const { validatedRecurringFields, serializeRule, isDue } = require('../lib/recurring.ts');
const { newExpense, paymentSuggestion } = require('../lib/household.ts');

export function sampleId(ledgerId, key) {
  const hex = createHash('sha256').update(`${sampleBatch}:${ledgerId}:${key}`).digest('hex').slice(0,32).split('');
  hex[12]='5'; hex[16]='8'; const text=hex.join('');
  return `${text.slice(0,8)}-${text.slice(8,12)}-${text.slice(12,16)}-${text.slice(16,20)}-${text.slice(20)}`;
}
function exactlyOne(rows, message) { assert.equal(rows.length,1,message); return rows[0]; }

export async function captureSampleHousehold(actor) {
  return withLedgerDb(actor, tx => captureHouseholdBackup(async(sql,values=[])=>({rows:await tx.$queryRawUnsafe(sql,...values)}),actor,'famfi-expenses/v7','famfi'));
}

export async function prepareSample(actor) {
  return withUserDb(actor,async(tx,scope)=>{
    const masters=await readMasters(tx), existing=await tx.recurringRule.findMany();
    const category=(names)=>exactlyOne(masters.categories.filter(c=>!c.archived && c.name===names.at(-1) && (names.length===1?!c.parentId:masters.categories.some(p=>p.id===c.parentId&&!p.archived&&p.name===names[0]))),'Category missing or ambiguous').id;
    const person=(role)=>exactlyOne(masters.parties.filter(p=>p.systemKey===role&&!p.archived),'Party missing or ambiguous').id;
    const source=([role,method])=>exactlyOne(masters.paymentSources.filter(s=>s.fundingPartyId===person(role)&&s.method===method&&!s.archived),'Source missing or ambiguous').id;
    assert.equal(scope.partyId,person('owner'),'Only the confirmed household owner may seed samples');
    const expense=(item)=>{
      const personal=item.treatment==='direct' && (item.name.includes('美容院')||item.name.includes('年パス'));
      return validatedExpenseFields.parse({...newExpense(masters,item.date),categoryId:category(item.category),amount:item.amount,
        description:`【サンプル】${item.name}`,memo:sampleMemo,costClass:item.costClass,
        usedByPartyId:person(item.actor??'owner'),beneficiaryKind:personal?'party':'family',beneficiaryPartyId:personal?person(item.actor??'owner'):null,
        ...paymentSuggestion(masters,source(item.source),item.amount,item.treatment??(item.source[0]==='shared'?'shared':'advance'))});
    };
    const rules=sampleRules.map(def=>{
      const id=sampleId(scope.ledgerId,'rule:'+def.key);
      // Keep pre-existing user templates, especially the September mortgage.
      const old=existing.filter(r=>r.id!==id && (r.name===def.name||r.name===`【仮】${def.name}`));
      assert.ok(old.length<=1,'Existing recurring rule is ambiguous');
      if(old.length)return {def,id:old[0].id,preserved:true,input:serializeRule(old[0])};
      const input=validatedRecurringFields.parse({name:`【仮】${def.name}`,costClass:'fixed',amountMode:def.mode,
        amount:def.mode==='fixed'?def.amounts.find(a=>a!==null):null,frequency:def.frequency??'monthly',startMonth:def.start??'2026-07',endMonth:null,
        dueDay:def.day,reviewDay:def.day,reviewMonthOffset:0,categoryId:category(def.category),paymentSourceId:source(def.source),
        paymentTreatment:def.source[0]==='shared'?'shared':'advance',usedByPartyId:person(def.actor??'owner'),usedByText:'',
        beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',memo:sampleMemo+' 金額・日程は仮です。実際の請求内容へ変更して確定してください。',archived:false});
      return {def,id,preserved:false,input};
    });
    const rows=sampleExpenses.map(item=>({id:sampleId(scope.ledgerId,'expense:'+item.key),input:expense(item)}));
    for(const rule of rules) for(const [i,month] of ['2026-07','2026-08'].entries()) {
      const amount=rule.def.amounts[i]; if(amount===null)continue;
      const id=sampleId(scope.ledgerId,`expense:${rule.def.key}:${month}`);
      rows.push({id,input:expense({...rule.def,amount,costClass:'fixed',date:`${month}-${String(rule.def.day).padStart(2,'0')}`}),
        // A user's existing template is never backdated or automatically confirmed.
        occurrence:rule.preserved?null:{id:sampleId(scope.ledgerId,`occurrence:${rule.def.key}:${month}`),ruleId:rule.id,period:month}});
    }
    return {ledgerId:scope.ledgerId,partyId:scope.partyId,rules,rows};
  });
}

export function sampleTotals(plan) {
  return ['2026-07','2026-08'].map(month=>{
    const rows=plan.rows.filter(r=>r.input.date.startsWith(month));
    return {month,records:rows.length,total:rows.reduce((sum,r)=>sum+r.input.amount,0),
      fixed:rows.filter(r=>r.input.costClass==='fixed').reduce((sum,r)=>sum+r.input.amount,0),
      advance:rows.filter(r=>r.input.paymentTreatment==='advance').reduce((sum,r)=>sum+r.input.amount,0)};
  });
}

export async function applySample(actor,plan) {
  for(const rule of plan.rules.filter(r=>!r.preserved))await withLedgerDb(actor,async(tx,scope)=>{
    assert.equal(scope.ledgerId,plan.ledgerId);
    const old=await tx.recurringRule.findUnique({where:{id:rule.id}});
    if(old){const serialized=serializeRule(old);for(const [key,value] of Object.entries(rule.input))assert.deepEqual(serialized[key],value,'An existing sample template was edited');}
    else await insertRule(tx,scope.ledgerId,rule.id,rule.input);
  });
  for(const item of plan.rows)await withLedgerDb(actor,async(tx,scope)=>{
    assert.equal(scope.ledgerId,plan.ledgerId);
    if(item.occurrence){
      const rule=await tx.recurringRule.findUniqueOrThrow({where:{id:item.occurrence.ruleId}});
      const prepared=plan.rules.find(r=>r.id===rule.id);
      const serialized=serializeRule(rule);
      for(const [key,value] of Object.entries(prepared.input))assert.deepEqual(serialized[key],value,'Template changed during sample import');
      assert.ok(isDue(serialized,item.occurrence.period));
    }
    await insertExpense(tx,scope.ledgerId,item.id,item.input);
    if(item.occurrence){
      const {id,ruleId,period}=item.occurrence, date=new Date(period+'-01T00:00:00Z');
      const old=await tx.recurringOccurrence.findUnique({where:{userId_ruleId_period:{userId:scope.ledgerId,ruleId,period:date}}});
      if(old){assert.equal(old.expenseId,item.id,'Occurrence already belongs to another expense');assert.equal(old.state,'posted');}
      else await tx.$executeRaw`insert into famfi.recurring_occurrences(id,user_id,rule_id,period,state,expense_id) values(${id}::uuid,${scope.ledgerId}::uuid,${ruleId}::uuid,${date}::date,'posted',${item.id}::uuid)`;
    }
  });
}

export function verifyPreservation(before,after) {
  assert.equal(after.ownerId,before.ownerId);
  assert.deepEqual(after.household,before.household);
  for(const table of notesBackupTables){
    const ids=new Set(before[table.key].map(row=>row.id));
    assert.deepEqual(normalizeBackupRows(after[table.key].filter(row=>ids.has(row.id)),table.fields),normalizeBackupRows(before[table.key],table.fields),table.key+' original records changed');
  }
}

export async function verifySample(actor,plan) {
  const snapshot=await captureSampleHousehold(actor);
  for(const item of plan.rows){
    const row=exactlyOne(snapshot.expenses.filter(r=>r.id===item.id),'Sample expense missing');
    for(const [key,value] of Object.entries(item.input))if(key!=='date')assert.deepEqual(row[key],value,'Sample expense field differs');
    assert.equal(row.date,item.input.date.length===7?item.input.date+'-01':item.input.date);
    assert.equal(row.datePrecision,item.input.date.length===7?'month':'day');
    assert.equal(row.recordedByPartyId,plan.partyId);
    if(item.occurrence){const occurrence=exactlyOne(snapshot.recurringOccurrences.filter(o=>o.id===item.occurrence.id),'Sample occurrence missing');assert.equal(occurrence.expenseId,item.id);assert.equal(occurrence.state,'posted');assert.equal(occurrence.period,item.occurrence.period+'-01');}
  }
  for(const rule of plan.rules.filter(r=>!r.preserved)){
    const row=exactlyOne(snapshot.recurringRules.filter(r=>r.id===rule.id),'Sample template missing');
    for(const [key,value] of Object.entries(rule.input))assert.deepEqual(['startMonth','endMonth'].includes(key)?row[key]?.slice(0,7)??null:row[key],value,'Sample template field differs');
  }
  const createdIds=[...plan.rows.map(r=>r.id),...plan.rules.filter(r=>!r.preserved).map(r=>r.id),...plan.rows.flatMap(r=>r.occurrence?[r.occurrence.id]:[])];
  for(const id of createdIds)assert.ok(snapshot.auditEvents.some(e=>e.entityId===id&&e.action==='INSERT'&&e.actorPartyId===plan.partyId),'Sample history missing');
  await assert.rejects(withUserDb(randomUUID(),tx=>tx.expense.count()),e=>e.status===403);
  await assert.rejects(withUserDb(actor,tx=>tx.$queryRaw`select 1 from compath.owner_states limit 1`));
  return snapshot;
}

async function verifiedBackup(snapshot) {
  const file=await encryptBackup(snapshot);
  await verifyBackupRestore(await decryptBackup(file));
  console.log('Encrypted backup and isolated restore verified: '+file);
  return file;
}

async function main(){
  assert.equal(process.env.FAMFI_DB_SCHEMA,'famfi','Explicit Production schema required');
  assert.equal(process.env.NODE_ENV,'production','Production TLS verification required');
  const [mode,confirmation]=process.argv.slice(2);assert.ok(['inspect','apply','verify'].includes(mode));
  if(mode==='apply')assert.equal(confirmation,'--allow-production-sample');
  process.env.DATABASE_URL=(await readFile('.private/database-url','utf8')).trim();
  const owners=await adminQuery("select hm.user_id from famfi.household_members hm join famfi.parties p on p.id=hm.party_id and p.user_id=hm.ledger_id join famfi.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())");
  const actor=exactlyOne(owners,'Confirmed owner missing or ambiguous').user_id;
  try{
    const plan=await prepareSample(actor);
    console.log(JSON.stringify({batch:sampleBatch,totals:sampleTotals(plan),newTemplates:plan.rules.filter(r=>!r.preserved).length,preservedTemplates:plan.rules.filter(r=>r.preserved).map(r=>r.def.name)}));
    if(mode==='inspect')return;
    if(mode==='verify'){await verifySample(actor,plan);console.log('PASS: live sample rows, recurring history, actor and access isolation verified');return;}
    const before=await captureSampleHousehold(actor);
    assert.ok(!before.expenses.some(e=>['2026-07','2026-08'].includes(e.date.slice(0,7))&&!plan.rows.some(r=>r.id===e.id)),'Existing July/August expenses require review');
    assert.ok(!before.expenseSummaries.some(s=>['2026-07','2026-08'].includes(s.month.slice(0,7))),'Existing summary requires review');
    await verifiedBackup(before);
    await applySample(actor,plan);
    const after=await verifySample(actor,plan);verifyPreservation(before,after);
    await verifiedBackup(after);
    console.log('PASS: sample import completed; original records and masters preserved; no Auth, schema, deployment or Preview changes');
  }finally{await getPrisma().$disconnect();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname)main().catch(error=>{
  console.error('Sample operation stopped. Existing records are not automatically deleted; deterministic IDs permit a reviewed retry.',{type:error?.name,code:error?.code,sqlState:error?.meta?.code});process.exitCode=1;
});
