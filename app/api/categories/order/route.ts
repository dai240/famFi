import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { masterId } from '@/lib/ledger';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireUser();
    const input = z.object({ entries: z.array(z.object({ id: masterId, version: z.number().int().positive() }).strict()).min(1).max(300) }).strict().parse(await readJson(request));
    await withLedgerDb(user.id, async tx => {
      const first = await tx.category.findUnique({ where: { userId_id: { userId: user.id, id: input.entries[0].id } } });
      if (!first) throw new ApiError(404, 'カテゴリが見つかりません。');
      const siblings = await tx.category.findMany({ where: { parentId: first.parentId } });
      if (siblings.length !== input.entries.length || new Set(input.entries.map(e => e.id)).size !== siblings.length || input.entries.some(e => !siblings.some(c => c.id === e.id && c.version === e.version))) throw new ApiError(409, 'カテゴリが変更されています。開き直してください。');
      for (const [index, entry] of input.entries.entries()) await tx.category.update({ where: { userId_id: { userId: user.id, id: entry.id } }, data: { sortOrder: (index+1)*10, version: { increment: 1 } } });
    });
    return json({ reordered: true });
  } catch (error) { return apiError(error); }
}
