import { dbSchema } from "@/lib/database-schema";
import 'server-only';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { readMasters, validateExpenseReferences } from './expense-service';
import { RecurringFields, recurringExpense } from './recurring';

export function storedRule(input:RecurringFields) {
  return {...input,startMonth:new Date(input.startMonth+'-01T00:00:00Z'),endMonth:input.endMonth?new Date(input.endMonth+'-01T00:00:00Z'):null};
}
export async function validateRuleReferences(tx:Prisma.TransactionClient,input:RecurringFields,existing?:RecurringFields) {
  const masters=await readMasters(tx);
  const proposed=recurringExpense(input,input.startMonth,masters);
  await validateExpenseReferences(tx,proposed,existing?recurringExpense(existing,existing.startMonth,masters):undefined);
}
export async function insertRule(tx:Prisma.TransactionClient,ledgerId:string,id:string,input:RecurringFields) {
  if(await tx.recurringRule.count()>=200) throw new ApiError(422,'定期支出は200件までです。');
  await validateRuleReferences(tx,input);
  const stored=storedRule(input);
  await tx.$executeRaw`insert into ${dbSchema}.recurring_rules(id,user_id,name,amount_mode,amount,frequency,start_month,end_month,due_day,category_id,payment_source_id,payment_treatment,used_by_party_id,used_by_text,beneficiary_kind,beneficiary_party_id,beneficiary_text,memo,archived,cost_class,review_day,review_month_offset)
    values(${id}::uuid,${ledgerId}::uuid,${input.name},${input.amountMode},${input.amount},${input.frequency},${stored.startMonth}::date,${stored.endMonth}::date,${input.dueDay},${input.categoryId},${input.paymentSourceId}::uuid,${input.paymentTreatment},${input.usedByPartyId}::uuid,${input.usedByText},${input.beneficiaryKind},${input.beneficiaryPartyId}::uuid,${input.beneficiaryText},${input.memo},${input.archived},${input.costClass},${input.reviewDay},${input.reviewMonthOffset})`;
  return tx.recurringRule.findUniqueOrThrow({where:{id}});
}
