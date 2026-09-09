import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, json } from '@/lib/api';
export const dynamic='force-dynamic';
const querySchema=z.object({entityType:z.enum(['expenses','category_entries','parties','payment_sources','settlements','recurring_rules','recurring_occurrences']).optional(),entityId:z.string().min(1).max(60).optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
function payload(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return null;const {user_id:_ledger,...rest}=value as Record<string,unknown>;return rest;}
export async function GET(request:Request){
  try{const user=await requireUser();const {page,...where}=querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id,async tx=>({count:await tx.auditEvent.count({where}),events:(await tx.auditEvent.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,skip:(page-1)*50})).map(({userId:_ledger,beforeData,afterData,...r})=>({...r,beforeData:payload(beforeData),afterData:payload(afterData)}))})));
  }catch(error){return apiError(error);}
}
