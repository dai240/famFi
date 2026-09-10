import {z} from 'zod';
import {requireUser} from '@/lib/auth/server';
import {withUserDb,withLedgerDb} from '@/lib/prisma';
import {ApiError,apiError,assertSameOrigin,json,readJson} from '@/lib/api';
import {dbSchema} from '@/lib/database-schema';
import {expenseDateForStorage} from '@/lib/expenses';
import {planFields,serializePlan} from '@/lib/planning';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireUser();return json(await withUserDb(user.id,async tx=>(await tx.plannedExpense.findMany({orderBy:[{date:'asc'},{id:'asc'}]})).map(serializePlan)));}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
  assertSameOrigin(request);const user=await requireUser();const {id,...input}=planFields.extend({id:z.string().uuid()}).strict().parse(await readJson(request));
  return json(await withLedgerDb(user.id,async(tx,scope)=>{
    const old=await tx.plannedExpense.findUnique({where:{id}});if(old){const row=serializePlan(old);if(Object.entries(input).some(([k,v])=>row[k as keyof typeof row]!==v))throw new ApiError(409,'保存済みの予定と内容が異なります。');return row;}
    if(await tx.plannedExpense.count({where:{state:'open'}})>=500)throw new ApiError(422,'未確定の予定は500件までです。');
    if(input.categoryId&&!await tx.category.findFirst({where:{id:input.categoryId,archived:false}})||input.paymentSourceId&&!await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,archived:false}}))throw new ApiError(400,'使用中のカテゴリ・支払元を選んでください。');
    const date=expenseDateForStorage(input.date);
    await tx.$executeRaw`insert into ${dbSchema}.planned_expenses(id,user_id,name,date,date_precision,amount,category_id,payment_source_id,memo,review_after) values(${id}::uuid,${scope.ledgerId}::uuid,${input.name},${date.date}::date,${date.datePrecision},${input.amount},${input.categoryId},${input.paymentSourceId}::uuid,${input.memo},${input.reviewAfter}::date)`;
    return serializePlan(await tx.plannedExpense.findUniqueOrThrow({where:{id}}));
  }),201);
}catch(e){return apiError(e);}}
