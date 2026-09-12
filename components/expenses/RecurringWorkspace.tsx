'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, LoaderCircle, Pencil, Plus, RefreshCw, Save, SkipForward, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseFields, ExpenseRecord, formatYen, shiftMonth, todayInJapan } from '@/lib/expenses';
import { Masters, categoryName } from '@/lib/ledger';
import { draftRecord, newExpense } from '@/lib/household';
import { RecurringFields, RecurringResponse, RecurringRule, isDue, recurringExpense, recurringFields, recurringReviewDate, recurringOverview, validatedRecurringFields } from '@/lib/recurring';
import { confirmProvisionalFields, isProvisionalRule } from '@/lib/sample-data';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { CategorySelect } from './CategorySelect';
import { PaymentFields } from './PaymentFields';
import { ExpenseEditor } from './ExpenseEditor';
import { CostClassSelect } from './CostClassSelect';
import { ReferenceSelect } from './ReferenceSelect';
import { SnoozeDialog } from './SnoozeDialog';
import { PlansWorkspace } from './PlansWorkspace';

export function RecurringWorkspace({initialMonth,externalRevision,onEdit,onChanged,onMastersChanged}:{initialMonth:string;externalRevision:number;onEdit:(row:ExpenseRecord)=>void;onChanged:()=>void;onMastersChanged:(masters:Masters)=>void}){
  const [month,setMonth]=useState(initialMonth);const [view,setView]=useState('due');const [data,setData]=useState<RecurringResponse|null>(null);
  const [revision,setRevision]=useState(0);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  const [editing,setEditing]=useState<{rule:RecurringRule|null;key:string}|null>(null);const [confirming,setConfirming]=useState<RecurringRule|null>(null);
  const [snoozing,setSnoozing]=useState<RecurringRule|null>(null);
  const refresh=()=>setRevision(n=>n+1);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError('');requestJson<RecurringResponse>('/api/recurring?month='+month,{signal:c.signal}).then(result=>{if(!c.signal.aborted)setData(result);}).catch(error=>{if(c.signal.aborted)return;if(error instanceof RequestError&&error.status===401)window.location.replace('/login');else setError(errorMessage(error));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[month,revision,externalRevision]);
  function changeMonth(value:string){if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))setMonth(value);}
  async function action(rule:RecurringRule,mode:'skip'|'reopen'|'edit'){
    if(lock.current||!data)return;toast.dismiss();lock.current=true;setBusy(true);setError('');
    try{const occurrence=data.occurrences.find(o=>o.ruleId===rule.id);
      if(mode==='edit'&&occurrence?.expenseId)onEdit(await requestJson<ExpenseRecord>('/api/expenses/'+occurrence.expenseId));
      else{await requestJson('/api/recurring/'+rule.id+'/occurrences',{method:'POST',body:JSON.stringify({action:mode,period:month,ruleVersion:rule.version,occurrenceVersion:occurrence?.version??0})});refresh();onChanged();}
    }catch(error){setError(errorMessage(error));}finally{lock.current=false;setBusy(false);}
  }
  const overview=recurringOverview(data?.rules??[],data?.occurrences??[],month);
  const rows=view==='plans'?[]:view==='due'?overview.rows:data?.rules??[];
  return <main className="expense-main recurring-workspace">
    <div className="workspace-heading"><div><p className="section-eyebrow">家計簿</p><h1>予定・定期</h1></div>{view!=='plans'&&<Button className="primary-action" disabled={!data||loading||busy} onClick={()=>setEditing({rule:null,key:crypto.randomUUID()})}><Plus />定期支出</Button>}</div>
    <div className="expense-toolbar"><div className="month-selector"><Button variant="ghost" size="icon" aria-label="定期支出の前月" disabled={month==='2000-01'} onClick={()=>changeMonth(shiftMonth(month,-1))}><ChevronLeft /></Button><input aria-label="定期支出の表示月" type="month" min="2000-01" max="2099-12" value={month} onChange={e=>changeMonth(e.target.value)} /><Button variant="ghost" size="icon" aria-label="定期支出の翌月" disabled={month==='2099-12'} onClick={()=>changeMonth(shiftMonth(month,1))}><ChevronRight /></Button></div><Button variant="ghost" size="icon" aria-label="定期支出を更新" title="定期支出を更新" disabled={loading||busy} onClick={refresh}><RefreshCw className={loading?'animate-spin':''} /></Button></div>
    <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="due">定期・この月</TabsTrigger><TabsTrigger value="all">定期の設定</TabsTrigger><TabsTrigger value="plans">単発の予定</TabsTrigger></TabsList></Tabs>
    {view==='plans'&&data&&<PlansWorkspace month={month} masters={data.masters} revision={externalRevision} onChanged={onChanged} onEdit={onEdit} onMastersChanged={onMastersChanged} />}
    {view==='due'&&Boolean(data?.attention.filter(a=>a.kind==='recurring'&&a.period!==month).length)&&<div className="attention-list" aria-label="別の月の確認待ち">{data?.attention.filter(a=>a.kind==='recurring'&&a.period!==month).slice(0,10).map(a=><button key={a.id+a.period} type="button" onClick={()=>changeMonth(a.period)}>{a.period} · {a.name}<span>確認待ち</span></button>)}</div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {loading?<div className="workspace-message" role="status"><LoaderCircle className="animate-spin" />定期支出を読み込み中</div>:data&&<>
      {view==='due'&&<section className="recurring-summary" aria-label="定期支出の予定"><span>未登録 <strong>{overview.pendingCount}件</strong></span><span>基準額の合計 <strong>{formatYen(overview.baseAmount)}</strong></span><span>金額入力が必要 <strong>{overview.amountCheckCount}件</strong></span></section>}
      {view!=='plans'&&rows.some(isProvisionalRule)&&<p className="sample-notice" role="status">仮設定あり。金額・支払元・確認日の確認が必要です。サンプルの金額は前回額に使用しません。</p>}
      {view==='plans'?null:!rows.length?<p className="workspace-message">{view==='due'?'この月の定期支出はありません':'定期支出の設定なし'}</p>:<ul className="recurring-list">{rows.map(rule=>{
        const occurrence=data.occurrences.find(o=>o.ruleId===rule.id);const cat=data.masters.categories.find(c=>c.id===rule.categoryId);const state=occurrence?.state??'open';const active=isDue(rule,month);
        return <li key={rule.id}><div className="recurring-item-main"><div><strong>{rule.name}</strong><span>{cat&&<i className="category-dot" style={{backgroundColor:cat.color}} />}{cat?categoryName(cat,data.masters.categories):''}</span><small>{rule.frequency==='monthly'?'毎月':rule.frequency==='bimonthly'?'2か月ごと':'毎年 '+Number(rule.startMonth.slice(5))+'月'} · {rule.dueDay?rule.dueDay+'日（月末上限）':'月のみ'} · {data.masters.paymentSources.find(s=>s.id===rule.paymentSourceId)?.name}</small>{state==='open'&&<small>確認開始 {recurringReviewDate(rule,month,occurrence)}</small>}{data.previousAmounts[rule.id]!==undefined&&<small>前回 {formatYen(data.previousAmounts[rule.id])}</small>}</div><div className="recurring-amount"><strong>{rule.amount===null?(rule.amountMode==='previous'?'前回額':'毎回入力'):formatYen(rule.amount)}</strong><span>{view==='due'?(state==='posted'?'登録済み':state==='skipped'?'スキップ':recurringReviewDate(rule,month,occurrence)<=todayInJapan()?'確認待ち':'確認日前'):rule.archived?'停止中':rule.endMonth?'終了 '+rule.endMonth:'継続中'}</span></div></div>
          <div className="recurring-actions"><Button variant="ghost" size="icon" aria-label={rule.name+'の設定を編集'} title="設定を編集" disabled={busy} onClick={()=>setEditing({rule,key:rule.id})}><Pencil /></Button>{view==='due'&&(state==='posted'?<Button variant="outline" disabled={busy} onClick={()=>action(rule,'edit')}>登録済みの支出</Button>:state==='skipped'?<Button variant="outline" disabled={busy||!active} onClick={()=>action(rule,'reopen')}><Undo2 />スキップ取消</Button>:<><Button variant="ghost" size="icon" title="確認を後日にする" aria-label={rule.name+'の確認を後日にする'} disabled={busy||!active} onClick={()=>setSnoozing(rule)}><Clock3 /></Button><Button variant="ghost" size="icon" title="この月をスキップ" aria-label={rule.name+'をこの月はスキップ'} disabled={busy||!active} onClick={()=>action(rule,'skip')}><SkipForward /></Button>{isProvisionalRule(rule)?<Button variant="outline" disabled={busy||!active} onClick={()=>setEditing({rule,key:rule.id})}><Pencil />仮設定を確認</Button>:<Button variant="outline" disabled={busy||!active} onClick={()=>setConfirming(rule)}><Plus />この月を登録</Button>}</>)}</div>
        </li>;
      })}</ul>}
    </>}
    {editing&&data&&<RecurringEditor key={editing.key} rule={editing.rule} month={month} masters={data.masters} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);refresh();onChanged();toast.success('定期支出の設定を保存しました');}} />}
    {confirming&&data&&<ExpenseEditor key={confirming.id+month} title={confirming.name+'を登録'} expense={null} initial={draftRecord(recurringExpense(confirming,month,data.masters,data.previousAmounts[confirming.id]))} initialMonth={month} masters={data.masters} onMastersChanged={masters=>{setData(old=>old?{...old,masters}:old);onMastersChanged(masters);}} onClose={()=>setConfirming(null)} onDelete={()=>{}} onDuplicate={()=>{}} onSaved={()=>{setConfirming(null);refresh();onChanged();toast.success('この月の支出を登録しました');}} saveOverride={(id,fields)=>requestJson<ExpenseRecord>('/api/recurring/'+confirming.id+'/occurrences',{method:'POST',body:JSON.stringify({action:'post',period:month,ruleVersion:confirming.version,occurrenceVersion:data.occurrences.find(o=>o.ruleId===confirming.id)?.version??0,expenseId:id,expense:fields})})} />}
    {snoozing&&data&&<SnoozeDialog name={snoozing.name+' / '+month} onClose={()=>setSnoozing(null)} onSave={async until=>{await requestJson('/api/recurring/'+snoozing.id+'/occurrences',{method:'POST',body:JSON.stringify({action:'snooze',period:month,ruleVersion:snoozing.version,occurrenceVersion:data.occurrences.find(o=>o.ruleId===snoozing.id)?.version??0,until})});refresh();onChanged();}} />}
  </main>;
}

