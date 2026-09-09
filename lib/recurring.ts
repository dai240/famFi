import { z } from 'zod';
import type { RecurringRule as StoredRule } from '@prisma/client';
import { ExpenseFields, monthSchema } from './expenses';
import { Masters, expenseDetails, masterId } from './ledger';
import { newExpense, paymentSuggestion } from './household';

export const recurringFields = z.object({
  name: z.string().trim().min(1).max(120), amountMode: z.enum(['fixed','variable']),
  amount: z.number().int().min(1).max(999999999).nullable(), frequency: z.enum(['monthly','yearly']),
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
  if((!input.usedByPartyId && !input.usedByText) || (input.usedByPartyId && input.usedByText)) issue('usedByPartyId','購入・支払いをした人を選んでください。');
  if(!(input.beneficiaryKind==='family' && !input.beneficiaryPartyId && !input.beneficiaryText || input.beneficiaryKind==='party' && input.beneficiaryPartyId && !input.beneficiaryText || input.beneficiaryKind==='other' && !input.beneficiaryPartyId && input.beneficiaryText)) issue('beneficiaryKind','誰のための支出かを選んでください。');
}
export const validatedRecurringFields=recurringFields.superRefine(validateRule);
export const createRecurringSchema=recurringFields.extend({id:z.string().uuid()}).strict().superRefine(validateRule);
export const updateRecurringSchema=recurringFields.extend({version:z.number().int().positive()}).strict().superRefine(validateRule);
export type RecurringRule=RecurringFields & {id:string;version:number;createdAt:string;updatedAt:string};
export type RecurringOccurrence={id:string;ruleId:string;period:string;state:'posted'|'skipped'|'open';expenseId:string|null;version:number};
export type RecurringResponse={rules:RecurringRule[];occurrences:RecurringOccurrence[];masters:Masters};
export function serializeRule(row:StoredRule):RecurringRule {
  const {userId:_owner,...rest}=row;
  return {...rest,amountMode:row.amountMode as RecurringFields['amountMode'],frequency:row.frequency as RecurringFields['frequency'],
    paymentTreatment:row.paymentTreatment as RecurringFields['paymentTreatment'],beneficiaryKind:row.beneficiaryKind as RecurringFields['beneficiaryKind'],
    startMonth:row.startMonth.toISOString().slice(0,7),endMonth:row.endMonth?.toISOString().slice(0,7)??null,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
export function isDue(rule:RecurringFields,month:string) {
  monthSchema.parse(month);
  return !rule.archived && month>=rule.startMonth && (!rule.endMonth || month<=rule.endMonth) && (rule.frequency==='monthly' || month.slice(5)===rule.startMonth.slice(5));
}
export function dueDate(month:string,day:number|null) {
  monthSchema.parse(month); if(day===null) return month;
  const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  return `${month}-${String(Math.min(Math.max(day,1),lastDay)).padStart(2,'0')}`;
}
export function recurringExpense(rule:RecurringFields,month:string,masters:Masters):ExpenseFields {
  const amount=rule.amount??0;
  return {...newExpense(masters,dueDate(month,rule.dueDay)),amount,categoryId:rule.categoryId,description:rule.name,memo:rule.memo,
    usedByPartyId:rule.usedByPartyId,usedByText:rule.usedByText,beneficiaryKind:rule.beneficiaryKind,beneficiaryPartyId:rule.beneficiaryPartyId,beneficiaryText:rule.beneficiaryText,
    ...paymentSuggestion(masters,rule.paymentSourceId,amount,rule.paymentTreatment)};
}
