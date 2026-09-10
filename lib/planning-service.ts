import 'server-only';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { dbSchema } from './database-schema';
import { ExpenseRecord, querySchema, todayInJapan } from './expenses';
import { recurringAttention, RecurringOccurrence, serializeRule } from './recurring';
import { planIsActionable, planReviewDate, serializePlan, serializeSummary } from './planning';

export async function readRecurringState(tx:Prisma.TransactionClient){
  const rules=(await tx.recurringRule.findMany({orderBy:[{archived:'asc'},{name:'asc'},{id:'asc'}]})).map(serializeRule);
  const occurrences:RecurringOccurrence[]=(await tx.recurringOccurrence.findMany()).map(row=>({id:row.id,ruleId:row.ruleId,period:row.period.toISOString().slice(0,7),state:row.state as RecurringOccurrence['state'],expenseId:row.expenseId,version:row.version,snoozedUntil:row.snoozedUntil?.toISOString().slice(0,10)??null}));
  return {rules,occurrences};
}
export async function readAttention(tx:Prisma.TransactionClient){
  const {rules,occurrences}=await readRecurringState(tx);
  const plans=(await tx.plannedExpense.findMany({where:{state:'open'}})).map(serializePlan);
  const today=todayInJapan();
  const items=[...recurringAttention(rules,occurrences,today),...plans.filter(p=>planIsActionable(p,today)).map(p=>({kind:'plan' as const,id:p.id,name:p.name,period:p.date.slice(0,7),reviewDate:planReviewDate(p)}))].sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate));
  return {count:items.length,items:items.slice(0,100)};
}
export async function readSummaries(tx:Prisma.TransactionClient,where:Prisma.ExpenseSummaryWhereInput={}){
  const rows=await tx.expenseSummary.findMany({where,orderBy:[{month:'desc'},{id:'asc'}]});
  if(!rows.length)return [];
  const groups=await tx.expense.groupBy({by:['summaryId'],where:{summaryId:{in:rows.map(r=>r.id)}},_sum:{amount:true},_count:true});
  return rows.map(r=>{const group=groups.find(g=>g.summaryId===r.id);return serializeSummary(r,group?._sum.amount??0,group?._count??0);});
}
export function summariesMatchFilters(query:Partial<zInferQuery>){
  return !query.category&&!query.person&&!query.treatment&&!query.settlement&&(!query.costClass||query.costClass==='unknown');
}
type zInferQuery=import('zod').infer<typeof querySchema>;
export async function linkSummary(tx:Prisma.TransactionClient,ledgerId:string,summaryId:string,version:number,expense:ExpenseRecord,allowMonthChange:boolean){
  const summary=await tx.expenseSummary.findUnique({where:{id:summaryId}});
  if(!summary)throw new ApiError(404,'まとめ記録が見つかりません。');
  if(summary.version!==version)throw new ApiError(409,'まとめ記録が更新されています。開き直してください。');
  if(expense.summaryId)throw new ApiError(409,'この支出はすでにまとめ記録に紐づいています。');
  if(summary.paymentSourceId!==expense.paymentSourceId)throw new ApiError(400,'支払元が異なります。');
  if(summary.month.toISOString().slice(0,7)!==expense.date.slice(0,7)&&!allowMonthChange)throw new ApiError(409,'計上月が異なるため月別の支出合計が変わります。確認してから紐づけてください。');
  const current=await tx.expense.aggregate({where:{summaryId},_sum:{amount:true}});
  if((current._sum.amount??0)+expense.amount>summary.amount)throw new ApiError(400,'明細の合計がまとめ記録の金額を超えます。');
  await tx.$executeRaw`update ${dbSchema}.expenses set summary_id=${summaryId}::uuid,version=version+1,updated_at=now() where user_id=${ledgerId}::uuid and id=${expense.id}::uuid`;
}