function RecurringEditor({rule,month,masters,onClose,onSaved}:{rule:RecurringRule|null;month:string;masters:Masters;onClose:()=>void;onSaved:()=>void}){
  const [id]=useState(()=>rule?.id??crypto.randomUUID());
  const provisional=Boolean(rule&&isProvisionalRule(rule));
  const [confirmed,setConfirmed]=useState(false);
  const [fields,setFields]=useState<RecurringFields>(()=>{
    if(rule)return recurringFields.strip().parse(rule);const expense=newExpense(masters);
    return {costClass:'unknown',reviewDay:null,reviewMonthOffset:0,name:'',amountMode:'fixed',amount:null,frequency:'monthly',startMonth:month,endMonth:null,dueDay:null,categoryId:expense.categoryId,paymentSourceId:expense.paymentSourceId??'',paymentTreatment:expense.paymentTreatment as RecurringFields['paymentTreatment'],usedByPartyId:expense.usedByPartyId,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',memo:'',archived:false};
  });
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);const baseline=useRef(JSON.stringify(fields));const dirty=confirmed||baseline.current!==JSON.stringify(fields);
  const patch=(input:Partial<RecurringFields>)=>setFields(old=>({...old,...input}));
  useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload);},[dirty]);
  function close(){if(!busy&&(!dirty||window.confirm('入力中の変更を破棄しますか？')))onClose();}
  async function save(event:FormEvent){event.preventDefault();if(lock.current)return;const parsed=validatedRecurringFields.safeParse(provisional&&confirmed?confirmProvisionalFields(fields):fields);if(!parsed.success){setError(parsed.error.issues[0]?.message??'入力内容を確認してください。');return;}if(confirmed&&isProvisionalRule(parsed.data)){setError('名称・メモに残っている仮設定の目印を確認してください。');return;}lock.current=true;setBusy(true);setError('');
    try{await requestJson(rule?'/api/recurring/'+id:'/api/recurring',{method:rule?'PUT':'POST',body:JSON.stringify({...parsed.data,...(rule?{version:rule.version,confirmProvisional:confirmed}:{id})})});onSaved();}catch(error){setError(errorMessage(error));}finally{lock.current=false;setBusy(false);}
  }
  const payment=recurringExpense(fields,fields.startMonth||todayInJapan().slice(0,7),masters);
  function paymentChange(input:Partial<ExpenseFields>){const allowed=['paymentSourceId','paymentTreatment','usedByPartyId','usedByText','beneficiaryKind','beneficiaryPartyId','beneficiaryText'] as const;patch(Object.fromEntries(allowed.filter(key=>key in input).map(key=>[key,input[key]])) as Partial<RecurringFields>);}
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()} onOpenAutoFocus={e=>e.preventDefault()}><DialogHeader><DialogTitle>定期支出を{rule?'編集':'追加'}</DialogTitle><DialogDescription className="sr-only">定期支出の予定設定</DialogDescription></DialogHeader>
    <form id={'rule-form-'+id} className="expense-form" onSubmit={save}>
      {provisional&&<><p className="sample-notice">架空の金額・日程を含む仮設定です。過去のサンプル支出は変更されません。</p><label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />実際の金額・支払元・確認日を確認済み</label></>}
      <label htmlFor="recurring-name">名称</label><input id="recurring-name" required maxLength={120} value={fields.name} disabled={busy} onChange={e=>patch({name:e.target.value})} />
      <label htmlFor="recurring-category">カテゴリ</label><CategorySelect id="recurring-category" label="カテゴリ" value={fields.categoryId} categories={masters.categories} disabled={busy} onChange={categoryId=>patch({categoryId,costClass:masters.categories.find(c=>c.id===categoryId)?.costClass??'unknown'})} />
      <label>金額の初期値</label><ReferenceSelect label="定期支出の金額の種類" value={fields.amountMode} options={[{id:'fixed',name:'基準額'},{id:'previous',name:'前回の確定額'},{id:'variable',name:'毎回入力'}]} disabled={busy} onChange={value=>{if(value)patch({amountMode:value as RecurringFields['amountMode'],amount:null});}} />
      <label>費用の区分</label><CostClassSelect value={fields.costClass} disabled={busy} onChange={costClass=>patch({costClass})} />
      {fields.amountMode==='fixed'&&<input aria-label="定期支出の金額（円）" type="text" inputMode="numeric" pattern="[0-9]+" required maxLength={9} value={fields.amount??''} disabled={busy} onChange={e=>{if(/^\d*$/.test(e.target.value))patch({amount:e.target.value?Number(e.target.value):null});}} />}
      <PaymentFields recurring fields={payment} masters={masters} onChange={paymentChange} disabled={busy} />
      <fieldset disabled={busy}><legend>周期</legend><div className="date-mode" role="radiogroup" aria-label="定期支出の周期">{(['monthly','bimonthly','yearly'] as const).map(frequency=><label key={frequency}><input type="radio" name="frequency" checked={fields.frequency===frequency} onChange={()=>patch({frequency})} /><span>{frequency==='monthly'?'毎月':frequency==='bimonthly'?'2か月ごと':'毎年'}</span></label>)}</div></fieldset>
      <label htmlFor="recurring-start">開始月</label><input id="recurring-start" type="month" required min="2000-01" max="2099-12" value={fields.startMonth} disabled={busy} onChange={e=>patch({startMonth:e.target.value})} />
      <label htmlFor="recurring-end">終了月 <span className="muted-text">任意</span></label><input id="recurring-end" type="month" min={fields.startMonth||'2000-01'} max="2099-12" value={fields.endMonth??''} disabled={busy} onChange={e=>patch({endMonth:e.target.value||null})} />
      <label className="check-label"><input type="checkbox" checked={fields.dueDay!==null} disabled={busy} onChange={e=>patch({dueDay:e.target.checked?1:null})} />計上日を指定</label>{fields.dueDay!==null&&<><label htmlFor="recurring-day">日（短い月は月末）</label><input id="recurring-day" type="number" min={1} max={31} required value={fields.dueDay||''} disabled={busy} onChange={e=>patch({dueDay:Number(e.target.value)})} /></>}
      <label className="check-label"><input type="checkbox" checked={fields.reviewDay!==null} disabled={busy} onChange={e=>patch({reviewDay:e.target.checked?31:null,reviewMonthOffset:0})} />確認開始日を指定</label>{fields.reviewDay!==null&&<><ReferenceSelect label="確認開始の月" value={String(fields.reviewMonthOffset)} options={[{id:'0',name:'当月'},{id:'1',name:'翌月'},{id:'2',name:'翌々月'}]} disabled={busy} onChange={v=>patch({reviewMonthOffset:Number(v)})} /><label htmlFor="review-day">日（31は月末）</label><input id="review-day" type="number" min={1} max={31} required value={fields.reviewDay||''} disabled={busy} onChange={e=>patch({reviewDay:Number(e.target.value)})} /></>}
      <label htmlFor="recurring-memo">メモ <span className="muted-text">任意</span></label><textarea id="recurring-memo" rows={2} maxLength={1000} value={fields.memo} disabled={busy} onChange={e=>patch({memo:e.target.value})} />
      {rule&&<label className="check-label"><input type="checkbox" checked={fields.archived} disabled={busy} onChange={e=>patch({archived:e.target.checked})} />停止する</label>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </form><div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={close}>キャンセル</Button><Button type="submit" form={'rule-form-'+id} className="primary-action" disabled={busy}>{busy?<LoaderCircle className="animate-spin" />:<Save />}保存</Button></div>
  </DialogContent></Dialog>;
}
