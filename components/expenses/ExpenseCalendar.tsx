'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, RefreshCw, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarEntry, CalendarResponse, calendarDays, calendarLabels, calendarActualTotal } from '@/lib/expense-calendar';
import { formatExpenseDate, formatYen, todayInJapan } from '@/lib/expenses';
import { Masters, categoryName } from '@/lib/ledger';
import { errorMessage, requestJson } from '@/lib/client-api';
const compact = new Intl.NumberFormat('ja-JP',{notation:'compact',maximumFractionDigits:1});
export function ExpenseCalendar({ month, masters, revision, onOpen, onAdd, onNote }: {
  month:string; masters:Masters; revision:number; onOpen:(entry:CalendarEntry)=>void; onAdd:(date:string)=>void; onNote:(date:string)=>void;
}) {
  const [data,setData]=useState<CalendarResponse|null>(null), [error,setError]=useState(''), [reload,setReload]=useState(0);
  const [selected,setSelected]=useState(()=>todayInJapan().startsWith(month)?todayInJapan():month+'-01');
  const [showPlans,setShowPlans]=useState(true), [showNotes,setShowNotes]=useState(true);
  const selectedDate = selected.startsWith(month) ? selected : month+'-01';
  useEffect(()=>{const c=new AbortController();setData(null);setError('');requestJson<CalendarResponse>('/api/calendar?month='+month,{signal:c.signal}).then(d=>{if(!c.signal.aborted)setData(d);}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[month,revision,reload]);
  const entries=(data?.entries??[]).filter(e=> !(['plan','recurring'].includes(e.kind)&&!showPlans) && !(['note','task'].includes(e.kind)&&!showNotes));
  const undated=entries.filter(e=>e.date===month), rows=entries.filter(e=>e.date===selectedDate);
  return <section className="expense-calendar" aria-label="家計カレンダー">
    <div className="calendar-options"><label className="check-label"><input type="checkbox" checked={showPlans} onChange={e=>setShowPlans(e.target.checked)} />予定・定期</label><label className="check-label"><input type="checkbox" checked={showNotes} onChange={e=>setShowNotes(e.target.checked)} />共有メモ</label><Button size="icon" variant="ghost" title="カレンダーを更新" aria-label="カレンダーを更新" onClick={()=>setReload(n=>n+1)}><RefreshCw /></Button></div>
    {error?<p className="form-error" role="alert">{error}</p>:!data?<p className="workspace-message" role="status"><LoaderCircle className="animate-spin" />カレンダーを読み込み中</p>:<>
      <div className="calendar-grid" role="group" aria-label={month+'のカレンダー'}>{['日','月','火','水','木','金','土'].map(d=><span key={d} className="calendar-weekday">{d}</span>)}{calendarDays(month).map((date,index)=>{
        if(!date)return <span key={'blank-'+index} className="calendar-blank" />;
        const dayRows=entries.filter(e=>e.date===date), actual=calendarActualTotal(dayRows), count=dayRows.filter(e=>e.kind==='expense').length;
        const marks=[...new Set(dayRows.map(e=>e.kind==='expense'?'expense':['plan','recurring'].includes(e.kind)?'plan':'note'))];
        return <button type="button" key={date} className="calendar-day" aria-pressed={selectedDate===date} aria-current={date===todayInJapan()?'date':undefined} aria-label={`${formatExpenseDate(date)} 支出${count}件 ${formatYen(actual)}${dayRows.length>count?' 予定・メモあり':''}`} onClick={()=>setSelected(date)}><time dateTime={date}>{Number(date.slice(8))}</time><strong>{count?compact.format(actual):''}</strong><span className="calendar-marks" aria-hidden="true">{marks.map(kind=><i key={kind} className={kind} />)}</span></button>;
      })}</div>
      <button type="button" className="calendar-undated" aria-pressed={selectedDate===month} onClick={()=>setSelected(month)}><span>日付未定・月のみ <small>{undated.length}件</small></span><strong>{formatYen(calendarActualTotal(undated))}</strong></button>
      <div className="calendar-agenda"><div className="ledger-heading"><h2>{selectedDate===month?'日付未定・月のみ':formatExpenseDate(selectedDate)}</h2><div className="toolbar-actions"><Button size="icon" variant="outline" title="この日にメモを追加" aria-label="この日にメモを追加" onClick={()=>onNote(selectedDate)}><StickyNote /></Button><Button size="icon" variant="outline" title="この日に支出を記録" aria-label="この日に支出を記録" onClick={()=>onAdd(selectedDate)}><Plus /></Button></div></div>
        {!rows.length?<p className="workspace-message">この日の記録はありません</p>:<ul>{rows.map(entry=>{const cat=masters.categories.find(c=>c.id===entry.categoryId);return <li key={entry.kind+entry.id}><button type="button" className="calendar-entry" onClick={()=>onOpen(entry)}><span><small className={'calendar-kind '+entry.kind}>{calendarLabels[entry.kind]}{entry.completed?'・完了':''}</small><strong>{entry.name||(cat?categoryName(cat,masters.categories):'支出')}</strong>{cat&&entry.name&&<small><i className="category-dot" style={{backgroundColor:cat.color}} />{categoryName(cat,masters.categories)}</small>}</span>{entry.amount!==null?<strong>{formatYen(entry.amount)}</strong>:['plan','recurring'].includes(entry.kind)?<small>金額未定</small>:null}</button></li>;})}</ul>}
      </div>
    </>}
  </section>;
}
