import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encryptBackup, decryptBackup } from '../scripts/backup.mjs';
import { verifyBackupRestore } from '../scripts/verify-backup-restore.mjs';
test('backups round-trip through encryption without plaintext on disk', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'famfi-backup-test-'));
  try {
    const payload = { format: 'famfi-expenses/v1', ownerId: 'test-owner', categories: [], expenses: [{ description: 'PRIVATE_TEST_RECORD', amount: 980 }] };
    const filename = await encryptBackup(payload, directory);
    assert.equal((await readFile(filename)).includes(Buffer.from('PRIVATE_TEST_RECORD')), false);
    assert.deepEqual(await decryptBackup(filename, directory), payload);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('runtime backup fields restore exactly and remain owner-only', async () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const categories = [{ id: 'food', name: 'Food', color: '#16806A', sortOrder: 10 }];
  const expense = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: ownerId, amount: 980, date: '2026-09-09T00:00:00.000Z', categoryId: 'food', description: 'Restore fixture', memo: 'Line 1\nLine 2', version: 2, createdAt: '2026-09-09T10:00:00.000Z', updatedAt: '2026-09-09T10:01:00.000Z' };
  assert.deepEqual(await verifyBackupRestore({ ownerId, categories, expenses: [expense] }), { expenses: 1, categories: 1 });
  await assert.rejects(verifyBackupRestore({ ownerId, categories, expenses: [{ ...expense, userId: '22222222-2222-4222-8222-222222222222' }] }));
});
