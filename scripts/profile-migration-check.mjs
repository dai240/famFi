// Capture with the verified app role; write probes are always rolled back.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { databaseOptions } from '../lib/database-config.ts';
import { decryptBackup, encryptBackup } from './backup.mjs';
import { householdBackupTables, profileBackupTables, captureHouseholdBackup, normalizeBackupRows } from './backup-model.mjs';
import { verifyBackupRestore } from './verify-backup-restore.mjs';

async function main(){
  const [mode,filename]=process.argv.slice(2);assert.ok(['before','after'].includes(mode));
  const previous=await decryptBackup(filename);assert.equal(previous.format,'famfi-expenses/v4');
  const owner=previous.ownerId;
  const connection=(await readFile(new URL('../.private/database-url',import.meta.url),'utf8')).trim();
  const client=new pg.Client(databaseOptions(connection,'production'));await client.connect();
  try{
    await client.query('begin isolation level repeatable read read only');
    await client.query("select set_config('app.user_id',$1,true)",[owner]);
    assert.equal((await client.query('select current_user as role')).rows[0].role,'famfi_app');
    const snapshot=await captureHouseholdBackup((sql,values)=>client.query(sql,values),owner,mode==='before'?'famfi-expenses/v4':'famfi-expenses/v5');
    if(mode==='after')for(const dataset of householdBackupTables)assert.deepEqual(normalizeBackupRows(snapshot[dataset.key],dataset.fields),normalizeBackupRows(previous[dataset.key],dataset.fields));
    await client.query('rollback');
    const output=await encryptBackup(snapshot);await decryptBackup(output);await verifyBackupRestore(snapshot);
    console.log(`Encrypted ${snapshot.format} snapshot verified and locally restored: ${output}; ${snapshot.expenses.length} expenses, ${snapshot.parties.length} parties, ${snapshot.paymentSources.length} sources. Contents not printed.`);
    if(mode==='after'){
      await client.query('begin');
      try{
        await client.query("select set_config('app.user_id',$1,true)",[owner]);
        const self=snapshot.exportedByPartyId,partner=snapshot.parties.find(p=>p.systemKey==='partner').id;
        await client.query("update famfi.parties set nickname=$1,profile_confirmed=true,version=version+1 where id=$2",['検証'+randomUUID().slice(0,6),self]);
        assert.equal((await client.query('select profile_confirmed from famfi.parties where id=$1',[self])).rows[0].profile_confirmed,true);
        assert.ok((await client.query("select count(*)::int n from famfi.audit_events where actor_party_id=$1 and entity_type='parties' and after_data->>'profile_confirmed'='true'",[self])).rows[0].n>0);
        for(const [sql,values] of [
          ["update famfi.parties set nickname='偽装',profile_confirmed=true where id=$1",[partner]],
          ['update famfi.parties set profile_confirmed=false where id=$1',[self]],
          ["update famfi.parties set name='別人' where id=$1",[self]],
          ['update famfi.household_members set party_id=party_id',[]],
          ['select * from auth.users',[]],['select * from compath.owner_states',[]],
        ]){await client.query('savepoint denied');await assert.rejects(client.query(sql,values));await client.query('rollback to savepoint denied');}
        await client.query("select set_config('app.user_id',$1,true)",[randomUUID()]);
        for(const dataset of profileBackupTables)assert.equal((await client.query(`select count(*)::int n from famfi.${dataset.table}`)).rows[0].n,0);
      }finally{await client.query('rollback');}
      await client.query('begin isolation level repeatable read read only');await client.query("select set_config('app.user_id',$1,true)",[owner]);
      const final=await captureHouseholdBackup((sql,values)=>client.query(sql,values),owner);
      for(const dataset of profileBackupTables)assert.deepEqual(normalizeBackupRows(final[dataset.key],dataset.fields),normalizeBackupRows(snapshot[dataset.key],dataset.fields));
      await client.query('rollback');
      console.log('PASS: original fields unchanged; self update/audit, spouse protection, other-schema and outsider denial verified; all probes rolled back and all fields rechecked.');
    }
  }finally{await client.end();}
}
main().catch(error=>{console.error('Profile migration verification failed; secrets and records are not displayed.',{type:error?.name,code:error?.code});process.exitCode=1;});
