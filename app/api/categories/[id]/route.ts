import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { categoryFields, masterId } from '@/lib/ledger';
import { validateCategory } from '@/lib/master-service';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const id = masterId.parse((await context.params).id);
    const { version, ...input } = categoryFields.extend({ version: z.number().int().positive() }).strict().parse(await readJson(request));
    const result = await withLedgerDb(user.id, async (tx, scope) => {
      const existing = await tx.category.findUnique({ where: { userId_id: { userId: scope.ledgerId, id } } });
      if (!existing) throw new ApiError(404, 'カテゴリが見つかりません。');
      if (existing.version !== version) throw new ApiError(409, 'カテゴリが変更されています。開き直してください。');
      await validateCategory(tx, input, id);
      return tx.category.update({ where: { userId_id: { userId: scope.ledgerId, id } }, data: { ...input, version: { increment: 1 } } });
    });
    const { userId: _owner, ...row } = result; return json(row);
  } catch (error) { return apiError(error); }
}
