import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError,json } from '@/lib/api';
import {readAttention} from '@/lib/planning-service';
import { monthSchema } from '@/lib/expenses';
import { z } from 'zod';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request){
  try{
    const user=await requireUser();
    const {month}=z.object({month:monthSchema.optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id,(tx,scope)=>readAttention(tx,month?{month,ledgerId:scope.ledgerId}:undefined)));
  }catch(error){return apiError(error);}
}
