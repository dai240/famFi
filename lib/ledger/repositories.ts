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

export interface ExpenseRepository {
  list(filters?: Partial<ExpenseFilters>): Promise<Expense[]>;
  listByMonth(month: string): Promise<Expense[]>;
  create(input: ExpenseInput): Promise<Expense>;
  update(id: string, input: ExpenseInput): Promise<Expense>;
  delete(id: string): Promise<void>;
  summary(month: string): Promise<MonthlySummary>;
}

export interface DepositRepository {
  list(): Promise<Deposit[]>;
  listByMonth(month: string): Promise<Deposit[]>;
  create(input: DepositInput): Promise<Deposit>;
  update(id: string, input: DepositInput): Promise<Deposit>;
  delete(id: string): Promise<void>;
}

export interface CategoryRepository {
  list(includeInactive?: boolean): Promise<Category[]>;
  upsert(input: CategoryInput): Promise<Category>;
  deactivate(id: string): Promise<Category>;
  reorder(ids: string[]): Promise<Category[]>;
}

export type LedgerRepositories = {
  expenses: ExpenseRepository;
  deposits: DepositRepository;
  categories: CategoryRepository;
};
