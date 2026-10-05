import 'server-only';
import { Prisma, CashMovement } from '@prisma/client';
import { ApiError } from './api';
import { CashFields, CashQuery, serializeCash, validCashFields } from './cash-movements';
import { dbSchema } from './database-schema';
import { shiftMonth } from './expenses';

export function cashWhere(ledgerId: string, query: CashQuery): Prisma.CashMovementWhereInput {
  return { userId: ledgerId, voided: false, matchedImportId: null,
    ...(query.month ? { date: { gte: new Date(query.month+'-01T00:00:00Z'), lt: new Date(shiftMonth(query.month,1)+'-01T00:00:00Z') } } : {}),
    ...(query.direction==='in' ? { amount: { gt: 0 } } : query.direction==='out' ? { amount: { lt: 0 } } : {}),
    ...(query.kind ? { kind: query.kind } : {}), ...(query.source ? { paymentSourceId: query.source } : {}),
    ...(query.search ? { OR: [{ description: { contains: query.search, mode:'insensitive' } }, { memo: { contains: query.search, mode:'insensitive' } }] } : {}),
  };
}
export async function checkCashReferences(tx: Prisma.TransactionClient, ledgerId: string, input: CashFields, old?: CashMovement) {
  validCashFields.parse(input);
  const source = await tx.paymentSource.findFirst({ where: { id: input.paymentSourceId, userId: ledgerId } });
  if (!source || source.method!=='bank' || (source.archived && old?.paymentSourceId!==source.id)) throw new ApiError(400, '入出金を記録する口座を選択してください。');
  if (input.partyId) {
    const person = await tx.party.findFirst({ where: { id: input.partyId, userId: ledgerId, kind:'person' } });
    if (!person || (person.archived && old?.partyId!==person.id)) throw new ApiError(400, '関係者を選び直してください。');
  }
}
export async function insertCash(tx: Prisma.TransactionClient, ledgerId: string, id: string, fields: CashFields,
  imported?: { key: string; batch: string }) {
  const input = validCashFields.parse(fields);
  if (imported && (!/^[0-9a-f]{64}$/.test(imported.key) || !/^[0-9a-f]{64}$/.test(imported.batch))) throw new ApiError(400,'取込識別値が不正です。');
  // Deleted imports remain as tombstones; retries never resurrect or overwrite edits.
  const old = await tx.cashMovement.findFirst({ where: { userId: ledgerId, ...(imported
    ? { paymentSourceId: input.paymentSourceId, importKey: imported.key } : { id }) } });
  if (old) {
    if (imported) {
      if (old.date.toISOString().slice(0,10)!==input.date || old.amount!==input.amount) throw new ApiError(409,'取込済みの明細と一致しません。');
      return { row: serializeCash(old), skipped: true, voided: old.voided };
    }
    if (old.voided || old.importKey || Object.entries(input).some(([k,v]) => serializeCash(old)[k as keyof CashFields] !== v)) throw new ApiError(409,'保存済みの入出金と内容が異なります。');
    return { row: serializeCash(old), skipped: true, voided: false };
  }
  await checkCashReferences(tx,ledgerId,input);
  if (await tx.cashMovement.count({ where: { userId: ledgerId } }) >= 100000) throw new ApiError(422,'入出金の保存上限に達しています。');
  await tx.$executeRaw`insert into ${dbSchema}.cash_movements(id,user_id,payment_source_id,date,amount,kind,description,memo,party_id,import_key,import_batch)
    values(${id}::uuid,${ledgerId}::uuid,${input.paymentSourceId}::uuid,${new Date(input.date+'T00:00:00Z')}::date,
      ${input.amount},${input.kind},${input.description},${input.memo},${input.partyId}::uuid,${imported?.key??null},${imported?.batch??null})`;
  return { row: serializeCash(await tx.cashMovement.findUniqueOrThrow({where:{id}})), skipped:false, voided:false };
}
