import 'server-only';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { dbSchema } from './database-schema';
import { databaseEnvironment } from './database-environment';
import { readMasters } from './expense-service';
import { fundingQuery } from './funding-query';
import { csvCell, todayInJapan } from './expenses';
import { confirmedAverage, Deposit, nextDay, previousDay, SummaryDetail, SummaryDetails, SummaryQuery, summaryMonths, SummaryResponse, summaryRange } from './household-summary';

const day = (date:Date|null) => date?.toISOString().slice(0,10)??null;
const sum = <T,>(rows:T[],value:(row:T)=>number) => rows.reduce((total,row)=>total+value(row),0);

export async function readHouseholdSummary(tx:Prisma.TransactionClient,ledgerId:string,query:SummaryQuery):Promise<SummaryResponse|SummaryDetails|string> {
  // All financial writers use the exclusive household lock. Keep this multi-query read consistent.
  await tx.$queryRaw`select pg_advisory_xact_lock_shared(hashtextextended(${databaseEnvironment().schema+'-ledger:'+ledgerId},0))::text`;
  const masters=await readMasters(tx),today=todayInJapan();
  const banks=masters.paymentSources.filter(p=>p.method==='bank'&&masters.parties.some(f=>f.id===p.fundingPartyId&&f.kind==='shared'));
  const source=query.source?banks.find(p=>p.id===query.source):banks.find(p=>!p.archived)??banks[0];
  if(query.source&&!source)throw new ApiError(404,'共通口座が見つかりません。');
  if(query.party&&!masters.parties.some(p=>p.id===query.party&&p.kind==='person'))throw new ApiError(404,'人物が見つかりません。');
  if(query.party&&query.detail!=='funding')throw new ApiError(400,'人物の指定は負担の明細で使用してください。');
  const sourceId=source?.id??null;
  const base=Prisma.sql`with ${fundingQuery(ledgerId)},
    expense_units as (
      select e.id,e.ledger_date as date,e.amount,coalesce(nullif(e.description,''),c.name) as name,'expense' as kind,
        e.paid_by_party_id as "partyId",e.payment_source_id as "sourceId",e.id as "expenseId"
      from ${dbSchema}.expenses e join ${dbSchema}.category_entries c on c.user_id=e.user_id and c.id=e.category_id where e.user_id=${ledgerId}::uuid
      union all
      select s.id,s.month,greatest(0,s.amount-coalesce(d.amount,0))::bigint,s.name,'summary',null::uuid,s.payment_source_id,null::uuid
      from ${dbSchema}.expense_summaries s left join (
        select summary_id,sum(amount) as amount from ${dbSchema}.expenses where user_id=${ledgerId}::uuid and summary_id is not null group by summary_id
      ) d on d.summary_id=s.id where s.user_id=${ledgerId}::uuid and s.amount>coalesce(d.amount,0)
    ), cash as (
      select * from ${dbSchema}.cash_movements where user_id=${ledgerId}::uuid and payment_source_id=${sourceId}::uuid and not voided and matched_import_id is null
    ), selected_funding as (
      select * from funding where "partyId" is not null and (kind<>'deposit' or "sourceId"=${sourceId}::uuid)
    )`;
  const [meta]=await tx.$queryRaw<{from:Date|null;to:Date|null;importFrom:Date|null;importTo:Date|null}[]>(Prisma.sql`${base}
    select (select min(date) from (select date from expense_units union all select date from cash union all select date from selected_funding) d) as "from",
      (select max(date) from (select date from expense_units union all select date from cash union all select date from selected_funding) d) as "to",
      (select min(date) from cash where import_key is not null) as "importFrom",
      (select max(date) from cash where import_key is not null) as "importTo"`);
  const latestDeposits=await tx.$queryRaw<{partyId:string|null;date:Date;amount:bigint;count:number}[]>(Prisma.sql`${base},
    deposits as (select * from cash where kind='contribution' and party_id is not null and amount>0 and date<=${today}::date),
    latest as (select party_id,max(date) date from deposits group by party_id)
    select null::uuid as "partyId",date,sum(amount)::bigint amount,count(*)::int count from deposits where date=(select max(date) from deposits) group by date
    union all select d.party_id,d.date,sum(d.amount)::bigint,count(*)::int from deposits d join latest l on l.party_id=d.party_id and l.date=d.date group by d.party_id,d.date`);
  const asDeposit=(row:typeof latestDeposits[number]|undefined):Deposit|null => row?{date:day(row.date)!,amount:Number(row.amount),count:row.count}:null;
  const lastDeposit=asDeposit(latestDeposits.find(d=>d.partyId===null));
  const range=summaryRange(query,{from:day(meta.from),to:day(meta.to),lastDeposit:lastDeposit?.date??null},today);
  const expenseDates=Prisma.sql`date>=${range.expenseFrom}::date and date<${range.expenseTo}::date`;
  const cashDates=Prisma.sql`date>=${range.from}::date and date<${range.to}::date`;
  const fundingDates=Prisma.sql`((kind='direct' and ${expenseDates}) or (kind<>'direct' and ${cashDates}))`;

  if(query.detail){
    const detail=query.detail;
    const units=detail==='expenses'?Prisma.sql`select * from expense_units where ${expenseDates}`:
      detail==='funding'?Prisma.sql`select * from selected_funding where ${fundingDates} ${query.party?Prisma.sql`and "partyId"=${query.party}::uuid`:Prisma.empty}`:
      Prisma.sql`select id,date,amount,description as name,kind,party_id as "partyId",payment_source_id as "sourceId",null::uuid as "expenseId" from cash
        where ${cashDates} and ${detail==='outgoing'?Prisma.sql`amount<0`:Prisma.sql`amount>0`}
        ${detail==='unknown'?Prisma.sql`and (kind='unknown' or (kind='contribution' and party_id is null))`:Prisma.empty}`;
    const filtered=Prisma.sql`${base}, details as (${units})`;
    const [count]=await tx.$queryRaw<{n:number}[]>(Prisma.sql`${filtered} select count(*)::int n from details where ${range.available}`);
    if(query.export&&count.n>100000)throw new ApiError(422,'出力件数の上限を超えています。期間を絞ってください。');
    const raw=await tx.$queryRaw<(Omit<SummaryDetail,'date'|'amount'>&{date:Date;amount:bigint|number})[]>(Prisma.sql`${filtered}
      select * from details where ${range.available} order by date desc,id,kind limit ${query.export?100000:50} offset ${query.export?0:(query.page-1)*50}`);
    const rows=raw.map(r=>({...r,date:day(r.date)!,amount:Number(r.amount)}));
    if(query.export)return csv([
      ['期間開始','期間終了','支出計上月開始','支出計上月終了','対象口座'],
      [range.from,previousDay(range.to),range.expenseFrom.slice(0,7),previousDay(range.expenseTo).slice(0,7),source?.name??'未設定'],
      ['日付（支出・直接負担は計上日）','種類','内容','人物','金額','支払元','ID'],
      ...rows.map(r=>[r.date,detail==='funding'?fundingLabels[r.kind]:detail==='expenses'?(r.kind==='summary'?'まとめの未配分額':'支出'):r.amount>0?'入金':'出金',r.name,
        masters.parties.find(p=>p.id===r.partyId)?.name??'不明',r.amount,masters.paymentSources.find(p=>p.id===r.sourceId)?.name??'',r.id]),
    ]);
    return {rows,count:count.n,range};
  }

  const expenses=await tx.$queryRaw<{month:string;amount:bigint;count:number}[]>(Prisma.sql`${base}
    select to_char(date,'YYYY-MM') as "month",sum(amount)::bigint amount,count(*)::int count from expense_units where ${expenseDates} and ${range.available} group by 1`);
  const cash=await tx.$queryRaw<{month:string;incoming:bigint;outgoing:bigint;count:number;deposits:bigint;unknown:bigint;other:bigint;unknownCount:number}[]>(Prisma.sql`${base}
    select to_char(date,'YYYY-MM') as "month",coalesce(sum(amount) filter(where amount>0),0)::bigint incoming,
      coalesce(-sum(amount) filter(where amount<0),0)::bigint outgoing,count(*)::int count,
      coalesce(sum(amount) filter(where amount>0 and kind='contribution' and party_id is not null),0)::bigint deposits,
      coalesce(sum(amount) filter(where amount>0 and (kind='unknown' or(kind='contribution' and party_id is null))),0)::bigint unknown,
      coalesce(sum(amount) filter(where amount>0 and kind not in('contribution','unknown')),0)::bigint other,
      count(*) filter(where amount>0 and (kind='unknown' or(kind='contribution' and party_id is null)))::int as "unknownCount"
    from cash where ${cashDates} and ${range.available} group by 1`);
  const funding=await tx.$queryRaw<{partyId:string|null;kind:string;amount:bigint}[]>(Prisma.sql`${base}
    select "partyId",kind,sum(amount)::bigint amount from selected_funding where ${fundingDates} and ${range.available} group by 1,2`);
  const reviews=await tx.cardMonthReview.findMany({where:{userId:ledgerId,complete:true,month:{gte:new Date(range.expenseFrom),lt:new Date(range.expenseTo)}}});
  const months=summaryMonths(range).map(month=>{
    const e=expenses.find(r=>r.month===month),c=cash.find(r=>r.month===month);
    return {month,expenses:Number(e?.amount??0),expenseCount:e?.count??0,incoming:Number(c?.incoming??0),outgoing:Number(c?.outgoing??0),cashCount:c?.count??0,
      deposits:Number(c?.deposits??0),unknown:Number(c?.unknown??0),otherIncoming:Number(c?.other??0),cardConfirmed:reviews.some(r=>day(r.month)!.slice(0,7)===month)};
  });
  const people=masters.parties.filter(p=>p.kind==='person').map(p=>{
    const amount=(kind:string)=>Number(funding.find(f=>f.partyId===p.id&&f.kind===kind)?.amount??0);
    const [deposits,direct,refunds,waived]=['deposit','direct','refund','contribution'].map(amount);
    return {id:p.id,name:p.name,deposits,direct,refunds,waived,total:deposits+direct+refunds+waived,lastDeposit:asDeposit(latestDeposits.find(d=>d.partyId===p.id))};
  });
  let sinceDeposit:SummaryResponse['sinceDeposit']=null;
  if(lastDeposit){
    const [row]=await tx.$queryRaw<{incoming:bigint;outgoing:bigint;count:number}[]>(Prisma.sql`${base}
      select coalesce(sum(amount) filter(where amount>0),0)::bigint incoming,coalesce(-sum(amount) filter(where amount<0),0)::bigint outgoing,count(*)::int count
      from cash where date>=${lastDeposit.date}::date and date<${nextDay(today)}::date`);
    sinceDeposit={incoming:Number(row.incoming),outgoing:Number(row.outgoing),count:row.count};
  }
  const response:SummaryResponse={range,today,sourceId,records:{from:day(meta.from),to:day(meta.to)},imports:{from:day(meta.importFrom),to:day(meta.importTo)},lastDeposit,sinceDeposit,months,people,
    totals:{expenses:sum(months,m=>m.expenses),expenseCount:sum(months,m=>m.expenseCount),incoming:sum(months,m=>m.incoming),outgoing:sum(months,m=>m.outgoing),cashCount:sum(months,m=>m.cashCount),
      deposits:sum(months,m=>m.deposits),unknown:sum(months,m=>m.unknown),otherIncoming:sum(months,m=>m.otherIncoming),unknownCount:sum(cash,r=>r.unknownCount)},average:confirmedAverage(months,today)};
  if(!query.export)return response;
  return csv([
    ['口座の期間開始','口座の期間終了','支出の計上月開始','支出の計上月終了','対象口座','銀行取込明細の最終日（全期間の網羅性は未確認）'],
    [range.from,previousDay(range.to),range.expenseFrom.slice(0,7),previousDay(range.expenseTo).slice(0,7),source?.name??'未設定',response.imports.to??'未取込'],
    ['月','家計支出（登録分）','個別・未配分記録数','口座入金','口座出金','入出金差額（残高ではない）','家族の入金','未確認入金','その他入金','カード分の確認'],
    ...months.map(m=>[m.month,m.expenses,m.expenseCount,m.incoming,m.outgoing,m.incoming-m.outgoing,m.deposits,m.unknown,m.otherIncoming,m.cardConfirmed?'確認済み':'未確認']),
    [],['人物','口座入金','直接負担','個人資金から返金','返金不要に変更','負担合計','最終入金日（今日までの全期間）','最終入金日合計'],
    ...people.map(p=>[p.name,p.deposits,p.direct,p.refunds,p.waived,p.total,p.lastDeposit?.date??'',p.lastDeposit?.amount??'']),
    [],['カード確認済み月の支出平均（登録分）','対象月数','過去月数'],[response.average.amount??'未算出',response.average.months,response.average.eligible],
  ]);
}
const fundingLabels:Record<string,string>={deposit:'口座への入金',direct:'直接負担',refund:'個人資金から返金',contribution:'返金不要に変更'};
function csv(rows:(string|number)[][]){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
