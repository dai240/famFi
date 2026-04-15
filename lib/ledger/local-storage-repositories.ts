'use client';

import { calculateMonth, depositBelongsToMonth, expenseBelongsToMonth, toMonthInputValue } from './calculations';
import {
  cloneCategoryPresets,
  uncategorizedCategoryId,
  uncategorizedSubCategoryId,
} from './category-presets';
import type { CategoryRepository, DepositRepository, ExpenseRepository } from './repositories';
import type {
  Category,
  CategoryInput,
  Deposit,
  DepositInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  MonthlySummary,
} from './types';

const expenseStorageKey = 'famfi:mvp:expenses';
const depositStorageKey = 'famfi:mvp:deposits';
const categoryStorageKey = 'famfi:mvp:categories';

type LegacyExpense = Partial<Expense> & {
  category?: string;
  subcategory?: string;
  subCategory?: string;
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getNextNo(records: { no: number }[]) {
  return records.reduce((max, record) => Math.max(max, record.no || 0), 0) + 1;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortCategories(categories: Category[]) {
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja'))
    .map((category) => ({
      ...category,
      subCategories: [...category.subCategories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja')),
    }));
}

function normalizeCategories(categories: Category[]) {
  const presets = cloneCategoryPresets();
  const byId = new Map<string, Category>();
  presets.forEach((category) => byId.set(category.id, category));
  categories.forEach((category) => {
    byId.set(category.id, {
      ...category,
      isActive: category.isActive ?? true,
      sortOrder: category.sortOrder ?? 500,
      subCategories: category.subCategories?.length
        ? category.subCategories.map((subCategory, index) => ({
            ...subCategory,
            isActive: subCategory.isActive ?? true,
            sortOrder: subCategory.sortOrder ?? (index + 1) * 10,
          }))
        : [{ id: `${category.id}-uncategorized`, name: '未分類', isActive: true, sortOrder: 10 }],
    });
  });
  return sortCategories(Array.from(byId.values()));
}

function findCategoryMatch(categories: Category[], categoryName?: string, subCategoryName?: string) {
  const normalizedCategory = (categoryName || '').trim();
  const normalizedSubCategory = (subCategoryName || '').trim();
  const category =
    categories.find((item) => item.name === normalizedCategory) ||
    categories.find((item) => item.subCategories.some((subCategory) => subCategory.name === normalizedSubCategory)) ||
    categories.find((item) => item.id === uncategorizedCategoryId);
  const subCategory =
    category?.subCategories.find((item) => item.name === normalizedSubCategory) ||
    category?.subCategories.find((item) => item.id === uncategorizedSubCategoryId) ||
    category?.subCategories[0];

  return {
    categoryId: category?.id || uncategorizedCategoryId,
    subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
  };
}

function normalizeExpense(expense: LegacyExpense, categories: Category[], index: number): Expense {
  const legacyMatch = findCategoryMatch(categories, expense.category, expense.subcategory || expense.subCategory);
  const now = new Date().toISOString();
  return {
    id: expense.id || createId('exp'),
    no: expense.no || index + 1,
    accountingMonth: toMonthInputValue(expense.accountingMonth || expense.date?.slice(0, 7) || getCurrentMonth()),
    date: expense.date || '',
    categoryId: expense.categoryId || legacyMatch.categoryId,
    subCategoryId: expense.subCategoryId || legacyMatch.subCategoryId,
    item: expense.item || '',
    description: expense.description || '',
    amount: Number(expense.amount || 0),
    payer: expense.payer || 'father',
    source: expense.source || 'rakuten',
    reimbursed: expense.source === 'advance' ? Boolean(expense.reimbursed) : false,
    beneficiary: expense.beneficiary || '',
    comment: expense.comment || '',
    createdAt: expense.createdAt || now,
    updatedAt: expense.updatedAt || now,
  };
}

function normalizeDeposit(deposit: Partial<Deposit>, index: number): Deposit {
  const now = new Date().toISOString();
  return {
    id: deposit.id || createId('dep'),
    no: deposit.no || index + 1,
    date: deposit.date || new Date().toISOString().slice(0, 10),
    depositor: deposit.depositor || 'father',
    amount: Number(deposit.amount || 0),
    description: deposit.description || '',
    comment: deposit.comment || '',
    createdAt: deposit.createdAt || now,
    updatedAt: deposit.updatedAt || now,
  };
}

function getCurrentMonth() {
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit' }).format(new Date()).replace('/', '-');
}

export class LocalStorageCategoryRepository implements CategoryRepository {
  async list(includeInactive = false): Promise<Category[]> {
    const categories = normalizeCategories(readJson<Category[]>(categoryStorageKey, []));
    writeJson(categoryStorageKey, categories);
    return includeInactive ? categories : categories.filter((category) => category.isActive);
  }

  async upsert(input: CategoryInput): Promise<Category> {
    const categories = await this.list(true);
    const now = new Date().toISOString();
    const nextCategory: Category = {
      ...input,
      subCategories: input.subCategories.map((subCategory, index) => ({
        ...subCategory,
        sortOrder: subCategory.sortOrder || (index + 1) * 10,
        isActive: subCategory.isActive ?? true,
      })),
      createdAt: categories.find((category) => category.id === input.id)?.createdAt || now,
      updatedAt: now,
    };
    const next = categories.some((category) => category.id === input.id)
      ? categories.map((category) => (category.id === input.id ? nextCategory : category))
      : [...categories, nextCategory];
    const sorted = sortCategories(next);
    writeJson(categoryStorageKey, sorted);
    return nextCategory;
  }

  async deactivate(id: string): Promise<Category> {
    const categories = await this.list(true);
    const target = categories.find((category) => category.id === id);
    if (!target) throw new Error('Category not found');
    const updated = { ...target, isActive: false, updatedAt: new Date().toISOString() };
    writeJson(categoryStorageKey, categories.map((category) => (category.id === id ? updated : category)));
    return updated;
  }

  async reorder(ids: string[]): Promise<Category[]> {
    const categories = await this.list(true);
    const order = new Map(ids.map((id, index) => [id, (index + 1) * 10]));
    const next = categories.map((category) => ({ ...category, sortOrder: order.get(category.id) || category.sortOrder }));
    const sorted = sortCategories(next);
    writeJson(categoryStorageKey, sorted);
    return sorted;
  }
}

export class LocalStorageExpenseRepository implements ExpenseRepository {
  private categoryRepository = new LocalStorageCategoryRepository();

  private async readAll() {
    const categories = await this.categoryRepository.list(true);
    const raw = readJson<LegacyExpense[]>(expenseStorageKey, []);
    const expenses = raw.map((expense, index) => normalizeExpense(expense, categories, index));
    writeJson(expenseStorageKey, expenses);
    return expenses;
  }

  private writeAll(expenses: Expense[]) {
    writeJson(expenseStorageKey, expenses);
  }

  async list(filters?: Partial<ExpenseFilters>): Promise<Expense[]> {
    const expenses = await this.readAll();
    return expenses
      .filter((expense) => !filters?.month || expenseBelongsToMonth(expense, filters.month))
      .filter((expense) => !filters?.categoryId || expense.categoryId === filters.categoryId)
      .filter((expense) => !filters?.payer || expense.payer === filters.payer)
      .filter((expense) => !filters?.source || expense.source === filters.source)
      .sort((a, b) => `${b.date || b.accountingMonth}-999`.localeCompare(`${a.date || a.accountingMonth}-999`) || b.no - a.no);
  }

  async listByMonth(month: string): Promise<Expense[]> {
    return this.list({ month });
  }

  async create(input: ExpenseInput): Promise<Expense> {
    const expenses = await this.readAll();
    const now = new Date().toISOString();
    const expense: Expense = {
      ...input,
      id: createId('exp'),
      no: getNextNo(expenses),
      accountingMonth: toMonthInputValue(input.accountingMonth),
      reimbursed: input.source === 'advance' ? input.reimbursed : false,
      createdAt: now,
      updatedAt: now,
    };
    this.writeAll([...expenses, expense]);
    return expense;
  }

  async update(id: string, input: ExpenseInput): Promise<Expense> {
    const expenses = await this.readAll();
    const existing = expenses.find((expense) => expense.id === id);
    if (!existing) throw new Error('Expense not found');
    const updated: Expense = {
      ...existing,
      ...input,
      accountingMonth: toMonthInputValue(input.accountingMonth),
      reimbursed: input.source === 'advance' ? input.reimbursed : false,
      updatedAt: new Date().toISOString(),
    };
    this.writeAll(expenses.map((expense) => (expense.id === id ? updated : expense)));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const expenses = await this.readAll();
    this.writeAll(expenses.filter((expense) => expense.id !== id));
  }

  async summary(month: string): Promise<MonthlySummary> {
    const expenses = await this.readAll();
    const deposits = await new LocalStorageDepositRepository().list();
    return calculateMonth(expenses, deposits, month);
  }
}

export class LocalStorageDepositRepository implements DepositRepository {
  private readAll() {
    const raw = readJson<Partial<Deposit>[]>(depositStorageKey, []);
    const deposits = raw.map((deposit, index) => normalizeDeposit(deposit, index));
    writeJson(depositStorageKey, deposits);
    return deposits;
  }

  private writeAll(deposits: Deposit[]) {
    writeJson(depositStorageKey, deposits);
  }

  async list(): Promise<Deposit[]> {
    return this.readAll().sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
  }

  async listByMonth(month: string): Promise<Deposit[]> {
    return (await this.list()).filter((deposit) => depositBelongsToMonth(deposit, month));
  }

  async create(input: DepositInput): Promise<Deposit> {
    const deposits = this.readAll();
    const now = new Date().toISOString();
    const deposit: Deposit = {
      ...input,
      id: createId('dep'),
      no: getNextNo(deposits),
      createdAt: now,
      updatedAt: now,
    };
    this.writeAll([...deposits, deposit]);
    return deposit;
  }

  async update(id: string, input: DepositInput): Promise<Deposit> {
    const deposits = this.readAll();
    const existing = deposits.find((deposit) => deposit.id === id);
    if (!existing) throw new Error('Deposit not found');
    const updated: Deposit = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.writeAll(deposits.map((deposit) => (deposit.id === id ? updated : deposit)));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deposits = this.readAll();
    this.writeAll(deposits.filter((deposit) => deposit.id !== id));
  }
}

export function createLocalStorageRepositories() {
  return {
    expenses: new LocalStorageExpenseRepository(),
    deposits: new LocalStorageDepositRepository(),
    categories: new LocalStorageCategoryRepository(),
  };
}
