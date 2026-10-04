import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb, withUserDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { cashFields, serializeCash } from '@/lib/cash-movements';
import { checkCashReferences } from '@/lib/cash-movement-service';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{id:string}> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser(), id=z.string().uuid().parse((await context.params).id);
    return json(await withUserDb(user.id,async(tx,scope)=>{
      const row=await tx.cashMovement.findFirst({where:{id,userId:scope.ledgerId,voided:false}});
      if(!row)throw new ApiError(404,'入出金が見つかりません。');
      return serializeCash(row);
    }));
  } catch(error) { return apiError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user=await requireUser(),id=z.string().uuid().parse((await context.params).id);
    const {version,...input}=cashFields.extend({version:z.number().int().positive()}).strict().parse(await readJson(request));
    return json(await withLedgerDb(user.id,async(tx,scope)=>{
      const old=await tx.cashMovement.findFirst({where:{id,userId:scope.ledgerId,voided:false}});
      if(!old)throw new ApiError(404,'入出金が見つかりません。');
      if(old.version!==version)throw new ApiError(409,'別の画面で変更されています。最新の入出金を確認してください。');
      if(old.importKey&&(old.paymentSourceId!==input.paymentSourceId||old.amount!==input.amount||old.date.toISOString().slice(0,10)!==input.date)) throw new ApiError(400,'取込済み明細の口座・日付・金額は変更できません。');
      await checkCashReferences(tx,scope.ledgerId,input,old);
      return serializeCash(await tx.cashMovement.update({where:{id},data:{...input,date:new Date(input.date+'T00:00:00Z'),version:{increment:1},updatedAt:new Date()}}));
    }));
  } catch(error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user=await requireUser(),id=z.string().uuid().parse((await context.params).id);
    const {version}=z.object({version:z.number().int().positive()}).strict().parse(await readJson(request));
    await withLedgerDb(user.id,async(tx,scope)=>{
      const old=await tx.cashMovement.findFirst({where:{id,userId:scope.ledgerId}});
      if(!old)throw new ApiError(404,'入出金が見つかりません。');
      if(old.voided&&old.version===version+1)return;
      if(old.voided||old.version!==version)throw new ApiError(409,'別の画面で変更されています。最新の入出金を確認してください。');
      await tx.cashMovement.update({where:{id},data:{voided:true,version:{increment:1},updatedAt:new Date()}});
    });
    return json({deleted:true});
  } catch(error) { return apiError(error); }
}
