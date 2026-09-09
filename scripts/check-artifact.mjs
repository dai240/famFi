import { readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { PrismaPg } from '@prisma/adapter-pg';

const walk = directory => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const traces = walk('.next/server/app').filter(file => file.endsWith('.nft.json'));
if (!traces.length) throw new Error('Run the production build first');
let apiCount = 0;
for (const file of traces) {
  const { files } = JSON.parse(readFileSync(file, 'utf8'));
  if (files.some(path => path.includes('.private/') || /(?:^|\/)\.env(?:\.|$)/.test(path))) {
    throw new Error(`Private configuration in artifact: ${file}`);
  }
  if (file.includes('/api/')) {
    if (!files.some(path => path.endsWith('certs/supabase-ca.crt'))) throw new Error(`Missing public CA: ${file}`);
    if (!files.some(path => path.endsWith('node_modules/.prisma/client/query_compiler_bg.wasm'))) throw new Error(`Missing Prisma query compiler: ${file}`);
    apiCount++;
  }
}

// Initialize from only the traced files, so workspace dependencies cannot hide packaging defects.
const directory = mkdtempSync(join(tmpdir(), 'famfi-artifact-'));
const previousUrl = process.env.DATABASE_URL;
let db;
try {
  const tracePath = resolve('.next/server/app/api/auth/verify/route.js.nft.json');
  const { files } = JSON.parse(readFileSync(tracePath, 'utf8'));
  for (const file of files) {
    const source = resolve(dirname(tracePath), file);
    const destinationPath = relative(process.cwd(), source);
    if (destinationPath.startsWith('..')) throw new Error('Artifact contains a file outside the project');
    const destination = join(directory, destinationPath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  process.env.DATABASE_URL = 'postgresql://artifact:fixture@127.0.0.1:1/postgres';
  const requireArtifact = createRequire(join(directory, 'probe.cjs'));
  const { PrismaClient } = requireArtifact('@prisma/client');
  db = new PrismaClient({ adapter: new PrismaPg({ host: '127.0.0.1', port: 1, user: 'artifact', database: 'postgres', connectionTimeoutMillis: 100 }, { schema: 'famfi' }) });
  // PrismaPg connects lazily. This loads the compiler without sending any SQL or using real credentials.
  await db.$connect();
} finally {
  try { if (db) await db.$disconnect(); }
  finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(directory, { recursive: true, force: true });
  }
}
console.log(`PASS: ${traces.length} app traces exclude private configuration; ${apiCount} APIs include the public CA and Prisma compiler; isolated artifact initializes without a DB`);
