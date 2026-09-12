import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, json } from '@/lib/api';
import { monthSchema, shiftMonth } from '@/lib/expenses';
import { monthSnapshot } from '@/lib/expense-comparison-service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request) {
  try {
    const user=await requireUser();
    const {month}=z.object({month:monthSchema}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id,async(tx,scope)=>{
      const categories=await tx.category.findMany();
      const current=await monthSnapshot(tx,scope.ledgerId,month,categories);
      const previous=month==='2000-01'?null:await monthSnapshot(tx,scope.ledgerId,shiftMonth(month,-1),categories);
      return {current,previous};
    }));
  }catch(error){return apiError(error);}
}
