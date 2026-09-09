import 'server-only';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { Category, PaymentSource } from './ledger';

export async function validateCategory(tx: Prisma.TransactionClient, input: Omit<Category,'id'|'version'>, id?: string) {
  const categories = await tx.category.findMany();
  if (categories.some(c => c.id !== id && c.parentId === input.parentId && c.name.trim().toLowerCase() === input.name.toLowerCase())) throw new ApiError(409, '同じ階層に同名のカテゴリがあります。');
  if (input.parentId) {
    const parent = categories.find(c => c.id === input.parentId);
    if (!parent || parent.parentId || parent.id === id || (parent.archived && !input.archived) || categories.some(c => c.parentId === id)) throw new ApiError(400, '親カテゴリを確認してください。子カテゴリを持つカテゴリは移動できません。');
  }
  if (!id && categories.length >= 300) throw new ApiError(422, 'カテゴリは300件までです。');
}
export async function validateSource(tx: Prisma.TransactionClient, input: Omit<PaymentSource,'id'|'version'>, id?: string) {
  const existing = await tx.paymentSource.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' }, ...(id ? { NOT: { id } } : {}) } });
  if (existing) throw new ApiError(409, '同名の支払元があります。');
  if (input.fundingPartyId) {
    const party = await tx.party.findUnique({ where: { id: input.fundingPartyId } });
    const previous = id ? await tx.paymentSource.findUnique({ where: { id } }) : null;
    if (previous?.isDefault && !input.isDefault) throw new ApiError(409,'初期値を変える場合は、別の支払元を初期値に設定してください。');
    if (!party || (party.archived && previous?.fundingPartyId !== party.id)) throw new ApiError(400, '資金の持ち主を確認してください。');
    if (input.defaultTreatment === 'shared' && party.kind !== 'shared' || ['advance','direct'].includes(input.defaultTreatment) && party.kind !== 'person') throw new ApiError(400, '資金の持ち主と既定の扱いが一致しません。');
    if (previous && previous.fundingPartyId !== input.fundingPartyId && (await tx.expense.count({ where: { paymentSourceId:id } }) || await tx.recurringRule.count({ where: { paymentSourceId:id } }))) throw new ApiError(409, '使用済みの支払元の持ち主は変更できません。別の支払元を追加してください。');
  }
  if (input.isDefault && input.archived) throw new ApiError(400,'既定の支払元は使用停止できません。');
}

export async function clearOtherDefaults(tx: Prisma.TransactionClient, id: string, isDefault: boolean) {
  if (isDefault) await tx.paymentSource.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false, version: { increment: 1 } } });
}
