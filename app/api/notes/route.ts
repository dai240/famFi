import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { dbSchema } from '@/lib/database-schema';
import { expenseDateForStorage } from '@/lib/expenses';
import { noteFields, serializeNote } from '@/lib/notes';
export const dynamic = 'force-dynamic';
const querySchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1),
  filter: z.enum(['all','note','open','completed']).default('all'), search: z.string().trim().max(120).default('') }).strict();
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { page, filter, search } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async (tx, scope) => {
      const where = { userId: scope.ledgerId, ...(filter === 'note' ? { kind: 'note' } : filter === 'all' ? {} : { kind: 'task', completed: filter === 'completed' }),
        ...(search ? { OR: [{ name: { contains: search } }, { memo: { contains: search } }] } : {}) };
      const count = await tx.householdNote.count({ where });
      const rows = await tx.householdNote.findMany({ where, orderBy: [{ completed: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }], take: 50, skip: (page - 1) * 50 });
      return { rows: rows.map(serializeNote), count };
    }));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireUser();
    const { id, ...input } = noteFields.extend({ id: z.string().uuid() }).strict().parse(await readJson(request));
    return json(await withLedgerDb(user.id, async (tx, scope) => {
      const old = await tx.householdNote.findUnique({ where: { id } });
      if (old) {
        const row = serializeNote(old);
        if (Object.entries(input).some(([k,v]) => row[k as keyof typeof row] !== v)) throw new ApiError(409, '保存済みのメモと内容が異なります。');
        return row;
      }
      if (await tx.householdNote.count() >= 5000) throw new ApiError(422, '共有メモは5,000件までです。不要なメモを整理してください。');
      const date = input.date ? expenseDateForStorage(input.date) : { date: null, datePrecision: 'none' };
      await tx.$executeRaw`insert into ${dbSchema}.household_notes(id,user_id,name,memo,kind,date,date_precision)
        values(${id}::uuid,${scope.ledgerId}::uuid,${input.name},${input.memo},${input.kind},${date.date}::date,${date.datePrecision})`;
      return serializeNote(await tx.householdNote.findUniqueOrThrow({ where: { id } }));
    }), 201);
  } catch (error) { return apiError(error); }
}
