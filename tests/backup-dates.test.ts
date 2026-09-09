import test from 'node:test';
import assert from 'node:assert/strict';
import { backupSelectColumns, normalizeBackupRows } from '../scripts/backup-model.mjs';

test('calendar-only backup dates are selected as text rather than timezone-dependent pg Date objects',()=>{
  assert.equal(backupSelectColumns(['date','startMonth','endMonth','period','createdAt']), 'date::text as "date",start_month::text as "startMonth",end_month::text as "endMonth",period::text as "period",created_at as "createdAt"');
  const row={id:'a',date:'2026-09-10',startMonth:'2026-09-01',endMonth:null,period:'2026-02-01'};
  assert.deepEqual(normalizeBackupRows([row],Object.keys(row)),[row]);
});
