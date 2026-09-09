import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { deleteExpenseSchema, serializeExpense, updateExpenseSchema } from '@/lib/expenses';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse((await context.params).id);
    const row = await withUserDb(user.id, tx => tx.expense.findUnique({ where: { id } }));
    if (!row) throw new ApiError(404, '支出が見つかりません。');
    return json(serializeExpense(row));
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const id = z.string().uuid().parse((await context.params).id);
    const { version, ...input } = updateExpenseSchema.parse(await readJson(request));
    const row = await withUserDb(user.id, async tx => {
      const existing = await tx.expense.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, '支出が見つかりません。');
      const result = await tx.expense.updateMany({ where: { id, userId: user.id, version },
        data: { ...input, date: new Date(`${input.date}T00:00:00Z`), version: { increment: 1 }, updatedAt: new Date() } });
      if (!result.count) throw new ApiError(409, '別の画面で変更されています。一覧を更新して開き直してください。');
      return tx.expense.findUniqueOrThrow({ where: { id } });
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
    await withUserDb(user.id, async tx => {
      const row = await tx.expense.findUnique({ where: { id } });
      if (!row) throw new ApiError(404, '支出が見つかりません。');
      const deleted = await tx.expense.deleteMany({ where: { id, userId: user.id, version } });
      if (!deleted.count) throw new ApiError(409, '別の画面で変更されています。一覧を更新してから削除してください。');
    });
    return json({ deleted: true });
  } catch (error) { return apiError(error); }
}
