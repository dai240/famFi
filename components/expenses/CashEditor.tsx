'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { History, LoaderCircle, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CashFields, CashKind, CashRecord, cashFields, cashKinds, cashKindMatchesAmount, validCashFields } from '@/lib/cash-movements';
import { todayInJapan } from '@/lib/expenses';
import { Masters } from '@/lib/ledger';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { HistoryView } from './HistoryView';

export function CashEditor({row,masters,onClose,onSaved}:{row:CashRecord|null;masters:Masters;onClose:()=>void;onSaved:()=>void}) {
  const sources=masters.paymentSources.filter(s=>s.method==='bank'&&(!s.archived||s.id===row?.paymentSourceId));
  const [id]=useState(()=>row?.id??crypto.randomUUID()), [version,setVersion]=useState(row?.version??1);
  const [fields,setFields]=useState<CashFields>(()=>row?cashFields.strip().parse(row):{
    paymentSourceId:sources.find(s=>masters.parties.some(p=>p.id===s.fundingPartyId&&p.kind==='shared'))?.id??sources[0]?.id??'',
    date:todayInJapan(),amount:0,kind:'unknown',description:'',memo:'',partyId:null,
  });
  const [direction,setDirection]=useState(row&&row.amount>0?'in':'out');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [conflict,setConflict]=useState(false), [history,setHistory]=useState(false);
  const lock=useRef(false),baseline=useRef(JSON.stringify(fields));
  const dirty=JSON.stringify(fields)!==baseline.current;
  const patch=(change:Partial<CashFields>)=>setFields(old=>({...old,...change}));
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  function close(){if(!busy&&(!dirty||window.confirm('入力中の変更を破棄しますか？')))onClose();}
  async function mutate(action:()=>Promise<unknown>){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setConflict(false);
    try{await action();onSaved();}catch(e){setError(errorMessage(e));setConflict(e instanceof RequestError&&e.status===409);}finally{lock.current=false;setBusy(false);}
  }
  function save(e:FormEvent){
    e.preventDefault();const parsed=validCashFields.safeParse(fields);
    if(!parsed.success){setError(parsed.error.issues[0]?.message??'入力内容を確認してください。');return;}
    void mutate(()=>requestJson(row?'/api/cash-movements/'+id:'/api/cash-movements',{method:row?'PUT':'POST',body:JSON.stringify({...parsed.data,...(row?{version}:{id})})}));
  }
  async function reload(){
    if(lock.current||!window.confirm('入力中の変更を破棄し、最新の入出金を読み込みますか？'))return;
    lock.current=true;setBusy(true);
    try{const latest=await requestJson<CashRecord>('/api/cash-movements/'+id),next=cashFields.strip().parse(latest);setFields(next);setVersion(latest.version);setDirection(latest.amount>0?'in':'out');baseline.current=JSON.stringify(next);setError('');setConflict(false);}catch(e){setError(errorMessage(e));}finally{lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()}>
    <DialogHeader><DialogTitle>{row?'入出金を編集':'入出金を記録'}</DialogTitle><DialogDescription>{row?.imported?'銀行明細からの記録':'手入力'}</DialogDescription></DialogHeader>
    <form id={'cash-'+id} className="expense-form cash-form" onSubmit={save}>
      <fieldset disabled={busy||row?.imported}><legend>入出金</legend><div className="date-mode" role="radiogroup" aria-label="記録する入出金">{[['out','出金'],['in','入金']].map(([value,label])=><label key={value}><input type="radio" name="cash-direction" checked={direction===value} onChange={()=>{setDirection(value);const amount=Math.abs(fields.amount)*(value==='in'?1:-1);patch({amount,kind:cashKindMatchesAmount(fields.kind,value==='in'?1:-1)?fields.kind:'unknown'});}} /><span>{label}</span></label>)}</div></fieldset>
      <label htmlFor="cash-source">口座</label><select id="cash-source" required value={fields.paymentSourceId} disabled={busy||row?.imported} onChange={e=>patch({paymentSourceId:e.target.value})}><option value="" disabled>口座を選択</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}{s.archived?'（使用停止）':''}</option>)}</select>
      <label htmlFor="cash-amount">金額（円）</label><input id="cash-amount" type="number" inputMode="numeric" min={1} max={999999999} step={1} required value={Math.abs(fields.amount)||''} disabled={busy||row?.imported} onChange={e=>patch({amount:Number(e.target.value)*(direction==='in'?1:-1)})} />
      <label htmlFor="cash-description">内容</label><input id="cash-description" required maxLength={240} value={fields.description} disabled={busy} onChange={e=>patch({description:e.target.value})} />
      <label htmlFor="cash-kind">種類</label><select id="cash-kind" value={fields.kind} disabled={busy} onChange={e=>patch({kind:e.target.value as CashKind})}>{Object.entries(cashKinds).filter(([key])=>cashKindMatchesAmount(key as CashKind,direction==='in'?1:-1)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      <label htmlFor="cash-person">関係者</label><select id="cash-person" value={fields.partyId??''} disabled={busy} onChange={e=>patch({partyId:e.target.value||null})}><option value="">不明</option>{masters.parties.filter(p=>p.kind==='person'&&(!p.archived||p.id===fields.partyId)).map(p=><option key={p.id} value={p.id}>{p.name}{p.archived?'（使用停止）':''}</option>)}</select>
      <label htmlFor="cash-date">取引日</label><input id="cash-date" type="date" min="2000-01-01" max="2099-12-31" required value={fields.date} disabled={busy||row?.imported} onChange={e=>patch({date:e.target.value})} />
      <label htmlFor="cash-memo">メモ</label><textarea id="cash-memo" rows={3} maxLength={2000} value={fields.memo} disabled={busy} onChange={e=>patch({memo:e.target.value})} />
      {error&&<p role="alert" className="form-error">{error}</p>}{conflict&&row&&<Button type="button" variant="outline" disabled={busy} onClick={reload}><RefreshCw />最新を読み込む</Button>}
    </form>
    <div className="editor-actions">{row&&<div className="editor-tools"><Button variant="ghost" size="icon" title="入出金を削除" aria-label="入出金を削除" disabled={busy} onClick={()=>{if(window.confirm('この入出金を削除しますか？ 変更履歴と再取込防止の記録は残ります。'))void mutate(()=>requestJson('/api/cash-movements/'+id,{method:'DELETE',body:JSON.stringify({version})}));}}><Trash2 /></Button><Button variant="ghost" size="icon" title="入出金の変更履歴" aria-label="入出金の変更履歴" disabled={busy} onClick={()=>setHistory(true)}><History /></Button></div>}<div className="editor-save"><Button variant="outline" disabled={busy} onClick={close}>キャンセル</Button><Button type="submit" form={'cash-'+id} className="primary-action" disabled={busy}>{busy?<LoaderCircle className="animate-spin" />:<Save />}保存</Button></div></div>
    {history&&row&&<Dialog open onOpenChange={setHistory}><DialogContent className="expense-dialog master-dialog"><DialogHeader><DialogTitle>入出金の変更履歴</DialogTitle><DialogDescription className="sr-only">家計内の変更履歴</DialogDescription></DialogHeader><HistoryView masters={masters} entityType="cash_movements" entityId={id} /></DialogContent></Dialog>}
  </DialogContent></Dialog>;
}
