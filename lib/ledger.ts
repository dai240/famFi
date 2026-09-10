import { z } from 'zod';
import { costClassSchema } from './cost-class';

export const masterId = z.string().regex(/^(food|daily|housing|utilities|transport|communication|health|leisure|clothing|other|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
const optionalId = z.string().uuid().nullable().default(null);
export const categoryFields = z.object({ costClass: costClassSchema.default('unknown'), name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-f]{6}$/i),
  sortOrder: z.number().int().min(0).max(100000), parentId: masterId.nullable().default(null), archived: z.boolean().default(false) }).strict();
export const partyFields = z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(['person', 'shared']), archived: z.boolean().default(false) }).strict();
export const paymentMethods = { cash: '現金', card: 'クレジットカード', bank: '口座・振込', emoney: '電子マネー', other: 'その他' } as const;
export const paymentSourceFields = z.object({ name: z.string().trim().min(1).max(60), method: z.enum(['cash','card','bank','emoney','other']),
  ownerLabel: z.string().trim().min(1).max(40).nullable().default(null),
  fundingPartyId: z.string().uuid(), archived: z.boolean().default(false),
  defaultTreatment: z.enum(['shared','advance','direct','review']).default('review'), isDefault: z.boolean().default(false) }).strict();
export const treatmentLabels = { legacy: '未設定', shared: '共通資金で支払い', advance: '立替・あとで精算', direct: '直接負担・返金なし', custom: '精算内容を指定', review: 'あとで確認' } as const;
export const expenseDetails = {
  usedByPartyId: optionalId, beneficiaryPartyId: optionalId, paidByPartyId: optionalId, paymentSourceId: optionalId,
  reimbursementStatus: z.enum(['unknown', 'not_required', 'required']).default('unknown'),
  reimbursementFromPartyId: optionalId, reimbursementToPartyId: optionalId,
  reimbursementAmount: z.number().int().min(0).max(999999999).default(0),
  paymentTreatment: z.enum(['legacy','shared','advance','direct','custom','review']).default('legacy'),
  beneficiaryKind: z.enum(['unknown','family','party','other']).default('unknown'),
  beneficiaryText: z.string().trim().max(80).default(''), usedByText: z.string().trim().max(80).default(''),
};
export type Party = z.infer<typeof partyFields> & { id: string; version: number; systemKey?: string | null; nickname?: string | null; profileConfirmed?: boolean };
export type PaymentSource = Omit<z.infer<typeof paymentSourceFields>,'fundingPartyId'|'ownerLabel'> & { id: string; version: number; fundingPartyId: string | null; ownerLabel?: string | null; storedName?: string };
export const profileFields = z.object({
  name: z.string().trim().min(1, '表示名を入力してください。').refine(value => Array.from(value).length <= 10 && !/[\p{Cc}\p{Cf}]/u.test(value), '表示名は制御文字を除く10文字以内で入力してください。')
    .refine(value => !['家族','自分','その他','共通'].includes(value), '家族・自分・その他・共通とは別の表示名を入力してください。'),
  version: z.number().int().positive(),
}).strict();

export function sourceDisplayName(source: Pick<PaymentSource,'name'|'ownerLabel'|'fundingPartyId'>, parties: Pick<Party,'id'|'name'>[]) {
  const owner = parties.find(p => p.id === source.fundingPartyId);
  return source.ownerLabel && owner ? `${owner.name}の${source.ownerLabel}` : source.name;
}
export type Category = Omit<z.infer<typeof categoryFields>,'costClass'> & { costClass?: z.infer<typeof costClassSchema>; id: string; version: number };
export type Masters = { categories: Category[]; parties: Party[]; paymentSources: PaymentSource[]; selfPartyId?: string; householdName?: string };
export type SettlementRecord = { id: string; expenseId: string; amount: number; date: string; fromPartyId: string; toPartyId: string; memo: string; createdAt: string; cancelledAt: string | null };
export const settlementLabels = { unknown: '要確認', not_required: '精算不要', unsettled: '未精算', partial: '一部精算', settled: '精算済み' } as const;
export type SettlementState = keyof typeof settlementLabels;
export function settlementState(expense: { reimbursementStatus: string; reimbursementAmount: number; settledAmount: number }): SettlementState {
  if (expense.reimbursementStatus === 'unknown') return 'unknown';
  if (expense.reimbursementStatus === 'not_required') return 'not_required';
  if (expense.settledAmount >= expense.reimbursementAmount) return 'settled';
  return expense.settledAmount > 0 ? 'partial' : 'unsettled';
}
export function orderedCategories(categories: Category[]) {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return sorted.filter(c => !c.parentId).flatMap(parent => [parent, ...sorted.filter(c => c.parentId === parent.id)]);
}
export function categoryName(category: Pick<Category, 'name' | 'parentId'>, categories: Pick<Category, 'id' | 'name'>[]) {
  return category.parentId ? `${categories.find(c => c.id === category.parentId)?.name ?? ''} / ${category.name}` : category.name;
}

export function categoryChoices(categories: Category[], value: string, includeArchived = false) {
  const selected = categories.find(category => category.id === value);
  const parent = selected?.parentId ? categories.find(category => category.id === selected.parentId) : selected;
  return {
    parent,
    parents: categories.filter(category => !category.parentId && (includeArchived || !category.archived || category.id === parent?.id)),
    children: parent ? categories.filter(category => category.parentId === parent.id &&
      (includeArchived || category.id === value || (!category.archived && !parent.archived))) : [],
  };
}
