import { generateKey, readKey, readPrivateKey, createMessage, readMessage, encrypt, decrypt } from 'openpgp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseOptions } from '../lib/database-config.ts';

export const backupDirectory = path.join(homedir(), '.local/share/famfi-backups');
export async function initializeKeys(directory = backupDirectory) {
  await mkdir(path.join(directory, 'keys'), { recursive: true, mode: 0o700 });
  try { await readFile(path.join(directory, 'keys/private.asc')); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const keys = await generateKey({ type: 'rsa', rsaBits: 3072, userIDs: [{ name: 'famFi backup' }], format: 'armored' });
  await writeFile(path.join(directory, 'keys/private.asc'), keys.privateKey, { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(directory, 'keys/public.asc'), keys.publicKey, { mode: 0o600, flag: 'wx' });
}
export async function encryptBackup(payload, directory = backupDirectory) {
  await initializeKeys(directory);
  const key = await readKey({ armoredKey: await readFile(path.join(directory, 'keys/public.asc'), 'utf8') });
  const encrypted = await encrypt({ message: await createMessage({ text: JSON.stringify(payload) }), encryptionKeys: key, format: 'binary' });
  const filename = path.join(directory, `famfi-${new Date().toISOString().replace(/[:.]/g, '-')}.json.pgp`);
  await writeFile(filename, encrypted, { mode: 0o600, flag: 'wx' });
  return filename;
}
export async function decryptBackup(filename, directory = backupDirectory) {
  const key = await readPrivateKey({ armoredKey: await readFile(path.join(directory, 'keys/private.asc'), 'utf8') });
  const { data } = await decrypt({ message: await readMessage({ binaryMessage: new Uint8Array(await readFile(filename)) }), decryptionKeys: key });
  const payload = JSON.parse(data);
  if (!['famfi-expenses/v1', 'famfi-expenses/v2'].includes(payload.format) || !Array.isArray(payload.expenses) || !Array.isArray(payload.categories)) throw new Error('Invalid backup format');
  return payload;
}
async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'init') { await initializeKeys(); console.log(`Backup keys initialized: ${backupDirectory}/keys (private, not printed)`); return; }
  if (command === 'verify') {
    const backup = await decryptBackup(arg);
    console.log(`Encrypted backup verified: ${backup.expenses.length} expenses. Contents not displayed.`); return;
  }
  if (command !== 'create' || !/^[0-9a-f-]{36}$/i.test(arg ?? '')) throw new Error('Use init, create <owner UUID>, or verify <encrypted file>');
  const connection = process.env.FAMFI_BACKUP_DATABASE_URL ?? (await readFile(new URL('../.private/database-url', import.meta.url), 'utf8')).trim();
  process.env.DATABASE_URL = connection;
  const db = new PrismaClient({ adapter: new PrismaPg(databaseOptions(connection, 'production'), { schema: 'famfi' }) });
  try {
    const payload = await db.$transaction(async tx => {
      await tx.$executeRaw`set transaction read only`;
      await tx.$queryRaw`select set_config('app.user_id', ${arg}, true)`;
      const membership = await tx.membership.findUnique({ where: { userId: arg } });
      if (!membership?.active) throw new Error('The owner must be provisioned before taking a backup');
      return { format: 'famfi-expenses/v2', exportedAt: new Date().toISOString(), ownerId: arg,
        categories: await tx.category.findMany(), expenses: await tx.expense.findMany({ where: { userId: arg }, orderBy: { id: 'asc' } }) };
    }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
    const filename = await encryptBackup(payload);
    await decryptBackup(filename);
    console.log(`Encrypted backup created and verified: ${filename}`);
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch(() => { console.error('Backup failed. No secrets or user records are printed.'); process.exitCode = 1; });
}
