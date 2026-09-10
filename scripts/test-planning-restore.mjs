import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {captureHouseholdBackup} from './backup-model.mjs';
import {encryptBackup,decryptBackup} from './backup.mjs';
import {verifyBackupRestore} from './verify-backup-restore.mjs';
const schema=process.env.FAMFI_TEST_SCHEMA??'famfi_preview';
if(!['famfi','famfi_preview'].includes(schema))throw new Error('Unsupported fixture schema');
const db=new pg.Client({host:'127.0.0.1',port:55432,user:`${schema}_app`,database:'postgres'});
const directory=await mkdtemp(path.join(tmpdir(),'famfi-planning-restore-'));
try{
  await db.connect();await db.query('begin isolation level repeatable read read only');
  const owner='11111111-1111-4111-8111-111111111111';await db.query("select set_config('app.user_id',$1,true)",[owner]);
  const payload=await captureHouseholdBackup((sql,values)=>db.query(sql,values),owner,undefined,schema);
  await db.query('rollback');
  const file=await encryptBackup(payload,directory);await verifyBackupRestore(await decryptBackup(file,directory));
  console.log('PASS: v6 summary links, planned expenses, review windows, cost classes, profiles and audit restore exactly; other household rejected. No production connection.');
}finally{await db.end();await rm(directory,{recursive:true,force:true});}
