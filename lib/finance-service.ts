import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { dbSchema } from './database-schema';
import { BankAction, DebtAction, cardExpenseMonth } from './finance';
import { serializeCash } from './cash-movements';
import { monthRange } from './expenses';

const day=(value:Date)=>value.toISOString().slice(0,10);
// Callers hold the household advisory lock for every mutation.
export async function changeBank(tx:Prisma.TransactionClient,ledgerId:string,input:BankAction){
  if(input.action==='review'){
    const month=monthRange(input.month).gte;
    const old=await tx.cardMonthReview.findUnique({where:{userId_month:{userId:ledgerId,month}}});
    if((old?.version??0)!==input.version)throw new ApiError(409,'月の確認状況が変わりました。更新してください。');
    if(old)await tx.cardMonthReview.update({where:{id:old.id},data:{complete:input.complete,version:{increment:1},updatedAt:new Date()}});
    else await tx.$executeRaw`insert into ${dbSchema}.card_month_reviews(id,user_id,month,complete) values(${randomUUID()}::uuid,${ledgerId}::uuid,${month}::date,${input.complete})`;
    return;
  }
  if(input.action==='post'){
    if(new Set(input.entries.map(e=>e.id)).size!==input.entries.length||new Set(input.details.map(e=>e.id)).size!==input.details.length)throw new ApiError(400,'明細が重複しています。');
    const masters=await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,userId:ledgerId,method:'card',archived:false}});
    if(!masters||!await tx.party.findFirst({where:{id:masters.fundingPartyId??'',kind:'shared'}}))throw new ApiError(400,'共通資金のカードを選んでください。');
    const rows=await tx.cashMovement.findMany({where:{userId:ledgerId,id:{in:input.entries.map(e=>e.id)}}});
    if(rows.length!==input.entries.length)throw new ApiError(404,'明細が見つかりません。');
    const month=monthRange(input.month).gte;
    let summary=await tx.expenseSummary.findUnique({where:{userId_paymentSourceId_month:{userId:ledgerId,paymentSourceId:input.paymentSourceId,month}}});
    if(summary?.basis==='bank'&&rows.every(r=>r.summaryId===summary?.id)){
      const linked=await tx.expense.count({where:{id:{in:input.details.map(d=>d.id)},summaryId:summary.id}});
      if(linked!==input.details.length)throw new ApiError(409,'保存済みの内訳と異なります。');return;
    }
    if(rows.some(r=>r.voided||!r.importKey||r.kind!=='card_payment'||r.amount>=0||r.summaryId||r.version!==input.entries.find(e=>e.id===r.id)?.version))throw new ApiError(409,'未計上のカード引落を選び直してください。');
    if(rows.some(r=>cardExpenseMonth(day(r.date))!==input.month))throw new ApiError(400,'カード引落日の前月を計上月にしてください。');
    const details=await tx.expense.findMany({where:{id:{in:input.details.map(d=>d.id)},userId:ledgerId}});
    if(details.length!==input.details.length||details.some(d=>d.summaryId||d.paymentSourceId!==input.paymentSourceId||d.version!==input.details.find(e=>e.id===d.id)?.version))throw new ApiError(409,'内訳に含める支出を選び直してください。');
    const separate=await tx.expense.count({where:{userId:ledgerId,summaryId:null,paymentSourceId:input.paymentSourceId,ledgerDate:monthRange(input.month),id:{notIn:input.details.map(d=>d.id)}}});
    if(separate&&!input.keepSeparate)throw new ApiError(409,'同じ月・カードの支出が残っています。内訳へ含めるか、別の支出として残すことを確認してください。');
    for(const sourceId of new Set(rows.map(r=>r.paymentSourceId))){
      const source=await tx.paymentSource.findUnique({where:{id:sourceId}});
      if(!source||!await tx.party.findFirst({where:{id:source.fundingPartyId??'',kind:'shared'}}))throw new ApiError(400,'共通口座の明細だけを計上できます。');
    }
    if(summary&&summary.basis!=='bank')throw new ApiError(409,'同じ月・カードの手入力まとめ記録があります。重複を整理してから計上してください。');
    const amount=rows.reduce((sum,r)=>sum-r.amount,summary?.amount??0);
    if(amount>999999999)throw new ApiError(422,'まとめ記録の金額上限を超えています。');
    if(summary)await tx.expenseSummary.update({where:{id:summary.id},data:{amount,version:{increment:1},updatedAt:new Date()}});
    else{
      const id=randomUUID();
      await tx.$executeRaw`insert into ${dbSchema}.expense_summaries(id,user_id,payment_source_id,month,amount,name,basis,complete) values(${id}::uuid,${ledgerId}::uuid,${input.paymentSourceId}::uuid,${month}::date,${amount},'楽天カード（家計分）','bank',true)`;
      summary=await tx.expenseSummary.findUniqueOrThrow({where:{id}});
    }
    await tx.cashMovement.updateMany({where:{id:{in:rows.map(r=>r.id)},userId:ledgerId},data:{summaryId:summary.id,version:{increment:1},updatedAt:new Date()}});
    for(const detail of details)await tx.expense.update({where:{id:detail.id},data:{summaryId:summary.id,version:{increment:1},updatedAt:new Date()}});
    return;
  }
  const row=await tx.cashMovement.findFirst({where:{id:input.id,userId:ledgerId,voided:false}});
  if(!row)throw new ApiError(404,'入出金が見つかりません。');
  if(row.version!==input.version)throw new ApiError(409,'入出金が変更されています。更新してください。');
  if(input.action==='unlink'){
    if(!row.summaryId)return;
    const summary=await tx.expenseSummary.findUniqueOrThrow({where:{id:row.summaryId}});
    const details=await tx.expense.aggregate({where:{summaryId:summary.id},_sum:{amount:true},_count:true});
    const amount=summary.amount+row.amount;
    if((details._sum.amount??0)>amount||(!amount&&details._count))throw new ApiError(409,'先にまとめ記録の内訳を整理してください。');
    await tx.cashMovement.update({where:{id:row.id},data:{summaryId:null,version:{increment:1},updatedAt:new Date()}});
    if(amount)await tx.expenseSummary.update({where:{id:summary.id},data:{amount,version:{increment:1},updatedAt:new Date()}});
    else await tx.expenseSummary.delete({where:{id:summary.id}});
    return;
  }
  if(input.action==='unmatch'){
    await tx.cashMovement.update({where:{id:row.id},data:{matchedImportId:null,version:{increment:1},updatedAt:new Date()}});return;
  }
  const imported=await tx.cashMovement.findFirst({where:{id:input.importId,userId:ledgerId,voided:false}});
  if(!imported?.importKey||row.importKey||row.summaryId||row.matchedImportId||imported.version!==input.importVersion||row.paymentSourceId!==imported.paymentSourceId||row.amount!==imported.amount||day(row.date)!==day(imported.date))throw new ApiError(409,'同じ口座・日付・金額の手入力と明細を選んでください。');
  if(row.partyId&&imported.partyId&&row.partyId!==imported.partyId||row.kind!=='unknown'&&imported.kind!=='unknown'&&row.kind!==imported.kind)throw new ApiError(409,'関係者または種類が異なります。先に記録を確認してください。');
  await tx.cashMovement.update({where:{id:row.id},data:{matchedImportId:imported.id,version:{increment:1},updatedAt:new Date()}});
  await tx.cashMovement.update({where:{id:imported.id},data:{partyId:imported.partyId??row.partyId,kind:imported.kind==='unknown'?row.kind:imported.kind,version:{increment:1},updatedAt:new Date()}});
}

