import { z } from 'zod';
import type { RecurringRule as StoredRule } from '@prisma/client';
import { ExpenseFields, monthSchema, shiftMonth, todayInJapan } from './expenses';
import { costClassSchema } from './cost-class';
import { Masters, expenseDetails, masterId } from './ledger';
import { newExpense, paymentSuggestion } from './household';

export const recurringFields = z.object({
  costClass: costClassSchema.default('unknown'),
  reviewDay: z.number().int().min(1).max(31).nullable().default(null), reviewMonthOffset:z.number().int().min(0).max(2).default(0),
  name: z.string().trim().min(1).max(120), amountMode: z.enum(['fixed','previous','variable']),
  amount: z.number().int().min(1).max(999999999).nullable(), frequency: z.enum(['monthly','bimonthly','yearly']),
  startMonth: monthSchema, endMonth: monthSchema.nullable().default(null), dueDay: z.number().int().min(1).max(31).nullable().default(null),
  categoryId: masterId, paymentSourceId: z.string().uuid(), paymentTreatment: z.enum(['shared','advance','direct','review']),
  usedByPartyId: expenseDetails.usedByPartyId, usedByText: expenseDetails.usedByText,
  beneficiaryKind: z.enum(['family','party','other']), beneficiaryPartyId: expenseDetails.beneficiaryPartyId, beneficiaryText: expenseDetails.beneficiaryText,
  memo: z.string().trim().max(1000).default(''), archived: z.boolean().default(false),
}).strict();
export type RecurringFields = z.infer<typeof recurringFields>;
function validateRule(input: RecurringFields, ctx: z.RefinementCtx) {
  const issue=(path:string,message:string)=>ctx.addIssue({code:'custom',path:[path],message});
  if(input.amountMode==='fixed' ? input.amount===null : input.amount!==null) issue('amount','定額は金額を入力し、変動額は金額を空にしてください。');
  if(input.endMonth && input.endMonth<input.startMonth) issue('endMonth','終了月は開始月以降にしてください。');
  if(input.reviewDay===null && input.reviewMonthOffset!==0)issue('reviewDay','確認開始日を指定してください。');
  if((!input.usedByPartyId && !input.usedByText) || (input.usedByPartyId && input.usedByText)) issue('usedByPartyId','購入・支払いをした人を選んでください。');
  if(!(input.beneficiaryKind==='family' && !input.beneficiaryPartyId && !input.beneficiaryText || input.beneficiaryKind==='party' && input.beneficiaryPartyId && !input.beneficiaryText || input.beneficiaryKind==='other' && !input.beneficiaryPartyId && input.beneficiaryText)) issue('beneficiaryKind','誰のための支出かを選んでください。');
}
export const validatedRecurringFields=recurringFields.superRefine(validateRule);
export const createRecurringSchema=recurringFields.extend({id:z.string().uuid()}).strict().superRefine(validateRule);
export const updateRecurringSchema=recurringFields.extend({version:z.number().int().positive(),confirmProvisional:z.boolean().default(false)}).strict().superRefine(validateRule);
export type RecurringRule=RecurringFields & {id:string;version:number;createdAt:string;updatedAt:string};
export type RecurringOccurrence={id:string;ruleId:string;period:string;state:'posted'|'skipped'|'open';expenseId:string|null;version:number;snoozedUntil?:string|null};
export type RecurringResponse={rules:RecurringRule[];occurrences:RecurringOccurrence[];masters:Masters;previousAmounts:Record<string,number>;attention:AttentionItem[]};
export function serializeRule(row:StoredRule):RecurringRule {
  const {userId:_owner,...rest}=row;
  return {...rest,costClass:row.costClass as RecurringFields['costClass'],amountMode:row.amountMode as RecurringFields['amountMode'],frequency:row.frequency as RecurringFields['frequency'],
    paymentTreatment:row.paymentTreatment as RecurringFields['paymentTreatment'],beneficiaryKind:row.beneficiaryKind as RecurringFields['beneficiaryKind'],
    startMonth:row.startMonth.toISOString().slice(0,7),endMonth:row.endMonth?.toISOString().slice(0,7)??null,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
export function isDue(rule:RecurringFields,month:string) {
  monthSchema.parse(month);
  const distance=(Number(month.slice(0,4))-Number(rule.startMonth.slice(0,4)))*12+Number(month.slice(5))-Number(rule.startMonth.slice(5));
  const interval=rule.frequency==='yearly'?12:rule.frequency==='bimonthly'?2:1;
  return !rule.archived && month>=rule.startMonth && (!rule.endMonth || month<=rule.endMonth) && distance%interval===0;
}
export function dueDate(month:string,day:number|null) {
  monthSchema.parse(month); if(day===null) return month;
  const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  return `${month}-${String(Math.min(Math.max(day,1),lastDay)).padStart(2,'0')}`;
}
export function recurringExpense(rule:RecurringFields,month:string,masters:Masters,previousAmount?:number):ExpenseFields {
  const amount=rule.amountMode==='previous'?previousAmount??0:rule.amount??0;
  return {...newExpense(masters,dueDate(month,rule.dueDay)),costClass:rule.costClass,amount,categoryId:rule.categoryId,description:rule.name,memo:rule.memo,
    usedByPartyId:rule.usedByPartyId,usedByText:rule.usedByText,beneficiaryKind:rule.beneficiaryKind,beneficiaryPartyId:rule.beneficiaryPartyId,beneficiaryText:rule.beneficiaryText,
    ...paymentSuggestion(masters,rule.paymentSourceId,amount,rule.paymentTreatment)};
}

export type AttentionItem={kind:'recurring'|'plan';id:string;name:string;period:string;reviewDate:string};
export function recurringReviewDate(rule:RecurringFields,period:string,occurrence?:RecurringOccurrence){
  const scheduled=dueDate(shiftMonth(period,rule.reviewMonthOffset??0),rule.reviewDay??1);
  return occurrence?.snoozedUntil && occurrence.snoozedUntil>scheduled?occurrence.snoozedUntil:scheduled;
}
export function recurringOverview(rules: RecurringRule[], occurrences: RecurringOccurrence[], month: string, today = todayInJapan()) {
  const relevant = rules.filter(rule => isDue(rule, month) || occurrences.some(o => o.ruleId === rule.id && o.state === 'posted'));
  const state = (rule: RecurringRule) => occurrences.find(o => o.ruleId === rule.id);
  const pending = relevant.filter(rule => !state(rule) || state(rule)?.state === 'open');
  const rank = (rule: RecurringRule) => state(rule)?.state === 'posted' ? 2 : state(rule)?.state === 'skipped' ? 3 : recurringReviewDate(rule, month, state(rule)) <= today ? 0 : 1;
  return {
    rows: [...relevant].sort((a,b) => rank(a)-rank(b) || recurringReviewDate(a,month,state(a)).localeCompare(recurringReviewDate(b,month,state(b))) || a.name.localeCompare(b.name,'ja') || a.id.localeCompare(b.id)),
    pendingCount: pending.length,
    baseAmount: pending.filter(r => r.amountMode === 'fixed').reduce((sum,r) => sum + (r.amount ?? 0), 0),
    amountCheckCount: pending.filter(r => r.amountMode !== 'fixed').length,
  };
}
export function recurringAttention(rules:RecurringRule[],occurrences:RecurringOccurrence[],today=todayInJapan()):AttentionItem[]{
  const byPeriod=new Map(occurrences.map(o=>[o.ruleId+':'+o.period,o]));
  const result:AttentionItem[]=[];
  for(const rule of rules){
    if(rule.archived)continue;
    for(let period=rule.startMonth;period<=today.slice(0,7)&&period<='2099-12';period=shiftMonth(period,1)){
      if(rule.endMonth&&period>rule.endMonth)break;
      if(!isDue(rule,period))continue;
      const occurrence=byPeriod.get(rule.id+':'+period);
      if(occurrence&&occurrence.state!=='open')continue;
      const reviewDate=recurringReviewDate(rule,period,occurrence);
      if(reviewDate<=today)result.push({kind:'recurring',id:rule.id,name:rule.name,period,reviewDate});
    }
  }
  return result.sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate)||a.id.localeCompare(b.id));
}
