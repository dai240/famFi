import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// The reviewed model remains production-scoped. Only these exact schema declarations vary.
const schema = process.env.FAMFI_DB_SCHEMA ?? 'famfi';
if (!['famfi', 'famfi_preview'].includes(schema)) throw new Error('Unsupported database schema');
if (process.env.VERCEL_ENV === 'preview' && (schema !== 'famfi_preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'preview')) throw new Error('Untrusted preview build');
if (process.env.VERCEL_ENV === 'production' && schema !== 'famfi') throw new Error('Incorrect production schema');
let source = await readFile('prisma/schema.prisma', 'utf8');
source = source.replace('provider   = "prisma-client-js"', 'provider   = "prisma-client-js"\n  output = "../node_modules/.prisma/client"');
source = source.replace('schemas  = ["famfi"]', `schemas  = ["${schema}"]`).replaceAll('@@schema("famfi")', `@@schema("${schema}")`);
await mkdir('.generated', { recursive: true });
await writeFile('.generated/schema.prisma', source);
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'generate', '--schema', path.resolve('.generated/schema.prisma')], { stdio: 'inherit' });
await mkdir('lib/generated/prisma',{recursive:true});
await writeFile('lib/generated/prisma/environment.json',JSON.stringify({schema})+'\n');
