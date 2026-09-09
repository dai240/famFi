import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { partyFields, paymentSourceFields } from '@/lib/ledger';
import { validateSource, clearOtherDefaults } from '@/lib/master-service';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const kind = z.enum(['parties','payment-sources']).parse((await context.params).kind);
    const body = await readJson(request);
    const result = await withLedgerDb(user.id, async (tx, scope) => {
      if (kind === 'parties') {
        const { id, ...input } = partyFields.extend({ id: z.string().uuid() }).strict().parse(body);
        const old = await tx.party.findUnique({ where: { id } });
        if (old) { if (Object.entries(input).some(([k,v]) => old[k as keyof typeof old] !== v)) throw new ApiError(409, '保存内容が競合しました。'); return old; }
        if (await tx.party.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } })) throw new ApiError(409, '同名の人物・共用資金があります。');
        if (await tx.party.count() >= 100) throw new ApiError(422, '人物・共用資金は100件までです。');
        await tx.$executeRaw`insert into famfi.parties(id,user_id,name,kind,archived) values (${id}::uuid,${scope.ledgerId}::uuid,${input.name},${input.kind},${input.archived})`;
        return tx.party.findUniqueOrThrow({ where: { id } });
      }
      const { id, ...input } = paymentSourceFields.extend({ id: z.string().uuid() }).strict().parse(body);
      const old = await tx.paymentSource.findUnique({ where: { id } });
      if (old) { if (Object.entries(input).some(([k,v]) => old[k as keyof typeof old] !== v)) throw new ApiError(409, '保存内容が競合しました。'); return old; }
      await validateSource(tx, input);
      if (await tx.paymentSource.count() >= 100) throw new ApiError(422, '支払元は100件までです。');
      await clearOtherDefaults(tx,id,input.isDefault);
      await tx.$executeRaw`insert into famfi.payment_sources(id,user_id,name,method,funding_party_id,archived,default_treatment,is_default) values (${id}::uuid,${scope.ledgerId}::uuid,${input.name},${input.method},${input.fundingPartyId}::uuid,${input.archived},${input.defaultTreatment},${input.isDefault})`;
      return tx.paymentSource.findUniqueOrThrow({ where: { id } });
    });
    const { userId: _owner, ...row } = result; return json(row, 201);
  } catch (error) { return apiError(error); }
}
