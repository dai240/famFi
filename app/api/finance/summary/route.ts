import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, json, privateHeaders } from '@/lib/api';
import { summaryQuery } from '@/lib/household-summary';
import { readHouseholdSummary } from '@/lib/household-summary-service';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request){
  try{
    const user=await requireUser();
    const query=summaryQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result=await withUserDb(user.id,(tx,scope)=>readHouseholdSummary(tx,scope.ledgerId,query));
    return typeof result==='string'?new NextResponse(result,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-household-summary.csv"'}}):json(result);
  }catch(error){return apiError(error);}
}
