import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { expenseDateForStorage } from '@/lib/expenses';
import { noteFields, serializeNote } from '@/lib/notes';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const versionFields = z.object({ version: z.number().int().positive() }).strict();
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser(), id = z.string().uuid().parse((await context.params).id);
    const row = await withUserDb(user.id, tx => tx.householdNote.findUnique({ where: { id } }));
    if (!row) throw new ApiError(404, 'メモが見つかりません。');
    return json(serializeNote(row));
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertSameOrigin(request); const user = await requireUser(), id = z.string().uuid().parse((await context.params).id);
    const { version, completed, ...input } = noteFields.extend({ version: z.number().int().positive(), completed: z.boolean() }).strict().parse(await readJson(request));
    if (input.kind === 'note' && completed) throw new ApiError(400, '通常のメモには完了状態を設定できません。');
    return json(await withLedgerDb(user.id, async tx => {
      const old = await tx.householdNote.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, 'メモが見つかりません。');
      if (old.version !== version) throw new ApiError(409, '別の画面で変更されています。最新のメモを確認してください。');
      const date = input.date ? expenseDateForStorage(input.date) : { date: null, datePrecision: 'none' };
      return serializeNote(await tx.householdNote.update({ where: { id }, data: { ...input, ...date, completed, version: { increment: 1 }, updatedAt: new Date() } }));
    }));
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request); const user = await requireUser(), id = z.string().uuid().parse((await context.params).id);
    const { version } = versionFields.parse(await readJson(request));
    await withLedgerDb(user.id, async tx => {
      const old = await tx.householdNote.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, 'メモが見つかりません。');
      if (old.version !== version) throw new ApiError(409, '別の画面で変更されています。最新のメモを確認してください。');
      await tx.householdNote.delete({ where: { id } });
    });
    return json({ deleted: true });
  } catch (error) { return apiError(error); }
}
