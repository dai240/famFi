import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson, privateHeaders } from '@/lib/api';
import { debtAction } from '@/lib/finance';
import { changeDebt } from '@/lib/finance-service';
import { dbSchema } from '@/lib/database-schema';
import { csvCell } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const user=await requireUser(),query=z.object({view:z.enum(['open','all']).default('open'),page:z.coerce.number().int().min(1).max(2000).default(1),export:z.enum(['csv']).optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  const result=await withUserDb(user.id,async(tx,s)=>{
    const balance=Prisma.sql`d.amount-coalesce((select sum(r.amount) from ${dbSchema}.personal_repayments r where r.user_id=d.user_id and r.debt_id=d.id and r.cancelled_at is null),0)`;
    const where=Prisma.sql`from ${dbSchema}.personal_debts d where d.user_id=${s.ledgerId}::uuid and not d.voided`;
    const filter=query.view==='open'?Prisma.sql`and ${balance}>0`:Prisma.empty;
    const ids=await tx.$queryRaw<{id:string}[]>(Prisma.sql`select d.id ${where} ${filter} order by d.date desc,d.id limit ${query.export?10001:50} offset ${query.export?0:(query.page-1)*50}`);
    if(ids.length>10000)throw new ApiError(422,'出力件数の上限を超えています。');
    const count=await tx.$queryRaw<{n:number}[]>(Prisma.sql`select count(*)::int n ${where} ${filter}`);
    const total=await tx.$queryRaw<{n:bigint}[]>(Prisma.sql`select coalesce(sum(${balance}),0)::bigint n ${where}`);
    const debts=await tx.personalDebt.findMany({where:{id:{in:ids.map(r=>r.id)}},orderBy:[{date:'desc'},{id:'asc'}]});
    const payments=await tx.personalRepayment.findMany({where:{debtId:{in:ids.map(r=>r.id)}},orderBy:[{date:'asc'},{id:'asc'}]});
    const rows=debts.map(d=>({...d,date:d.date.toISOString().slice(0,10),paid:payments.filter(r=>r.debtId===d.id&&!r.cancelledAt).reduce((n,r)=>n+r.amount,0),repayments:payments.filter(r=>r.debtId===d.id).map(r=>({...r,date:r.date.toISOString().slice(0,10),cancelledAt:r.cancelledAt?.toISOString()??null}))}));
    if(query.export){
      const masters=await readMasters(tx),person=(id:string)=>masters.parties.find(p=>p.id===id)?.name??'不明';
      const lines=[['種別','日付','内容','金額','借りた人','貸した人','返済元','状態','メモ','記録ID','貸し借りID'],...rows.flatMap(d=>[
        ['貸し借り',d.date,d.name,d.amount,person(d.debtorPartyId),person(d.creditorPartyId),'',d.paid===d.amount?'返済済み':'返済待ち',d.memo,d.id,d.id],
        ...d.repayments.map(r=>['返済',r.date,d.name,r.amount,person(d.debtorPartyId),person(d.creditorPartyId),masters.paymentSources.find(p=>p.id===r.paymentSourceId)?.name??'不明',r.cancelledAt?'取消済み':'有効',r.memo,r.id,d.id])])];
      return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
    }
    return {rows,count:count[0].n,outstanding:Number(total[0].n)};
  });
  return typeof result==='string'?new NextResponse(result,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-personal-debts.csv"'}}):json(result);
}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
  assertSameOrigin(request);const user=await requireUser(),input=debtAction.parse(await readJson(request));
  await withLedgerDb(user.id,(tx,s)=>changeDebt(tx,s.ledgerId,input));return json({saved:true});
}catch(e){return apiError(e);}}
