'use client';
import { useId, useState } from 'react';
import { ChevronUp, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dateSchema, formatExpenseDate, monthSchema, todayInJapan } from '@/lib/expenses';

export function ExpenseDateField({date,onChange,disabled=false,compact=false}:{date:string;onChange:(date:string)=>void;disabled?:boolean;compact?:boolean}) {
  const [monthOnly,setMonthOnly]=useState(date.length===7);
  const [lastDay,setLastDay]=useState(date.length===10?date:'');
  const [expanded,setExpanded]=useState(!compact);
  const id=useId();
  const valid=(monthOnly?monthSchema:dateSchema).safeParse(date).success;
  const showFields=expanded||!valid;
  return <fieldset className="expense-date-fields" disabled={disabled}>
    <legend>支出日</legend>
    {compact&&<div className="compact-date-summary"><span>{valid?formatExpenseDate(date):'未入力'}{date===todayInJapan()&&<small>今日</small>}</span><Button type="button" size="icon" variant="ghost" disabled={disabled||showFields&&!valid} title={showFields?'支出日を折りたたむ':'支出日を変更'} aria-label={showFields?'支出日を折りたたむ':'支出日を変更'} aria-expanded={showFields} aria-controls={id} onClick={()=>setExpanded(!showFields)}>{showFields?<ChevronUp />:<Pencil />}</Button></div>}
    <div id={id} hidden={!showFields}>{showFields&&<><div className="date-mode" role="radiogroup" aria-label="日付の指定方法">
      <label><input type="radio" name={id+'-mode'} checked={!monthOnly} onChange={()=>{setMonthOnly(false);onChange(lastDay.slice(0,7)===date?lastDay:'');}} /><span>日付指定</span></label>
      <label><input type="radio" name={id+'-mode'} checked={monthOnly} onChange={()=>{setMonthOnly(true);if(date.length===10)setLastDay(date);onChange(date.slice(0,7));}} /><span>月のみ</span></label>
    </div>{monthOnly?<input key="month" id="expense-month" aria-label="支出月" type="month" required min="2000-01" max="2099-12" value={date} onChange={e=>onChange(e.target.value)} />:<input key="day" id="expense-date" aria-label="支出日" type="date" required min="2000-01-01" max="2099-12-31" value={date} onChange={e=>onChange(e.target.value)} />}</>}</div>
  </fieldset>;
}
