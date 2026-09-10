import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {localPostgres} from './local-postgres.mjs';
import {encryptBackup,decryptBackup} from './backup.mjs';
import {verifyBackupRestore} from './verify-backup-restore.mjs';
const bin=process.env.FAMFI_TEST_PG_BIN;assert.ok(bin,'Set the installed disposable PostgreSQL bin path');
process.env.NODE_ENV='development';process.env.FAMFI_DB_SCHEMA='famfi';process.env.DATABASE_URL='postgresql://famfi_app:fixture@127.0.0.1:55434/postgres';
const db=await localPostgres(bin,55434),directory=await mkdtemp(path.join(tmpdir(),'famfi-summer-backup-'));
let getPrisma;
try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);revoke all on schema public from public;');
  const migrations=path.resolve('../personal-apps-infra/supabase/migrations');
  for(const file of (await readdir(migrations)).sort())if(/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_.*)\.sql$/.test(file))await db.exec(await readFile(path.join(migrations,file),'utf8'));
  const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  await db.exec(`insert into auth.users values('${owner}'),('${other}');insert into famfi.memberships(user_id) values('${owner}'),('${other}');select famfi.provision_household('${owner}');select famfi.provision_household('${other}');`);
  const {prepareSample,applySample,verifySample,captureSampleHousehold,verifyPreservation,sampleTotals}=await import('./seed-summer-sample.mjs');
  const require=createRequire(import.meta.url);const prisma=require('../lib/prisma.ts');getPrisma=prisma.getPrisma;
  const {insertRule}=require('../lib/recurring-service.ts');
  const plan=await prepareSample(owner),before=await captureSampleHousehold(owner);
  assert.deepEqual(sampleTotals(plan).map(m=>m.records),[40,45]);assert.equal(plan.rules.length,10);
  assert.equal(plan.rows.filter(r=>r.occurrence).length,19);
  await applySample(owner,plan);const after=await verifySample(owner,plan);verifyPreservation(before,after);
  assert.equal(after.expenses.length,85);assert.equal(after.recurringRules.length,10);assert.equal(after.recurringOccurrences.length,19);
  await applySample(owner,await prepareSample(owner));const repeated=await verifySample(owner,plan);verifyPreservation(after,repeated);
  assert.equal(repeated.expenses.length,85);assert.equal(repeated.auditEvents.length,after.auditEvents.length);
  // The production household already has its own September mortgage rule.
  const otherPlan=await prepareSample(other),mortgage=otherPlan.rules.find(r=>r.def.key==='mortgage');
  await prisma.withLedgerDb(other,(tx,scope)=>insertRule(tx,scope.ledgerId,'55555555-5555-4555-8555-555555555555',{...mortgage.input,name:'住宅ローン',startMonth:'2026-09',amountMode:'fixed',amount:105000}));
  const existing=await captureSampleHousehold(other),preserving=await prepareSample(other);
  assert.equal(preserving.rules.filter(r=>r.preserved).length,1);assert.equal(preserving.rows.filter(r=>r.occurrence).length,17);
  await applySample(other,preserving);const otherAfter=await verifySample(other,preserving);verifyPreservation(existing,otherAfter);
  assert.equal(otherAfter.recurringRules.length,10);assert.equal(otherAfter.expenses.length,85);
  await assert.rejects(prisma.withUserDb(other,tx=>tx.expense.findUniqueOrThrow({where:{id:plan.rows[0].id}})));
  const file=await encryptBackup(otherAfter,directory);await verifyBackupRestore(await decryptBackup(file,directory));
  console.log(JSON.stringify({totals:sampleTotals(plan),expenses:85,templates:10,existingMortgagePreserved:true,repeatDoesNotDuplicate:true,otherHouseholdRejected:true,backupRestore:'v7 passed'}));
}finally{await getPrisma?.().$disconnect();await db.close();await rm(directory,{recursive:true,force:true});}
