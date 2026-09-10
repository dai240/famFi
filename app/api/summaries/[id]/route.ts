import {z} from 'zod';
import {requireUser} from '@/lib/auth/server';
import {withUserDb,withLedgerDb} from '@/lib/prisma';
import {ApiError,apiError,assertSameOrigin,json,readJson} from '@/lib/api';
import {dbSchema} from '@/lib/database-schema';
import {serializeExpense,validatedExpenseFields} from '@/lib/expenses';
import {summaryFields} from '@/lib/planning';
import {readSummaries,linkSummary} from '@/lib/planning-service';
import {expenseInclude,insertExpense} from '@/lib/expense-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const version=z.number().int().positive();
export async function GET(request:Request,context:Context){try{
  const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);
  return json(await withUserDb(user.id,async tx=>{
    const [summary]=await readSummaries(tx,{id});if(!summary)throw new ApiError(404,'まとめ記録が見つかりません。');
    const details=await tx.expense.findMany({where:{summaryId:id},include:expenseInclude,orderBy:[{date:'asc'},{id:'asc'}]});
    return {summary,details:details.map(serializeExpense)};
  }));
}catch(e){return apiError(e);}}
export async function PUT(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const {version:expected,...input}=summaryFields.extend({version}).strict().parse(await readJson(request));
  return json(await withLedgerDb(user.id,async tx=>{
    const old=await tx.expenseSummary.findUnique({where:{id}});if(!old)throw new ApiError(404,'まとめ記録が見つかりません。');if(old.version!==expected)throw new ApiError(409,'まとめ記録が更新されています。');
    if(old.paymentSourceId!==input.paymentSourceId&&!await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,archived:false}}))throw new ApiError(400,'使用中の支払元を選んでください。');
    await tx.expenseSummary.update({where:{id},data:{...input,month:new Date(input.month+'-01T00:00:00Z'),version:{increment:1},updatedAt:new Date()}});
    return (await readSummaries(tx,{id}))[0];
  }));
}catch(e){return apiError(e);}}
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('create-detail'),version,expenseId:z.string().uuid(),expense:validatedExpenseFields,allowMonthChange:z.boolean().default(false)}).strict(),
  z.object({action:z.enum(['link','unlink']),version,expenseId:z.string().uuid(),expenseVersion:version,allowMonthChange:z.boolean().default(false)}).strict(),
]);
export async function POST(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const input=actionSchema.parse(await readJson(request));
  return json(await withLedgerDb(user.id,async(tx,scope)=>{
    const summary=await tx.expenseSummary.findUnique({where:{id}});if(!summary)throw new ApiError(404,'まとめ記録が見つかりません。');
    const existing=await tx.expense.findUnique({where:{id:input.expenseId},include:expenseInclude});
    if(input.action==='create-detail'&&existing?.summaryId===id){
      const {sameExpense}=await import('@/lib/expense-service');if(sameExpense(input.expense,serializeExpense(existing)))return serializeExpense(existing);
    }
    if(summary.version!==input.version)throw new ApiError(409,'まとめ記録が更新されています。開き直してください。');
    let expense;
    if(input.action==='create-detail'){
      if(existing)throw new ApiError(409,'使用済みの支出IDです。');
      expense=(await insertExpense(tx,scope.ledgerId,input.expenseId,input.expense)).row;
    }else{
      if(!existing)throw new ApiError(404,'支出が見つかりません。');
      if(existing.version!==input.expenseVersion)throw new ApiError(409,'支出が更新されています。');
      expense=serializeExpense(existing);
    }
    if(input.action==='unlink'){
      if(expense.summaryId!==id)throw new ApiError(409,'このまとめ記録の明細ではありません。');
      await tx.$executeRaw`update ${dbSchema}.expenses set summary_id=null,version=version+1,updated_at=now() where id=${expense.id}::uuid and user_id=${scope.ledgerId}::uuid`;
    }else await linkSummary(tx,scope.ledgerId,id,input.version,expense,input.allowMonthChange);
    return serializeExpense(await tx.expense.findUniqueOrThrow({where:{id:expense.id},include:expenseInclude}));
  }));
}catch(e){return apiError(e);}}
export async function DELETE(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const input=z.object({version}).strict().parse(await readJson(request));
  await withLedgerDb(user.id,async tx=>{
    const row=await tx.expenseSummary.findUnique({where:{id}});if(!row)throw new ApiError(404,'まとめ記録が見つかりません。');if(row.version!==input.version)throw new ApiError(409,'まとめ記録が更新されています。');
    if(await tx.expense.count({where:{summaryId:id}}))throw new ApiError(409,'明細のあるまとめ記録は削除できません。');
    await tx.expenseSummary.delete({where:{id}});
  });return json({deleted:true});
}catch(e){return apiError(e);}}
