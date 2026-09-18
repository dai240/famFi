import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPeriods, waitingReviews } from '../lib/monthly-review';
import { recurringFields, type RecurringRule, type RecurringOccurrence } from '../lib/recurring';
import type { PlanRecord } from '../lib/planning';

const rule: RecurringRule = { ...recurringFields.parse({ name: '電気', amountMode: 'variable', amount: null, frequency: 'monthly', startMonth: '2026-08', categoryId: 'utilities', paymentSourceId: '11111111-1111-4111-8111-111111111111', paymentTreatment: 'shared', usedByText: '本人', beneficiaryKind: 'family', reviewDay: 20 }), id: 'rule', version: 1, createdAt: '', updatedAt: '' };
const plan: PlanRecord = { id: 'plan', name: '予定', date: '2026-09', amount: null, categoryId: null, paymentSourceId: null, memo: '', reviewAfter: null, snoozedUntil: null, state: 'open', expenseId: null, version: 1 };
const occurrence: RecurringOccurrence = { id: 'o', ruleId: 'rule', period: '2026-09', state: 'open', expenseId: null, version: 1 };

test('review periods retain all counts beyond the legacy attention detail cap', () => {
  const items = Array.from({ length: 120 }, (_, i) => ({ kind: 'recurring' as const, id: String(i), name: '', period: '2026-08', reviewDate: '2026-08-01' }));
  assert.deepEqual(reviewPeriods([...items, { kind: 'plan', id: 'p', name: '', period: '2026-09', reviewDate: '2026-10-01' }]), [
    { month: '2026-08', recurring: 120, plans: 0 }, { month: '2026-09', recurring: 0, plans: 1 },
  ]);
});
test('future and snoozed checks are neutral, with exact day and month precision', () => {
  assert.deepEqual(waitingReviews([rule], [], [plan], '2026-09', '2026-09-18'), { count: 2, nextDate: '2026-09-20' });
  assert.deepEqual(waitingReviews([rule], [], [plan], '2026-09', '2026-09-20'), { count: 1, nextDate: '2026-10-01' });
  assert.deepEqual(waitingReviews([rule], [{ ...occurrence, snoozedUntil: '2026-10-04' }], [plan], '2026-09', '2026-10-01'), { count: 1, nextDate: '2026-10-04' });
  assert.deepEqual(waitingReviews([{ ...rule, reviewDay: 31, startMonth: '2024-02' }], [], [], '2024-02', '2024-02-28'), { count: 1, nextDate: '2024-02-29' });
});
test('closed, archived, ended and off-cycle records are not waiting', () => {
  for (const state of ['posted', 'skipped'] as const) assert.equal(waitingReviews([rule], [{ ...occurrence, state }], [], '2026-09', '2026-09-01').count, 0);
  for (const fields of [{ archived: true }, { endMonth: '2026-08' }, { frequency: 'bimonthly' as const }]) assert.equal(waitingReviews([{ ...rule, ...fields }], [], [], '2026-09', '2026-09-01').count, 0);
  for (const state of ['posted', 'cancelled'] as const) assert.equal(waitingReviews([], [], [{ ...plan, state }], '2026-09', '2026-09-01').count, 0);
  assert.equal(waitingReviews([], [], [plan], '2026-08', '2026-09-01').count, 0);
  assert.equal(waitingReviews([rule], [{ ...occurrence, period: '2026-08', state: 'posted' }], [], '2026-09', '2026-09-01').count, 1);
});
