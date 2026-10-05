'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Link2, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BankAction, BankState, cardExpenseMonth } from '@/lib/finance';
import { Masters } from '@/lib/ledger';
import { formatYen, shiftMonth } from '@/lib/expenses';
import { errorMessage, requestJson } from '@/lib/client-api';

export function BankMonthStatus({month,revision,onChanged,onCash}:{month:string;revision:number;onChanged:()=>void;onCash:()=>void}){
  const [state,setState]=useState<BankState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false);
  useEffect(()=>{const c=new AbortController();setState(null);setError('');requestJson<BankState>('/api/finance/bank?month='+month,{signal:c.signal}).then(s=>{if(!c.signal.aborted)setState(s);}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[month,revision]);
  async function review(){if(!state||lock.current||!window.confirm(state.review.complete?'この月をカード分の確認待ちに戻しますか？':'この月に計上する家計用カード2枚の合計を確認済みにしますか？ 内訳は未入力でも構いません。'))return;lock.current=true;setBusy(true);try{await requestJson('/api/finance/bank',{method:'POST',body:JSON.stringify({action:'review',month,complete:!state.review.complete,version:state.review.version})});onChanged();}catch(e){setError(errorMessage(e));}finally{lock.current=false;setBusy(false);}}
  return <section className={'bank-month-status '+(state?.review.complete?'complete':'pending')} aria-label="楽天カード分の確認"><div><strong>楽天カード分 {state?.review.complete?'確認済み':state?.amount?'集計途中':'未反映'}</strong>{state&&<small>{formatYen(state.amount)}{!state.review.complete?' / 未確認':''}</small>}</div><div className="toolbar-actions"><Button variant="ghost" onClick={onCash}><Link2 />明細</Button><Button variant="ghost" size="icon" title={state?.review.complete?'確認待ちに戻す':'カード2枚の合計を確認'} aria-label={state?.review.complete?'カード分を確認待ちに戻す':'カード2枚の合計を確認'} disabled={!state||busy} onClick={review}>{state?.review.complete?<Undo2 />:<Check />}</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}</section>;
}

export function BankPosting({masters,revision,onChanged}:{masters:Masters;revision:number;onChanged:()=>void}){
  const [state,setState]=useState<BankState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [month,setMonth]=useState(''),[source,setSource]=useState(()=>masters.paymentSources.find(s=>s.isDefault&&s.method==='card')?.id??'');
  const [selected,setSelected]=useState<string[]>([]);const lock=useRef(false);
  const [detailIds,setDetailIds]=useState<string[]>([]),[keepSeparate,setKeepSeparate]=useState(false);
  useEffect(()=>{const c=new AbortController();setError('');setSelected([]);requestJson<BankState>('/api/finance/bank?month=2000-01',{signal:c.signal}).then(s=>{if(c.signal.aborted)return;setState(s);if(s.rows[0])setMonth(old=>old||cardExpenseMonth(s.rows[0].date));}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[revision]);
  async function act(input:BankAction){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await requestJson('/api/finance/bank',{method:'POST',body:JSON.stringify(input)});onChanged();}catch(e){setError(errorMessage(e));}finally{lock.current=false;setBusy(false);}}
  const rows=state?.rows.filter(r=>month&&r.date.slice(0,7)===shiftMonth(month,1))??[];
  const entries=rows.filter(r=>selected.includes(r.id));
  const details=state?.details.filter(d=>d.paymentSourceId===source&&d.date.slice(0,7)===month)??[];
  return <section className="bank-posting">
    <details><summary>カード引落の支出計上 <strong>{state?.pendingCount??0}件待ち</strong></summary><div className="expense-form">
      <label htmlFor="bank-post-month">計上月</label><input id="bank-post-month" type="month" min="2000-01" max="2099-11" value={month} disabled={busy} onChange={e=>{setMonth(e.target.value);setSelected([]);setDetailIds([]);setKeepSeparate(false);}} />
      <label htmlFor="bank-post-source">家計用カード</label><select id="bank-post-source" value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setDetailIds([]);setKeepSeparate(false);}}><option value="">選択してください</option>{masters.paymentSources.filter(s=>s.method==='card'&&!s.archived&&masters.parties.some(p=>p.id===s.fundingPartyId&&p.kind==='shared')).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <ul className="bank-pending-list">{rows.map(r=><li key={r.id}><label className="check-label"><input type="checkbox" checked={selected.includes(r.id)} disabled={busy||selected.length>=50&&!selected.includes(r.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))} /><span>{r.date} 引落<strong>{formatYen(-r.amount)}</strong></span></label></li>)}</ul>
      {!rows.length&&<p className="muted-text">この計上月に対応する翌月の未計上明細はありません</p>}
      {!!details.length&&<fieldset><legend>登録済みの支出を内訳に含める</legend>{details.map(d=><label className="check-label" key={d.id}><input type="checkbox" disabled={busy} checked={detailIds.includes(d.id)} onChange={e=>{setKeepSeparate(false);setDetailIds(old=>e.target.checked?[...old,d.id]:old.filter(id=>id!==d.id));}} />{d.name||'支出'} / {formatYen(d.amount)}</label>)}{details.some(d=>!detailIds.includes(d.id))&&<label className="check-label"><input type="checkbox" checked={keepSeparate} disabled={busy} onChange={e=>setKeepSeparate(e.target.checked)} />選ばない支出は、このカード引落とは別の支出です</label>}</fieldset>}
      <Button className="primary-action" disabled={busy||!entries.length||!source||details.some(d=>!detailIds.includes(d.id))&&!keepSeparate} onClick={()=>{if(window.confirm(`${month}の家計支出に${entries.length}件・${formatYen(entries.reduce((n,r)=>n-r.amount,0))}を計上しますか？`))void act({action:'post',month,paymentSourceId:source,entries:entries.map(r=>({id:r.id,version:r.version})),details:details.filter(d=>detailIds.includes(d.id)).map(d=>({id:d.id,version:d.version})),keepSeparate});}}><Check />選択分を支出に計上</Button>
    </div></details>
    {!!state?.matches.length&&<details><summary>手入力との重複候補 <strong>{state.matches.length}件</strong></summary><ul className="bank-pending-list">{state.matches.map(({manual,imported})=><li key={manual.id+imported.id}><div><strong>{manual.description}</strong><small>{manual.date} / {formatYen(Math.abs(manual.amount))}</small></div><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm('同じ取引であることを確認しましたか？ 手入力分を集計から外し、未設定の関係者・種類を銀行明細へ引き継ぎます。'))void act({action:'match',id:manual.id,version:manual.version,importId:imported.id,importVersion:imported.version});}}><Link2 />照合</Button></li>)}</ul></details>}
    {!!state?.matched.length&&<details><summary>照合済みの手入力 <strong>{state.matched.length}件</strong></summary><ul className="bank-pending-list">{state.matched.map(r=><li key={r.id}><span>{r.date} / {r.description}</span><Button variant="ghost" size="icon" title="照合を解除" aria-label="照合を解除" disabled={busy} onClick={()=>{if(window.confirm('手入力と明細が両方集計される状態に戻しますか？'))void act({action:'unmatch',id:r.id,version:r.version});}}><Undo2 /></Button></li>)}</ul></details>}
    {error&&<p className="form-error" role="alert">{error}<Button variant="ghost" size="icon" title="明細を更新" aria-label="明細を更新" onClick={onChanged}><RefreshCw /></Button></p>}
  </section>;
}
