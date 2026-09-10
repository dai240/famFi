import {z} from 'zod';
import {requireUser} from '@/lib/auth/server';
import {withUserDb,withLedgerDb} from '@/lib/prisma';
import {ApiError,apiError,assertSameOrigin,json,readJson} from '@/lib/api';
import {dbSchema} from '@/lib/database-schema';
import {monthSchema} from '@/lib/expenses';
import {summaryFields} from '@/lib/planning';
import {readSummaries} from '@/lib/planning-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await requireUser();const month=monthSchema.optional().parse(new URL(request.url).searchParams.get('month')??undefined);return json(await withUserDb(user.id,tx=>readSummaries(tx,month?{month:new Date(month+'-01T00:00:00Z')}:{ })));}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
  assertSameOrigin(request);const user=await requireUser();const {id,...input}=summaryFields.extend({id:z.string().uuid()}).strict().parse(await readJson(request));
  return json(await withLedgerDb(user.id,async(tx,scope)=>{
    const [old]=await readSummaries(tx,{id});if(old){if(Object.entries(input).some(([k,v])=>old[k as keyof typeof old]!==v))throw new ApiError(409,'保存済みの内容と異なります。');return old;}
    if(!await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,archived:false}}))throw new ApiError(400,'使用中の支払元を選んでください。');
    await tx.$executeRaw`insert into ${dbSchema}.expense_summaries(id,user_id,name,month,amount,payment_source_id,memo,complete) values(${id}::uuid,${scope.ledgerId}::uuid,${input.name},${input.month+'-01'}::date,${input.amount},${input.paymentSourceId}::uuid,${input.memo},${input.complete})`;
    return (await readSummaries(tx,{id}))[0];
  }),201);
}catch(e){return apiError(e);}}
