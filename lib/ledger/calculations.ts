import type { Deposit, Expense, MonthlySummary, MonthlySummaryWithCumulative } from './types';

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
