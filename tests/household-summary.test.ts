import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedAverage, nextDay, previousDay, summaryMonths, summaryQuery, summaryRange, SummaryMonth } from '../lib/household-summary';
const bounds={from:'2024-01-15',to:'2026-09-28',lastDeposit:'2026-07-15'};
test('summary periods use explicit month, year and recorded ranges',()=>{
  const range=(period:Parameters<typeof summaryRange>[0]['period'],month='2026-09')=>summaryRange({period,month},bounds,'2026-10-05');
  assert.equal(range('three').from,'2026-07-01');assert.equal(range('six').from,'2026-04-01');
  assert.equal(range('year').from,'2026-01-01');assert.equal(range('year').to,'2027-01-01');
  assert.equal(range('all').from,'2024-01-15');assert.equal(range('all').to,'2026-09-29');
  assert.deepEqual(range('deposit'),{from:'2026-07-15',to:'2026-10-06',expenseFrom:'2026-07-01',expenseTo:'2026-11-01',available:true});
  assert.equal(range('six','2000-01').from,'2000-01-01');assert.equal(range('year','2099-12').to,'2100-01-01');
  assert.deepEqual(summaryMonths(range('three')),['2026-07','2026-08','2026-09']);
  assert.equal(nextDay('2024-02-28'),'2024-02-29');assert.equal(previousDay('2024-03-01'),'2024-02-29');
});
test('missing deposits and missing records do not invent a reporting period',()=>{
  for(const period of ['all','deposit'] as const){const r=summaryRange({period,month:'2026-10'},{from:null,to:null,lastDeposit:null},'2026-10-05');assert.equal(r.available,false);assert.deepEqual(summaryMonths(r),[]);}
});
test('averages exclude missing, unconfirmed, current and future months',()=>{
  const month=(m:string,amount:number,count:number,confirmed:boolean):SummaryMonth=>({month:m,expenses:amount,expenseCount:count,cardConfirmed:confirmed,incoming:0,outgoing:0,cashCount:0,deposits:0,unknown:0,otherIncoming:0});
  const rows=[month('2026-06',100,1,true),month('2026-07',900,1,false),month('2026-08',0,0,true),month('2026-09',300,1,true),month('2026-10',9000,1,true),month('2026-11',9000,1,true)];
  assert.deepEqual(confirmedAverage(rows,'2026-10-05'),{amount:200,months:2,eligible:4});
  assert.equal(confirmedAverage([rows[1]],'2026-10-05').amount,null);
});
test('summary query rejects scope overrides and invalid options',()=>{
  for(const query of [{userId:'x'},{ledgerId:'x'},{month:'2026-13'},{period:'balance'},{page:0},{page:2001},{source:'public'},{party:'unknown'},{export:'json'}])assert.equal(summaryQuery.safeParse(query).success,false);
  assert.equal(summaryQuery.parse({period:'deposit'}).period,'deposit');
});
