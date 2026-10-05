import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, json, privateHeaders } from '@/lib/api';
import { fundingQuery } from '@/lib/funding-query';
import { csvCell, monthSchema, monthRange } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
import { ContributionRow } from '@/lib/finance';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const user=await requireUser(),query=z.object({month:monthSchema.optional(),page:z.coerce.number().int().min(1).max(2000).default(1),export:z.enum(['csv']).optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  const result=await withUserDb(user.id,async(tx,s)=>{
    const base=Prisma.sql`with ${fundingQuery(s.ledgerId)}, filtered as (select * from funding ${query.month?Prisma.sql`where date>=${monthRange(query.month).gte}::date and date<${monthRange(query.month).lt}::date`:Prisma.empty})`;
    const rows=await tx.$queryRaw<(Omit<ContributionRow,'date'>&{date:Date})[]>(Prisma.sql`${base} select id,date,"partyId",amount,kind,name from filtered order by date desc,id limit ${query.export?100001:50} offset ${query.export?0:(query.page-1)*50}`);
    if(rows.length>100000)throw new ApiError(422,'出力件数の上限を超えています。');
    const groups=await tx.$queryRaw<{partyId:string|null;amount:bigint}[]>(Prisma.sql`${base} select "partyId",sum(amount)::bigint amount from filtered group by "partyId"`);
    const counts=await tx.$queryRaw<{n:number}[]>(Prisma.sql`${base} select count(*)::int n from filtered`);
    const items=rows.map(r=>({...r,date:r.date.toISOString().slice(0,10)}));
    if(query.export){const masters=await readMasters(tx);return '\uFEFF'+[['日付','負担者','金額','種類','内容','ID'],...items.map(r=>[r.date,masters.parties.find(p=>p.id===r.partyId)?.name??'未確認の入金',r.amount,{deposit:'口座への入金',direct:'直接負担',refund:'個人資金から返金',contribution:'返金不要に変更'}[r.kind],r.name,r.id])].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
    return {rows:items,count:counts[0].n,groups:groups.map(g=>({...g,amount:Number(g.amount)}))};
  });
  return typeof result==='string'?new NextResponse(result,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-contributions.csv"'}}):json(result);
}catch(e){return apiError(e);}}
