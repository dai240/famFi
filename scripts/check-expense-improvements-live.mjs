// Read-only Production verification and encrypted backup. No sample cleanup or settlement writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';
const require=createRequire(import.meta.url);
require.cache[require.resolve('server-only')]={exports:{}};
const {withUserDb,getPrisma}=require('../lib/prisma.ts');
const {monthSnapshot}=require('../lib/expense-comparison-service.ts');
const {monthRange}=require('../lib/expenses.ts');
async function main(){
  assert.equal(process.env.NODE_ENV,'production');assert.equal(process.env.FAMFI_DB_SCHEMA,'famfi');
  const owners=await adminQuery("select hm.user_id from famfi.household_members hm join famfi.parties p on p.id=hm.party_id and p.user_id=hm.ledger_id join famfi.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())");
  assert.equal(owners.length,1);const actor=owners[0].user_id;
  process.env.DATABASE_URL=(await readFile('.private/database-url','utf8')).trim();
  try{
    const snapshot=await withUserDb(actor,async(tx,scope)=>{
      await tx.$executeRawUnsafe('set local transaction_read_only = on');
      const role=await tx.$queryRawUnsafe('select current_user::text as role');assert.equal(role[0].role,'famfi_app');
      const categories=await tx.category.findMany();
      for(const month of ['2026-07','2026-08']){
        const result=await monthSnapshot(tx,scope.ledgerId,month,categories);
        const amounts=await tx.expense.aggregate({where:{userId:scope.ledgerId,date:monthRange(month)},_sum:{amount:true}});
        assert.equal(result.total,(amounts._sum.amount??0)+result.summaryRemainder);
        assert.equal(result.costs.reduce((sum,c)=>sum+c.amount,0),result.total);
        console.log(JSON.stringify({month,records:result.count,total:result.total,sampleCount:result.sampleCount}));
      }
      return captureHouseholdBackup(async(sql,values=[])=>({rows:await tx.$queryRawUnsafe(sql,...values)}),actor,'famfi-expenses/v7','famfi');
    });
    const file=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(file));
    await assert.rejects(withUserDb(randomUUID(),async()=>null),e=>e.status===403);
    for(const schema of ['compath','famfi_preview'])await assert.rejects(withUserDb(actor,tx=>tx.$queryRawUnsafe('select * from '+schema+'.memberships')),e=>e.code==='P2010');
    console.log('PASS: actual runtime comparison, nonmember/cross-schema rejection and v7 encrypted restore; no Production records changed. Backup: '+file);
  }finally{await getPrisma().$disconnect();}
}
main().catch(error=>{console.error('Live verification failed; records and credentials suppressed.',{type:error?.name,code:error?.code});process.exitCode=1;});
