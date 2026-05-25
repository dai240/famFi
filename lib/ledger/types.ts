export type Payer = 'father' | 'mother';
export type ExpenseSource = 'rakuten' | 'advance' | 'personal';

export type SubCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type Category = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  subCategories: SubCategory[];
  createdAt?: string;
  updatedAt?: string;
};

export type Expense = {
  id: string;
  no: number;
  accountingMonth: string;
  date?: string;
  categoryId: string;
  subCategoryId: string;
  item: string;
  description: string;
  amount: number;
  payer: Payer;
  source: ExpenseSource;
  reimbursed: boolean;
  beneficiary: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type Deposit = {
  id: string;
  no: number;
  date: string;
  depositor: Payer;
  amount: number;
  description: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = Omit<Expense, 'id' | 'no' | 'createdAt' | 'updatedAt'>;
export type DepositInput = Omit<Deposit, 'id' | 'no' | 'createdAt' | 'updatedAt'>;
export type CategoryInput = Omit<Category, 'createdAt' | 'updatedAt'>;

export type MonthlySummary = {
  month: string;
  totalExpenses: number;
  sharedExpenses: number;
  personalExpenses: number;
  depositTotal: number;
  sharedBalance: number;
};

export type MonthlySummaryWithCumulative = MonthlySummary & {
  cumulative: number;
};

export type ExpenseFilters = {
  month: string;
  categoryId?: string;
  payer?: Payer;
  source?: ExpenseSource;
};

export type DataBackend = 'local' | 'db';

export const payerLabels: Record<Payer, string> = {
  father: '父',
  mother: '母',
};

export const sourceLabels: Record<ExpenseSource, string> = {
  rakuten: '楽天',
  advance: '立替',
  personal: '実費',
};
