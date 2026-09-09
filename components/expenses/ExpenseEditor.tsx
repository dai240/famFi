'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, LoaderCircle, Save, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseFields, ExpenseRecord, validatedExpenseFields, todayInJapan } from '@/lib/expenses';
import { Masters } from '@/lib/ledger';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { CategorySelect } from './CategorySelect';
import { ReferenceSelect } from './ReferenceSelect';
import { MasterManager } from './MasterManager';

export function ExpenseEditor({ expense, initial, initialMonth, masters, onMastersChanged, onClose, onSaved, onDelete, onDuplicate }: {
  expense: ExpenseRecord | null; initial?: ExpenseRecord; initialMonth: string; masters: Masters; onMastersChanged: (masters: Masters) => void; onClose: () => void;
  onSaved: (expense: ExpenseRecord) => void; onDelete: (expense: ExpenseRecord) => void;
  onDuplicate: (expense: ExpenseRecord) => void;
}) {
  const categories = masters.categories;
  const seed = expense ?? initial;
  const initialDate = seed?.date ?? (initialMonth === todayInJapan().slice(0,7) ? todayInJapan() : initialMonth);
  const [id] = useState(() => expense?.id ?? crypto.randomUUID());
  const [amount, setAmount] = useState(seed ? String(seed.amount) : '');
  const [monthOnly, setMonthOnly] = useState(initialDate.length === 7);
  const [date, setDate] = useState(initialDate.length === 7 ? '' : initialDate);
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [categoryId, setCategory] = useState(seed?.categoryId ?? categories.find(c => !c.archived && !c.parentId)?.id ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  const [memo, setMemo] = useState(seed?.memo ?? '');
  const [usedByPartyId, setUsedBy] = useState(seed?.usedByPartyId ?? null);
  const [beneficiaryPartyId, setBeneficiary] = useState(seed?.beneficiaryPartyId ?? null);
  const [paidByPartyId, setPaidBy] = useState(seed?.paidByPartyId ?? null);
  const [paymentSourceId, setPaymentSource] = useState(seed?.paymentSourceId ?? null);
  const [reimbursementStatus, setReimbursementStatus] = useState<ExpenseFields['reimbursementStatus']>(seed?.reimbursementStatus ?? 'unknown');
  const [reimbursementFromPartyId, setFrom] = useState(seed?.reimbursementFromPartyId ?? null);
  const [reimbursementToPartyId, setTo] = useState(seed?.reimbursementToPartyId ?? null);
  const [reimbursementAmount, setReimbursementAmount] = useState(seed?.reimbursementAmount ? String(seed.reimbursementAmount) : '');
  const [details, setDetails] = useState(Boolean(seed?.usedByPartyId || seed?.beneficiaryPartyId || seed?.paymentSourceId || seed?.paidByPartyId || (seed && seed.reimbursementStatus !== 'unknown')));
  const [managing, setManaging] = useState<'categories'|'parties'|'payment-sources'|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const fields = { amount: Number(amount), date: monthOnly ? month : date, categoryId, description, memo, usedByPartyId, beneficiaryPartyId, paidByPartyId, paymentSourceId,
    reimbursementStatus, reimbursementFromPartyId: reimbursementStatus === 'required' ? reimbursementFromPartyId : null, reimbursementToPartyId: reimbursementStatus === 'required' ? reimbursementToPartyId : null, reimbursementAmount: reimbursementStatus === 'required' ? Number(reimbursementAmount) : 0 };
  const initialFields = useRef(JSON.stringify(fields));
  const dirty = JSON.stringify(fields) !== initialFields.current;
  const financialLocked = Boolean(expense?.settledAmount);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function close() { if (!busy && ( !dirty || window.confirm('入力中の変更を破棄しますか？'))) onClose(); }
  const partyOptions = (selected: string | null, peopleOnly = false) => masters.parties.filter(p => (!peopleOnly || p.kind === 'person') && (!p.archived || p.id === selected));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError('');
    const parsed = validatedExpenseFields.safeParse(fields);
    if (!/^\d+$/.test(amount) || !parsed.success) { setError('金額・日付・入力内容を確認してください。'); return; }
    lock.current = true; setBusy(true);
    try {
      const row = await requestJson<ExpenseRecord>(expense ? `/api/expenses/${id}` : '/api/expenses', {
        method: expense ? 'PUT' : 'POST', body: JSON.stringify({ ...parsed.data, ...(expense ? { version: expense.version } : { id }) }),
      });
      onSaved(row);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) window.location.replace('/login');
      else setError(errorMessage(error));
    } finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="expense-dialog" onInteractOutside={event => event.preventDefault()}>
      <DialogHeader><DialogTitle>{expense ? '支出を編集' : '支出を記録'}</DialogTitle><DialogDescription className="sr-only">支出の入力</DialogDescription></DialogHeader>
      <form className="expense-form" onSubmit={save}>
        <label htmlFor="expense-amount">金額（円）</label>
        <input id="expense-amount" className="amount-field" type="text" inputMode="numeric" pattern="[0-9]+" maxLength={9} autoFocus required value={amount} disabled={busy || financialLocked} onChange={e => setAmount(e.target.value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)))} />
        <fieldset className="expense-date-fields" disabled={busy}>
          <legend>支出日</legend>
          <div className="date-mode" role="radiogroup" aria-label="日付の指定方法">
            <label><input type="radio" name="date-mode" checked={!monthOnly} onChange={() => { setMonthOnly(false); if (date.slice(0, 7) !== month) setDate(''); }} /><span>日付指定</span></label>
            <label><input type="radio" name="date-mode" checked={monthOnly} onChange={() => { setMonthOnly(true); if (date) setMonth(date.slice(0, 7)); }} /><span>月のみ</span></label>
          </div>
          {monthOnly
            ? <input id="expense-month" aria-label="支出月" type="month" required min="2000-01" max="2099-12" value={month} onChange={e => setMonth(e.target.value)} />
            : <input id="expense-date" aria-label="支出日" type="date" required min="2000-01-01" max="2099-12-31" value={date} onChange={e => setDate(e.target.value)} />}
        </fieldset>
        <div className="field-heading"><label htmlFor="expense-category">カテゴリ</label><Button type="button" size="icon" variant="ghost" title="カテゴリを管理" aria-label="カテゴリを管理" disabled={busy} onClick={() => setManaging('categories')}><Settings2 /></Button></div>
        <CategorySelect id="expense-category" label="カテゴリ" value={categoryId} disabled={busy} categories={categories} onChange={value => setCategory(value as ExpenseRecord['categoryId'])} />
        <label htmlFor="expense-description">内容 <span className="muted-text">任意</span></label><input id="expense-description" maxLength={120} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} />
        <Button type="button" variant="ghost" className="details-toggle" aria-expanded={details} aria-controls="expense-details" onClick={() => setDetails(!details)}><ChevronDown className={details ? 'rotate-180' : ''} />人物・支払元・立替</Button>
        {details && <div id="expense-details" className="expense-details">
          <div className="field-heading"><label htmlFor="expense-used-by">使った人 <span className="muted-text">任意</span></label><Button type="button" size="icon" variant="ghost" title="人物を管理" aria-label="人物を管理" disabled={busy} onClick={() => setManaging('parties')}><Settings2 /></Button></div>
          <ReferenceSelect id="expense-used-by" label="使った人" value={usedByPartyId} disabled={busy} options={partyOptions(usedByPartyId,true)} onChange={setUsedBy} />
          <label htmlFor="expense-beneficiary">誰のため <span className="muted-text">任意</span></label><ReferenceSelect id="expense-beneficiary" label="誰のため" value={beneficiaryPartyId} disabled={busy} options={partyOptions(beneficiaryPartyId)} onChange={setBeneficiary} />
          <div className="field-heading"><label htmlFor="expense-payment">支払元 <span className="muted-text">任意</span></label><Button type="button" size="icon" variant="ghost" title="支払元を管理" aria-label="支払元を管理" disabled={busy} onClick={() => setManaging('payment-sources')}><Settings2 /></Button></div>
          <ReferenceSelect id="expense-payment" label="支払元" value={paymentSourceId} disabled={busy || financialLocked} options={masters.paymentSources.filter(p => !p.archived || p.id === paymentSourceId)} onChange={value => { setPaymentSource(value); const funding = masters.paymentSources.find(p => p.id === value)?.fundingPartyId; if (funding && masters.parties.some(p => p.id === funding && !p.archived)) setPaidBy(funding); }} />
          <label htmlFor="expense-paid-by">支払者・資金の負担元 <span className="muted-text">任意</span></label><ReferenceSelect id="expense-paid-by" label="支払者・資金の負担元" value={paidByPartyId} disabled={busy || financialLocked} options={partyOptions(paidByPartyId)} onChange={setPaidBy} />
          <label htmlFor="expense-reimbursement">精算の要否</label><ReferenceSelect id="expense-reimbursement" label="精算の要否" value={reimbursementStatus} disabled={busy || financialLocked} options={[{ id:'unknown',name:'未設定・あとで確認' },{ id:'not_required',name:'精算不要' },{ id:'required',name:'立替・精算が必要' }]} emptyLabel="選択してください" onChange={value => { if (value) setReimbursementStatus(value as ExpenseFields['reimbursementStatus']); }} />
          {reimbursementStatus === 'required' && <>
            <label htmlFor="expense-from">返す側</label><ReferenceSelect id="expense-from" label="返す側" value={reimbursementFromPartyId} disabled={busy || financialLocked} options={partyOptions(reimbursementFromPartyId)} onChange={setFrom} />
            <label htmlFor="expense-to">受け取る側（立替者）</label><ReferenceSelect id="expense-to" label="受け取る側（立替者）" value={reimbursementToPartyId} disabled={busy || financialLocked} options={partyOptions(reimbursementToPartyId)} onChange={setTo} />
            <div className="field-heading"><label htmlFor="expense-reimbursement-amount">精算対象額（円）</label><Button type="button" variant="ghost" disabled={busy || financialLocked} onClick={() => setReimbursementAmount(amount)}>全額</Button></div><input id="expense-reimbursement-amount" inputMode="numeric" pattern="[0-9]+" maxLength={9} required value={reimbursementAmount} disabled={busy || financialLocked} onChange={e => setReimbursementAmount(e.target.value)} />
          </>}
          {financialLocked && <p className="muted-text">精算記録あり。金額・支払元・精算対象の変更は精算取消後に可能です。</p>}
        </div>}
        <label htmlFor="expense-memo">メモ <span className="muted-text">任意</span></label><textarea id="expense-memo" maxLength={1000} rows={3} value={memo} disabled={busy} onChange={e => setMemo(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="editor-actions">
          {expense && <div className="editor-tools"><Button type="button" variant="ghost" className="delete-action" disabled={busy || expense.settlements.length > 0} onClick={() => onDelete(expense)}><Trash2 />削除</Button><Button type="button" variant="ghost" size="icon" title="複製して新しく記録" aria-label="複製して新しく記録" disabled={busy} onClick={() => { const parsed = validatedExpenseFields.safeParse(fields); if (parsed.success) onDuplicate({ ...expense, ...parsed.data, settlements: [], settledAmount: 0 }); else setError('入力内容を確認してください。'); }}><Copy /></Button></div>}
          <div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={close}>キャンセル</Button><Button type="submit" disabled={busy} className="primary-action">{busy ? <LoaderCircle className="animate-spin" /> : <Save />}保存</Button></div>
        </div>
      </form>
    </DialogContent>
    {managing && <MasterManager initialKind={managing} masters={masters} onChange={onMastersChanged} onClose={() => setManaging(null)} />}
  </Dialog>;
}
