import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json } from '@/lib/api';
import { insertCash } from '@/lib/cash-movement-service';
import { CashKind } from '@/lib/cash-movements';
import { parseRakutenBank, cashImportId } from '@/scripts/rakuten-bank-csv.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){try{
  assertSameOrigin(request);const user=await requireUser();
  if(process.env.FAMFI_DB_SCHEMA==='famfi_preview')throw new ApiError(403,'実際の銀行明細は本番だけに取り込んでください。');
  const input=z.object({source:z.string().uuid(),phase:z.enum(['preview','apply']),hash:z.string().regex(/^[0-9a-f]{64}$/).optional(),offset:z.coerce.number().int().min(0).max(10000).default(0)}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  // Check membership before reading any financial file; bound the body while streaming.
  await withUserDb(user.id,async tx=>{const source=await tx.paymentSource.findFirst({where:{id:input.source,method:'bank',archived:false}});if(!source)throw new ApiError(400,'取込先の銀行口座を選んでください。');});
  if(!request.headers.get('content-type')?.startsWith('application/octet-stream'))throw new ApiError(415,'CSVファイルを選んでください。');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'CSVがありません。');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new ApiError(413,'CSVは2MB以内にしてください。');}chunks.push(value);}
  let parsed:ReturnType<typeof parseRakutenBank>;
  try{parsed=parseRakutenBank(Buffer.concat(chunks));}catch{throw new ApiError(400,'楽天銀行CSVの列・日付・金額・重複・取引の連続性を確認してください。');}
  if(input.phase==='preview')return json(await withUserDb(user.id,async tx=>{
    const old=await tx.cashMovement.findMany({where:{paymentSourceId:input.source,importKey:{in:parsed.rows.map((r:{key:string})=>r.key)}},select:{importKey:true,voided:true}});
    return {hash:parsed.batch,...parsed.summary,newCount:parsed.rows.length-old.length,existingCount:old.filter(r=>!r.voided).length,deletedCount:old.filter(r=>r.voided).length};
  }));
  if(input.hash!==parsed.batch)throw new ApiError(409,'確認したCSVと異なります。再確認してください。');
  const batch=parsed.rows.slice(input.offset,input.offset+10);
  const counts=await withLedgerDb(user.id,async(tx,s)=>{
    let added=0;
    for(const row of batch){const result=await insertCash(tx,s.ledgerId,cashImportId(s.ledgerId,input.source,row.key),{paymentSourceId:input.source,date:row.date,amount:row.amount,kind:row.kind as CashKind,description:row.description,memo:'',partyId:null},{key:row.key,batch:parsed.batch});if(!result.skipped)added++;}
    return {added};
  });
  return json({...counts,next:Math.min(input.offset+10,parsed.rows.length),total:parsed.rows.length});
}catch(e){return apiError(e);}}
