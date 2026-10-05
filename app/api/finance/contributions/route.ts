import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, json, privateHeaders } from '@/lib/api';
import { dbSchema } from '@/lib/database-schema';
import { csvCell, monthSchema, monthRange } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
import { ContributionRow } from '@/lib/finance';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const user=await requireUser(),query=z.object({month:monthSchema.optional(),page:z.coerce.number().int().min(1).max(2000).default(1),export:z.enum(['csv']).optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  const result=await withUserDb(user.id,async(tx,s)=>{
    // Advances are not contributions until waived or actually funded by a person.
    const base=Prisma.sql`with funding as (
      select c.id,c.date,case when c.kind='contribution' then c.party_id else null end as "partyId",c.amount,'deposit' as kind,c.description as name
      from ${dbSchema}.cash_movements c join ${dbSchema}.payment_sources p on p.user_id=c.user_id and p.id=c.payment_source_id
      join ${dbSchema}.parties f on f.user_id=p.user_id and f.id=p.funding_party_id
      where c.user_id=${s.ledgerId}::uuid and not c.voided and c.matched_import_id is null and c.amount>0 and c.kind in ('contribution','unknown') and f.kind='shared'
      union all
      select e.id,e.ledger_date,e.paid_by_party_id,
        case when e.payment_treatment='direct' then e.amount else e.amount-e.reimbursement_amount end,'direct',e.description
      from ${dbSchema}.expenses e join ${dbSchema}.parties p on p.user_id=e.user_id and p.id=e.paid_by_party_id
      where e.user_id=${s.ledgerId}::uuid and p.kind='person' and (e.payment_treatment='direct' or
        (e.reimbursement_status='required' and e.amount>e.reimbursement_amount and exists(select 1 from ${dbSchema}.parties f where f.user_id=e.user_id and f.id=e.reimbursement_from_party_id and f.kind='shared')))
      union all
      select r.id,r.date,case when r.kind='contribution' then r.to_party_id else p.funding_party_id end,r.amount,r.kind,e.description
      from ${dbSchema}.settlements r join ${dbSchema}.expenses e on e.user_id=r.user_id and e.id=r.expense_id
      left join ${dbSchema}.payment_sources p on p.user_id=r.user_id and p.id=r.payment_source_id
      where r.user_id=${s.ledgerId}::uuid and r.cancelled_at is null
        and exists(select 1 from ${dbSchema}.parties f where f.user_id=r.user_id and f.id=r.from_party_id and f.kind='shared')
        and (r.kind='contribution' or exists(select 1 from ${dbSchema}.parties f where f.user_id=p.user_id and f.id=p.funding_party_id and f.kind='person'))
    ), filtered as (select * from funding ${query.month?Prisma.sql`where date>=${monthRange(query.month).gte}::date and date<${monthRange(query.month).lt}::date`:Prisma.empty})`;
    const rows=await tx.$queryRaw<(Omit<ContributionRow,'date'>&{date:Date})[]>(Prisma.sql`${base} select * from filtered order by date desc,id limit ${query.export?100001:50} offset ${query.export?0:(query.page-1)*50}`);
    if(rows.length>100000)throw new ApiError(422,'出力件数の上限を超えています。');
    const groups=await tx.$queryRaw<{partyId:string|null;amount:bigint}[]>(Prisma.sql`${base} select "partyId",sum(amount)::bigint amount from filtered group by "partyId"`);
    const counts=await tx.$queryRaw<{n:number}[]>(Prisma.sql`${base} select count(*)::int n from filtered`);
    const items=rows.map(r=>({...r,date:r.date.toISOString().slice(0,10)}));
    if(query.export){const masters=await readMasters(tx);return '\uFEFF'+[['日付','負担者','金額','種類','内容','ID'],...items.map(r=>[r.date,masters.parties.find(p=>p.id===r.partyId)?.name??'未確認の入金',r.amount,{deposit:'口座への入金',direct:'直接負担',refund:'個人資金から返金',contribution:'返金不要に変更'}[r.kind],r.name,r.id])].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
    return {rows:items,count:counts[0].n,groups:groups.map(g=>({...g,amount:Number(g.amount)}))};
  });
  return typeof result==='string'?new NextResponse(result,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-contributions.csv"'}}):json(result);
}catch(e){return apiError(e);}}
