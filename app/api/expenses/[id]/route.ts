import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { deleteExpenseSchema, expenseDateForStorage, serializeExpense, updateExpenseSchema } from '@/lib/expenses';
import { expenseInclude, lockedExpense, validateExpenseReferences } from '@/lib/expense-service';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse((await context.params).id);
    const row = await withUserDb(user.id, tx => tx.expense.findUnique({ where: { id }, include: expenseInclude }));
    if (!row) throw new ApiError(404, '支出が見つかりません。');
    return json(serializeExpense(row));
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = z.string().uuid().parse((await context.params).id);
    const body = await readJson(request);
    const { version, ...input } = updateExpenseSchema.parse(body);
    const row = await withLedgerDb(user.id, async tx => {
      const existing = await lockedExpense(tx, user.id, id);
      if (existing.version !== version) throw new ApiError(409, '別の画面で変更されています。一覧を更新して開き直してください。');
      if (!Object.hasOwn(body as object, 'reimbursementStatus') && (existing.reimbursementStatus !== 'unknown' || existing.usedByPartyId || existing.beneficiaryPartyId || existing.paidByPartyId || existing.paymentSourceId)) throw new ApiError(409, '画面を更新してから編集してください。');
      if (existing.settledAmount && (['amount','reimbursementStatus','reimbursementAmount','reimbursementFromPartyId','reimbursementToPartyId','paidByPartyId','paymentSourceId'] as const).some(key => existing[key] !== input[key])) throw new ApiError(409, '金額・支払元・精算対象を変更するには、先に精算記録を取り消してください。');
      await validateExpenseReferences(tx, input, existing);
      const result = await tx.expense.updateMany({ where: { id, userId: user.id, version },
        data: { ...input, ...expenseDateForStorage(input.date), version: { increment: 1 }, updatedAt: new Date() } });
      if (!result.count) throw new ApiError(409, '別の画面で変更されています。一覧を更新して開き直してください。');
      return tx.expense.findUniqueOrThrow({ where: { id }, include: expenseInclude });
    });
    return json(serializeExpense(row));
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = z.string().uuid().parse((await context.params).id);
    const { version } = deleteExpenseSchema.parse(await readJson(request));
    await withLedgerDb(user.id, async tx => {
      const row = await lockedExpense(tx, user.id, id);
      if (row.settlements.length) throw new ApiError(409, '精算履歴のある支出は削除できません。履歴を残して内容を訂正してください。');
      const deleted = await tx.expense.deleteMany({ where: { id, userId: user.id, version } });
      if (!deleted.count) throw new ApiError(409, '別の画面で変更されています。一覧を更新してから削除してください。');
    });
    return json({ deleted: true });
  } catch (error) { return apiError(error); }
}
