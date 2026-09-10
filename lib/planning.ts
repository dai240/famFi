import { z } from 'zod';
import type { ExpenseSummary, PlannedExpense } from '@prisma/client';
import { dateSchema, monthSchema, shiftMonth, todayInJapan } from './expenses';
import { masterId } from './ledger';
const money=z.number().int().min(1).max(999999999);
export const summaryFields=z.object({name:z.string().trim().min(1).max(120),month:monthSchema,amount:money,paymentSourceId:z.string().uuid(),memo:z.string().trim().max(1000).default(''),complete:z.boolean().default(false)}).strict();
export const planFields=z.object({name:z.string().trim().min(1).max(120),date:z.union([dateSchema,monthSchema]),amount:money.nullable().default(null),categoryId:masterId.nullable().default(null),paymentSourceId:z.string().uuid().nullable().default(null),memo:z.string().trim().max(1000).default(''),reviewAfter:dateSchema.nullable().default(null)}).strict();
export type SummaryFields=z.infer<typeof summaryFields>;
export type PlanFields=z.infer<typeof planFields>;
export type SummaryRecord=SummaryFields&{id:string;version:number;detailedAmount:number;remainder:number;detailCount:number};
export type PlanRecord=PlanFields&{id:string;version:number;state:'open'|'posted'|'cancelled';expenseId:string|null;snoozedUntil:string|null};
export function serializePlan(row:PlannedExpense):PlanRecord{
  return {id:row.id,version:row.version,name:row.name,date:row.date.toISOString().slice(0,row.datePrecision==='month'?7:10),amount:row.amount,categoryId:row.categoryId,paymentSourceId:row.paymentSourceId,memo:row.memo,reviewAfter:row.reviewAfter?.toISOString().slice(0,10)??null,snoozedUntil:row.snoozedUntil?.toISOString().slice(0,10)??null,state:row.state as PlanRecord['state'],expenseId:row.expenseId};
}
export function serializeSummary(row:ExpenseSummary,detailedAmount:number,detailCount:number):SummaryRecord{
  if(detailedAmount>row.amount)throw new Error('Summary allocation invariant violated');
  return {id:row.id,version:row.version,name:row.name,month:row.month.toISOString().slice(0,7),amount:row.amount,paymentSourceId:row.paymentSourceId,memo:row.memo,complete:row.complete,detailedAmount,detailCount,remainder:row.amount-detailedAmount};
}
export function planReviewDate(plan:PlanRecord){
  const defaultDate=plan.date.length===7?shiftMonth(plan.date,1)+'-01':new Date(new Date(plan.date+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
  const scheduled=plan.reviewAfter??defaultDate;
  return plan.snoozedUntil&&plan.snoozedUntil>scheduled?plan.snoozedUntil:scheduled;
}
export function planIsActionable(plan:PlanRecord,today=todayInJapan()){return plan.state==='open'&&planReviewDate(plan)<=today;}
