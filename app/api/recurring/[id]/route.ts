import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { serializeRule, updateRecurringSchema } from '@/lib/recurring';
import { storedRule, validateRuleReferences } from '@/lib/recurring-service';
export const dynamic='force-dynamic';
export async function PUT(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);const user=await requireUser();const id=z.string().uuid().parse((await context.params).id);
    const {version,...input}=updateRecurringSchema.parse(await readJson(request));
    return json(await withLedgerDb(user.id,async(tx,scope)=>{
      const old=await tx.recurringRule.findUnique({where:{id}});
      if(!old)throw new ApiError(404,'定期支出が見つかりません。');
      if(old.version!==version)throw new ApiError(409,'別の画面で変更されています。更新して開き直してください。');
      await validateRuleReferences(tx,input,serializeRule(old));
      const changed=await tx.recurringRule.updateMany({where:{id,userId:scope.ledgerId,version},data:{...storedRule(input),version:{increment:1},updatedAt:new Date()}});
      if(!changed.count)throw new ApiError(409,'保存内容が競合しました。');
      return serializeRule(await tx.recurringRule.findUniqueOrThrow({where:{id}}));
    }));
  }catch(error){return apiError(error);}
}
