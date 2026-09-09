import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseOptions } from '../lib/database-config.ts';
const url = await readFile(new URL('../.private/database-url', import.meta.url), 'utf8');
process.env.DATABASE_URL = url;
const db = new PrismaClient({ adapter: new PrismaPg(databaseOptions(url, 'production'), { schema: 'famfi' }) });
let passed = 0;
try {
  const [role] = await db.$queryRawUnsafe('select current_user::text, session_user::text');
  if (role.current_user !== 'famfi_app' || role.session_user !== 'famfi_app') throw new Error('Incorrect runtime identity');
  passed++;
  for (const table of ['memberships', 'categories', 'expenses']) {
    const [row] = await db.$queryRawUnsafe(`select count(*)::int as n from famfi.${table}`);
    if (row.n !== 0) throw new Error('Context-free query exposed data');
    passed++;
  }
  for (const query of ['select * from platform.apps', 'select * from auth.users', 'set role postgres', 'set role service_role', 'create table famfi.__forbidden(id int)', 'create table public.__forbidden(id int)', 'update famfi.memberships set active=false']) {
    let rejected = false;
    try { await db.$transaction(async tx => { await tx.$executeRawUnsafe(query); throw new Error('Unexpected access'); }); }
    catch (error) { if (error.code === 'P2010') rejected = true; else throw error; }
    if (!rejected) throw new Error('A restricted operation succeeded');
    passed++;
  }
  console.log(`PASS: ${passed} actual runtime identity/isolation checks. No user data written.`);
} catch (error) {
  const safe = String(error.message).replaceAll(url, '[redacted]').replaceAll(new URL(url).password, '[redacted]');
  console.error('Runtime verification failed', { type: error.name, code: error.code ?? error.errorCode ?? null, detail: safe.split('\n').slice(-2).join(' ') }); process.exitCode = 1;
} finally { await db.$disconnect(); }
