import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { recurringOverview, RecurringRule } from '../lib/recurring';
import { compareMonths, MonthSnapshot } from '../lib/expense-comparison';
import { isProvisionalRule, isSampleRecord, confirmProvisionalFields, sampleBatch } from '../lib/sample-data';
import { settlementBatchSchema } from '../lib/settlement-batch';

test('recurring counts previous amounts, sorts actionables first, keeps completed history',()=>{
  const rule=(id:string,mode:string,reviewDay:number)=>({id,name:id,amountMode:mode,amount:mode==='fixed'?1000:null,reviewDay,reviewMonthOffset:0,startMonth:'2026-08',endMonth:null,frequency:'monthly',archived:false} as RecurringRule);
  const rules=[rule('fixed','fixed',20),rule('previous','previous',1),rule('variable','variable',30),rule('posted','previous',1),rule('skipped','fixed',1)];
  const occurrences=[{id:'1',ruleId:'posted',period:'2026-09',state:'posted' as const,expenseId:'x',version:1},{id:'2',ruleId:'skipped',period:'2026-09',state:'skipped' as const,expenseId:null,version:1}];
  const result=recurringOverview(rules,occurrences,'2026-09','2026-09-12');
  assert.equal(result.pendingCount,3);assert.equal(result.baseAmount,1000);assert.equal(result.amountCheckCount,2);
  assert.deepEqual(result.rows.map(r=>r.id),['previous','fixed','variable','posted','skipped']);
  assert.equal(recurringOverview([],[],'2026-09').pendingCount,0);
});
test('comparison handles missing months, cost classes, categories and zero denominator',()=>{
  const previous:MonthSnapshot={month:'2026-07',total:281876,count:40,sampleCount:40,summaryRemainder:0,costs:[{costClass:'fixed',amount:150408},{costClass:'variable',amount:120268},{costClass:'special',amount:11200},{costClass:'unknown',amount:0}],categories:[{categoryId:'a',name:'a',color:'#000000',amount:1000}]};
  const current={...previous,month:'2026-08',total:353444,count:45,costs:[{costClass:'fixed',amount:163736},{costClass:'variable',amount:137868},{costClass:'special',amount:51840},{costClass:'unknown',amount:0}],categories:[{...previous.categories[0],amount:1500}]};
  const result=compareMonths({current,previous});assert.equal(result.delta,71568);assert.equal(result.costs.reduce((s,c)=>s+c.delta,0),71568);assert.equal(result.categories[0].delta,500);
  assert.equal(compareMonths({current,previous:null}).available,false);
  assert.equal(compareMonths({current,previous:{...previous,total:0,count:0}}).percent,null);
});
test('sample and provisional markers remain distinct from access rules',()=>{
  const memo=sampleBatch+': 動作確認用の架空データです。実際の請求・支払・送金ではありません。 金額・日程は仮です。実際の請求内容へ変更して確定してください。';
  assert.equal(isSampleRecord({description:'【サンプル】食費',memo:''}),true);
  assert.equal(isSampleRecord({memo:'通常の支出'}),false);
  assert.equal(isProvisionalRule({name:'【仮】電気',memo:''}),true);
  const confirmed=confirmProvisionalFields({name:'【仮】電気',memo});assert.deepEqual(confirmed,{name:'電気',memo:''});assert.equal(isProvisionalRule(confirmed),false);
});
test('batch rejects duplicate allocations, extra identity, oversize and bad date',()=>{
  const input={date:'2026-09-12',memo:'',fromPartyId:randomUUID(),toPartyId:randomUUID(),entries:[{id:randomUUID(),expenseId:randomUUID(),expenseVersion:1,amount:10}]};
  assert.equal(settlementBatchSchema.safeParse(input).success,true);
  for(const invalid of [{...input,userId:randomUUID()},{...input,entries:[...input.entries,...input.entries]},{...input,entries:[]},{...input,date:'2026-02-30'},{...input,toPartyId:input.fromPartyId},{...input,entries:Array.from({length:51},()=>({...input.entries[0],id:randomUUID(),expenseId:randomUUID()}))}])assert.equal(settlementBatchSchema.safeParse(invalid).success,false);
});
