import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { lockedExpense } from '@/lib/expense-service';
export const dynamic = 'force-dynamic';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const id = z.string().uuid().parse((await context.params).id);
    z.object({}).strict().parse(await readJson(request));
    await withLedgerDb(user.id, async tx => {
      const record = await tx.settlement.findUnique({ where: { id } });
      if (!record) throw new ApiError(404, '精算記録が見つかりません。');
      await lockedExpense(tx, user.id, record.expenseId);
      if (record.cancelledAt) return;
      await tx.settlement.update({ where: { id }, data: { cancelledAt: new Date() } });
      await tx.expense.update({ where: { id: record.expenseId }, data: { version: { increment: 1 }, updatedAt: new Date() } });
    });
    return json({ cancelled: true });
  } catch (error) { return apiError(error); }
}
