import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, privateHeaders } from '@/lib/api';
import { expenseCsv, querySchema, serializeExpense } from '@/lib/expenses';
import { expenseInclude, expenseWhere, readMasters } from '@/lib/expense-service';
import {readSummaries,summariesMatchFilters} from '@/lib/planning-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = querySchema.omit({ page: true }).extend({ month: querySchema.shape.month.optional() }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    const csv = await withUserDb(user.id, async (tx, scope) => {
      const rows = await tx.expense.findMany({ where: await expenseWhere(tx, scope.ledgerId, query), include: expenseInclude, orderBy: [{ date: 'asc' }, { id: 'asc' }], take: 100001 });
      if (rows.length > 100000) throw new ApiError(422, '件数が多いため、月を指定して出力してください。');
      const masters = await readMasters(tx);
      const summaries=summariesMatchFilters(query)?await readSummaries(tx,{...(query.month?{month:new Date(query.month+'-01T00:00:00Z')}:{ }),...(query.paymentSource?{paymentSourceId:query.paymentSource}:{})}):[];
      return expenseCsv(rows.map(serializeExpense), masters.categories, masters,summaries.filter(s=>!query.search||s.name.includes(query.search)||s.memo.includes(query.search)));
    });
    return new NextResponse(csv, { headers: { ...privateHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="famfi-expenses-${query.month ?? 'all'}.csv"` } });
  } catch (error) { return apiError(error); }
}
