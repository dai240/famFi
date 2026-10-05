// One-time operator bridge for the user's already-reviewed bank file. Never reimports raw CSV.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup,financeBackupTables,normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup,decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';
const require=createRequire(import.meta.url);require.cache[require.resolve('server-only')]={exports:{}};
const {withLedgerDb,getPrisma}=require('../lib/prisma.ts'),{changeBank}=require('../lib/finance-service.ts'),{cardExpenseMonth}=require('../lib/finance.ts');
const batch='f37de13a83155fcb957817efbb4097f0d4cf5a48e32325ba761f66344d8be62b',bank='b7f3faca-4091-495c-9a9f-ae00afc68236';
const capture=(actor)=>withLedgerDb(actor,tx=>captureHouseholdBackup(async(sql,args=[])=>({rows:await tx.$queryRawUnsafe(sql,...args)}),actor,undefined,'famfi'));
async function save(snapshot){const file=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(file));console.log('Encrypted backup and independent restore: '+file);return file;}
function same(a,b){assert.equal(a.ownerId,b.ownerId);for(const t of financeBackupTables)assert.deepEqual(normalizeBackupRows(a[t.key],t.fields),normalizeBackupRows(b[t.key],t.fields),t.key+' changed');}
async function main(){
  const [mode,file,approval]=process.argv.slice(2);assert.ok(['prepare','apply'].includes(mode));assert.equal(process.env.NODE_ENV,'production');assert.equal(process.env.FAMFI_DB_SCHEMA,'famfi');
  process.env.DATABASE_URL=(await readFile('.private/database-url','utf8')).trim();
  const owners=await adminQuery("select hm.user_id from famfi.household_members hm join famfi.parties p on p.id=hm.party_id and p.user_id=hm.ledger_id join famfi.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())");
  assert.equal(owners.length,1);const actor=owners[0].user_id;
  try{
    const current=await capture(actor);assert.equal(current.format,'famfi-expenses/v9');
    const original=current.cashMovements.filter(r=>r.importBatch===batch);assert.equal(original.length,64);assert.ok(original.every(r=>r.paymentSourceId===bank));
    const shared=current.parties.find(p=>p.systemKey==='shared'),card=current.paymentSources.find(p=>p.isDefault&&p.method==='card'&&p.fundingPartyId===shared.id);assert.ok(card&&!card.archived);
    const rows=original.filter(r=>!r.voided&&r.kind==='card_payment'&&r.amount<0&&!r.summaryId);
    const groups=Map.groupBy(rows,r=>cardExpenseMonth(r.date));
    console.log(JSON.stringify({bankOriginalsPreserved:original.length,unpostedCardDebits:rows.length,expenseMonths:groups.size,otherBankRowsNotExpenses:original.length-rows.length}));
    if(mode==='prepare'){await save(current);return;}
    assert.equal(approval,'--allow-production-post');const previous=await decryptBackup(file);same(previous,current);await verifyBackupRestore(previous);
    for(const [month,records] of groups)await withLedgerDb(actor,(tx,s)=>changeBank(tx,s.ledgerId,{action:'post',month,paymentSourceId:card.id,entries:records.map(r=>({id:r.id,version:r.version})),details:[],keepSeparate:false}));
    await withLedgerDb(actor,async(tx,s)=>{const people=current.parties.filter(p=>p.kind==='person').map(p=>p.id);await tx.paymentSource.updateMany({where:{userId:s.ledgerId,fundingPartyId:{in:people},defaultTreatment:'advance'},data:{defaultTreatment:'direct',version:{increment:1}}});});
    const after=await capture(actor);await save(after);
    for(const t of financeBackupTables.filter(t=>!['cashMovements','expenseSummaries','paymentSources','auditEvents','cardMonthReviews'].includes(t.key)))assert.deepEqual(normalizeBackupRows(after[t.key],t.fields),normalizeBackupRows(current[t.key],t.fields),t.key+' preservation');
    const cashFields=financeBackupTables.find(t=>t.key==='cashMovements').fields.filter(k=>!['summaryId','version','updatedAt'].includes(k));assert.deepEqual(normalizeBackupRows(after.cashMovements,cashFields),normalizeBackupRows(current.cashMovements,cashFields));
    for(const row of rows){const posted=after.cashMovements.find(r=>r.id===row.id),summary=after.expenseSummaries.find(s=>s.id===posted.summaryId);assert.equal(summary.basis,'bank');assert.equal(summary.month.slice(0,7),cardExpenseMonth(row.date));assert.equal(summary.amount,-after.cashMovements.filter(c=>c.summaryId===summary.id).reduce((n,c)=>n+c.amount,0));}
    const oldAudit=financeBackupTables.find(t=>t.key==='auditEvents');assert.deepEqual(normalizeBackupRows(after.auditEvents.filter(r=>current.auditEvents.some(o=>o.id===r.id)),oldAudit.fields),normalizeBackupRows(current.auditEvents,oldAudit.fields));
    console.log(JSON.stringify({verified:true,postedCardDebits:rows.length,bankOriginals:after.cashMovements.length,bankSummaries:after.expenseSummaries.filter(s=>s.basis==='bank').length,monthlyReview:'left for household confirmation',individualDefault:'direct'}));
  }finally{await getPrisma().$disconnect();}
}
main().catch(e=>{console.error('Bank posting stopped. No automatic rollback; review before resuming.',{type:e?.name,code:e?.code});process.exitCode=1;});
