import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { monthSchema } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
import { createRecurringSchema, serializeRule } from '@/lib/recurring';
import { insertRule } from '@/lib/recurring-service';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const user=await requireUser();const month=monthSchema.parse(new URL(request.url).searchParams.get('month'));
    return json(await withUserDb(user.id,async tx=>({
      rules:(await tx.recurringRule.findMany({orderBy:[{archived:'asc'},{name:'asc'},{id:'asc'}]})).map(serializeRule),
      occurrences:(await tx.recurringOccurrence.findMany({where:{period:new Date(month+'-01T00:00:00Z')}})).map(({userId:_owner,updatedAt:_updated,period,...r})=>({...r,period:period.toISOString().slice(0,7)})),
      masters:await readMasters(tx),
    })));
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
