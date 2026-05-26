import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonth,
  calculateSettlement,
  calculateSummaryRows,
} from '../lib/ledger/calculations';
import type { Deposit, Expense } from '../lib/ledger/types';

const baseExpense = {
  id: 'expense-1',
  no: 1,
  accountingMonth: '2026-05',
  date: '2026-05-10',
  categoryId: 'cat-food',
  subCategoryId: 'sub-food-grocery',
  item: '',
  description: '',
  payer: 'father',
  source: 'rakuten',
  reimbursed: false,
  beneficiary: '',
  comment: '',
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
} satisfies Omit<Expense, 'amount'>;

const baseDeposit = {
  id: 'deposit-1',
  no: 1,
  date: '2026-05-01',
  depositor: 'father',
  description: '',
  comment: '',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
} satisfies Omit<Deposit, 'amount'>;

test('calculateMonth separates shared and personal expenses by accounting month', () => {
  const expenses: Expense[] = [
    { ...baseExpense, id: 'shared', amount: 12000, source: 'rakuten' },
    { ...baseExpense, id: 'advance', amount: 3000, source: 'advance' },
    { ...baseExpense, id: 'personal', amount: 5000, source: 'personal' },
    { ...baseExpense, id: 'other-month', accountingMonth: '2026-04', amount: 9000, source: 'rakuten' },
  ];
  const deposits: Deposit[] = [
    { ...baseDeposit, id: 'deposit-this-month', amount: 20000 },
    { ...baseDeposit, id: 'deposit-other-month', date: '2026-04-01', amount: 7000 },
  ];

  assert.deepEqual(calculateMonth(expenses, deposits, '2026-05'), {
    month: '2026-05',
    totalExpenses: 20000,
    sharedExpenses: 15000,
    personalExpenses: 5000,
    depositTotal: 20000,
    sharedBalance: 5000,
  });
});

test('calculateSummaryRows keeps cumulative shared balance in month order', () => {
  const expenses: Expense[] = [
    { ...baseExpense, id: 'april-expense', accountingMonth: '2026-04', amount: 7000, source: 'rakuten' },
    { ...baseExpense, id: 'may-expense', accountingMonth: '2026-05', amount: 10000, source: 'rakuten' },
  ];
  const deposits: Deposit[] = [
    { ...baseDeposit, id: 'april-deposit', date: '2026-04-01', amount: 10000 },
    { ...baseDeposit, id: 'may-deposit', date: '2026-05-01', amount: 4000 },
  ];

  assert.deepEqual(
    calculateSummaryRows(expenses, deposits, '2026-05').map((row) => ({
      month: row.month,
      sharedBalance: row.sharedBalance,
      cumulative: row.cumulative,
    })),
    [
      { month: '2026-04', sharedBalance: 3000, cumulative: 3000 },
      { month: '2026-05', sharedBalance: -6000, cumulative: -3000 },
    ],
  );
});

test('calculateSettlement equalizes total contribution by half', () => {
  const settlement = calculateSettlement({
    fatherContribution: 30000,
    motherContribution: 10000,
    rule: { mode: 'equal' },
  });

  assert.equal(settlement.payer, 'mother');
  assert.equal(settlement.receiver, 'father');
  assert.equal(settlement.amount, 10000);
  assert.equal(settlement.fatherTarget, 20000);
  assert.equal(settlement.motherTarget, 20000);
});

test('calculateSettlement supports custom contribution ratio', () => {
  const settlement = calculateSettlement({
    fatherContribution: 30000,
    motherContribution: 10000,
    rule: { mode: 'ratio', fatherShare: 7, motherShare: 3 },
  });

  assert.equal(settlement.payer, 'mother');
  assert.equal(settlement.receiver, 'father');
  assert.equal(settlement.amount, 2000);
  assert.equal(settlement.fatherTarget, 28000);
  assert.equal(settlement.motherTarget, 12000);
});
