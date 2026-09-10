import { ExpenseFields, ExpenseRecord, todayInJapan } from './expenses';
import { Masters, treatmentLabels } from './ledger';

export function personLabel(id: string | null, masters: Masters, selfLabel = false) {
  const person = masters.parties.find(p => p.id === id);
  return person ? (selfLabel && person.id === masters.selfPartyId ? `自分（${person.name}）` : person.name) : '未設定';
}
export function personRole(person: Masters['parties'][number]) {
  return person.systemKey === 'owner' ? '夫' : person.systemKey === 'partner' ? '妻' : person.kind === 'shared' ? '共通' : '家族';
}
export function paymentSourceGroups(masters: Masters, selected: string | null, includeArchived = false) {
  const parties = [...masters.parties].sort((a,b) => {
    const rank = (p: Masters['parties'][number]) => p.kind === 'shared' ? 0 : p.id === masters.selfPartyId ? 1 : 2;
    return rank(a)-rank(b) || a.name.localeCompare(b.name,'ja') || a.id.localeCompare(b.id);
  });
  const visible = masters.paymentSources.filter(s => includeArchived || !s.archived || s.id === selected);
  const groups = parties.map(p => ({ id: p.id, name: p.systemKey === 'shared' ? '共通' : p.id === masters.selfPartyId ? `${p.name}（自分）` : p.name,
    options: visible.filter(s => s.fundingPartyId === p.id).sort((a,b) => Number(b.isDefault)-Number(a.isDefault) || a.name.localeCompare(b.name,'ja')) }));
  const unknown = visible.filter(s => !parties.some(p => p.id === s.fundingPartyId));
  if (unknown.length) groups.push({ id:'unknown', name:'持ち主未設定', options:unknown });
  return groups.filter(g => g.options.length);
}
export function beneficiaryLabel(expense: Pick<ExpenseFields,'beneficiaryKind'|'beneficiaryPartyId'|'beneficiaryText'>, masters: Masters) {
  return expense.beneficiaryKind === 'family' ? '家族' : expense.beneficiaryKind === 'other' ? expense.beneficiaryText : personLabel(expense.beneficiaryPartyId,masters);
}
export function paymentSuggestion(masters: Masters, sourceId: string | null, amount: number, treatment?: ExpenseFields['paymentTreatment']): Partial<ExpenseFields> {
  const source = masters.paymentSources.find(p => p.id === sourceId);
  const mode = treatment ?? source?.defaultTreatment ?? 'review';
  const shared = masters.parties.find(p => p.systemKey === 'shared');
  return {
    paymentSourceId: sourceId, paidByPartyId: source?.fundingPartyId ?? null, paymentTreatment: mode,
    reimbursementStatus: mode === 'advance' ? 'required' : mode === 'review' || mode === 'custom' ? 'unknown' : 'not_required',
    reimbursementFromPartyId: mode === 'advance' ? shared?.id ?? null : null,
    reimbursementToPartyId: mode === 'advance' ? source?.fundingPartyId ?? null : null,
    reimbursementAmount: mode === 'advance' ? amount : 0,
  };
}
export function newExpense(masters: Masters, date = todayInJapan()): ExpenseFields {
  const source = masters.paymentSources.find(p => p.isDefault && !p.archived);
  return {
    costClass: masters.categories.find(c => !c.parentId && !c.archived)?.costClass ?? 'unknown', amount: 0, date, categoryId: masters.categories.find(c => !c.parentId && !c.archived)?.id ?? '', description: '', memo: '',
    usedByPartyId: masters.selfPartyId ?? null, usedByText: '', beneficiaryKind: 'family', beneficiaryPartyId: null, beneficiaryText: '',
    paidByPartyId: null, paymentSourceId: null, paymentTreatment: 'review', reimbursementStatus: 'unknown', reimbursementAmount: 0, reimbursementFromPartyId: null, reimbursementToPartyId: null,
    ...paymentSuggestion(masters,source?.id ?? null,0),
  };
}
export function paymentSummary(expense: ExpenseFields, masters: Masters) {
  if (expense.reimbursementStatus === 'required') return `${personLabel(expense.reimbursementFromPartyId,masters)} → ${personLabel(expense.reimbursementToPartyId,masters)}`;
  return treatmentLabels[expense.paymentTreatment];
}
export function draftRecord(fields: ExpenseFields): ExpenseRecord {
  return { ...fields, id: '', version: 1, createdAt: '', updatedAt: '', settledAmount: 0, settlements: [] };
}
