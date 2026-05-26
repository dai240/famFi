'use client';

import { useCallback, useMemo, useState } from 'react';
import { calculateMonth, calculateSummaryRows } from './calculations';
import { createClientRepositories, getDataBackend } from './repository-factory';
import type {
  Category,
  CategoryInput,
  Deposit,
  DepositInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  MonthlySummary,
  MonthlySummaryWithCumulative,
} from './types';

const monthFormatter = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit' });

export function getCurrentMonth() {
  return monthFormatter.format(new Date()).replace('/', '-');
}

export function useLedgerData() {
  const repositories = useMemo(() => createClientRepositories(), []);
  const [backend] = useState(getDataBackend());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>(() => calculateMonth([], [], getCurrentMonth()));
  const [summaryRows, setSummaryRows] = useState<MonthlySummaryWithCumulative[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (month: string, filters?: Partial<ExpenseFilters>) => {
      setIsLoading(true);
      setError(null);
      try {
        const [nextCategories, nextExpenses, nextMonthExpenses, monthDeposits] = await Promise.all([
          repositories.categories.list(true),
          repositories.expenses.list({ ...filters, month }),
          repositories.expenses.list({ month }),
          repositories.deposits.listByMonth(month),
        ]);
        const [allExpenses, allDeposits, nextSummary] = await Promise.all([
          repositories.expenses.list(),
          repositories.deposits.list(),
          repositories.expenses.summary(month),
        ]);
        setCategories(nextCategories);
        setExpenses(nextExpenses);
        setMonthExpenses(nextMonthExpenses);
        setDeposits(monthDeposits);
        setSummary(nextSummary);
        setSummaryRows(calculateSummaryRows(allExpenses, allDeposits, month));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'データの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    },
    [repositories],
  );

  const createExpense = useCallback(
    async (input: ExpenseInput) => {
      await repositories.expenses.create(input);
    },
    [repositories],
  );

  const updateExpense = useCallback(
    async (id: string, input: ExpenseInput) => {
      await repositories.expenses.update(id, input);
    },
    [repositories],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      await repositories.expenses.delete(id);
    },
    [repositories],
  );

  const createDeposit = useCallback(
    async (input: DepositInput) => {
      await repositories.deposits.create(input);
    },
    [repositories],
  );

  const updateDeposit = useCallback(
    async (id: string, input: DepositInput) => {
      await repositories.deposits.update(id, input);
    },
    [repositories],
  );

  const deleteDeposit = useCallback(
    async (id: string) => {
      await repositories.deposits.delete(id);
    },
    [repositories],
  );

  const upsertCategory = useCallback(
    async (input: CategoryInput) => {
      await repositories.categories.upsert(input);
    },
    [repositories],
  );

  const deactivateCategory = useCallback(
    async (id: string) => {
      await repositories.categories.deactivate(id);
    },
    [repositories],
  );

  const reorderCategories = useCallback(
    async (ids: string[]) => {
      await repositories.categories.reorder(ids);
    },
    [repositories],
  );

  return {
    backend,
    expenses,
    monthExpenses,
    deposits,
    categories,
    summary,
    summaryRows,
    isLoading,
    error,
    refresh,
    createExpense,
    updateExpense,
    deleteExpense,
    createDeposit,
    updateDeposit,
    deleteDeposit,
    upsertCategory,
    deactivateCategory,
    reorderCategories,
  };
}
