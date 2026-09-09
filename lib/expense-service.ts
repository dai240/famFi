import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from './api';
import { ExpenseFields, expenseDateForStorage, querySchema, serializeExpense } from './expenses';
import { Masters, orderedCategories, sourceDisplayName } from './ledger';

export const expenseInclude = { settlements: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] } };
export async function readMasters(tx: Prisma.TransactionClient): Promise<Masters> {
  const categories = await tx.category.findMany();
  const parties = (await tx.party.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] })).map(p => ({ ...p, name: p.nickname ?? p.name }));
  const paymentSources = await tx.paymentSource.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  const member = await tx.householdMember.findFirst();
  const household = await tx.household.findFirst();
  return {
    categories: orderedCategories(categories.map(({ userId: _owner, ...c }) => c)),
    parties: parties.map(({ userId: _owner, ...p }) => ({ ...p, kind: p.kind as 'person' | 'shared' })),
    paymentSources: paymentSources.map(({ userId: _owner, ...p }) => ({ ...p, storedName: p.name, name: sourceDisplayName(p, parties), method: p.method as Masters['paymentSources'][number]['method'], defaultTreatment: p.defaultTreatment as Masters['paymentSources'][number]['defaultTreatment'] })),
    selfPartyId: member?.partyId, householdName: household?.name,
  };
}
export async function validateExpenseReferences(tx: Prisma.TransactionClient, input: ExpenseFields, existing?: ExpenseFields) {
  const masters = await readMasters(tx);
  const category = masters.categories.find(c => c.id === input.categoryId);
  const parent = masters.categories.find(c => c.id === category?.parentId);
  if (!category || ((category.archived || parent?.archived) && input.categoryId !== existing?.categoryId)) throw new ApiError(400, '使用できるカテゴリを選んでください。');
  for (const field of ['usedByPartyId', 'beneficiaryPartyId', 'paidByPartyId', 'reimbursementFromPartyId', 'reimbursementToPartyId'] as const) {
    const id = input[field];
    if (!id) continue;
    const party = masters.parties.find(p => p.id === id);
    if (!party || (party.archived && id !== existing?.[field]) || (field === 'usedByPartyId' && party.kind !== 'person')) throw new ApiError(400, '人物・共用資金の選択を確認してください。');
  }
  if (input.paymentSourceId) {
    const source = masters.paymentSources.find(s => s.id === input.paymentSourceId);
    if (!source || (source.archived && source.id !== existing?.paymentSourceId)) throw new ApiError(400, '使用できる支払元を選んでください。');
    const funding = masters.parties.find(p => p.id === source.fundingPartyId);
    if (!funding || input.paidByPartyId !== funding.id) throw new ApiError(400, '支払元と資金の持ち主を確認してください。');
    if (input.paymentTreatment === 'shared' && funding.kind !== 'shared' || ['advance','direct'].includes(input.paymentTreatment) && funding.kind !== 'person') throw new ApiError(400, 'この支払元では選択した支払いの扱いを使用できません。');
    if (input.paymentTreatment === 'advance' && (input.reimbursementToPartyId !== funding.id || input.reimbursementFromPartyId !== masters.parties.find(p => p.systemKey === 'shared')?.id)) throw new ApiError(400, '立替は家計から資金の持ち主へ精算してください。');
  }
}
export function sameExpense(input: ExpenseFields, row: ExpenseFields) {
  return (Object.keys(input) as (keyof ExpenseFields)[]).every(key => input[key] === row[key]);
}
export async function expenseWhere(tx: Prisma.TransactionClient, userId: string, query: Partial<z.infer<typeof querySchema>>) {
  const where: Prisma.ExpenseWhereInput = { userId };
  if (query.month) {
    const start = new Date(`${query.month}-01T00:00:00Z`); const end = new Date(start); end.setUTCMonth(end.getUTCMonth()+1);
    where.date = { gte: start, lt: end };
  }
  if (query.category) {
    const children = await tx.category.findMany({ where: { parentId: query.category }, select: { id: true } });
    where.categoryId = { in: [query.category, ...children.map(c => c.id)] };
  }
  if (query.person) where.OR = [{ usedByPartyId: query.person }, { beneficiaryPartyId: query.person }, { paidByPartyId: query.person }, { reimbursementFromPartyId: query.person }, { reimbursementToPartyId: query.person }];
  if (query.paymentSource) where.paymentSourceId = query.paymentSource;
  if (query.treatment) where.paymentTreatment = query.treatment;
  if (query.search) where.AND = [{ OR: [{ description: { contains: query.search, mode: 'insensitive' } }, { memo: { contains: query.search, mode: 'insensitive' } }] }];
  if (query.settlement === 'unknown' || query.settlement === 'not_required') where.reimbursementStatus = query.settlement;
  else if (query.settlement) {
    const balance = Prisma.sql`coalesce((select sum(s.amount) from famfi.settlements s where s.user_id=e.user_id and s.expense_id=e.id and s.cancelled_at is null),0)`;
    const condition = query.settlement === 'settled' ? Prisma.sql`${balance} = e.reimbursement_amount`
      : query.settlement === 'partial' ? Prisma.sql`${balance} > 0 and ${balance} < e.reimbursement_amount` : Prisma.sql`${balance} = 0`;
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`select e.id from famfi.expenses e where e.user_id=${userId}::uuid and e.reimbursement_status='required' and ${condition}`);
    where.id = { in: ids.map(row => row.id) };
  }
  return where;
}

export async function insertExpense(tx: Prisma.TransactionClient, ledgerId: string, id: string, input: ExpenseFields) {
  const old = await tx.expense.findUnique({ where: { id }, include: expenseInclude });
  if (old) {
    const row = serializeExpense(old);
    if (!sameExpense(input,row)) throw new ApiError(409,'この記録はすでに保存されています。');
    return { row, created: false };
  }
  await validateExpenseReferences(tx,input);
  const date = expenseDateForStorage(input.date);
  const inserted = await tx.$executeRaw`insert into famfi.expenses(id,user_id,amount,date,date_precision,category_id,description,memo,
    used_by_party_id,beneficiary_party_id,paid_by_party_id,payment_source_id,reimbursement_status,reimbursement_from_party_id,reimbursement_to_party_id,reimbursement_amount,
    payment_treatment,beneficiary_kind,beneficiary_text,used_by_text)
    values(${id}::uuid,${ledgerId}::uuid,${input.amount},${date.date}::date,${date.datePrecision},${input.categoryId},${input.description},${input.memo},
    ${input.usedByPartyId}::uuid,${input.beneficiaryPartyId}::uuid,${input.paidByPartyId}::uuid,${input.paymentSourceId}::uuid,${input.reimbursementStatus},${input.reimbursementFromPartyId}::uuid,${input.reimbursementToPartyId}::uuid,${input.reimbursementAmount},
    ${input.paymentTreatment},${input.beneficiaryKind},${input.beneficiaryText},${input.usedByText}) on conflict(id) do nothing`;
  const found = await tx.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!found || (!inserted && !sameExpense(input,serializeExpense(found)))) throw new ApiError(409,'保存内容が競合しました。');
  return { row: serializeExpense(found), created: inserted>0 };
}
export async function lockedExpense(tx: Prisma.TransactionClient, userId: string, id: string) {
  const locks = await tx.$queryRaw<{ id: string }[]>`select id from famfi.expenses where user_id=${userId}::uuid and id=${id}::uuid for update`;
  if (!locks.length) throw new ApiError(404, '支出が見つかりません。');
  return serializeExpense(await tx.expense.findUniqueOrThrow({ where: { id }, include: expenseInclude }));
}
