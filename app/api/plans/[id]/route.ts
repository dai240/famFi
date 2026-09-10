import {z} from 'zod';
import {requireUser} from '@/lib/auth/server';
import {withLedgerDb} from '@/lib/prisma';
import {ApiError,apiError,assertSameOrigin,json,readJson} from '@/lib/api';
import {dateSchema,expenseDateForStorage,validatedExpenseFields,serializeExpense,todayInJapan} from '@/lib/expenses';
import {expenseInclude,insertExpense,sameExpense} from '@/lib/expense-service';
import {planFields,serializePlan} from '@/lib/planning';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function PUT(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const {version,...input}=planFields.extend({version:z.number().int().positive()}).strict().parse(await readJson(request));
  return json(await withLedgerDb(user.id,async tx=>{
    const old=await tx.plannedExpense.findUnique({where:{id}});if(!old)throw new ApiError(404,'予定が見つかりません。');
    if(old.version!==version||old.state==='posted')throw new ApiError(409,'予定が更新されています。開き直してください。');
    if(input.categoryId!==old.categoryId&&input.categoryId&&!await tx.category.findFirst({where:{id:input.categoryId,archived:false}})||input.paymentSourceId!==old.paymentSourceId&&input.paymentSourceId&&!await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,archived:false}}))throw new ApiError(400,'使用中のカテゴリ・支払元を選んでください。');
    return serializePlan(await tx.plannedExpense.update({where:{id},data:{...input,...expenseDateForStorage(input.date),reviewAfter:input.reviewAfter?new Date(input.reviewAfter+'T00:00:00Z'):null,snoozedUntil:null,version:{increment:1},updatedAt:new Date()}}));
  }));
}catch(e){return apiError(e);}}
const version=z.number().int().positive();
const actions=z.discriminatedUnion('action',[
  z.object({action:z.literal('post'),version,expenseId:z.string().uuid(),expense:validatedExpenseFields}).strict(),
  z.object({action:z.literal('link'),version,expenseId:z.string().uuid(),expenseVersion:version}).strict(),
  z.object({action:z.enum(['cancel','reopen']),version}).strict(),
  z.object({action:z.literal('snooze'),version,until:dateSchema}).strict(),
]);
export async function POST(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);const input=actions.parse(await readJson(request));
  return json(await withLedgerDb(user.id,async(tx,scope)=>{
    const plan=await tx.plannedExpense.findUnique({where:{id}});if(!plan)throw new ApiError(404,'予定が見つかりません。');
    if(input.action==='post'&&plan.state==='posted'&&plan.expenseId===input.expenseId){const row=serializeExpense(await tx.expense.findUniqueOrThrow({where:{id:input.expenseId},include:expenseInclude}));if(!sameExpense(input.expense,row))throw new ApiError(409,'確定済みの内容と異なります。');return row;}
    if(plan.version!==input.version||plan.state==='posted')throw new ApiError(409,'予定が更新されています。開き直してください。');
    if(input.action==='post'||input.action==='link'){
      if(plan.state!=='open')throw new ApiError(409,'中止を取り消してから確定してください。');
      let row;
      if(input.action==='post'){
        if(await tx.expense.findUnique({where:{id:input.expenseId}}))throw new ApiError(409,'使用済みの支出IDです。');
        row=(await insertExpense(tx,scope.ledgerId,input.expenseId,input.expense)).row;
      }else{
        const expense=await tx.expense.findUnique({where:{id:input.expenseId},include:expenseInclude});
        if(!expense)throw new ApiError(404,'支出が見つかりません。');
        if(expense.version!==input.expenseVersion)throw new ApiError(409,'支出が更新されています。');
        row=serializeExpense(expense);
      }
      await tx.plannedExpense.update({where:{id},data:{state:'posted',expenseId:row.id,snoozedUntil:null,version:{increment:1},updatedAt:new Date()}});
      return row;
    }
    if(input.action==='snooze'&&(input.until<=todayInJapan()||plan.state!=='open'))throw new ApiError(400,'未確定の予定について明日以降を指定してください。');
    return serializePlan(await tx.plannedExpense.update({where:{id},data:{state:input.action==='cancel'?'cancelled':'open',snoozedUntil:input.action==='snooze'?new Date(input.until+'T00:00:00Z'):null,version:{increment:1},updatedAt:new Date()}}));
  }));
}catch(e){return apiError(e);}}
