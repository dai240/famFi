import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpenseSchema, csvCell, dateSchema, expenseCsv, monthRange, querySchema, shiftMonth, todayInJapan, updateExpenseSchema } from '../lib/expenses';

const input = { id: '11111111-1111-4111-8111-111111111111', amount: 980, date: '2026-09-09', categoryId: 'food' };
test('expense defaults and strict input ownership', () => {
  assert.equal(createExpenseSchema.parse(input).description, '');
  assert.equal(createExpenseSchema.safeParse({ ...input, userId: 'other' }).success, false);
  assert.equal(createExpenseSchema.safeParse({ ...input, categoryId: 'unknown' }).success, false);
  for (const amount of [0, -1, 1.2, '980', NaN, Infinity, 1000000000]) assert.equal(createExpenseSchema.safeParse({ ...input, amount }).success, false);
});
test('valid calendar dates, leap year and boundaries', () => {
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
  for (const value of ['2025-02-29', '2026-02-31', '2026-04-31', '2026-00-01', '2026-09-00', '1999-12-31', '2100-01-01']) assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(monthRange('2026-12').lt.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(todayInJapan(new Date('2026-09-08T15:00:00Z')), '2026-09-09');
});
test('query scope and edit version validation', () => {
  assert.deepEqual(querySchema.parse({ month: '2026-09' }), { month: '2026-09', page: 1 });
  assert.equal(querySchema.safeParse({ month: '2026-09', userId: 'other' }).success, false);
  assert.equal(querySchema.safeParse({ month: '2026-09', page: '1.5' }).success, false);
  assert.equal(updateExpenseSchema.safeParse({ amount: 980, date: '2026-09-09', categoryId: 'food' }).success, false);
});
test('CSV encodes Japanese, quotes, newlines and formula injection', () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const value of ['=1+1', '+SUM(1)', '-2+3', '@x', '  =HYPERLINK("x")', '\tfoo']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(expenseCsv([], []).charCodeAt(0), 0xfeff);
  assert.ok(expenseCsv([], []).includes('日付'));
});
