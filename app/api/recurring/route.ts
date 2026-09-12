import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { monthSchema } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
import { createRecurringSchema, serializeRule } from '@/lib/recurring';
import { insertRule } from '@/lib/recurring-service';
import { readAttention,readRecurringState } from '@/lib/planning-service';
import { isSampleRecord } from '@/lib/sample-data';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const user=await requireUser();const month=monthSchema.parse(new URL(request.url).searchParams.get('month'));
    return json(await withUserDb(user.id,async tx=>{
      const state=await readRecurringState(tx);
      const previous=state.occurrences.filter(o=>o.state==='posted'&&o.period<month).sort((a,b)=>b.period.localeCompare(a.period));
      const expenses=await tx.expense.findMany({where:{id:{in:previous.flatMap(o=>o.expenseId?[o.expenseId]:[])}},select:{id:true,amount:true,memo:true,description:true}});
      const real=new Map(expenses.filter(e=>!isSampleRecord(e)).map(e=>[e.id,e.amount]));
      const latest=new Map<string,string>();for(const o of previous)if(o.expenseId&&real.has(o.expenseId)&&!latest.has(o.ruleId))latest.set(o.ruleId,o.expenseId);
      return {rules:state.rules,occurrences:state.occurrences.filter(o=>o.period===month),previousAmounts:Object.fromEntries([...latest].map(([id,expenseId])=>[id,expenses.find(e=>e.id===expenseId)?.amount])),masters:await readMasters(tx),attention:(await readAttention(tx)).items};
    }));
  }catch(error){return apiError(error);}
}
export async function POST(request:Request) {
  try {
    assertSameOrigin(request);const user=await requireUser();const {id,...input}=createRecurringSchema.parse(await readJson(request));
    const result=await withLedgerDb(user.id,async(tx,scope)=>{
      const old=await tx.recurringRule.findUnique({where:{id}});
      if(old){const row=serializeRule(old);if(Object.entries(input).some(([k,v])=>row[k as keyof typeof row]!==v)) throw new ApiError(409,'この定期支出はすでに保存されています。');return row;}
      return serializeRule(await insertRule(tx,scope.ledgerId,id,input));
    });return json(result,201);
  }catch(error){return apiError(error);}
}
