import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpenseSchema, validatedExpenseFields } from '../lib/expenses';
import { newExpense, paymentSuggestion, beneficiaryLabel } from '../lib/household';
import { Masters } from '../lib/ledger';
import { dueDate, isDue, recurringExpense, validatedRecurringFields } from '../lib/recurring';
const husband='11111111-1111-4111-8111-111111111111',wife='22222222-2222-4222-8222-222222222222',fund='33333333-3333-4333-8333-333333333333',card='44444444-4444-4444-8444-444444444444',personal='55555555-5555-4555-8555-555555555555';
const masters:Masters={selfPartyId:husband,categories:[{id:'food',name:'食費',color:'#16806A',sortOrder:1,parentId:null,archived:false,version:1}],parties:[{id:husband,name:'夫',kind:'person',systemKey:'owner',archived:false,version:1},{id:wife,name:'妻',kind:'person',systemKey:'partner',archived:false,version:1},{id:fund,name:'共用資金',kind:'shared',systemKey:'shared',archived:false,version:1}],paymentSources:[{id:card,name:'家族カード',method:'card',fundingPartyId:fund,defaultTreatment:'shared',isDefault:true,archived:false,version:1},{id:personal,name:'妻のカード',method:'card',fundingPartyId:wife,defaultTreatment:'advance',isDefault:false,archived:false,version:1}]};
test('explicit required fields and stable household defaults',()=>{
  const fields={...newExpense(masters,'2026-09-09'),amount:1000};assert.ok(validatedExpenseFields.safeParse(fields).success);
  assert.equal(fields.paymentSourceId,card);assert.equal(fields.usedByPartyId,husband);assert.equal(fields.beneficiaryKind,'family');assert.equal(fields.reimbursementStatus,'not_required');
  assert.equal(newExpense({...masters,selfPartyId:wife}).usedByPartyId,wife);
  for(const patch of [{paymentSourceId:null},{paymentTreatment:'legacy'},{usedByPartyId:null},{usedByText:'Someone'},{beneficiaryKind:'unknown'},{beneficiaryKind:'other'},{recordedByPartyId:husband},{userId:husband}])assert.equal(validatedExpenseFields.safeParse({...fields,...patch}).success,false);
  assert.equal(createExpenseSchema.safeParse({id:card,amount:100,date:'2026-09',categoryId:'food'}).success,false);
  assert.ok(validatedExpenseFields.safeParse({...fields,usedByPartyId:null,usedByText:'Guest',beneficiaryKind:'other',beneficiaryText:'Friend'}).success);
});
test('funding owner, buyer, beneficiary and reimbursement remain distinct',()=>{
  const fields={...newExpense(masters,'2026-09'),amount:1200,...paymentSuggestion(masters,personal,1200)};
  assert.equal(fields.usedByPartyId,husband);assert.equal(fields.paidByPartyId,wife);assert.equal(fields.reimbursementToPartyId,wife);assert.equal(fields.reimbursementFromPartyId,fund);assert.equal(fields.reimbursementAmount,1200);
  assert.ok(validatedExpenseFields.safeParse(fields).success);
  const direct={...fields,...paymentSuggestion(masters,personal,1200,'direct')};assert.equal(direct.reimbursementStatus,'not_required');assert.equal(direct.reimbursementAmount,0);assert.equal(direct.reimbursementToPartyId,null);assert.equal(direct.amount,1200);
  assert.equal(beneficiaryLabel({...fields,beneficiaryKind:'party',beneficiaryPartyId:husband},{...masters,selfPartyId:wife}),'夫');
});
const base={name:'Phone',amountMode:'fixed' as const,amount:3000,frequency:'monthly' as const,startMonth:'2026-01',endMonth:'2026-12',dueDay:31,categoryId:'food',paymentSourceId:personal,paymentTreatment:'advance' as const,usedByPartyId:wife,usedByText:'',beneficiaryKind:'family' as const,beneficiaryPartyId:null,beneficiaryText:'',memo:'',archived:false};
test('recurring schedule clamps month ends, supports yearly and month-only, never fabricates a variable amount',()=>{
  assert.ok(validatedRecurringFields.safeParse(base).success);assert.equal(dueDate('2024-02',31),'2024-02-29');assert.equal(dueDate('2026-02',31),'2026-02-28');assert.equal(dueDate('2026-09',null),'2026-09');
  for(const [month,expected] of [['2025-12',false],['2026-01',true],['2026-12',true],['2027-01',false]] as const)assert.equal(isDue(base,month),expected);
  assert.equal(isDue({...base,archived:true},'2026-09'),false);assert.equal(isDue({...base,frequency:'yearly'},'2026-02'),false);assert.equal(isDue({...base,frequency:'yearly'},'2026-01'),true);
  const variable={...base,amountMode:'variable' as const,amount:null};assert.ok(validatedRecurringFields.safeParse(variable).success);assert.equal(recurringExpense(variable,'2026-02',masters).amount,0);assert.equal(validatedExpenseFields.safeParse(recurringExpense(variable,'2026-02',masters)).success,false);
  const draft=recurringExpense(base,'2026-02',masters);assert.equal(draft.date,'2026-02-28');assert.equal(draft.reimbursementAmount,3000);assert.ok(validatedExpenseFields.safeParse(draft).success);
  for(const patch of [{amount:null},{amountMode:'variable'},{dueDay:32},{endMonth:'2025-12'},{paymentTreatment:'custom'},{beneficiaryText:'must choose other'}])assert.equal(validatedRecurringFields.safeParse({...base,...patch}).success,false);
});
