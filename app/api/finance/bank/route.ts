import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { monthSchema } from '@/lib/expenses';
import { bankAction } from '@/lib/finance';
import { changeBank, readBank } from '@/lib/finance-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const user=await requireUser(),{month}=z.object({month:monthSchema}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  return json(await withUserDb(user.id,(tx,s)=>readBank(tx,s.ledgerId,month)));
}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
  assertSameOrigin(request);const user=await requireUser(),input=bankAction.parse(await readJson(request));
  await withLedgerDb(user.id,(tx,s)=>changeBank(tx,s.ledgerId,input));return json({saved:true});
}catch(e){return apiError(e);}}
