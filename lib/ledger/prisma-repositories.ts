import { calculateMonth } from './calculations';
import { cloneCategoryPresets } from './category-presets';
import { prisma } from './prisma-client';
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

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '';
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function mapCategory(record: any): Category {
  return {
    id: record.id,
    name: record.name,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
    subCategories: (record.subCategories || []).map((subCategory: any) => ({
      id: subCategory.id,
      name: subCategory.name,
      isActive: subCategory.isActive,
      sortOrder: subCategory.sortOrder,
    })),
  };
}

function mapExpense(record: any): Expense {
  return {
    id: record.id,
    no: record.no,
    accountingMonth: record.accountingMonth,
    date: formatDate(record.date),
    categoryId: record.categoryId,
    subCategoryId: record.subCategoryId,
    item: record.item,
    description: record.description,
    amount: record.amount,
    payer: record.payer,
    source: record.source,
    reimbursed: record.reimbursed,
    beneficiary: record.beneficiary,
    comment: record.comment,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
  };
}

function mapDeposit(record: any): Deposit {
  return {
    id: record.id,
    no: record.no,
    date: formatDate(record.date),
    depositor: record.depositor,
    amount: record.amount,
    description: record.description,
    comment: record.comment,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
  };
}

async function ensurePresetCategories() {
  const count = await prisma.category.count();
  if (count > 0) return;
  for (const category of cloneCategoryPresets()) {
    await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        subCategories: {
          create: category.subCategories.map((subCategory) => ({
            id: subCategory.id,
            name: subCategory.name,
            isActive: subCategory.isActive,
            sortOrder: subCategory.sortOrder,
          })),
        },
      },
    });
  }
}

export class PrismaCategoryRepository implements CategoryRepository {
  async list(includeInactive = false): Promise<Category[]> {
    await ensurePresetCategories();
    const categories = await prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { subCategories: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return categories.map(mapCategory);
  }

  async upsert(input: CategoryInput): Promise<Category> {
    const category = await prisma.category.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        subCategories: {
          create: input.subCategories.map((subCategory) => ({
            id: subCategory.id,
            name: subCategory.name,
            isActive: subCategory.isActive,
            sortOrder: subCategory.sortOrder,
          })),
        },
      },
      update: {
        name: input.name,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
      include: { subCategories: true },
    });

    for (const subCategory of input.subCategories) {
      await prisma.subCategory.upsert({
        where: { id: subCategory.id },
        create: {
          id: subCategory.id,
          categoryId: input.id,
          name: subCategory.name,
          isActive: subCategory.isActive,
          sortOrder: subCategory.sortOrder,
        },
        update: {
          name: subCategory.name,
          isActive: subCategory.isActive,
          sortOrder: subCategory.sortOrder,
        },
      });
    }

    return mapCategory(await prisma.category.findUniqueOrThrow({ where: { id: category.id }, include: { subCategories: true } }));
  }

  async deactivate(id: string): Promise<Category> {
    const category = await prisma.category.update({
      where: { id },
      data: { isActive: false },
      include: { subCategories: true },
    });
    return mapCategory(category);
  }

  async reorder(ids: string[]): Promise<Category[]> {
    await Promise.all(
      ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } })),
    );
    return this.list(true);
  }
}

export class PrismaExpenseRepository implements ExpenseRepository {
  async list(filters?: Partial<ExpenseFilters>): Promise<Expense[]> {
    const expenses = await prisma.expense.findMany({
      where: {
        accountingMonth: filters?.month,
        categoryId: filters?.categoryId,
        payer: filters?.payer,
        source: filters?.source,
      },
      orderBy: [{ date: 'desc' }, { no: 'desc' }],
    });
    return expenses.map(mapExpense);
  }

  async listByMonth(month: string): Promise<Expense[]> {
    return this.list({ month });
  }

  async create(input: ExpenseInput): Promise<Expense> {
    const expense = await prisma.expense.create({
      data: {
        ...input,
        date: input.date ? new Date(input.date) : null,
        reimbursed: input.source === 'advance' ? input.reimbursed : false,
      },
    });
    return mapExpense(expense);
  }

  async update(id: string, input: ExpenseInput): Promise<Expense> {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...input,
        date: input.date ? new Date(input.date) : null,
        reimbursed: input.source === 'advance' ? input.reimbursed : false,
      },
    });
    return mapExpense(expense);
  }

  async delete(id: string): Promise<void> {
    await prisma.expense.delete({ where: { id } });
  }

  async summary(month: string): Promise<MonthlySummary> {
    const [expenses, deposits] = await Promise.all([
      this.listByMonth(month),
      new PrismaDepositRepository().listByMonth(month),
    ]);
    return calculateMonth(expenses, deposits, month);
  }
}

export class PrismaDepositRepository implements DepositRepository {
  async list(): Promise<Deposit[]> {
    const deposits = await prisma.deposit.findMany({ orderBy: [{ date: 'desc' }, { no: 'desc' }] });
    return deposits.map(mapDeposit);
  }

  async listByMonth(month: string): Promise<Deposit[]> {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const deposits = await prisma.deposit.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: 'desc' }, { no: 'desc' }],
    });
    return deposits.map(mapDeposit);
  }

  async create(input: DepositInput): Promise<Deposit> {
    const deposit = await prisma.deposit.create({ data: { ...input, date: new Date(input.date) } });
    return mapDeposit(deposit);
  }

  async update(id: string, input: DepositInput): Promise<Deposit> {
    const deposit = await prisma.deposit.update({ where: { id }, data: { ...input, date: new Date(input.date) } });
    return mapDeposit(deposit);
  }

  async delete(id: string): Promise<void> {
    await prisma.deposit.delete({ where: { id } });
  }
}

export function createPrismaRepositories() {
  return {
    expenses: new PrismaExpenseRepository(),
    deposits: new PrismaDepositRepository(),
    categories: new PrismaCategoryRepository(),
  };
}
