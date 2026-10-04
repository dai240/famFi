import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb, withUserDb } from '@/lib/prisma';
import { apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { cashFields, cashQuery, serializeCash } from '@/lib/cash-movements';
import { cashWhere, insertCash } from '@/lib/cash-movement-service';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = cashQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async (tx,scope) => {
      const where = cashWhere(scope.ledgerId,query);
      const count = await tx.cashMovement.count({where});
      const incoming = await tx.cashMovement.aggregate({where:{AND:[where,{amount:{gt:0}}]},_sum:{amount:true}});
      const outgoing = await tx.cashMovement.aggregate({where:{AND:[where,{amount:{lt:0}}]},_sum:{amount:true}});
      const rows = await tx.cashMovement.findMany({where,orderBy:[{date:'desc'},{id:'asc'}],take:50,skip:(query.page-1)*50});
      return {rows:rows.map(serializeCash),count,incoming:incoming._sum.amount??0,outgoing:-(outgoing._sum.amount??0)};
    }));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const {id,...fields} = cashFields.extend({id:z.string().uuid()}).strict().parse(await readJson(request));
    return json(await withLedgerDb(user.id,async(tx,scope)=>(await insertCash(tx,scope.ledgerId,id,fields)).row),201);
  } catch (error) { return apiError(error); }
}
