import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFields, masterId, orderedCategories, settlementState } from '../lib/ledger';
import { createExpenseSchema, createSettlementSchema, expenseCsv, serializeExpense } from '../lib/expenses';
const from='11111111-1111-4111-8111-111111111111', to='22222222-2222-4222-8222-222222222222';
const input={ id:from,amount:3000,date:'2026-09',categoryId:'food',paymentSourceId:from,paymentTreatment:'custom',usedByPartyId:to,beneficiaryKind:'family' };
test('reimbursement requires explicit parties and bounded amount; unknown stays unknown',()=>{
  assert.equal(createExpenseSchema.parse(input).reimbursementStatus,'unknown');
  const valid={...input,reimbursementStatus:'required',reimbursementAmount:1000,reimbursementFromPartyId:from,reimbursementToPartyId:to};
  assert.ok(createExpenseSchema.safeParse(valid).success);
  for(const patch of [{reimbursementAmount:0},{reimbursementAmount:3001},{reimbursementToPartyId:from},{reimbursementToPartyId:null},{reimbursementStatus:'unknown'},{userId:from}]) assert.equal(createExpenseSchema.safeParse({...valid,...patch}).success,false);
  assert.equal(createSettlementSchema.safeParse({id:from,expenseId:to,expenseVersion:1,amount:1,date:'2026-09'}).success,false);
});
test('categories accept stable custom IDs, color and deterministic two-level order',()=>{
  assert.ok(masterId.safeParse(from).success); assert.equal(masterId.safeParse('<script>').success,false);
  assert.equal(categoryFields.safeParse({name:' ',color:'#FFFFFF',sortOrder:0}).success,false);
  assert.equal(categoryFields.safeParse({name:'Food',color:'red',sortOrder:0}).success,false);
  const base={color:'#16806A',archived:false,version:1};
  const rows=[{...base,id:'b',name:'Child',parentId:'a',sortOrder:0},{...base,id:'c',name:'Other',parentId:null,sortOrder:20},{...base,id:'a',name:'Food',parentId:null,sortOrder:10}];
  assert.deepEqual(orderedCategories(rows).map(c=>c.id),['a','b','c']);
});
test('settlement state and exports distinguish purchases from repayment including cancellation',()=>{
  for(const [status,amount,paid,expected] of [['unknown',0,0,'unknown'],['not_required',0,0,'not_required'],['required',1000,0,'unsettled'],['required',1000,400,'partial'],['required',1000,1000,'settled']] as const) assert.equal(settlementState({reimbursementStatus:status,reimbursementAmount:amount,settledAmount:paid}),expected);
  const expense=serializeExpense({...createExpenseSchema.parse({...input,reimbursementStatus:'required',reimbursementAmount:3000,reimbursementFromPartyId:from,reimbursementToPartyId:to}),date:new Date('2026-09-01'),datePrecision:'month',version:1,createdAt:new Date(),updatedAt:new Date(),settlements:[{id:to,expenseId:from,amount:1000,date:new Date('2026-09-10'),fromPartyId:from,toPartyId:to,memo:'',createdAt:new Date(),cancelledAt:null},{id:from,expenseId:from,amount:2000,date:new Date('2026-09-10'),fromPartyId:from,toPartyId:to,memo:'',createdAt:new Date(),cancelledAt:new Date()}]});
  assert.equal(expense.amount,3000); assert.equal(expense.settledAmount,1000);
  const csv=expenseCsv([expense],[],{parties:[{id:from,name:'=Unsafe',kind:'shared',archived:false,version:1},{id:to,name:'Person',kind:'person',archived:false,version:1}],paymentSources:[]});
  assert.match(csv,/一部精算/);assert.match(csv,/'=Unsafe/);assert.match(csv,/"3000","1000","2000"/);
});
