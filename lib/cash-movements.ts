import { z } from 'zod';
import type { CashMovement } from '@prisma/client';
import { dateSchema, monthSchema } from './expenses';

export const cashKinds = {
  unknown: '用途不明', card_payment: 'カード引落', direct_debit: '口座引落', transfer: '資金移動',
  contribution: '家計への入金', benefit: '手当・給付金', interest: '利息', refund: '返金', fee: '手数料',
} as const;
export type CashKind = keyof typeof cashKinds;
export const cashKindSchema = z.enum(['unknown','card_payment','direct_debit','transfer','contribution','benefit','interest','refund','fee']);
export function cashKindMatchesAmount(kind: CashKind, amount: number) {
  if (['card_payment','direct_debit','fee'].includes(kind)) return amount < 0;
  if (['contribution','benefit','interest','refund'].includes(kind)) return amount > 0;
  return true;
}
export const cashFields = z.object({
  paymentSourceId: z.string().uuid(), date: dateSchema,
  amount: z.number().int().min(-999999999).max(999999999).refine(n => n !== 0, '金額は1円以上で入力してください。'),
  kind: cashKindSchema.default('unknown'),
  description: z.string().trim().min(1, '内容を入力してください。').max(240),
  memo: z.string().trim().max(2000).default(''), partyId: z.string().uuid().nullable().default(null),
}).strict();
export const validCashFields = cashFields.refine(row => cashKindMatchesAmount(row.kind, row.amount), '入出金の方向と種類が一致しません。');
export type CashFields = z.infer<typeof cashFields>;
export type CashRecord = CashFields & { id: string; imported: boolean; version: number; createdAt: string; updatedAt: string };
export const cashQuery = z.object({
  month: monthSchema.optional(), direction: z.enum(['all','in','out']).default('all'),
  kind: cashKindSchema.optional(), source: z.string().uuid().optional(), search: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).max(2000).default(1),
}).strict();
export type CashQuery = z.infer<typeof cashQuery>;
export type CashResponse = { rows: CashRecord[]; count: number; incoming: number; outgoing: number };
export function serializeCash(row: CashMovement): CashRecord {
  return { id: row.id, paymentSourceId: row.paymentSourceId, date: row.date.toISOString().slice(0,10), amount: row.amount,
    kind: row.kind as CashKind, description: row.description, memo: row.memo, partyId: row.partyId,
    imported: row.importKey !== null, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
