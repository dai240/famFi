// One-time encrypted credential transport. Never prints a password or private key.
import { generateKey, readPrivateKey, readMessage, decrypt } from 'openpgp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../.private/', import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o700 });
if (process.argv[2] === 'key') {
  const { privateKey, publicKey } = await generateKey({ type: 'rsa', rsaBits: 3072, userIDs: [{ name: 'famFi provisioning' }], format: 'armored', config: { v6Keys: false } });
  await writeFile(new URL('transport-private.asc', directory), privateKey, { mode: 0o600, flag: 'wx' });
  await writeFile(new URL('transport-public.asc', directory), publicKey, { mode: 0o600, flag: 'wx' });
  console.log(publicKey);
} else if (process.argv[2] === 'receive') {
  const ciphertext = await readFile(new URL('credential.asc', directory), 'utf8');
  const key = await readPrivateKey({ armoredKey: await readFile(new URL('transport-private.asc', directory), 'utf8') });
  const { data } = await decrypt({ message: await readMessage({ armoredMessage: ciphertext }), decryptionKeys: key });
  if (typeof data !== 'string' || !/^[a-f0-9]{64}$/.test(data)) throw new Error('Invalid credential payload');
  const url = new URL('postgresql://famfi_app.fpptihhtyhehpjvmtuqt@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres');
  url.password = data;
  url.search = new URLSearchParams({ schema: 'famfi', pgbouncer: 'true', connection_limit: '2', sslmode: 'require', sslaccept: 'strict' }).toString();
  await writeFile(new URL('database-url', directory), url.toString(), { mode: 0o600, flag: 'wx' });
  console.log('Dedicated runtime credential received; value not displayed.');
} else throw new Error('Use key or receive');
