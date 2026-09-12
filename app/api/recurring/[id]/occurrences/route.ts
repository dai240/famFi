import { dbSchema } from "@/lib/database-schema";
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { dateSchema, monthSchema, validatedExpenseFields, serializeExpense, todayInJapan } from '@/lib/expenses';
import { expenseInclude, insertExpense, sameExpense } from '@/lib/expense-service';
import { isDue, serializeRule } from '@/lib/recurring';
import { isProvisionalRule } from '@/lib/sample-data';
export const dynamic='force-dynamic';
const common={period:monthSchema,ruleVersion:z.number().int().positive(),occurrenceVersion:z.number().int().min(0)};
const schema=z.discriminatedUnion('action',[
  z.object({...common,action:z.literal('post'),expenseId:z.string().uuid(),expense:validatedExpenseFields}).strict(),
  z.object({...common,action:z.enum(['skip','reopen'])}).strict(),
  z.object({...common,action:z.literal('snooze'),until:dateSchema}).strict(),
]);
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const input=schema.parse(await readJson(request));
    return json(await withLedgerDb(user.id,async(tx,scope)=>{
      const rule=await tx.recurringRule.findUnique({where:{id}});if(!rule)throw new ApiError(404,'定期支出が見つかりません。');
      const period=new Date(input.period+'-01T00:00:00Z');
      const occurrence=await tx.recurringOccurrence.findUnique({where:{userId_ruleId_period:{userId:scope.ledgerId,ruleId:id,period}}});
      // A retry can arrive after the rule or occurrence version has advanced.
      if(input.action==='post' && occurrence?.state==='posted' && occurrence.expenseId===input.expenseId){
        const row=await tx.expense.findUniqueOrThrow({where:{id:input.expenseId},include:expenseInclude});
        if(!sameExpense(input.expense,serializeExpense(row)))throw new ApiError(409,'確定済みの内容と異なります。一覧を更新してください。');
        return serializeExpense(row);
      }
      if(rule.version!==input.ruleVersion || (occurrence?.version??0)!==input.occurrenceVersion)throw new ApiError(409,'別の画面で変更されています。一覧を更新してください。');
      if(!isDue(serializeRule(rule),input.period))throw new ApiError(400,'この月は定期支出の対象外です。');
      if(occurrence?.state==='posted')throw new ApiError(409,'この月は登録済みです。支出一覧から編集してください。');
      const state=input.action==='post'?'posted':input.action==='skip'?'skipped':'open';
      if(input.action==='snooze'&&(input.until<=todayInJapan()||occurrence?.state==='skipped'))throw new ApiError(400,'未確定の支出について、明日以降の日付を指定してください。');
      const snoozedUntil=input.action==='snooze'?new Date(input.until+'T00:00:00Z'):null;
      let result=null;
      if(input.action==='post'){
        if(isProvisionalRule(rule))throw new ApiError(422,'仮設定の金額・支払元・確認日を確認してから登録してください。');
        if(occurrence?.state==='skipped')throw new ApiError(409,'スキップを取り消してから登録してください。');
        if(await tx.expense.findUnique({where:{id:input.expenseId}}))throw new ApiError(409,'別の支出に使用されているIDです。');
        result=(await insertExpense(tx,scope.ledgerId,input.expenseId,input.expense)).row;
      }
      const expenseId=input.action==='post'?input.expenseId:null;
      if(occurrence)await tx.recurringOccurrence.update({where:{id:occurrence.id},data:{state,expenseId,snoozedUntil,version:{increment:1},updatedAt:new Date()}});
      else await tx.$executeRaw`insert into ${dbSchema}.recurring_occurrences(id,user_id,rule_id,period,state,expense_id,snoozed_until) values(${randomUUID()}::uuid,${scope.ledgerId}::uuid,${id}::uuid,${period}::date,${state},${expenseId}::uuid,${snoozedUntil}::date)`;
      return result??{state};
    }));
  }catch(error){return apiError(error);}
}
