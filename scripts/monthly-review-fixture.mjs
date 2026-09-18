// Synthetic fixture; callers use the disposable loopback API only.
import { randomUUID } from 'node:crypto';
export async function seedReview(req, month) {
  const masters=await req('/api/masters'), self=masters.selfPartyId;
  const source=masters.paymentSources.find(s=>s.isDefault), shared=masters.parties.find(p=>p.systemKey==='shared');
  const otherSource=masters.paymentSources.find(s=>s.fundingPartyId===shared.id&&s.id!==source.id);
  const expense={amount:2300,date:month,categoryId:'food',description:'支払方法を確認する買い物',memo:'',paymentSourceId:source.id,paidByPartyId:shared.id,usedByPartyId:self,beneficiaryKind:'family',paymentTreatment:'review',reimbursementStatus:'unknown'};
  const createExpense=(patch={})=>req('/api/expenses','POST',{...expense,...patch,id:randomUUID()},201);
  const payment=await createExpense();
  const sample=await createExpense({description:'【サンプル】確認対象外',memo:'famfi-sample-summer-2026-v1'});
  const actual=await createExpense({amount:1000,description:'まとめ記録の明細',paymentTreatment:'shared',reimbursementStatus:'not_required'});
  const summary=await req('/api/summaries','POST',{id:randomUUID(),name:'後から整理するカード分',month,amount:10000,paymentSourceId:source.id,complete:false},201);
  await req('/api/summaries/'+summary.id,'POST',{action:'link',version:summary.version,expenseId:actual.id,expenseVersion:actual.version});
  const complete=await req('/api/summaries','POST',{id:randomUUID(),name:'まとめ記録で完了する分',month,amount:8000,paymentSourceId:otherSource.id,complete:true},201);
  const fields={name:'毎月の電気代',amountMode:'fixed',amount:1000,frequency:'monthly',startMonth:month,endMonth:month,dueDay:null,reviewDay:1,categoryId:'utilities',paymentSourceId:source.id,paymentTreatment:'shared',usedByPartyId:self,beneficiaryKind:'family',costClass:'fixed'};
  const createRule=(patch={})=>req('/api/recurring','POST',{...fields,...patch,id:randomUUID()},201);
  const rule=await createRule(),snoozed=await createRule({name:'延期したガス代'}),skipped=await createRule({name:'スキップ済みの通信費'}),posted=await createRule({name:'確定済みの保険料'});
  const occurrence=(r,action,extra={})=>req('/api/recurring/'+r.id+'/occurrences','POST',{period:month,ruleVersion:r.version,occurrenceVersion:0,action,...extra});
  await occurrence(snoozed,'snooze',{until:'2099-12-31'});
  await occurrence(skipped,'skip');
  await occurrence(posted,'post',{expenseId:randomUUID(),expense:{...expense,paymentTreatment:'shared',reimbursementStatus:'not_required',description:'確定済み',amount:1000}});
  await createRule({name:'停止済み',archived:true});
  const oldDate=new Date(month+'-01T00:00:00Z');oldDate.setUTCMonth(oldDate.getUTCMonth()-1);const previous=oldDate.toISOString().slice(0,7);
  const oldRule=await createRule({name:'前の月の確認待ち',startMonth:previous,endMonth:previous});
  const createPlan=(patch={})=>req('/api/plans','POST',{id:randomUUID(),name:'家族の誕生日プレゼント',date:month+'-04',...patch},201);
  const plan=await createPlan(),futurePlan=await createPlan({name:'確認日を待つ予定',date:month,reviewAfter:'2099-12-31'}),cancelled=await createPlan({name:'中止済みの予定'});
  await req('/api/plans/'+cancelled.id,'POST',{action:'cancel',version:cancelled.version});
  const oldPlan=await createPlan({name:'別の月の予定',date:previous});
  return {month,previous,masters,expense,payment,sample,actual,summary,complete,rule,snoozed,skipped,posted,oldRule,plan,futurePlan,oldPlan};
}
