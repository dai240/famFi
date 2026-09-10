import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { masterId } from '@/lib/ledger';
import { readMasters } from '@/lib/expense-service';
import { suggestedCategoryCost } from '@/lib/category-defaults';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  try {
    assertSameOrigin(request);const user=await requireUser();
    const {entries}=z.object({entries:z.array(z.object({id:masterId,version:z.number().int().positive()}).strict()).min(1).max(100)}).strict().parse(await readJson(request));
    if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new ApiError(400,'カテゴリが重複しています。');
    return json(await withLedgerDb(user.id,async(tx,scope)=>{
      const masters=await readMasters(tx);
      for(const entry of entries){
        const category=masters.categories.find(c=>c.id===entry.id),costClass=category&&suggestedCategoryCost(category);
        if(!category||!costClass||category.version!==entry.version)throw new ApiError(409,'カテゴリが更新されています。最新の状態を確認してください。');
        await tx.category.update({where:{userId_id:{userId:scope.ledgerId,id:entry.id}},data:{costClass,version:{increment:1}}});
      }
      return readMasters(tx);
    }));
  }catch(error){return apiError(error);}
}
