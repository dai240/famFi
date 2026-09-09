import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encryptBackup, decryptBackup } from '../scripts/backup.mjs';
test('backups round-trip through encryption without plaintext on disk', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'famfi-backup-test-'));
  try {
    const payload = { format: 'famfi-expenses/v1', ownerId: 'test-owner', categories: [], expenses: [{ description: 'PRIVATE_TEST_RECORD', amount: 980 }] };
    const filename = await encryptBackup(payload, directory);
    assert.equal((await readFile(filename)).includes(Buffer.from('PRIVATE_TEST_RECORD')), false);
    assert.deepEqual(await decryptBackup(filename, directory), payload);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
