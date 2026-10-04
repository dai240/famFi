'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Landmark, LoaderCircle, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CashKind, CashRecord, CashResponse, cashKinds } from '@/lib/cash-movements';
import { formatExpenseDate, formatYen, shiftMonth } from '@/lib/expenses';
import { Masters } from '@/lib/ledger';
import { errorMessage, requestJson } from '@/lib/client-api';
import { CashEditor } from './CashEditor';

export function CashWorkspace({ initialMonth, masters, revision, onChanged }: { initialMonth:string; masters:Masters; revision:number; onChanged:()=>void }) {
  const [month,setMonth]=useState(initialMonth), [all,setAll]=useState(false), [direction,setDirection]=useState('all');
  const [kind,setKind]=useState(''), [source,setSource]=useState(''), [search,setSearch]=useState(''), [draft,setDraft]=useState('');
  const [page,setPage]=useState(1), [data,setData]=useState<CashResponse|null>(null), [error,setError]=useState('');
  const [editing,setEditing]=useState<{row:CashRecord|null}|null>(null), [exporting,setExporting]=useState(false);
  const exportLock=useRef(false);
  const params=new URLSearchParams({direction,search});
  if(!all)params.set('month',month);
  if(kind)params.set('kind',kind);
  if(source)params.set('source',source);
  const query=params.toString();
  useEffect(()=>{
    const c=new AbortController();setData(null);setError('');
    requestJson<CashResponse>(`/api/cash-movements?${query}&page=${page}`,{signal:c.signal})
      .then(result=>{if(c.signal.aborted)return;if(page>1&&!result.rows.length)setPage(1);else setData(result);})
      .catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});
    return()=>c.abort();
  },[query,page,revision]);
  function changeMonth(value:string){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))return;setMonth(value);setPage(1);}
  function find(e:FormEvent){e.preventDefault();setSearch(draft);setPage(1);}
  async function download(){
    if(exportLock.current)return;exportLock.current=true;setExporting(true);setError('');
    try{
      const response=await fetch('/api/cash-movements/export?'+query,{cache:'no-store'});
      if(!response.ok)throw new Error((await response.json()).error);
      const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');
      a.href=url;a.download=`famfi-cash-${all?'all':month}.csv`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(e){setError(errorMessage(e));}finally{exportLock.current=false;setExporting(false);}
  }
  const bankSources=masters.paymentSources.filter(s=>s.method==='bank');
  return <main className="expense-main cash-workspace">
    <div className="workspace-heading"><div><p className="section-eyebrow">共通資金・個人資金</p><h1>入出金</h1></div><Button className="primary-action" onClick={()=>setEditing({row:null})}><Plus />記録</Button></div>
    <div className="expense-toolbar">
      <div className="month-selector"><Button variant="ghost" size="icon" title="前の月" aria-label="入出金の前の月" disabled={all||month==='2000-01'} onClick={()=>changeMonth(shiftMonth(month,-1))}><ChevronLeft /></Button>
        <input type="month" aria-label="入出金の表示月" min="2000-01" max="2099-12" disabled={all} value={month} onChange={e=>changeMonth(e.target.value)} />
        <Button variant="ghost" size="icon" title="次の月" aria-label="入出金の次の月" disabled={all||month==='2099-12'} onClick={()=>changeMonth(shiftMonth(month,1))}><ChevronRight /></Button>
      </div>
      <div className="toolbar-actions"><Button size="icon" variant="ghost" title="入出金を更新" aria-label="入出金を更新" onClick={onChanged}><RefreshCw /></Button><Button size="icon" variant="outline" title="表示中の入出金をCSV出力" aria-label="表示中の入出金をCSV出力" disabled={!data||exporting} onClick={download}>{exporting?<LoaderCircle className="animate-spin" />:<Download />}</Button></div>
    </div>
    <details className="cash-filter-panel"><summary><SlidersHorizontal aria-hidden="true" />絞り込み{(all||direction!=='all'||kind||source||search)&&<span>適用中</span>}</summary>
    <label className="check-label cash-all"><input type="checkbox" checked={all} onChange={e=>{setAll(e.target.checked);setPage(1);}} />全期間</label>
    <div className="cash-filters">
      <label>入出金<select aria-label="入出金の方向" value={direction} onChange={e=>{setDirection(e.target.value);setPage(1);}}><option value="all">すべて</option><option value="in">入金</option><option value="out">出金</option></select></label>
      <label>種類<select aria-label="入出金の種類" value={kind} onChange={e=>{setKind(e.target.value);setPage(1);}}><option value="">すべて</option>{Object.entries(cashKinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>口座<select aria-label="入出金の口座" value={source} onChange={e=>{setSource(e.target.value);setPage(1);}}><option value="">すべて</option>{bankSources.map(s=><option key={s.id} value={s.id}>{s.name}{s.archived?'（使用停止）':''}</option>)}</select></label>
    </div>
    <form className="search-form notes-search" onSubmit={find}><input aria-label="入出金を検索" maxLength={120} value={draft} onChange={e=>setDraft(e.target.value)} /><Button size="icon" variant="outline" title="入出金を検索" aria-label="入出金を検索する"><Search /></Button>{search&&<Button type="button" variant="ghost" onClick={()=>{setDraft('');setSearch('');setPage(1);}}>解除</Button>}</form>
    </details>
    {error&&<div className="workspace-message" role="alert"><p>{error}</p><Button variant="outline" onClick={onChanged}><RefreshCw />再読み込み</Button></div>}
    {!data&&!error&&<p className="workspace-message" role="status"><LoaderCircle className="animate-spin" />入出金を読み込み中</p>}
    {data&&<>
      <section className="cash-totals" aria-label="入出金の集計"><div><h2>{all?'全期間':'表示月'}の入金{direction!=='all'||kind||source||search?'（絞込）':''}</h2><strong data-testid="cash-incoming">{formatYen(data.incoming)}</strong></div><div><h2>{all?'全期間':'表示月'}の出金{direction!=='all'||kind||source||search?'（絞込）':''}</h2><strong data-testid="cash-outgoing">{formatYen(data.outgoing)}</strong></div></section>
      <div className="cash-list-heading"><h2>入出金履歴</h2><span>{data.count}件</span></div>
      {!data.rows.length?<div className="empty-ledger"><Landmark aria-hidden="true" /><p>該当する入出金はありません</p><Button variant="outline" onClick={()=>setEditing({row:null})}><Plus />入出金を記録</Button></div>:<ul className="cash-list">{data.rows.map(row=><li key={row.id}><button type="button" onClick={()=>setEditing({row})}>
        {row.amount>0?<ArrowDownLeft className="cash-in" aria-hidden="true" />:<ArrowUpRight aria-hidden="true" />}
        <span className="cash-row-text"><strong>{row.description}</strong><span>{formatExpenseDate(row.date)} · {masters.paymentSources.find(s=>s.id===row.paymentSourceId)?.name??'口座不明'}</span><small>{cashKinds[row.kind as CashKind]} · {masters.parties.find(p=>p.id===row.partyId)?.name??'関係者不明'}{row.imported?' · 明細取込':''}</small></span>
        <span className={'cash-amount'+(row.amount>0?' cash-in':'')}><small>{row.amount>0?'入金':'出金'}</small><strong>{formatYen(Math.abs(row.amount))}</strong></span>
      </button></li>)}</ul>}
      {data.count>50&&<nav className="ledger-pagination" aria-label="入出金のページ"><Button size="icon" variant="outline" title="前のページ" aria-label="入出金の前のページ" disabled={page===1} onClick={()=>setPage(n=>n-1)}><ChevronLeft /></Button><span>{page} / {Math.ceil(data.count/50)}</span><Button size="icon" variant="outline" title="次のページ" aria-label="入出金の次のページ" disabled={page*50>=data.count} onClick={()=>setPage(n=>n+1)}><ChevronRight /></Button></nav>}
    </>}
    {editing&&<CashEditor key={editing.row?.id??'new'} row={editing.row} masters={masters} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}} />}
  </main>;
}
