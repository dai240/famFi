import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, privateHeaders } from '@/lib/api';
import { csvCell } from '@/lib/expenses';
import { readMasters } from '@/lib/expense-service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user=await requireUser();
    const csv=await withUserDb(user.id,async tx=>{
      const rows=await tx.settlement.findMany({orderBy:[{date:'asc'},{id:'asc'}],take:100001});
      if(rows.length>100000) throw new ApiError(422,'出力上限を超えています。');
      const masters=await readMasters(tx); const name=(id:string)=>masters.parties.find(p=>p.id===id)?.name ?? id;
      const lines=[['精算日','金額（円）','返す側','受け取る側','メモ','状態','精算ID','支出ID','記録日時','取消日時'],...rows.map(s=>[s.date.toISOString().slice(0,10),s.amount,name(s.fromPartyId),name(s.toPartyId),s.memo,s.cancelledAt?'取消済み':'有効',s.id,s.expenseId,s.createdAt.toISOString(),s.cancelledAt?.toISOString()??''])];
      return '\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
    });
    return new NextResponse(csv,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-settlements.csv"'}});
  } catch(error) {return apiError(error);}
}
