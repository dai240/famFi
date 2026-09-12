import { z } from 'zod';
import { dateSchema } from './expenses';

export const MAX_SETTLEMENT_BATCH = 50;
export const settlementBatchSchema = z.object({
  date: dateSchema,
  memo: z.string().trim().max(500).default(''),
  fromPartyId: z.string().uuid(),
  toPartyId: z.string().uuid(),
  entries: z.array(z.object({
    id: z.string().uuid(), expenseId: z.string().uuid(),
    expenseVersion: z.number().int().positive(), amount: z.number().int().min(1).max(999999999),
  }).strict()).min(1).max(MAX_SETTLEMENT_BATCH),
}).strict().superRefine((input, ctx) => {
  if (input.fromPartyId === input.toPartyId || new Set(input.entries.map(e => e.id)).size !== input.entries.length || new Set(input.entries.map(e => e.expenseId)).size !== input.entries.length) {
    ctx.addIssue({ code: 'custom', message: '精算相手と重複のない支出を選んでください。' });
  }
});
export type SettlementBatch = z.infer<typeof settlementBatchSchema>;
