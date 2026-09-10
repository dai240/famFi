import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringFields,recurringAttention,recurringReviewDate,isDue,RecurringRule} from '../lib/recurring';
import {planIsActionable,planReviewDate,PlanRecord,summaryFields} from '../lib/planning';
import {expenseCsv,serializeExpense} from '../lib/expenses';
const rule:RecurringRule={...recurringFields.parse({name:'水道',amountMode:'variable',amount:null,frequency:'bimonthly',startMonth:'2026-08',categoryId:'utilities',paymentSourceId:'11111111-1111-4111-8111-111111111111',paymentTreatment:'shared',usedByText:'本人',beneficiaryKind:'family'}),id:'rule',version:1,createdAt:'',updatedAt:''};
test('recurring review windows use month end, offset, shared snooze and all overdue periods',()=>{
  assert.equal(isDue(rule,'2026-09'),false);assert.equal(isDue(rule,'2026-10'),true);
  assert.equal(recurringReviewDate({...rule,reviewDay:31},'2024-02'),'2024-02-29');
  assert.equal(recurringReviewDate({...rule,reviewDay:10,reviewMonthOffset:1},'2026-12'),'2027-01-10');
  assert.deepEqual(recurringAttention([rule],[],'2026-10-01').map(a=>a.period),['2026-08','2026-10']);
  const occurrence={id:'o',ruleId:'rule',period:'2026-08',state:'open' as const,expenseId:null,version:1,snoozedUntil:'2026-10-02'};
  assert.equal(recurringAttention([rule],[occurrence],'2026-10-01').length,1);
  assert.equal(recurringAttention([rule],[{...occurrence,state:'skipped'}],'2026-09-01').length,0);
  assert.equal(recurringAttention([{...rule,reviewDay:30}],[],'2026-08-29').length,0);
});
test('single plans become actionable after the date or after the entire month',()=>{
  const plan:PlanRecord={id:'plan',name:'贈り物',date:'2026-09',amount:null,categoryId:null,paymentSourceId:null,memo:'',reviewAfter:null,snoozedUntil:null,state:'open',expenseId:null,version:1};
  assert.equal(planReviewDate(plan),'2026-10-01');assert.equal(planIsActionable(plan,'2026-09-30'),false);assert.equal(planIsActionable(plan,'2026-10-01'),true);
  assert.equal(planReviewDate({...plan,date:'2024-02-29'}),'2024-03-01');
  assert.equal(planIsActionable({...plan,state:'posted'},'2026-10-01'),false);
  assert.equal(planReviewDate({...plan,reviewAfter:'2026-09-10',snoozedUntil:'2026-09-20'}),'2026-09-20');
});
test('summary remainder is exported once without invented buyer or reimbursement',()=>{
  const summary={...summaryFields.parse({name:'カード',month:'2026-09',amount:100000,paymentSourceId:rule.paymentSourceId}),id:'summary',version:1,detailedAmount:30000,remainder:70000,detailCount:1};
  const expense=serializeExpense({id:'expense',amount:30000,date:new Date('2026-09-01'),datePrecision:'month',categoryId:'food',description:'明細',memo:'',version:1,createdAt:new Date(),updatedAt:new Date(),summaryId:'summary',costClass:'variable'});
  const lines=expenseCsv([expense],[],{parties:[],paymentSources:[]},[summary]).split('\r\n');
  assert.equal(lines.length,4);assert.ok(lines[1].includes('"30000"'));assert.ok(lines[2].includes('"70000"'));assert.ok(lines[2].includes('まとめ記録の未整理額'));assert.ok(!lines[2].includes('立替'));
});
