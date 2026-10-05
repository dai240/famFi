import { z } from 'zod';
import { monthSchema, shiftMonth, todayInJapan } from './expenses';

export const summaryPeriods = { month:'月別', three:'3か月', six:'6か月', year:'年別', all:'全期間', deposit:'前回入金以降' } as const;
export const summaryQuery = z.object({
  period:z.enum(['month','three','six','year','all','deposit']).default('three'),
  month:monthSchema.default(() => todayInJapan().slice(0,7)), source:z.string().uuid().optional(),
  detail:z.enum(['expenses','incoming','outgoing','funding','unknown']).optional(), party:z.string().uuid().optional(),
  page:z.coerce.number().int().min(1).max(2000).default(1), export:z.literal('csv').optional(),
}).strict();
export type SummaryQuery = z.infer<typeof summaryQuery>;
export type SummaryRange = { from:string; to:string; expenseFrom:string; expenseTo:string; available:boolean };
export type Deposit = { date:string; amount:number; count:number };
export type SummaryMonth = { month:string; expenses:number; expenseCount:number; incoming:number; outgoing:number; cashCount:number; deposits:number; unknown:number; otherIncoming:number; cardConfirmed:boolean };
export type SummaryPerson = { id:string; name:string; deposits:number; direct:number; refunds:number; waived:number; total:number; lastDeposit:Deposit|null };
export type SummaryResponse = {
  range:SummaryRange; today:string; sourceId:string|null;
  records:{from:string|null;to:string|null}; imports:{from:string|null;to:string|null};
  lastDeposit:Deposit|null; sinceDeposit:{incoming:number;outgoing:number;count:number}|null;
  months:SummaryMonth[]; people:SummaryPerson[];
  totals:{expenses:number;expenseCount:number;incoming:number;outgoing:number;cashCount:number;deposits:number;unknown:number;otherIncoming:number;unknownCount:number};
  average:{amount:number|null;months:number;eligible:number};
};
export type SummaryDetail = { id:string; date:string; amount:number; name:string; kind:string; partyId:string|null; sourceId:string|null; expenseId:string|null };
export type SummaryDetails = { rows:SummaryDetail[]; count:number; range:SummaryRange };

const iso = (d:Date) => d.toISOString().slice(0,10);
export function nextDay(day:string) { return iso(new Date(new Date(day+'T00:00:00Z').getTime()+86400000)); }
export function previousDay(day:string) { return iso(new Date(new Date(day+'T00:00:00Z').getTime()-86400000)); }
export function summaryRange(query:Pick<SummaryQuery,'period'|'month'>, bounds:{from:string|null;to:string|null;lastDeposit:string|null}, today=todayInJapan()):SummaryRange {
  let from=query.month+'-01', to=shiftMonth(query.month,1)+'-01', available=true;
  if(query.period==='three'||query.period==='six') from=shiftMonth(query.month,query.period==='three'?-2:-5)+'-01';
  if(query.period==='year') { from=query.month.slice(0,4)+'-01-01';to=String(Number(query.month.slice(0,4))+1)+'-01-01'; }
  if(query.period==='all') { available=Boolean(bounds.from);from=bounds.from??today;to=nextDay(bounds.to??today); }
  if(query.period==='deposit') { available=Boolean(bounds.lastDeposit);from=bounds.lastDeposit??today;to=nextDay(today); }
  from=from<'2000-01-01'?'2000-01-01':from;
  return {from,to,expenseFrom:from.slice(0,7)+'-01',expenseTo:shiftMonth(previousDay(to).slice(0,7),1)+'-01',available};
}
export function summaryMonths(range:SummaryRange) {
  if(!range.available)return [];
  const months:string[]=[];
  for(let month=range.expenseFrom.slice(0,7);month<range.expenseTo.slice(0,7);month=shiftMonth(month,1)) months.push(month);
  return months;
}
export function confirmedAverage(months:SummaryMonth[],today:string) {
  const eligible=months.filter(m=>m.month<today.slice(0,7));
  const confirmed=eligible.filter(m=>m.cardConfirmed&&m.expenseCount>0);
  return {amount:confirmed.length?Math.round(confirmed.reduce((s,m)=>s+m.expenses,0)/confirmed.length):null,months:confirmed.length,eligible:eligible.length};
}
