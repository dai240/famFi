import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseEnvironment} from '../lib/database-environment';
test('database environment is an explicit allowlist with trusted Preview only',()=>{
  assert.equal(databaseEnvironment({}).schema,'famfi');
  assert.equal(databaseEnvironment({FAMFI_DB_SCHEMA:'famfi_preview'}).role,'famfi_preview_app');
  for(const env of [{FAMFI_DB_SCHEMA:'public'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production',FAMFI_DB_SCHEMA:'famfi_preview'},{VERCEL_ENV:'preview',FAMFI_DB_SCHEMA:'famfi_preview',VERCEL_GIT_COMMIT_REF:'untrusted-pr'}])assert.throws(()=>databaseEnvironment(env));
  assert.equal(databaseEnvironment({VERCEL_ENV:'preview',FAMFI_DB_SCHEMA:'famfi_preview',VERCEL_GIT_COMMIT_REF:'preview'}).schema,'famfi_preview');
});