export async function readBank(tx:Prisma.TransactionClient,ledgerId:string,month:string){
  const pending={userId:ledgerId,voided:false,kind:'card_payment',amount:{lt:0},importKey:{not:null},summaryId:null};
  const rows=await tx.cashMovement.findMany({where:pending,orderBy:[{date:'desc'},{id:'asc'}],take:500});
  const review=await tx.cardMonthReview.findUnique({where:{userId_month:{userId:ledgerId,month:monthRange(month).gte}}});
  const amount=await tx.expenseSummary.aggregate({where:{userId:ledgerId,month:monthRange(month).gte,basis:'bank'},_sum:{amount:true}});
  const pairs=await tx.$queryRaw<{manualId:string;importId:string}[]>`select m.id as "manualId",i.id as "importId" from ${dbSchema}.cash_movements m join ${dbSchema}.cash_movements i
    on i.user_id=m.user_id and i.payment_source_id=m.payment_source_id and i.date=m.date and i.amount=m.amount
    where m.user_id=${ledgerId}::uuid and m.import_key is null and m.matched_import_id is null and not m.voided
      and i.import_key is not null and not i.voided and not exists(select 1 from ${dbSchema}.cash_movements x where x.user_id=m.user_id and x.matched_import_id=i.id)
    order by m.date desc,m.id,i.id limit 100`;
  const matchRows=await tx.cashMovement.findMany({where:{id:{in:pairs.flatMap(p=>[p.manualId,p.importId])}}});
  const matched=await tx.cashMovement.findMany({where:{userId:ledgerId,matchedImportId:{not:null}},orderBy:[{date:'desc'},{id:'asc'}],take:100});
  const details=await tx.expense.findMany({where:{userId:ledgerId,summaryId:null},orderBy:[{date:'desc'},{id:'asc'}],take:1000});
  return {details:details.map(d=>({id:d.id,version:d.version,date:day(d.date),paymentSourceId:d.paymentSourceId,amount:d.amount,name:d.description})),matched:matched.map(serializeCash),rows:rows.map(serializeCash),pendingCount:await tx.cashMovement.count({where:pending}),review:{complete:review?.complete??false,version:review?.version??0},amount:amount._sum.amount??0,
    matches:pairs.map(p=>({manual:serializeCash(matchRows.find(r=>r.id===p.manualId)!),imported:serializeCash(matchRows.find(r=>r.id===p.importId)!)}))};
}

