'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseRecord, formatExpenseDate, formatYen, todayInJapan } from '@/lib/expenses';
import { Masters } from '@/lib/ledger';
import { settlementBatchSchema } from '@/lib/settlement-batch';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';

export function BatchSettlementDialog({ expenses, masters, onClose, onSaved, onReload }: {
  expenses: ExpenseRecord[]; masters: Masters; onClose: () => void; onSaved: () => void; onReload: () => void;
}) {
  const [entries] = useState(() => expenses.map(e => ({ id: crypto.randomUUID(), expenseId: e.id, expenseVersion: e.version, amount: e.reimbursementAmount-e.settledAmount })));
  const [date,setDate] = useState(todayInJapan()), [memo,setMemo] = useState('');
  const initialDate=useRef(date);
  const [confirmed,setConfirmed] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [conflict,setConflict] = useState(false);
  const lock = useRef(false);
  const first = expenses[0], total = entries.reduce((sum,e) => sum+e.amount,0);
  const person = (id:string|null) => masters.parties.find(p => p.id===id)?.name ?? '未設定';
  function close() { if(!busy&&(!confirmed&&!memo&&date===initialDate.current||window.confirm('入力中の精算を破棄しますか？')))onClose(); }
  useEffect(() => { const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';}; window.addEventListener('beforeunload',handler); return()=>window.removeEventListener('beforeunload',handler); },[]);
  async function save(event:FormEvent) {
    event.preventDefault(); if(lock.current||!confirmed||conflict)return;
    const parsed=settlementBatchSchema.safeParse({date,memo,entries,fromPartyId:first.reimbursementFromPartyId,toPartyId:first.reimbursementToPartyId});
    if(!parsed.success){setError('精算日と対象を確認してください。');return;}
    lock.current=true;setBusy(true);setError('');
    try { await requestJson('/api/settlements/batch',{method:'POST',body:JSON.stringify(parsed.data)});onSaved(); }
    catch(error){setError(errorMessage(error));setConflict(error instanceof RequestError&&[404,409,422].includes(error.status));}
    finally{lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>まとめて精算を記録</DialogTitle><DialogDescription>返金済みの支出を記録します。送金は行いません。</DialogDescription></DialogHeader>
    <form id="batch-settlement" className="expense-form" onSubmit={save}>
      <p className="batch-parties">{person(first.reimbursementFromPartyId)} <ArrowRight aria-label="から" /> {person(first.reimbursementToPartyId)}</p>
      <div className="batch-total"><span>{entries.length}件の未精算額</span><strong>{formatYen(total)}</strong></div>
      <ul className="batch-items">{expenses.map(e=><li key={e.id}><span><small>{formatExpenseDate(e.date)}</small>{e.description||masters.categories.find(c=>c.id===e.categoryId)?.name}</span><strong>{formatYen(e.reimbursementAmount-e.settledAmount)}</strong></li>)}</ul>
      <label htmlFor="batch-date">精算日</label><input id="batch-date" type="date" required min="2000-01-01" max="2099-12-31" value={date} disabled={busy||conflict} onChange={e=>{setDate(e.target.value);setConfirmed(false);}} />
      <label htmlFor="batch-memo">精算メモ <span className="muted-text">任意</span></label><input id="batch-memo" maxLength={500} value={memo} disabled={busy||conflict} onChange={e=>setMemo(e.target.value)} />
      <label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy||conflict} onChange={e=>setConfirmed(e.target.checked)} />対象と金額を確認し、返金済みです</label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {conflict&&<Button type="button" variant="outline" onClick={onReload}><RefreshCw />一覧を更新して選び直す</Button>}
    </form><div className="editor-save batch-save"><span>{entries.length}件 <strong>{formatYen(total)}</strong></span><Button variant="outline" disabled={busy} onClick={close}>キャンセル</Button><Button type="submit" form="batch-settlement" className="primary-action" disabled={busy||!confirmed||conflict}>{busy?<LoaderCircle className="animate-spin" />:<Check />}精算を保存</Button></div>
  </DialogContent></Dialog>;
}
