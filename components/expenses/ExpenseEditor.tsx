'use client';
import { FormEvent, useRef, useState } from 'react';
import { LoaderCircle, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseCategory, ExpenseRecord, expenseFields, todayInJapan } from '@/lib/expenses';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';
import { CategorySelect } from './CategorySelect';

export function ExpenseEditor({ expense, categories, onClose, onSaved, onDelete }: {
  expense: ExpenseRecord | null; categories: ExpenseCategory[]; onClose: () => void;
  onSaved: (expense: ExpenseRecord) => void; onDelete: (expense: ExpenseRecord) => void;
}) {
  const [id] = useState(() => expense?.id ?? crypto.randomUUID());
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [monthOnly, setMonthOnly] = useState(expense?.date.length === 7);
  const [date, setDate] = useState(expense?.date.length === 7 ? '' : expense?.date ?? todayInJapan());
  const [month, setMonth] = useState((expense?.date ?? todayInJapan()).slice(0, 7));
  const [categoryId, setCategory] = useState(expense?.categoryId ?? 'food');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [memo, setMemo] = useState(expense?.memo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError('');
    const parsed = expenseFields.safeParse({ amount: Number(amount), date: monthOnly ? month : date, categoryId, description, memo });
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
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="expense-dialog" onInteractOutside={event => event.preventDefault()}>
      <DialogHeader><DialogTitle>{expense ? '支出を編集' : '支出を記録'}</DialogTitle><DialogDescription className="sr-only">支出の入力</DialogDescription></DialogHeader>
      <form className="expense-form" onSubmit={save}>
        <label htmlFor="expense-amount">金額（円）</label>
        <input id="expense-amount" className="amount-field" type="text" inputMode="numeric" pattern="[0-9]+" maxLength={9} autoFocus required value={amount} disabled={busy} onChange={e => setAmount(e.target.value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)))} />
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
        <label htmlFor="expense-category">カテゴリ</label>
        <CategorySelect id="expense-category" label="カテゴリ" value={categoryId} disabled={busy} categories={categories} onChange={value => setCategory(value as ExpenseRecord['categoryId'])} />
        <label htmlFor="expense-description">内容 <span className="muted-text">任意</span></label><input id="expense-description" maxLength={120} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} />
        <label htmlFor="expense-memo">メモ <span className="muted-text">任意</span></label><textarea id="expense-memo" maxLength={1000} rows={3} value={memo} disabled={busy} onChange={e => setMemo(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="editor-actions">
          {expense && <Button type="button" variant="ghost" className="delete-action" disabled={busy} onClick={() => onDelete(expense)}><Trash2 />削除</Button>}
          <div className="editor-save"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>キャンセル</Button><Button type="submit" disabled={busy} className="primary-action">{busy ? <LoaderCircle className="animate-spin" /> : <Save />}保存</Button></div>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
