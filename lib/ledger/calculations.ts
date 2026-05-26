import type { Deposit, Expense, MonthlySummary, MonthlySummaryWithCumulative, Payer } from './types';

export type SettlementRule =
  | { mode: 'equal' }
  | { mode: 'ratio'; fatherShare: number; motherShare: number };

export type SettlementInput = {
  fatherContribution: number;
  motherContribution: number;
  rule: SettlementRule;
};

export type SettlementResult = {
  payer: Payer | null;
  receiver: Payer | null;
  amount: number;
  fatherTarget: number;
  motherTarget: number;
  fatherContribution: number;
  motherContribution: number;
};

export function toMonthInputValue(month: string) {
  return month.replace('/', '-');
}

export function expenseBelongsToMonth(expense: Expense, month: string) {
  return toMonthInputValue(expense.accountingMonth) === month;
}

export function depositBelongsToMonth(deposit: Deposit, month: string) {
  return deposit.date.slice(0, 7) === month;
}

export function calculateMonth(expenses: Expense[], deposits: Deposit[], month: string): MonthlySummary {
  const monthExpenses = expenses.filter((expense) => expenseBelongsToMonth(expense, month));
  const monthDeposits = deposits.filter((deposit) => depositBelongsToMonth(deposit, month));
  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const sharedExpenses = monthExpenses
    .filter((expense) => expense.source !== 'personal')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const personalExpenses = monthExpenses
    .filter((expense) => expense.source === 'personal')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const depositTotal = monthDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  return {
    month,
    totalExpenses,
    sharedExpenses,
    personalExpenses,
    depositTotal,
    sharedBalance: depositTotal - sharedExpenses,
  };
}

export function calculateSummaryRows(
  expenses: Expense[],
  deposits: Deposit[],
  currentMonth: string,
): MonthlySummaryWithCumulative[] {
  const months = new Set<string>([currentMonth]);
  expenses.forEach((expense) => months.add(toMonthInputValue(expense.accountingMonth)));
  deposits.forEach((deposit) => months.add(deposit.date.slice(0, 7)));

  let cumulative = 0;
  return Array.from(months)
    .sort()
    .map((month) => {
      const summary = calculateMonth(expenses, deposits, month);
      cumulative += summary.sharedBalance;
      return { ...summary, cumulative };
    });
}

function normalizeShares(rule: SettlementRule) {
  if (rule.mode === 'equal') return { fatherShare: 1, motherShare: 1 };
  const fatherShare = Math.max(0, Number(rule.fatherShare) || 0);
  const motherShare = Math.max(0, Number(rule.motherShare) || 0);
  if (fatherShare + motherShare === 0) return { fatherShare: 1, motherShare: 1 };
  return { fatherShare, motherShare };
}

export function calculateSettlement({ fatherContribution, motherContribution, rule }: SettlementInput): SettlementResult {
  const totalContribution = fatherContribution + motherContribution;
  const shares = normalizeShares(rule);
  const shareTotal = shares.fatherShare + shares.motherShare;
  const fatherTarget = Math.round((totalContribution * shares.fatherShare) / shareTotal);
  const motherTarget = totalContribution - fatherTarget;
  const fatherDelta = fatherContribution - fatherTarget;
  const amount = Math.abs(fatherDelta);

  if (amount === 0) {
    return {
      payer: null,
      receiver: null,
      amount: 0,
      fatherTarget,
      motherTarget,
      fatherContribution,
      motherContribution,
    };
  }

  return {
    payer: fatherDelta > 0 ? 'mother' : 'father',
    receiver: fatherDelta > 0 ? 'father' : 'mother',
    amount,
    fatherTarget,
    motherTarget,
    fatherContribution,
    motherContribution,
  };
}
