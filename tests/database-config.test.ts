import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseOptions } from '../lib/database-config';
test('production requires the exact app role and project host, always validates TLS', () => {
  const url = 'postgresql://famfi_app.fpptihhtyhehpjvmtuqt:dummy@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
  const options = databaseOptions(url + '?sslmode=disable&sslaccept=accept_invalid_certs', 'production');
  assert.notEqual(options.ssl, false);
  assert.equal(options.ssl && options.ssl.rejectUnauthorized, true);
  assert.throws(() => databaseOptions(url.replace('famfi_app.', 'postgres.'), 'production'));
  assert.throws(() => databaseOptions(url.replace('aws-1-ap-southeast-1.pooler.supabase.com', 'evil.example'), 'production'));
  assert.throws(() => databaseOptions('postgresql://famfi_app:x@127.0.0.1/postgres', 'production'));
  assert.equal(databaseOptions('postgresql://famfi_app:x@127.0.0.1/postgres', 'development').ssl, false);
});
