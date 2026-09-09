import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { categoryFields } from '@/lib/ledger';
import { readMasters } from '@/lib/expense-service';
import { validateCategory } from '@/lib/master-service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await requireUser();
    return json(await withUserDb(user.id, async (tx, scope) => (await readMasters(tx)).categories));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireUser();
    const { id, ...input } = categoryFields.extend({ id: z.string().uuid() }).strict().parse(await readJson(request));
    const result = await withLedgerDb(user.id, async (tx, scope) => {
      const existing = await tx.category.findUnique({ where: { userId_id: { userId: scope.ledgerId, id } } });
      if (existing) {
        if (Object.entries(input).some(([key, value]) => existing[key as keyof typeof existing] !== value)) throw new ApiError(409, 'このカテゴリはすでに保存されています。');
        return existing;
      }
      await validateCategory(tx, input);
      await tx.$executeRaw`insert into famfi.category_entries(user_id,id,name,color,sort_order,parent_id,archived) values (${scope.ledgerId}::uuid,${id},${input.name},${input.color},${input.sortOrder},${input.parentId},${input.archived})`;
      return tx.category.findUniqueOrThrow({ where: { userId_id: { userId: scope.ledgerId, id } } });
    });
    const { userId: _owner, ...row } = result; return json(row, 201);
  } catch (error) { return apiError(error); }
}
