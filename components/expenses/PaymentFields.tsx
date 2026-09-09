'use client';
import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpenseFields, formatYen } from '@/lib/expenses';
import { Masters, treatmentLabels } from '@/lib/ledger';
import { paymentSourceGroups, paymentSuggestion, paymentSummary, personLabel } from '@/lib/household';
import { ReferenceSelect } from './ReferenceSelect';

export function PaymentFields({fields,masters,onChange,disabled=false,financialLocked=false,onManage,recurring=false}:{
  fields:ExpenseFields;masters:Masters;onChange:(patch:Partial<ExpenseFields>)=>void;disabled?:boolean;financialLocked?:boolean;
  onManage?:(kind:'parties'|'payment-sources')=>void;recurring?:boolean;
}) {
  const [buyerOther,setBuyerOther]=useState(Boolean(fields.usedByText));
  const parties=(selected:string|null,people=false)=>masters.parties.filter(p=>(!people||p.kind==='person')&&(!p.archived||p.id===selected)).map(p=>({...p,name:personLabel(p.id,masters,true)}));
  const source=masters.paymentSources.find(p=>p.id===fields.paymentSourceId);
  const personal=masters.parties.find(p=>p.id===source?.fundingPartyId)?.kind==='person';
  const modes=(personal?['advance','direct','review','custom']:['shared','review','custom']).filter(m=>!recurring||m!=='custom');
  if(fields.paymentTreatment==='legacy')modes.unshift('legacy');
  const paymentDisabled=disabled||financialLocked;
  return <div className="expense-details payment-fields">
    <div className="field-heading"><label htmlFor="expense-payment">支払元</label>{onManage&&<Button type="button" size="icon" variant="ghost" title="支払元を管理" aria-label="支払元を管理" disabled={disabled} onClick={()=>onManage('payment-sources')}><Settings2 /></Button>}</div>
    <ReferenceSelect id="expense-payment" label="支払元" value={fields.paymentSourceId} disabled={paymentDisabled} allowEmpty={false} emptyLabel="選択してください" options={[]} groups={paymentSourceGroups(masters,fields.paymentSourceId)} onChange={id=>onChange(paymentSuggestion(masters,id,fields.amount))} />
    <label htmlFor="expense-treatment">支払いの扱い</label><ReferenceSelect id="expense-treatment" label="支払いの扱い" value={fields.paymentTreatment} allowEmpty={false} disabled={paymentDisabled} options={modes.map(id=>({id,name:treatmentLabels[id as keyof typeof treatmentLabels]}))} onChange={mode=>{if(mode&&mode!=='legacy')onChange(paymentSuggestion(masters,fields.paymentSourceId,fields.amount,mode as ExpenseFields['paymentTreatment']));}} />
    {source&&<div className={`payment-outcome ${fields.paymentTreatment}`} role="status"><span>資金：{personLabel(source.fundingPartyId,masters)}</span><strong>{paymentSummary(fields,masters)}{fields.reimbursementStatus==='required'&&!recurring&&` ${formatYen(fields.reimbursementAmount)}`}</strong></div>}
    <div className="field-heading"><label htmlFor="expense-used-by">購入・支払いをした人</label>{onManage&&<Button type="button" size="icon" variant="ghost" title="人物を管理" aria-label="人物を管理" disabled={disabled} onClick={()=>onManage('parties')}><Settings2 /></Button>}</div>
    <ReferenceSelect id="expense-used-by" label="購入・支払いをした人" value={buyerOther?'other':fields.usedByPartyId} disabled={disabled} allowEmpty={false} emptyLabel="選択してください" options={[...parties(fields.usedByPartyId,true),{id:'other',name:'その他'}]} onChange={id=>{setBuyerOther(id==='other');onChange({usedByPartyId:id==='other'?null:id,usedByText:''});}} />
    {buyerOther&&<input aria-label="購入・支払いをした人の名前" required maxLength={80} value={fields.usedByText} disabled={disabled} onChange={e=>onChange({usedByText:e.target.value})} />}
    <label htmlFor="expense-beneficiary">誰のため</label><ReferenceSelect id="expense-beneficiary" label="誰のため" value={fields.beneficiaryKind==='party'?fields.beneficiaryPartyId:fields.beneficiaryKind==='unknown'?null:fields.beneficiaryKind} disabled={disabled} allowEmpty={false} emptyLabel="選択してください" options={[{id:'family',name:'家族'},...parties(fields.beneficiaryPartyId,true),{id:'other',name:'その他'}]} onChange={id=>onChange({beneficiaryKind:id==='family'?'family':id==='other'?'other':'party',beneficiaryPartyId:id==='family'||id==='other'?null:id,beneficiaryText:''})} />
    {fields.beneficiaryKind==='other'&&<input aria-label="誰のための支出か" required maxLength={80} value={fields.beneficiaryText} disabled={disabled} onChange={e=>onChange({beneficiaryText:e.target.value})} />}
    {fields.paymentTreatment==='custom'&&<>
      <label htmlFor="expense-reimbursement">精算の要否</label><ReferenceSelect id="expense-reimbursement" label="精算の要否" value={fields.reimbursementStatus} disabled={paymentDisabled} allowEmpty={false} options={[{id:'unknown',name:'あとで確認'},{id:'not_required',name:'精算不要'},{id:'required',name:'精算が必要'}]} onChange={status=>{if(status)onChange({reimbursementStatus:status as ExpenseFields['reimbursementStatus'],reimbursementAmount:status==='required'?fields.amount:0,reimbursementFromPartyId:null,reimbursementToPartyId:null});}} />
      {fields.reimbursementStatus==='required'&&<><label htmlFor="expense-from">返す側</label><ReferenceSelect id="expense-from" label="返す側" value={fields.reimbursementFromPartyId} disabled={paymentDisabled} options={parties(fields.reimbursementFromPartyId)} onChange={id=>onChange({reimbursementFromPartyId:id})} /><label htmlFor="expense-to">受け取る側（立替者）</label><ReferenceSelect id="expense-to" label="受け取る側（立替者）" value={fields.reimbursementToPartyId} disabled={paymentDisabled} options={parties(fields.reimbursementToPartyId)} onChange={id=>onChange({reimbursementToPartyId:id})} /></>}
    </>}
    {fields.reimbursementStatus==='required'&&!recurring&&<><div className="field-heading"><label htmlFor="expense-reimbursement-amount">精算対象額（円）</label><Button type="button" variant="ghost" disabled={paymentDisabled} onClick={()=>onChange({reimbursementAmount:fields.amount})}>全額</Button></div><input id="expense-reimbursement-amount" type="text" inputMode="numeric" pattern="[0-9]+" maxLength={9} required value={fields.reimbursementAmount||''} disabled={paymentDisabled} onChange={e=>{if(/^\d*$/.test(e.target.value))onChange({reimbursementAmount:Number(e.target.value)});}} /></>}
    {financialLocked&&<p className="muted-text">精算記録あり。金額・支払元・精算対象の変更は精算取消後に可能です。</p>}
  </div>;
}
