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
    if (!party || (party.archived && previous?.fundingPartyId !== party.id)) throw new ApiError(400, '資金の持ち主を確認してください。');
  }
}
