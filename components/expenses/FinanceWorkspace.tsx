'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Plus, RefreshCw, Save, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Masters } from '@/lib/ledger';
import { ContributionResponse, DebtRecord, DebtResponse, debtFields } from '@/lib/finance';
import { formatYen, todayInJapan } from '@/lib/expenses';
import { errorMessage, requestJson } from '@/lib/client-api';
import { HistoryView } from './HistoryView';
import dynamic from 'next/dynamic';

const HouseholdSummary=dynamic(()=>import('./HouseholdSummary').then(module=>module.HouseholdSummary),{loading:()=> <p role="status" className="workspace-message">サマリーを読み込み中</p>});

export function FinanceWorkspace({masters,revision,onChanged,initialMonth,onCash,onExpenses}:{masters:Masters;revision:number;onChanged:()=>void;initialMonth:string;onCash:()=>void;onExpenses:(month:string)=>void}){
  const [view,setView]=useState('summary'),[all,setAll]=useState(true),[month,setMonth]=useState(initialMonth),[page,setPage]=useState(1),[debtView,setDebtView]=useState('open');
  const [funding,setFunding]=useState<ContributionResponse|null>(null),[debts,setDebts]=useState<DebtResponse|null>(null),[editing,setEditing]=useState<{row:DebtRecord|null}|null>(null),[error,setError]=useState(''),[downloading,setDownloading]=useState(false);
  const query=view==='debts'?`view=${debtView}`:all?'':`month=${month}`;
  const endpoint='/api/finance/'+view;
  useEffect(()=>{const c=new AbortController();setError('');setFunding(null);setDebts(null);if(view==='summary')return;requestJson<ContributionResponse|DebtResponse>(`${endpoint}?${query}&page=${page}`,{signal:c.signal}).then(result=>{if(c.signal.aborted)return;if(page>1&&!result.rows.length){setPage(1);return;}if(view==='debts')setDebts(result as DebtResponse);else setFunding(result as ContributionResponse);}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[endpoint,query,page,revision,view]);
  const person=(id:string|null)=>masters.parties.find(p=>p.id===id)?.name??'未確認の入金';
  const count=(funding??debts)?.count??0;
  async function download(){if(downloading)return;setDownloading(true);try{const r=await fetch(endpoint+'?'+query+'&export=csv',{cache:'no-store'});if(!r.ok)throw new Error((await r.json()).error);const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=`famfi-${view}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){setError(errorMessage(e));}finally{setDownloading(false);}}
  return <main className="expense-main finance-workspace"><div className="workspace-heading"><div><p className="section-eyebrow">家計と個人の記録</p><h1>{view==='debts'?'個人の貸し借り':view==='summary'?'家計サマリー':'家計への負担'}</h1></div><div className="toolbar-actions"><Button variant="ghost" size="icon" title="負担・貸し借りを更新" aria-label="負担・貸し借りを更新" onClick={onChanged}><RefreshCw /></Button>{view!=='summary'&&<Button variant="outline" size="icon" title="CSV出力" aria-label="負担・貸し借りのCSV出力" disabled={downloading||!funding&&!debts} onClick={download}><Download /></Button>}</div></div>
    <Tabs value={view} onValueChange={v=>{setView(v);setPage(1);}}><TabsList aria-label="資金の記録" className="finance-view-tabs"><TabsTrigger value="summary">サマリー</TabsTrigger><TabsTrigger value="contributions">負担明細</TabsTrigger><TabsTrigger value="debts">個人の貸し借り</TabsTrigger></TabsList></Tabs>
    {view==='summary'&&<HouseholdSummary masters={masters} revision={revision} initialMonth={initialMonth} onChanged={onChanged} onCash={onCash} onExpenses={onExpenses} />}
    {view==='contributions'&&<div className="finance-period"><Tabs value={all?'all':'month'} onValueChange={v=>{setAll(v==='all');setPage(1);}}><TabsList aria-label="負担額の期間"><TabsTrigger value="all">全期間</TabsTrigger><TabsTrigger value="month">月別</TabsTrigger></TabsList></Tabs>{!all&&<input aria-label="負担額の対象月" type="month" min="2000-01" max="2099-12" value={month} onChange={e=>{setMonth(e.target.value);setPage(1);}} />}</div>}
    {view==='debts'&&<div className="finance-period"><Tabs value={debtView} onValueChange={v=>{setDebtView(v);setPage(1);}}><TabsList aria-label="貸し借りの状態"><TabsTrigger value="open">返済待ち</TabsTrigger><TabsTrigger value="all">すべて</TabsTrigger></TabsList></Tabs><Button className="primary-action" onClick={()=>setEditing({row:null})}><Plus />記録</Button></div>}
    {view!=='summary'&&error&&<p className="form-error" role="alert">{error}</p>}{view!=='summary'&&!funding&&!debts&&!error&&<p role="status" className="workspace-message"><LoaderCircle className="animate-spin" />読み込み中</p>}
    {funding&&<><dl className="finance-stats" aria-label="人物別の家計負担">{masters.parties.filter(p=>p.kind==='person').map(p=><div key={p.id}><dt>{p.name}</dt><dd>{formatYen(funding.groups.find(g=>g.partyId===p.id)?.amount??0)}</dd></div>)}{funding.groups.some(g=>!g.partyId)&&<div><dt>負担者未確認の入金</dt><dd>{formatYen(funding.groups.find(g=>!g.partyId)?.amount??0)}</dd></div>}</dl>
      <ul className="finance-list">{funding.rows.map(r=><li key={r.kind+r.id}><div><strong>{r.name||{deposit:'口座への入金',direct:'直接負担',refund:'個人資金から返金',contribution:'返金不要に変更'}[r.kind]}</strong><small>{r.date} / {person(r.partyId)} / {{deposit:'入金',direct:'直接負担',refund:'返金',contribution:'返金不要'}[r.kind]}</small></div><strong>{formatYen(r.amount)}</strong></li>)}</ul></>}
    {debts&&<><div className="finance-outstanding"><span>個人間の返済待ち</span><strong>{formatYen(debts.outstanding)}</strong></div><ul className="finance-list">{debts.rows.map(r=><li key={r.id}><button className="finance-debt-row" onClick={()=>setEditing({row:r})}><span><strong>{r.name}</strong><small>{r.date} / {person(r.debtorPartyId)} → {person(r.creditorPartyId)}</small></span><span><strong>{formatYen(r.amount-r.paid)}</strong><small>{r.amount===r.paid?'返済済み':r.paid?'一部返済':'返済待ち'}</small></span></button></li>)}</ul></>}
    {(funding||debts)&&count===0&&<p className="workspace-message">該当する記録はありません</p>}
    {count>50&&<nav className="ledger-pagination" aria-label="資金の記録のページ"><Button size="icon" variant="outline" title="前のページ" aria-label="資金の記録の前のページ" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft /></Button><span>{page} / {Math.ceil(count/50)}</span><Button size="icon" variant="outline" title="次のページ" aria-label="資金の記録の次のページ" disabled={page*50>=count} onClick={()=>setPage(p=>p+1)}><ChevronRight /></Button></nav>}
    {editing&&<DebtDialog row={editing.row} masters={masters} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}} />}
  </main>;
}

function DebtDialog({row,masters,onClose,onSaved}:{row:DebtRecord|null;masters:Masters;onClose:()=>void;onSaved:()=>void}){
  const people=masters.parties.filter(p=>p.kind==='person'&&!p.archived);
  const [id]=useState(()=>row?.id??crypto.randomUUID()),[fields,setFields]=useState(()=>row?debtFields.strip().parse(row):{name:'',amount:0,date:todayInJapan(),debtorPartyId:masters.selfPartyId??'',creditorPartyId:people.find(p=>p.id!==masters.selfPartyId)?.id??'',memo:''});
  const [paymentId]=useState(()=>crypto.randomUUID()),[amount,setAmount]=useState(row?row.amount-row.paid:0),[date,setDate]=useState(todayInJapan()),[source,setSource]=useState(''),[memo,setMemo]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState(false);const lock=useRef(false),baseline=useRef(JSON.stringify(fields));
  const dirty=JSON.stringify(fields)!==baseline.current||Boolean(source||memo)||date!==todayInJapan()||amount!==(row?row.amount-row.paid:0);
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  function close(){if(!busy&&(!dirty||window.confirm('入力中の変更を破棄しますか？')))onClose();}
  async function act(input:unknown){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await requestJson('/api/finance/debts',{method:'POST',body:JSON.stringify(input)});onSaved();}catch(e){setError(errorMessage(e));}finally{lock.current=false;setBusy(false);}}
  function save(e:FormEvent){e.preventDefault();const parsed=debtFields.safeParse(fields);if(!parsed.success){setError('内容・人物・金額・日付を確認してください。');return;}void act({...parsed.data,action:'save',id,version:row?.version??0});}
  const financialLocked=Boolean(row?.repayments.length);
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>個人の貸し借り</DialogTitle><DialogDescription>家計の支出・負担額の対象外</DialogDescription></DialogHeader>
    <div className="finance-dialog-body"><form id="personal-debt" className="expense-form" onSubmit={save}><label htmlFor="debt-name">内容</label><input id="debt-name" required maxLength={120} value={fields.name} disabled={busy} onChange={e=>setFields(f=>({...f,name:e.target.value}))} />
      <label htmlFor="debt-debtor">借りた人</label><select id="debt-debtor" required disabled={busy||financialLocked} value={fields.debtorPartyId} onChange={e=>setFields(f=>({...f,debtorPartyId:e.target.value}))}><option value="">選択してください</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <label htmlFor="debt-creditor">貸した人</label><select id="debt-creditor" required disabled={busy||financialLocked} value={fields.creditorPartyId} onChange={e=>setFields(f=>({...f,creditorPartyId:e.target.value}))}><option value="">選択してください</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <label htmlFor="debt-amount">金額（円）</label><input id="debt-amount" type="number" inputMode="numeric" required min={1} max={999999999} step={1} value={fields.amount||''} disabled={busy||financialLocked} onChange={e=>setFields(f=>({...f,amount:Number(e.target.value)}))} />
      <label htmlFor="debt-date">日付</label><input id="debt-date" type="date" required min="2000-01-01" max="2099-12-31" disabled={busy} value={fields.date} onChange={e=>setFields(f=>({...f,date:e.target.value}))} />
      <label htmlFor="debt-memo">メモ</label><textarea id="debt-memo" rows={2} maxLength={2000} disabled={busy} value={fields.memo} onChange={e=>setFields(f=>({...f,memo:e.target.value}))} />
    </form>
    {row&&row.amount>row.paid&&<details className="debt-repayment"><summary>返済を記録 <strong>残り{formatYen(row.amount-row.paid)}</strong></summary><form className="expense-form" onSubmit={e=>{e.preventDefault();void act({action:'repay',id:paymentId,debtId:row.id,version:row.version,amount,date,paymentSourceId:source,memo});}}>
      <label htmlFor="debt-repayment-source">実際の返済元</label><select id="debt-repayment-source" required value={source} disabled={busy} onChange={e=>setSource(e.target.value)}><option value="">選択してください</option>{masters.paymentSources.filter(s=>!s.archived&&s.fundingPartyId===row.debtorPartyId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <label htmlFor="debt-repayment-amount">返した金額（円）</label><input id="debt-repayment-amount" type="number" inputMode="numeric" required min={1} max={row.amount-row.paid} step={1} value={amount||''} disabled={busy} onChange={e=>setAmount(Number(e.target.value))} />
      <label htmlFor="debt-repayment-date">返済日</label><input id="debt-repayment-date" type="date" required min="2000-01-01" max="2099-12-31" value={date} disabled={busy} onChange={e=>setDate(e.target.value)} />
      <label htmlFor="debt-repayment-memo">返済メモ</label><input id="debt-repayment-memo" maxLength={500} value={memo} disabled={busy} onChange={e=>setMemo(e.target.value)} /><Button className="primary-action" disabled={busy}><Check />返済を保存</Button>
    </form></details>}
    {!!row?.repayments.length&&<section className="settlement-history"><h3>返済履歴</h3><ul>{row.repayments.map(r=><li key={r.id}><div><strong>{formatYen(r.amount)}</strong><span>{r.date} / {masters.paymentSources.find(p=>p.id===r.paymentSourceId)?.name}{r.cancelledAt?' / 取消済み':''}</span><span>{r.memo}</span></div>{!r.cancelledAt&&<Button size="icon" variant="ghost" title="返済を取り消す" aria-label="返済を取り消す" disabled={busy} onClick={()=>{if(window.confirm('この返済を取り消しますか？'))void act({action:'cancel',id:r.id});}}><Undo2 /></Button>}</li>)}</ul></section>}
    {row&&<details open={history} onToggle={e=>setHistory(e.currentTarget.open)}><summary>変更履歴</summary>{history&&<HistoryView masters={masters} entityType="personal_debts" entityId={row.id} />}</details>}
    {error&&<p className="form-error" role="alert">{error}</p>}</div>
    <div className="editor-actions">{row&&<Button size="icon" variant="ghost" title="貸し借りを削除" aria-label="貸し借りを削除" disabled={busy||financialLocked} onClick={()=>{if(window.confirm('この貸し借りを削除しますか？'))void act({action:'void',id:row.id,version:row.version});}}><Trash2 /></Button>}<div className="editor-save"><Button variant="outline" disabled={busy} onClick={close}>閉じる</Button><Button form="personal-debt" className="primary-action" disabled={busy}><Save />保存</Button></div></div>
  </DialogContent></Dialog>;
}
