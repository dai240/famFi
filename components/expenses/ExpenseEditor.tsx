'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Copy, History, LoaderCircle, Save, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseFields, ExpenseRecord, expenseFields, validatedExpenseFields } from '@/lib/expenses';
import { Masters } from '@/lib/ledger';
import { newExpense, personLabel } from '@/lib/household';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { CategorySelect } from './CategorySelect';
import { PaymentFields } from './PaymentFields';
import { MasterManager } from './MasterManager';
import { HistoryView } from './HistoryView';
import { CostClassSelect } from './CostClassSelect';

export function ExpenseEditor({ expense, initial, masters, onMastersChanged, onClose, onSaved, onDelete, onDuplicate, saveOverride, title, continueEntry=false }: {
  expense: ExpenseRecord | null; initial?: ExpenseRecord; initialMonth: string; masters: Masters; onMastersChanged: (masters: Masters) => void; onClose: () => void;
  onSaved: (expense: ExpenseRecord, keepOpen?: boolean) => void; onDelete: (expense: ExpenseRecord) => void; onDuplicate: (expense: ExpenseRecord) => void;
  saveOverride?:(id:string,fields:ExpenseFields)=>Promise<ExpenseRecord>;title?:string;continueEntry?:boolean;
}) {
  const seed=expense??initial;
  const [id]=useState(()=>expense?.id??crypto.randomUUID());
  const [fields,setFields]=useState<ExpenseFields>(()=>seed?{...expenseFields.omit({amount:true}).strip().parse(seed),amount:seed.amount}:newExpense(masters));
  const [monthOnly,setMonthOnly]=useState(fields.date.length===7);
  const [lastDay,setLastDay]=useState(fields.date.length===10?fields.date:'');
  const [managing,setManaging]=useState<'categories'|'parties'|'payment-sources'|null>(null);
  const [history,setHistory]=useState(false);
  const [keepOpen,setKeepOpen]=useState(continueEntry);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  const baseline=useRef(JSON.stringify(fields));const dirty=JSON.stringify(fields)!==baseline.current;
  const financialLocked=Boolean(expense?.settledAmount);
  const patch=(values:Partial<ExpenseFields>)=>setFields(old=>({...old,...values}));
  useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload);},[dirty]);
  function close(){if(!busy&&(!dirty||window.confirm('入力中の変更を破棄しますか？')))onClose();}
  async function save(event:FormEvent){
    event.preventDefault();if(lock.current)return;setError('');const parsed=validatedExpenseFields.safeParse(fields);
    if(!parsed.success){setError(parsed.error.issues[0]?.message??'入力内容を確認してください。');return;}
    const monthChanged=Boolean(expense?.summaryId&&expense.date.slice(0,7)!==parsed.data.date.slice(0,7));
    if(monthChanged&&!window.confirm('まとめ記録に含まれる明細の月が変わるため、月別の支出合計が変わります。保存しますか？'))return;
    lock.current=true;setBusy(true);
    try{const row=saveOverride?await saveOverride(id,parsed.data):await requestJson<ExpenseRecord>(expense?'/api/expenses/'+id:'/api/expenses',{method:expense?'PUT':'POST',body:JSON.stringify({...parsed.data,...(expense?{version:expense.version,allowMonthChange:monthChanged}:{id})})});onSaved(row,keepOpen&&!expense&&!saveOverride);}
    catch(error){if(error instanceof RequestError&&error.status===401)window.location.replace('/login');else setError(errorMessage(error));}
    finally{lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open)close();}}>
    <DialogContent className="expense-dialog expense-entry-dialog" onInteractOutside={e=>e.preventDefault()} onOpenAutoFocus={e=>e.preventDefault()}>
      <DialogHeader><DialogTitle>{title??(expense?'支出を編集':'支出を記録')}</DialogTitle><DialogDescription className="sr-only">支出の入力</DialogDescription></DialogHeader>
      <form id={'expense-form-'+id} className="expense-form" onSubmit={save}>
        <div className="field-heading"><label htmlFor="expense-category">カテゴリ</label><Button type="button" size="icon" variant="ghost" title="カテゴリを管理" aria-label="カテゴリを管理" disabled={busy} onClick={()=>setManaging('categories')}><Settings2 /></Button></div>
        <CategorySelect id="expense-category" label="カテゴリ" value={fields.categoryId} disabled={busy} categories={masters.categories} onChange={categoryId=>patch({categoryId,...(!expense?{costClass:masters.categories.find(c=>c.id===categoryId)?.costClass??'unknown'}:{})})} />
        <label htmlFor="expense-amount">金額（円）</label><input id="expense-amount" className="amount-field" type="text" inputMode="numeric" pattern="[0-9]+" maxLength={9} required value={fields.amount||''} disabled={busy||financialLocked} onChange={e=>{const raw=e.target.value.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));if(/^\d*$/.test(raw)){const amount=Number(raw);patch({amount,...(fields.reimbursementStatus==='required'&&fields.reimbursementAmount===fields.amount?{reimbursementAmount:amount}:{})});}}} />
        <label htmlFor="expense-description">内容 <span className="muted-text">任意</span></label><input id="expense-description" maxLength={120} value={fields.description} disabled={busy} onChange={e=>patch({description:e.target.value})} />
        <label>費用の区分</label><CostClassSelect value={fields.costClass} onChange={costClass=>patch({costClass})} disabled={busy} />
        {expense?.summaryId&&<p className="muted-text">まとめ記録の明細</p>}
        <PaymentFields fields={fields} masters={masters} onChange={patch} disabled={busy} financialLocked={financialLocked} onManage={setManaging} />
        <fieldset className="expense-date-fields" disabled={busy}><legend>支出日</legend><div className="date-mode" role="radiogroup" aria-label="日付の指定方法">
          <label><input type="radio" name="date-mode" checked={!monthOnly} onChange={()=>{setMonthOnly(false);patch({date:lastDay.slice(0,7)===fields.date?lastDay:''});}} /><span>日付指定</span></label>
          <label><input type="radio" name="date-mode" checked={monthOnly} onChange={()=>{setMonthOnly(true);if(fields.date.length===10)setLastDay(fields.date);patch({date:fields.date.slice(0,7)});}} /><span>月のみ</span></label>
        </div>{monthOnly?<input id="expense-month" aria-label="支出月" type="month" required min="2000-01" max="2099-12" value={fields.date} onChange={e=>patch({date:e.target.value})} />:<input id="expense-date" aria-label="支出日" type="date" required min="2000-01-01" max="2099-12-31" value={fields.date} onChange={e=>patch({date:e.target.value})} />}</fieldset>
        <label htmlFor="expense-memo">メモ <span className="muted-text">任意</span></label><textarea id="expense-memo" maxLength={1000} rows={2} value={fields.memo} disabled={busy} onChange={e=>patch({memo:e.target.value})} />
        {expense&&<div className="record-attribution"><span>記録：{personLabel(expense.recordedByPartyId??null,masters)}</span>{expense.updatedByPartyId&&<span>最終変更：{personLabel(expense.updatedByPartyId,masters)}</span>}<Button type="button" variant="ghost" size="icon" title="この支出の変更履歴" aria-label="この支出の変更履歴" onClick={()=>setHistory(true)}><History /></Button></div>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {!expense&&!saveOverride&&<label className="check-label"><input type="checkbox" checked={keepOpen} disabled={busy} onChange={e=>setKeepOpen(e.target.checked)} />保存後も続けて登録</label>}
      </form>
        <div className="editor-actions">{expense&&<div className="editor-tools"><Button type="button" variant="ghost" className="delete-action" disabled={busy||expense.settlements.length>0} onClick={()=>{if(!dirty||window.confirm('入力中の変更を破棄しますか？'))onDelete(expense);}}><Trash2 />削除</Button><Button type="button" variant="ghost" size="icon" title="複製して新しく記録" aria-label="複製して新しく記録" disabled={busy} onClick={()=>{const parsed=validatedExpenseFields.safeParse(fields);if(parsed.success)onDuplicate({...expense,...parsed.data,settlements:[],settledAmount:0});else setError('入力内容を確認してください。');}}><Copy /></Button></div>}<div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={close}>キャンセル</Button><Button type="submit" form={'expense-form-'+id} disabled={busy} className="primary-action">{busy?<LoaderCircle className="animate-spin" />:<Save />}保存</Button></div></div>
    </DialogContent>
    {managing&&<MasterManager initialKind={managing} masters={masters} onChange={onMastersChanged} onClose={()=>setManaging(null)} />}
    {history&&expense&&<Dialog open onOpenChange={open=>{if(!open)setHistory(false);}}><DialogContent className="expense-dialog master-dialog"><DialogHeader><DialogTitle>支出の変更履歴</DialogTitle><DialogDescription className="sr-only">登録後の変更</DialogDescription></DialogHeader><HistoryView masters={masters} entityType="expenses" entityId={expense.id} /></DialogContent></Dialog>}
  </Dialog>;
}
