import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

test('profile SQL allows only linked self updates, preserves roles, rejects cross-app access and records audit',async()=>{
  const db = new PGlite();
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);revoke all on schema public from public;');
    const root=path.resolve('../personal-apps-infra/supabase');
    for(const file of (await readdir(path.join(root,'migrations'))).sort())if(/^\d+_(shared_foundation|shared_runtime_admin_membership|famfi_.*)\.sql$/.test(file))await db.exec(await readFile(path.join(root,'migrations',file),'utf8'));
    await db.exec(await readFile(path.join(root,'tests/famfi_member_profiles.sql'),'utf8'));
  } finally {await db.close();}
});
