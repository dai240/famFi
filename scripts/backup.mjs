import { generateKey, readKey, readPrivateKey, createMessage, readMessage, encrypt, decrypt } from 'openpgp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { captureHouseholdBackup } from './backup-model.mjs';
import { databaseOptions } from '../lib/database-config.ts';

export const backupDirectory = path.join(homedir(), process.env.FAMFI_DB_SCHEMA==='famfi_preview'?'.local/share/famfi-preview-backups':'.local/share/famfi-backups');
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
  if (!['famfi-expenses/v1', 'famfi-expenses/v2', 'famfi-expenses/v3', 'famfi-expenses/v4', 'famfi-expenses/v5','famfi-expenses/v6','famfi-expenses/v7'].includes(payload.format) || !Array.isArray(payload.expenses) || !Array.isArray(payload.categories)) throw new Error('Invalid backup format');
  if (payload.format === 'famfi-expenses/v3' && !['parties','paymentSources','settlements'].every(key => Array.isArray(payload[key]))) throw new Error('Invalid ledger backup');
  if (['famfi-expenses/v4','famfi-expenses/v5','famfi-expenses/v6','famfi-expenses/v7'].includes(payload.format) && (!payload.household || !['parties','paymentSources','settlements','recurringRules','recurringOccurrences','auditEvents'].every(key=>Array.isArray(payload[key])))) throw new Error('Invalid household backup');
  if(['famfi-expenses/v6','famfi-expenses/v7'].includes(payload.format)&&(!Array.isArray(payload.expenseSummaries)||!Array.isArray(payload.plannedExpenses)))throw new Error('Invalid planning backup');
  if(payload.format==='famfi-expenses/v7'&&!Array.isArray(payload.householdNotes))throw new Error('Invalid notes backup');
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
  const connection = process.env.FAMFI_BACKUP_DATABASE_URL ?? (await readFile(new URL(process.env.FAMFI_DB_SCHEMA==='famfi_preview'?'../.private/preview-database-url':'../.private/database-url', import.meta.url), 'utf8')).trim();
  const db = new pg.Client(databaseOptions(connection, 'production'));
  await db.connect();
  try {
    await db.query('begin isolation level repeatable read read only');
    await db.query("select set_config('app.user_id',$1,true)",[arg]);
    const payload=await captureHouseholdBackup((sql,values)=>db.query(sql,values),arg);
    await db.query('rollback');
    const filename = await encryptBackup(payload);
    await decryptBackup(filename);
    console.log(`Encrypted backup created and verified: ${filename}`);
  } finally { await db.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch(() => { console.error('Backup failed. No secrets or user records are printed.'); process.exitCode = 1; });
}
