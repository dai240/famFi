'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Pencil, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseRecord, PAGE_SIZE, createSettlementSchema, formatExpenseDate, formatYen, todayInJapan } from '@/lib/expenses';
import { Masters, settlementLabels, settlementState } from '@/lib/ledger';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { isSampleRecord } from '@/lib/sample-data';
import { MAX_SETTLEMENT_BATCH } from '@/lib/settlement-batch';
import { BatchSettlementDialog } from './BatchSettlementDialog';
import { toast } from 'sonner';

type Response = Masters & { expenses: ExpenseRecord[]; count: number; unknownCount: number; sampleCount?:number;sampleAmount?:number; groups: { fromPartyId: string; toPartyId: string; amount: number }[] };
export function SettlementWorkspace({ externalRevision, onEdit, onChanged }: { externalRevision: number; onEdit: (expense: ExpenseRecord) => void; onChanged: () => void }) {
  const [view,setView] = useState('open'); const [page,setPage] = useState(1); const [revision,setRevision] = useState(0);
  const [data,setData] = useState<Response|null>(null); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const [selected,setSelected] = useState<ExpenseRecord|null>(null);
  const [samples,setSamples]=useState(false), [batchOpen,setBatchOpen]=useState(false);
  const [selection,setSelection]=useState<ExpenseRecord[]>([]);
  const [exporting,setExporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    requestJson<Response>(`/api/settlements?view=${view}&page=${page}&samples=${samples?'show':'hide'}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (page > 1 && !result.expenses.length) { setPage(1); return; }
      setData(result);
    }).catch(error => { if (!controller.signal.aborted) { if (error instanceof RequestError && error.status === 401) window.location.replace('/login'); else setError(errorMessage(error)); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view,page,revision,externalRevision,samples]);
  const person = (id: string|null) => data?.parties.find(p => p.id === id)?.name ?? '未設定';
  const canSelect=(expense:ExpenseRecord)=>!isSampleRecord(expense)&&expense.reimbursementAmount>expense.settledAmount&&(!selection.length||selection[0].reimbursementFromPartyId===expense.reimbursementFromPartyId&&selection[0].reimbursementToPartyId===expense.reimbursementToPartyId);
  function toggle(expense:ExpenseRecord) {setSelection(old=>old.some(e=>e.id===expense.id)?old.filter(e=>e.id!==expense.id):old.length<MAX_SETTLEMENT_BATCH?[...old,expense]:old);}
  function reloadBatch(){setBatchOpen(false);setSelection([]);setRevision(n=>n+1);onChanged();}
  async function download() {
    setExporting(true); setError('');
    try {
      const response = await fetch('/api/settlements/export',{ cache:'no-store' });
      if (!response.ok) throw new RequestError(response.status,(await response.json()).error);
      const url=URL.createObjectURL(await response.blob()); const anchor=document.createElement('a'); anchor.href=url; anchor.download='famfi-settlements.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),10000);
    } catch (error) { setError(errorMessage(error)); } finally { setExporting(false); }
  }
  return <main className="expense-main settlement-workspace">
    <div className="workspace-heading"><div><p className="section-eyebrow">全期間</p><h1>立替・精算</h1></div><div className="toolbar-actions"><Button variant="ghost" size="icon" title="精算一覧を更新" aria-label="精算一覧を更新" onClick={() => setRevision(n=>n+1)} disabled={loading}><RefreshCw className={loading ? 'animate-spin':''} /></Button><Button variant="outline" disabled={exporting || !data} onClick={download}><Download />CSV</Button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <section className="settlement-summary" aria-label="未精算の集計"><h2>未精算額</h2><p className="total-amount" data-testid="outstanding-total">{formatYen(data.groups.reduce((n,g)=>n+g.amount,0))}</p>
      <ul className="balance-list">{data.groups.map(g => <li key={`${g.fromPartyId}:${g.toPartyId}`}><span>{person(g.fromPartyId)} <ArrowRight aria-label="から" /> {person(g.toPartyId)}</span><strong>{formatYen(g.amount)}</strong></li>)}</ul>
      <p className="muted-text">精算要否が未設定の支出: {data.unknownCount}件</p>
    </section>}
    {Boolean(data?.sampleCount)&&<div className="sample-notice"><p>サンプル {data?.sampleCount}件・{formatYen(data?.sampleAmount??0)}は未精算額から除外しています。</p><label className="check-label"><input type="checkbox" checked={samples} onChange={e=>{setSamples(e.target.checked);setPage(1);setSelection([]);}} />サンプルも表示</label></div>}
    <Tabs value={view} onValueChange={v=>{setView(v);setPage(1);setSelection([]);}}><TabsList className="settlement-tabs"><TabsTrigger value="open">未精算・一部精算</TabsTrigger><TabsTrigger value="all">精算対象すべて</TabsTrigger></TabsList></Tabs>
    {selection.length>0&&<section className="batch-toolbar" aria-label="選択した精算"><div><strong>{selection.length}件 / {formatYen(selection.reduce((sum,e)=>sum+e.reimbursementAmount-e.settledAmount,0))}</strong><small>{person(selection[0].reimbursementFromPartyId)} → {person(selection[0].reimbursementToPartyId)}</small></div><Button variant="ghost" onClick={()=>setSelection([])}>選択解除</Button><Button className="primary-action" disabled={loading} onClick={()=>setBatchOpen(true)}><Check />まとめて精算</Button></section>}
    {loading ? <div className="workspace-message" role="status"><LoaderCircle className="animate-spin" />読み込み中</div> : data && <>
      <p className="muted-text">{data.count}件</p>
      <ul className="settlement-list">{data.expenses.map(expense => <li key={expense.id}>
        {!isSampleRecord(expense)&&expense.reimbursementAmount>expense.settledAmount&&<input className="settlement-select" type="checkbox" aria-label={`${expense.description||'支出'}を一括精算に選択`} checked={selection.some(e=>e.id===expense.id)} disabled={loading||!canSelect(expense)||selection.length>=MAX_SETTLEMENT_BATCH&&!selection.some(e=>e.id===expense.id)} onChange={()=>toggle(expense)} />}
        <button className="settlement-entry" onClick={()=>setSelected(expense)} aria-label={`${expense.description || '支出'}の精算`}><div><time>{formatExpenseDate(expense.date)}</time><strong>{expense.description || data.categories.find(c=>c.id===expense.categoryId)?.name}</strong><span>{person(expense.reimbursementFromPartyId)} <ArrowRight /> {person(expense.reimbursementToPartyId)}</span></div><div><span className={`settlement-status ${settlementState(expense)}`}>{settlementLabels[settlementState(expense)]}</span><strong>{formatYen(expense.reimbursementAmount-expense.settledAmount)}</strong></div></button>
        <Button size="icon" variant="ghost" title="支出を編集" aria-label={`${expense.description || '支出'}を編集`} onClick={()=>onEdit(expense)}><Pencil /></Button>
      </li>)}</ul>
      {!data.expenses.length && <p className="workspace-message">該当する支出はありません</p>}
      {data.count>PAGE_SIZE && <nav className="ledger-pagination" aria-label="精算一覧のページ"><Button variant="outline" size="icon" aria-label="精算の前のページ" disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft /></Button><span>{page} / {Math.ceil(data.count/PAGE_SIZE)}</span><Button variant="outline" size="icon" aria-label="精算の次のページ" disabled={page*PAGE_SIZE>=data.count} onClick={()=>setPage(page+1)}><ChevronRight /></Button></nav>}
    </>}
    {selected && data && <SettlementEditor key={selected.id} initial={selected} masters={data} onClose={()=>setSelected(null)} onChanged={()=>{setRevision(n=>n+1);onChanged();}} />}
    {batchOpen&&data&&selection.length>0&&<BatchSettlementDialog expenses={selection} masters={data} onClose={()=>setBatchOpen(false)} onReload={reloadBatch} onSaved={()=>{reloadBatch();toast.success('精算を記録しました');}} />}
  </main>;
}

function SettlementEditor({ initial, masters, onClose, onChanged }: { initial: ExpenseRecord; masters: Masters; onClose: () => void; onChanged: () => void }) {
  const [expense,setExpense] = useState(initial); const [id,setId] = useState(()=>crypto.randomUUID());
  const [amount,setAmount] = useState(String(initial.reimbursementAmount-initial.settledAmount)); const [date,setDate] = useState(todayInJapan()); const [memo,setMemo] = useState('');
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const lock=useRef(false);
  const person=(id:string|null)=>masters.parties.find(p=>p.id===id)?.name ?? '未設定';
  const remaining=expense.reimbursementAmount-expense.settledAmount;
  const cleanFields = useRef(JSON.stringify({amount,date,memo}));
  const dirty = JSON.stringify({amount,date,memo}) !== cleanFields.current;
  function close() { if(!busy && (!dirty || window.confirm('入力中の精算を破棄しますか？'))) onClose(); }
  useEffect(()=>{ if(!dirty) return; const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';}; window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  async function reload() {
    if(lock.current) return; lock.current=true;setBusy(true);setError('');
    try { setExpense(await requestJson<ExpenseRecord>(`/api/expenses/${expense.id}`));onChanged(); } catch(error) {setError(errorMessage(error));} finally {lock.current=false;setBusy(false);}
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); if(lock.current) return;
    const parsed=createSettlementSchema.safeParse({id,expenseId:expense.id,expenseVersion:expense.version,amount:Number(amount),date,memo});
    if(!/^\d+$/.test(amount) || !parsed.success || Number(amount)>remaining) { setError('精算日・未精算額の範囲内の金額を確認してください。'); return; }
    lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      const row=await requestJson<ExpenseRecord>('/api/settlements',{method:'POST',body:JSON.stringify(parsed.data)});
      setExpense(row);setId(crypto.randomUUID());setAmount(String(row.reimbursementAmount-row.settledAmount));setMemo('');cleanFields.current=JSON.stringify({amount:String(row.reimbursementAmount-row.settledAmount),date,memo:''});setNotice('精算を記録しました');onChanged();
    } catch(error) { setError(errorMessage(error)); } finally {lock.current=false;setBusy(false);}
  }
  async function cancel(id:string) {
    if(lock.current || !window.confirm('この精算記録を取り消して未精算額へ戻しますか？')) return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      await requestJson(`/api/settlements/${id}`,{method:'DELETE',body:'{}'});
      const row=await requestJson<ExpenseRecord>(`/api/expenses/${expense.id}`);setExpense(row);setAmount(String(row.reimbursementAmount-row.settledAmount));cleanFields.current=JSON.stringify({amount:String(row.reimbursementAmount-row.settledAmount),date,memo});setNotice('精算記録を取り消しました');onChanged();
    } catch(error) {setError(errorMessage(error));} finally {lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open) close();}}><DialogContent className="expense-dialog" onInteractOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>精算を記録</DialogTitle><DialogDescription>{formatExpenseDate(expense.date)} / {expense.description || masters.categories.find(c=>c.id===expense.categoryId)?.name}</DialogDescription></DialogHeader>
    <div className="field-heading"><span className={`settlement-status ${settlementState(expense)}`}>{settlementLabels[settlementState(expense)]}</span><Button size="icon" variant="ghost" title="精算状況を更新" aria-label="精算状況を更新" disabled={busy} onClick={reload}><RefreshCw className={busy?'animate-spin':''} /></Button></div>
    <div className="settlement-detail"><p>{person(expense.reimbursementFromPartyId)} <ArrowRight /> {person(expense.reimbursementToPartyId)}</p><dl><div><dt>精算対象</dt><dd>{formatYen(expense.reimbursementAmount)}</dd></div><div><dt>精算済み</dt><dd>{formatYen(expense.settledAmount)}</dd></div><div><dt>未精算</dt><dd>{formatYen(remaining)}</dd></div></dl></div>
    {isSampleRecord(expense)?<p className="sample-notice">サンプルのため、実際の精算は登録できません。</p>:remaining>0 && <form className="expense-form" onSubmit={submit}><label htmlFor="settlement-amount">返した金額（円）</label><input id="settlement-amount" required inputMode="numeric" pattern="[0-9]+" maxLength={9} value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} /><label htmlFor="settlement-date">精算日</label><input id="settlement-date" type="date" min="2000-01-01" max="2099-12-31" required value={date} disabled={busy} onChange={e=>setDate(e.target.value)} /><label htmlFor="settlement-memo">精算メモ <span className="muted-text">任意</span></label><input id="settlement-memo" value={memo} maxLength={500} disabled={busy} onChange={e=>setMemo(e.target.value)} /><Button className="primary-action" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" />:<Check />}精算を保存</Button></form>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="save-notice" role="status">{notice}</p>}
    <section className="settlement-history"><h3>精算履歴</h3>{!expense.settlements.length && <p className="muted-text">記録なし</p>}<ul>{expense.settlements.map(record=><li key={record.id}><div><strong>{formatYen(record.amount)}</strong><span>{formatExpenseDate(record.date)}{record.cancelledAt ? ' / 取消済み':''}</span><span>{person(record.fromPartyId)} → {person(record.toPartyId)}</span>{record.memo && <p>{record.memo}</p>}</div>{!record.cancelledAt && <Button type="button" size="icon" variant="ghost" title="精算を取り消す" aria-label={`${record.amount}円の精算を取り消す`} disabled={busy} onClick={()=>cancel(record.id)}><Undo2 /></Button>}</li>)}</ul></section>
    <Button variant="outline" disabled={busy} onClick={close}>閉じる</Button>
  </DialogContent></Dialog>;
}
