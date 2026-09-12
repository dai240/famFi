import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { settlementBatchSchema } from '@/lib/settlement-batch';
import { settleBatch } from '@/lib/settlement-service';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = settlementBatchSchema.parse(await readJson(request));
    const result = await withLedgerDb(user.id, (tx, scope) => settleBatch(tx, scope.ledgerId, input));
    return json(result, result.created ? 201 : 200);
  } catch (error) { return apiError(error); }
}
