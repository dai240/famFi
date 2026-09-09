import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { PAGE_SIZE, createExpenseSchema, expenseDateForStorage, monthRange, querySchema, serializeExpense } from '@/lib/expenses';
import { expenseInclude, expenseWhere, readMasters, sameExpense, validateExpenseReferences } from '@/lib/expense-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async tx => {
      const where = { userId: user.id, date: monthRange(query.month) };
      const filtered = await expenseWhere(tx, user.id, query);
      const expenses = await tx.expense.findMany({ where: filtered, include: expenseInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }], take: PAGE_SIZE, skip: (query.page - 1) * PAGE_SIZE });
      const masters = await readMasters(tx);
      const totals = await tx.expense.aggregate({ where, _sum: { amount: true }, _count: true });
      const groups = await tx.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true }, _count: true });
      const filteredTotals = await tx.expense.aggregate({ where: filtered, _sum: { amount: true }, _count: true });
      const breakdown = new Map<string, { categoryId: string; amount: number; count: number }>();
      for (const group of groups) {
        const categoryId = masters.categories.find(c => c.id === group.categoryId)?.parentId ?? group.categoryId;
        const item = breakdown.get(categoryId) ?? { categoryId, amount: 0, count: 0 };
        item.amount += group._sum.amount ?? 0; item.count += group._count; breakdown.set(categoryId, item);
      }
      return { expenses: expenses.map(serializeExpense), ...masters, total: totals._sum.amount ?? 0,
        count: totals._count, filteredCount: filteredTotals._count, filteredTotal: filteredTotals._sum.amount ?? 0,
        breakdown: [...breakdown.values()] };
    }));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id, ...input } = createExpenseSchema.parse(await readJson(request));
    const storedDate = expenseDateForStorage(input.date);
    const result = await withLedgerDb(user.id, async tx => {
      const old = await tx.expense.findUnique({ where: { id }, include: expenseInclude });
      if (old) {
        const row = serializeExpense(old);
        if (!sameExpense(input, row)) throw new ApiError(409, 'この記録はすでに保存されています。一覧を更新してください。');
        return { row, created: false };
      }
      await validateExpenseReferences(tx, input);
      // The client retains this UUID across retries, preventing ambiguous network failures from duplicating a record.
      // Prisma createMany also names default metadata columns, which this role must not insert.
      const inserted = await tx.$executeRaw`
        insert into famfi.expenses (id, user_id, amount, date, date_precision, category_id, description, memo,
          used_by_party_id,beneficiary_party_id,paid_by_party_id,payment_source_id,reimbursement_status,reimbursement_from_party_id,reimbursement_to_party_id,reimbursement_amount)
        values (${id}::uuid, ${user.id}::uuid, ${input.amount}, ${storedDate.date}::date, ${storedDate.datePrecision},
                ${input.categoryId}, ${input.description}, ${input.memo},${input.usedByPartyId}::uuid,${input.beneficiaryPartyId}::uuid,${input.paidByPartyId}::uuid,${input.paymentSourceId}::uuid,
                ${input.reimbursementStatus},${input.reimbursementFromPartyId}::uuid,${input.reimbursementToPartyId}::uuid,${input.reimbursementAmount})
        on conflict (id) do nothing`;
      const expense = await tx.expense.findUnique({ where: { id }, include: expenseInclude });
      if (!expense) throw new ApiError(409, '保存内容が競合しました。一覧を更新してください。');
      const row = serializeExpense(expense);
      if (!inserted && !sameExpense(input, row)) {
        throw new ApiError(409, 'この記録はすでに保存されています。一覧を更新してください。');
      }
      return { row, created: inserted > 0 };
    });
    return json(result.row, result.created ? 201 : 200);
  } catch (error) { return apiError(error); }
}
