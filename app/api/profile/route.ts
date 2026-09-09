import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { profileFields } from '@/lib/ledger';
import { readMasters } from '@/lib/expense-service';
import { validatePersonDisplayName } from '@/lib/master-service';

export const dynamic = 'force-dynamic';
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = profileFields.parse(await readJson(request));
    const result = await withLedgerDb(user.id, async (tx, scope) => {
      const person = await tx.party.findUnique({ where: { id: scope.partyId } });
      if (!person || !['owner','partner'].includes(person.systemKey ?? '')) throw new ApiError(403, '本人の紐づけを確認してください。');
      if (input.name === (person.systemKey === 'owner' ? '妻' : '夫')) throw new ApiError(400, '配偶者の役割と区別できる表示名を入力してください。');
      if (person.version !== input.version) throw new ApiError(409, '表示名が変更されています。最新の設定を読み込んでください。');
      await validatePersonDisplayName(tx, person.id, input.name);
      await tx.party.update({ where: { id: person.id }, data: { nickname: input.name, profileConfirmed: true, version: { increment: 1 } } });
      return readMasters(tx);
    });
    return json(result);
  } catch (error) { return apiError(error); }
}
