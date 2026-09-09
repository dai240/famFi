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
  date: z.union([dateSchema, monthSchema]),
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
export function expenseDateForStorage(value: string) {
  const date = z.union([dateSchema, monthSchema]).parse(value);
  const datePrecision = date.length === 7 ? 'month' : 'day';
  return { date: new Date(`${datePrecision === 'month' ? `${date}-01` : date}T00:00:00.000Z`), datePrecision };
}
export function formatExpenseDate(value: string, compact = false) {
  const month = Number(value.slice(5, 7));
  if (value.length === 7) return `${compact ? '' : `${value.slice(0, 4)}年`}${month}月（月のみ）`;
  const day = Number(value.slice(8, 10));
  return compact ? `${month}/${day}` : `${value.slice(0, 4)}年${month}月${day}日`;
}
export function serializeExpense(row: {
  id: string; amount: number; date: Date; datePrecision: string; categoryId: string; description: string;
  memo: string; version: number; createdAt: Date; updatedAt: Date;
}): ExpenseRecord {
  return { id: row.id, amount: row.amount, date: row.date.toISOString().slice(0, row.datePrecision === 'month' ? 7 : 10),
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
  const lines = [['日付', '金額（円）', 'カテゴリ', '内容', 'メモ', 'ID', '日付の精度'],
    ...rows.map(row => [row.date, row.amount, names.get(row.categoryId) ?? row.categoryId, row.description, row.memo, row.id, row.date.length === 7 ? '月のみ' : '日付指定'])];
  return '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
