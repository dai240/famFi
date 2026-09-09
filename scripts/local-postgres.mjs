import { execFileSync } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

export async function localPostgres(bin, port) {
  const directory=await mkdtemp(path.join(tmpdir(),'famfi-postgres-'));
  const data=path.join(directory,'data'); let running=false;let client;
  const run=(name,args)=>execFileSync(path.join(path.resolve(bin),name),args,{stdio:'pipe'});
  async function close(){await client?.end();if(running){run('pg_ctl',['-D',data,'-m','fast','-w','stop']);running=false;}await rm(directory,{recursive:true,force:true});}
  try {
    run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--locale=C']);
    run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${directory}`,'-w','start']);running=true;
    client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await client.connect();
    console.log('Disposable PostgreSQL 17 stack started on loopback only. No shared database is connected.');
    return {exec:sql=>client.query(sql),query:(sql,values)=>client.query(sql,values),close};
  } catch(error){await close();throw error;}
}
