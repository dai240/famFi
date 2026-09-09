import { z } from 'zod';
import { Category, Masters, SettlementRecord, categoryName, expenseDetails, masterId, settlementLabels, settlementState } from './ledger';

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
  categoryId: masterId,
  description: z.string().trim().max(120).default(''),
  memo: z.string().trim().max(1000).default(''),
  ...expenseDetails,
}).strict();
function validReimbursement(input: z.infer<typeof expenseFields>) {
  return input.reimbursementStatus === 'required'
    ? input.reimbursementAmount > 0 && input.reimbursementAmount <= input.amount && !!input.reimbursementFromPartyId && !!input.reimbursementToPartyId && input.reimbursementFromPartyId !== input.reimbursementToPartyId
    : input.reimbursementAmount === 0 && !input.reimbursementFromPartyId && !input.reimbursementToPartyId;
}
export const validatedExpenseFields = expenseFields.refine(validReimbursement, '精算相手と金額を確認してください');
export const createExpenseSchema = expenseFields.extend({ id: z.string().uuid() }).strict().refine(validReimbursement);
export const updateExpenseSchema = expenseFields.extend({ version: z.number().int().positive() }).strict().refine(validReimbursement);
export const deleteExpenseSchema = z.object({ version: z.number().int().positive() }).strict();
export const querySchema = z.object({
  month: monthSchema,
  category: masterId.optional(),
  person: z.string().uuid().optional(),
  paymentSource: z.string().uuid().optional(),
  settlement: z.enum(['unknown','not_required','unsettled','partial','settled']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();

export type ExpenseFields = z.infer<typeof expenseFields>;
export type ExpenseRecord = ExpenseFields & {
  id: string; version: number; createdAt: string; updatedAt: string;
  settledAmount: number; settlements: SettlementRecord[];
};
export type ExpenseCategory = Category;
export type ExpenseResponse = Masters & {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
  total: number;
  count: number;
  filteredCount: number;
  filteredTotal: number;
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
} & Partial<Omit<Pick<ExpenseFields, keyof typeof expenseDetails>, 'reimbursementStatus'>> & {
  reimbursementStatus?: string;
  settlements?: { id: string; expenseId: string; amount: number; date: Date; fromPartyId: string; toPartyId: string; memo: string; createdAt: Date; cancelledAt: Date | null }[];
}): ExpenseRecord {
  const settlements = (row.settlements ?? []).map(s => ({ id: s.id, expenseId: s.expenseId, amount: s.amount, date: s.date.toISOString().slice(0,10), fromPartyId: s.fromPartyId, toPartyId: s.toPartyId, memo: s.memo, createdAt: s.createdAt.toISOString(), cancelledAt: s.cancelledAt?.toISOString() ?? null }));
  return { id: row.id, amount: row.amount, date: row.date.toISOString().slice(0, row.datePrecision === 'month' ? 7 : 10),
    categoryId: row.categoryId as ExpenseFields['categoryId'], description: row.description,
    memo: row.memo, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    usedByPartyId: row.usedByPartyId ?? null, beneficiaryPartyId: row.beneficiaryPartyId ?? null, paidByPartyId: row.paidByPartyId ?? null, paymentSourceId: row.paymentSourceId ?? null,
    reimbursementStatus: (row.reimbursementStatus ?? 'unknown') as ExpenseFields['reimbursementStatus'], reimbursementFromPartyId: row.reimbursementFromPartyId ?? null, reimbursementToPartyId: row.reimbursementToPartyId ?? null, reimbursementAmount: row.reimbursementAmount ?? 0,
    settlements, settledAmount: settlements.filter(s => !s.cancelledAt).reduce((sum, s) => sum + s.amount, 0) };
}
export function csvCell(value: string | number) {
  let text = String(value);
  // Spreadsheet formulas remain inert even when entered as an expense description.
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function expenseCsv(rows: ExpenseRecord[], categories: ExpenseCategory[], masters?: Pick<Masters, 'parties' | 'paymentSources'>) {
  const names = new Map(categories.map(c => [c.id, categoryName(c, categories)]));
  const person = (id: string | null) => masters?.parties.find(p => p.id === id)?.name ?? (id ?? '');
  const lines = [['日付', '金額（円）', 'カテゴリ', '内容', 'メモ', 'ID', '日付の精度', '利用者', '誰のため', '支払者・資金', '支払元', '精算状態', '返す側', '受け取る側', '立替対象額', '精算済額', '未精算額'],
    ...rows.map(row => [row.date, row.amount, names.get(row.categoryId) ?? row.categoryId, row.description, row.memo, row.id, row.date.length === 7 ? '月のみ' : '日付指定',
      person(row.usedByPartyId), person(row.beneficiaryPartyId), person(row.paidByPartyId), masters?.paymentSources.find(p => p.id === row.paymentSourceId)?.name ?? (row.paymentSourceId ?? ''), settlementLabels[settlementState(row)], person(row.reimbursementFromPartyId), person(row.reimbursementToPartyId), row.reimbursementAmount, row.settledAmount, row.reimbursementAmount - row.settledAmount])];
  return '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const createSettlementSchema = z.object({ id: z.string().uuid(), expenseId: z.string().uuid(), expenseVersion: z.number().int().positive(), amount: z.number().int().min(1).max(999999999), date: dateSchema, memo: z.string().trim().max(500).default('') }).strict();