export async function changeDebt(tx:Prisma.TransactionClient,ledgerId:string,input:DebtAction){
  if(input.action==='cancel'){
    const row=await tx.personalRepayment.findFirst({where:{id:input.id,userId:ledgerId}});
    if(!row)throw new ApiError(404,'返済記録が見つかりません。');
    if(row.cancelledAt)return;
    await tx.personalRepayment.update({where:{id:row.id},data:{cancelledAt:new Date()}});
    await tx.personalDebt.update({where:{id:row.debtId},data:{version:{increment:1},updatedAt:new Date()}});return;
  }
  const id=input.action==='repay'?input.debtId:input.id;
  const old=await tx.personalDebt.findFirst({where:{id,userId:ledgerId,voided:false}});
  if(input.action==='save'){
    const {action:_a,id:_i,version:_v,...fields}=input;
    if(input.debtorPartyId===input.creditorPartyId)throw new ApiError(400,'貸した人と借りた人は別の人を選んでください。');
    const parties=await tx.party.count({where:{id:{in:[input.debtorPartyId,input.creditorPartyId]},kind:'person',archived:false}});
    if(parties!==2)throw new ApiError(400,'使用中の人物を選んでください。');
    if(old&&input.version===0&&Object.entries(fields).every(([k,v])=>k==='date'?day(old.date)===v:old[k as keyof typeof old]===v))return;
    if((old?.version??0)!==input.version)throw new ApiError(409,'貸し借りが更新されています。');
    if(old)await tx.personalDebt.update({where:{id},data:{...fields,date:new Date(input.date+'T00:00:00Z'),version:{increment:1},updatedAt:new Date()}});
    else await tx.$executeRaw`insert into ${dbSchema}.personal_debts(id,user_id,date,name,amount,debtor_party_id,creditor_party_id,memo) values(${id}::uuid,${ledgerId}::uuid,${new Date(input.date+'T00:00:00Z')}::date,${input.name},${input.amount},${input.debtorPartyId}::uuid,${input.creditorPartyId}::uuid,${input.memo})`;
    return;
  }
  if(!old)throw new ApiError(404,'貸し借りが見つかりません。');
  if(input.action==='repay'){
    const paid=await tx.personalRepayment.findUnique({where:{id:input.id}});
    if(paid){if(paid.cancelledAt||paid.debtId!==id||paid.amount!==input.amount||day(paid.date)!==input.date||paid.paymentSourceId!==input.paymentSourceId||paid.memo!==input.memo)throw new ApiError(409,'保存済みの返済と異なります。');return;}
  }
  if(old.version!==input.version)throw new ApiError(409,'貸し借りが更新されています。');
  if(input.action==='void')await tx.personalDebt.update({where:{id},data:{voided:true,version:{increment:1},updatedAt:new Date()}});
  else{
    const source=await tx.paymentSource.findFirst({where:{id:input.paymentSourceId,fundingPartyId:old.debtorPartyId,archived:false}});
    const paid=await tx.personalRepayment.aggregate({where:{debtId:id,cancelledAt:null},_sum:{amount:true}});
    if(!source||input.amount>old.amount-(paid._sum.amount??0))throw new ApiError(400,'返済元と残りの金額を確認してください。');
    await tx.$executeRaw`insert into ${dbSchema}.personal_repayments(id,user_id,debt_id,amount,date,payment_source_id,memo) values(${input.id}::uuid,${ledgerId}::uuid,${id}::uuid,${input.amount},${new Date(input.date+'T00:00:00Z')}::date,${source.id}::uuid,${input.memo})`;
    await tx.personalDebt.update({where:{id},data:{version:{increment:1},updatedAt:new Date()}});
  }
}
