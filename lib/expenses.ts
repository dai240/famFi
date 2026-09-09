import { z } from 'zod';

export const PAGE_SIZE = 50;
export const categoryIds = ['food', 'daily', 'housing', 'utilities', 'transport', 'communication', 'health', 'leisure', 'clothing', 'other'] as const;
export const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, '月が正しくありません');
export const dateSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/, '日付が正しくありません')
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, '存在する日付を入力してください');
export const expenseFields = z.object({
  amount: z.number().int().min(1).max(999999999),
  date: dateSchema,
  categoryId: z.enum(categoryIds),
  description: z.string().trim().max(120).default(''),
  memo: z.string().trim().max(1000).default(''),
}).strict();
export const createExpenseSchema = expenseFields.extend({ id: z.string().uuid() }).strict();
export const updateExpenseSchema = expenseFields.extend({ version: z.number().int().positive() }).strict();
export const deleteExpenseSchema = z.object({ version: z.number().int().positive() }).strict();
export const querySchema = z.object({
  month: monthSchema,
  category: z.enum(categoryIds).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();

export type ExpenseFields = z.infer<typeof expenseFields>;
export type ExpenseRecord = ExpenseFields & {
  id: string; version: number; createdAt: string; updatedAt: string;
};
export type ExpenseCategory = { id: string; name: string; color: string; sortOrder: number };
export type ExpenseResponse = {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
  total: number;
  count: number;
  filteredCount: number;
  breakdown: { categoryId: string; amount: number; count: number }[];
};

export function todayInJapan(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function monthRange(month: string) {
  monthSchema.parse(month);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}
export function shiftMonth(month: string, delta: number) {
  const { gte } = monthRange(month);
  gte.setUTCMonth(gte.getUTCMonth() + delta);
  return gte.toISOString().slice(0, 7);
}
export function formatYen(amount: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
}
export function serializeExpense(row: {
  id: string; amount: number; date: Date; categoryId: string; description: string;
  memo: string; version: number; createdAt: Date; updatedAt: Date;
}): ExpenseRecord {
  return { id: row.id, amount: row.amount, date: row.date.toISOString().slice(0, 10),
    categoryId: row.categoryId as ExpenseFields['categoryId'], description: row.description,
    memo: row.memo, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function csvCell(value: string | number) {
  let text = String(value);
  // Spreadsheet formulas remain inert even when entered as an expense description.
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function expenseCsv(rows: ExpenseRecord[], categories: ExpenseCategory[]) {
  const names = new Map(categories.map(c => [c.id, c.name]));
  const lines = [['日付', '金額（円）', 'カテゴリ', '内容', 'メモ', 'ID'],
    ...rows.map(row => [row.date, row.amount, names.get(row.categoryId) ?? row.categoryId, row.description, row.memo, row.id])];
  return '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
