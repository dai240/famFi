// One-time v6 -> v7 rollout. Live writes are temporary and always rolled back.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { adminQuery } from './supabase-admin.mjs';
import { captureHouseholdBackup, planningBackupTables, notesBackupTables, normalizeBackupRows } from './backup-model.mjs';
import { encryptBackup, decryptBackup } from './backup.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';
async function main(){
  const [mode,filename]=process.argv.slice(2),schema=process.env.FAMFI_DB_SCHEMA;
  assert.ok(['famfi','famfi_preview'].includes(schema));assert.ok(['before','after'].includes(mode));
  const owners=await adminQuery(`select hm.user_id from ${schema}.household_members hm join ${schema}.parties p on p.id=hm.party_id join ${schema}.memberships m on m.user_id=hm.user_id join auth.users u on u.id=hm.user_id where p.system_key='owner' and m.active and u.email_confirmed_at is not null`);
  assert.equal(owners.length,1);const actor=owners[0].user_id;
  const previous=mode==='after'?await decryptBackup(filename):null;if(previous)assert.equal(previous.format,'famfi-expenses/v6');
  const db=new pg.Client(databaseOptions((await readFile(schema==='famfi'?'.private/database-url':'.private/preview-database-url','utf8')).trim(),'production'));
  await db.connect();
  const capture=async()=>{await db.query('begin isolation level repeatable read read only');try{await db.query("select set_config('app.user_id',$1,true)",[actor]);return await captureHouseholdBackup((sql,values)=>db.query(sql,values),actor,undefined,schema);}finally{await db.query('rollback');}};
  try{
    assert.equal((await db.query('select current_user as role')).rows[0].role,schema+'_app');
    const snapshot=await capture();assert.equal(snapshot.format,mode==='before'?'famfi-expenses/v6':'famfi-expenses/v7');
    if(previous){assert.equal(snapshot.ownerId,previous.ownerId);for(const t of planningBackupTables)assert.deepEqual(normalizeBackupRows(snapshot[t.key],t.fields),normalizeBackupRows(previous[t.key],t.fields),t.key+' preservation');}
    const output=await encryptBackup(snapshot);await verifyBackupRestore(await decryptBackup(output));
    console.log('PASS: '+schema+' '+snapshot.format+' encrypted backup and isolated restore: '+output);
    if(mode==='before')return;
    assert.equal((await db.query(`select count(*)::int n from ${schema}.household_notes`)).rows[0].n,0);
    assert.equal((await db.query(`select count(*)::int n from ${schema}.household_roster()`)).rows[0].n,0);
    for(const sql of ['select * from '+(schema==='famfi'?'famfi_preview':'famfi')+'.household_notes','select * from compath.owner_states','select * from auth.users',`update ${schema}.memberships set active=false`]){
      await db.query('begin');try{await assert.rejects(db.query(sql));}finally{await db.query('rollback');}
    }
    await db.query('begin');
    try{
      await db.query("select set_config('app.user_id',$1,true)",[actor]);
      assert.ok((await db.query(`select * from ${schema}.household_roster()`)).rows.some(r=>r.party_id===snapshot.exportedByPartyId));
      const id=randomUUID();await db.query(`insert into ${schema}.household_notes(id,user_id,name,kind,date,date_precision) values($1,$2,'ROLLBACK note probe','task','2037-09-01','month')`,[id,snapshot.ownerId]);
      await db.query(`update ${schema}.household_notes set completed=true,version=version+1 where id=$1`,[id]);
      const note=(await db.query(`select date::text,completed,version from ${schema}.household_notes where id=$1`,[id])).rows[0];assert.deepEqual(note,{date:'2037-09-01',completed:true,version:2});
      assert.equal((await db.query(`select count(*)::int n from ${schema}.audit_events where entity_type='household_notes' and entity_id=$1`,[id])).rows[0].n,2);
      await db.query('savepoint denied');await assert.rejects(db.query(`update ${schema}.household_notes set kind='note' where id=$1`,[id]));await db.query('rollback to savepoint denied');
      await db.query("select set_config('app.user_id',$1,true)",[randomUUID()]);assert.equal((await db.query(`select * from ${schema}.household_notes`)).rows.length,0);assert.equal((await db.query(`select * from ${schema}.household_roster()`)).rows.length,0);
    }finally{await db.query('rollback');}
    const final=await capture();for(const t of notesBackupTables)assert.deepEqual(normalizeBackupRows(final[t.key],t.fields),normalizeBackupRows(snapshot[t.key],t.fields),t.key+' rollback');
    console.log('PASS: '+schema+' old fields unchanged; real runtime TLS, notes/history/roster, outsider and cross-schema rejection. All probes rolled back.');
  }finally{await db.end();}
}
main().catch(error=>{console.error('Notes release check failed; records and credentials suppressed.',{type:error?.name,code:error?.code});process.exitCode=1;});
