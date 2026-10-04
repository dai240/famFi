// Trusted operator CLI only. Never deployed; never uses a privileged role for ledger data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseRakutenBank, cashImportId } from './rakuten-bank-csv.mjs';
import { captureHouseholdBackup, cashBackupTables, normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

const require=createRequire(import.meta.url);
require.cache[require.resolve('server-only')]={exports:{}};
const {withUserDb,withLedgerDb,getPrisma}=require('../lib/prisma.ts');
const {insertCash,checkCashReferences}=require('../lib/cash-movement-service.ts');

export async function planCashImport(actor,sourceId,parsed) {
  return withUserDb(actor,async(tx,scope)=>{
    const {key:_key,...first}=parsed.rows[0];
    await checkCashReferences(tx,scope.ledgerId,{...first,paymentSourceId:sourceId});
    const keys=new Set(parsed.rows.map(r=>r.key));
    const existing=(await tx.cashMovement.findMany({where:{userId:scope.ledgerId,paymentSourceId:sourceId,importKey:{not:null}}})).filter(r=>keys.has(r.importKey));
    return {ledgerId:scope.ledgerId,sourceId,existing:existing.length,voided:existing.filter(r=>r.voided).length,create:parsed.rows.length-existing.length};
  });
}
export async function applyCashImport(actor,plan,parsed) {
  let created=0,skipped=0,voided=0;
  // Short household-locked transactions keep ordinary entry responsive. Replays are idempotent.
  for(let offset=0;offset<parsed.rows.length;offset+=10){
    const result=await withLedgerDb(actor,async(tx,scope)=>{
      assert.equal(scope.ledgerId,plan.ledgerId);
      const batch=[];
      for(const {key,...fields} of parsed.rows.slice(offset,offset+10))batch.push(await insertCash(tx,scope.ledgerId,
        cashImportId(scope.ledgerId,plan.sourceId,key),{...fields,paymentSourceId:plan.sourceId},{key,batch:parsed.batch}));
      return batch;
    });
    created+=result.filter(r=>!r.skipped).length;skipped+=result.filter(r=>r.skipped).length;voided+=result.filter(r=>r.voided).length;
  }
  return {created,skipped,voided};
}
export function captureCashHousehold(actor) {
  return withLedgerDb(actor,tx=>captureHouseholdBackup(async(sql,values=[])=>({rows:await tx.$queryRawUnsafe(sql,...values)}),actor,undefined));
}
async function checkedBackup(snapshot) {
  assert.equal(snapshot.format,'famfi-expenses/v8');
  const filename=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(filename));
  console.log('Encrypted backup and isolated restore verified: '+filename);
}
async function main() {
  const {values}=parseArgs({options:{file:{type:'string'},actor:{type:'string'},source:{type:'string'},apply:{type:'boolean'},'allow-production-import':{type:'boolean'},'expected-sha256':{type:'string'}}});
  assert.ok(values.file,'CSV file is required');
  const bytes=await readFile(values.file),parsed=parseRakutenBank(bytes),sha=createHash('sha256').update(bytes).digest('hex');
  console.log(JSON.stringify({fileSha256:sha,summary:parsed.summary}));
  if(!values.actor&&!values.source&&!values.apply)return;
  assert.match(values.actor??'',/^[0-9a-f-]{36}$/i);assert.match(values.source??'',/^[0-9a-f-]{36}$/i);
  assert.equal(process.env.FAMFI_DB_SCHEMA,'famfi','Real bank data must never enter Preview');
  assert.equal(process.env.NODE_ENV,'production','Explicit Production TLS required');
  process.env.DATABASE_URL=(await readFile('.private/database-url','utf8')).trim();
  try {
    // Actor must first be verified against active membership and confirmed Auth by the operator.
    const plan=await planCashImport(values.actor,values.source,parsed);
    console.log(JSON.stringify({create:plan.create,alreadyImported:plan.existing,previouslyDeleted:plan.voided}));
    if(!values.apply)return;
    assert.equal(values['allow-production-import'],true);assert.equal(values['expected-sha256'],sha);
    const before=await captureCashHousehold(values.actor);await checkedBackup(before);
    const result=await applyCashImport(values.actor,plan,parsed);
    const after=await captureCashHousehold(values.actor);
    assert.equal(after.ownerId,before.ownerId);assert.deepEqual(after.household,before.household);
    for(const table of cashBackupTables){
      const ids=new Set(before[table.key].map(row=>row.id));
      const retained=after[table.key].filter(row=>ids.has(row.id));
      assert.deepEqual(normalizeBackupRows(retained,table.fields),normalizeBackupRows(before[table.key],table.fields));
      if(!['cashMovements','auditEvents'].includes(table.key))assert.equal(after[table.key].length,before[table.key].length);
    }
    for(const input of parsed.rows){
      const row=after.cashMovements.find(r=>r.paymentSourceId===plan.sourceId&&r.importKey===input.key);
      assert.ok(row);assert.equal(row.amount,input.amount);assert.equal(row.date,input.date);
    }
    assert.equal(after.cashMovements.length-before.cashMovements.length,result.created);
    await checkedBackup(after);console.log(JSON.stringify({verified:true,...result,existingExpensesPreserved:true}));
  } finally {await getPrisma().$disconnect();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname)main().catch(error=>{
  console.error('Bank import stopped; no automatic deletion or overwrite. Review before retrying.',{type:error?.name,code:error?.code});process.exitCode=1;
});
