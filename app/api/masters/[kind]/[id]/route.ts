import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { partyFields, paymentSourceFields } from '@/lib/ledger';
import { validateSource } from '@/lib/master-service';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const params = await context.params;
    const kind = z.enum(['parties','payment-sources']).parse(params.kind); const id = z.string().uuid().parse(params.id); const body = await readJson(request);
    const result = await withLedgerDb(user.id, async tx => {
      if (kind === 'parties') {
        const { version, ...input } = partyFields.extend({ version: z.number().int().positive() }).strict().parse(body);
        const old = await tx.party.findUnique({ where: { id } });
        if (!old) throw new ApiError(404, '人物・共用資金が見つかりません。');
        if (old.version !== version) throw new ApiError(409, '変更されています。開き直してください。');
        if (old.kind !== input.kind) throw new ApiError(400, '登録後に人物・共用資金の種類は変更できません。');
        if (await tx.party.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' }, NOT: { id } } })) throw new ApiError(409, '同名の人物・共用資金があります。');
        return tx.party.update({ where: { id }, data: { name: input.name, archived: input.archived, version: { increment: 1 } } });
      }
      const { version, ...input } = paymentSourceFields.extend({ version: z.number().int().positive() }).strict().parse(body);
      const old = await tx.paymentSource.findUnique({ where: { id } });
      if (!old) throw new ApiError(404, '支払元が見つかりません。');
      if (old.version !== version) throw new ApiError(409, '変更されています。開き直してください。');
      await validateSource(tx, input, id);
      return tx.paymentSource.update({ where: { id }, data: { ...input, version: { increment: 1 } } });
    });
    const { userId: _owner, ...row } = result; return json(row);
  } catch (error) { return apiError(error); }
}
