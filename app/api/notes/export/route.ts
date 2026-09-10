import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, privateHeaders } from '@/lib/api';
import { serializeNote } from '@/lib/notes';
export const dynamic = 'force-dynamic';
const cell = (value: string) => '"' + (/^[\s]*[=+@-]/.test(value) ? "'" : '') + value.replaceAll('"','""') + '"';
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await withUserDb(user.id, async tx => (await tx.householdNote.findMany({orderBy:[{createdAt:'asc'},{id:'asc'}]})).map(serializeNote));
    const csv = '\uFEFF' + [['ID','件名','種類','日付・月','完了','メモ','登録日時','更新日時'], ...rows.map(r=>[r.id,r.name,r.kind==='task'?'チェック':'メモ',r.date??'',r.completed?'完了':'',r.memo,r.createdAt,r.updatedAt])].map(row=>row.map(cell).join(',')).join('\r\n');
    return new NextResponse(csv,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="famfi-notes.csv"'}});
  } catch(error) { return apiError(error); }
}
