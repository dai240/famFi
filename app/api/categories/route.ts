import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { apiError, json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await requireUser();
    return json(await withUserDb(user.id, tx => tx.category.findMany({ orderBy: { sortOrder: 'asc' } })));
  } catch (error) { return apiError(error); }
}
