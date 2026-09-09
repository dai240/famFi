import { ExpenseFields, ExpenseRecord, todayInJapan } from './expenses';
import { Masters, treatmentLabels } from './ledger';

export function personLabel(id: string | null, masters: Masters, selfLabel = false) {
  const person = masters.parties.find(p => p.id === id);
  return person ? (selfLabel && person.id === masters.selfPartyId ? `自分（${person.name}）` : person.name) : '未設定';
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
    amount: 0, date, categoryId: masters.categories.find(c => !c.parentId && !c.archived)?.id ?? '', description: '', memo: '',
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
