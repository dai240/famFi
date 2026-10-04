import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, privateHeaders } from '@/lib/api';
import { cashKinds, cashQuery, serializeCash } from '@/lib/cash-movements';
import { cashWhere } from '@/lib/cash-movement-service';
import { readMasters } from '@/lib/expense-service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const cell=(value:string)=>'"'+(/^[\s]*[=+@-]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';
export async function GET(request:Request) {
  try {
    const user=await requireUser();
    const query=cashQuery.omit({page:true}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    const csv=await withUserDb(user.id,async(tx,scope)=>{
      const where=cashWhere(scope.ledgerId,{...query,page:1});
      if(await tx.cashMovement.count({where})>100000)throw new ApiError(422,'出力対象が多すぎます。期間を絞り込んでください。');
      const masters=await readMasters(tx);
      const rows=(await tx.cashMovement.findMany({where,orderBy:[{date:'asc'},{id:'asc'}]})).map(serializeCash);
      return '\uFEFF'+[['ID','取引日','口座','入金（円）','出金（円）','種類','内容','関係者','メモ','登録方法','登録日時','更新日時'],
        ...rows.map(r=>[r.id,r.date,masters.paymentSources.find(s=>s.id===r.paymentSourceId)?.name??'不明',r.amount>0?String(r.amount):'',r.amount<0?String(-r.amount):'',cashKinds[r.kind],r.description,masters.parties.find(p=>p.id===r.partyId)?.name??'不明',r.memo,r.imported?'明細取込':'手入力',r.createdAt,r.updatedAt])
      ].map(row=>row.map(cell).join(',')).join('\r\n');
    });
    return new NextResponse(csv,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-cash-movements.csv"'}});
  }catch(error){return apiError(error);}
}
