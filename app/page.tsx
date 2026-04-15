'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { uncategorizedCategoryId, uncategorizedSubCategoryId } from '@/lib/ledger/category-presets';
import { toMonthInputValue } from '@/lib/ledger/calculations';
import { getCurrentMonth, useLedgerData } from '@/lib/ledger/use-ledger-data';
import type { Category, Deposit, DepositInput, Expense, ExpenseFilters, ExpenseInput, ExpenseSource, Payer } from '@/lib/ledger/types';
import { payerLabels, sourceLabels } from '@/lib/ledger/types';

type View = 'expenses' | 'deposits' | 'summary';

type ExpenseForm = ExpenseInput;
type DepositForm = DepositInput;

const currencyFormatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

function toDisplayMonth(month: string) {
  const [year, value] = month.replace('/', '-').split('-');
  return `${year}年${Number(value)}月`;
}

function getVisibleSubCategories(category?: Category) {
  return category?.subCategories.filter((subCategory) => subCategory.isActive) || [];
}

function getInitialCategory(categories: Category[]) {
  return categories.find((category) => category.isActive) || categories[0];
}

function createExpenseForm(month: string, categories: Category[]): ExpenseForm {
  const category = getInitialCategory(categories);
  const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
  return {
    accountingMonth: month,
    date: '',
    categoryId: category?.id || uncategorizedCategoryId,
    subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
    item: '',
    description: '',
    amount: 0,
    payer: 'father',
    source: 'rakuten',
    reimbursed: false,
    beneficiary: '',
    comment: '',
  };
}

function createDepositForm(): DepositForm {
  return {
    date: new Date().toISOString().slice(0, 10),
    depositor: 'father',
    amount: 0,
    description: '',
    comment: '',
  };
}

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [view, setView] = useState<View>('expenses');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState<'all' | Payer>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ExpenseSource>('all');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(() => createExpenseForm(getCurrentMonth(), []));
  const [depositForm, setDepositForm] = useState<DepositForm>(() => createDepositForm());

  const ledger = useLedgerData();
  const ledgerCategories = ledger.categories;
  const refreshLedger = ledger.refresh;

  const activeCategories = useMemo(() => ledgerCategories.filter((category) => category.isActive), [ledgerCategories]);
  const categoryById = useMemo(() => new Map(ledgerCategories.map((category) => [category.id, category])), [ledgerCategories]);
  const selectedCategory = categoryById.get(expenseForm.categoryId);
  const selectedSubCategories = getVisibleSubCategories(selectedCategory);

  const filters = useMemo<Partial<ExpenseFilters>>(
    () => ({
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      payer: payerFilter === 'all' ? undefined : payerFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
    }),
    [categoryFilter, payerFilter, sourceFilter],
  );

  useEffect(() => {
    refreshLedger(currentMonth, filters);
  }, [currentMonth, filters, refreshLedger]);

  useEffect(() => {
    if (!showExpenseForm) return;
    const category = categoryById.get(expenseForm.categoryId) || getInitialCategory(ledgerCategories);
    const subCategories = getVisibleSubCategories(category);
    if (category && !subCategories.some((subCategory) => subCategory.id === expenseForm.subCategoryId)) {
      setExpenseForm((current) => ({
        ...current,
        categoryId: category.id,
        subCategoryId: subCategories[0]?.id || category.subCategories[0]?.id || uncategorizedSubCategoryId,
      }));
    }
  }, [categoryById, expenseForm.categoryId, expenseForm.subCategoryId, ledgerCategories, showExpenseForm]);

  const refresh = () => refreshLedger(currentMonth, filters);

  const startNewExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm(createExpenseForm(currentMonth, ledgerCategories));
    setShowExpenseForm(true);
  };

  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      accountingMonth: toMonthInputValue(expense.accountingMonth),
      date: expense.date || '',
      categoryId: expense.categoryId,
      subCategoryId: expense.subCategoryId,
      item: expense.item,
      description: expense.description,
      amount: expense.amount,
      payer: expense.payer,
      source: expense.source,
      reimbursed: expense.reimbursed,
      beneficiary: expense.beneficiary,
      comment: expense.comment,
    });
    setShowExpenseForm(true);
  };

  const saveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseForm.accountingMonth || !expenseForm.amount || expenseForm.amount < 0) return;
    const input = {
      ...expenseForm,
      accountingMonth: toMonthInputValue(expenseForm.accountingMonth),
      amount: Number(expenseForm.amount),
      reimbursed: expenseForm.source === 'advance' ? expenseForm.reimbursed : false,
    };
    if (editingExpenseId) {
      await ledger.updateExpense(editingExpenseId, input);
    } else {
      await ledger.createExpense(input);
    }
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    await refresh();
  };

  const deleteExpense = async (expense: Expense) => {
    if (!window.confirm(`No.${expense.no} の支出を削除しますか？`)) return;
    await ledger.deleteExpense(expense.id);
    await refresh();
  };

  const startNewDeposit = () => {
    setEditingDepositId(null);
    setDepositForm(createDepositForm());
    setShowDepositForm(true);
  };

  const editDeposit = (deposit: Deposit) => {
    setEditingDepositId(deposit.id);
    setDepositForm({
      date: deposit.date,
      depositor: deposit.depositor,
      amount: deposit.amount,
      description: deposit.description,
      comment: deposit.comment,
    });
    setShowDepositForm(true);
  };

  const saveDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!depositForm.date || !depositForm.amount || depositForm.amount < 0) return;
    const input = { ...depositForm, amount: Number(depositForm.amount) };
    if (editingDepositId) {
      await ledger.updateDeposit(editingDepositId, input);
    } else {
      await ledger.createDeposit(input);
    }
    setShowDepositForm(false);
    setEditingDepositId(null);
    await refresh();
  };

  const deleteDeposit = async (deposit: Deposit) => {
    if (!window.confirm(`No.${deposit.no} の入金を削除しますか？`)) return;
    await ledger.deleteDeposit(deposit.id);
    await refresh();
  };

  const selectCategory = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
    setExpenseForm((current) => ({
      ...current,
      categoryId,
      subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
    }));
  };

  const maxChartValue = Math.max(...ledger.summaryRows.map((row) => Math.max(row.depositTotal, row.sharedExpenses)), 1);

  return (
    <main className="app-shell">
      <header className="hero dashboard-hero">
        <div>
          <p className="eyebrow">FamFi MVP</p>
          <h1>共通支出だけ、ゆるく整える。</h1>
          <p className="lead">支出、入金、月次サマリをまず使える形に。保存先は現在 {ledger.backend === 'local' ? 'localStorage' : 'DB'} です。</p>
        </div>
        <div className="hero-actions">
          <Link className="text-link" href="/categories">カテゴリ管理</Link>
          <label className="month-picker">
            <span>計上年月</span>
            <input type="month" value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)} />
          </label>
        </div>
      </header>

      {ledger.error && <p className="error-banner">{ledger.error}</p>}

      <section className="summary-grid" aria-label="月次サマリ">
        <SummaryCard label="支出合計" value={currencyFormatter.format(ledger.summary.totalExpenses)} />
        <SummaryCard label="共通支出" value={currencyFormatter.format(ledger.summary.sharedExpenses)} />
        <SummaryCard label="実費支出" value={currencyFormatter.format(ledger.summary.personalExpenses)} />
        <SummaryCard label="入金合計" value={currencyFormatter.format(ledger.summary.depositTotal)} />
        <SummaryCard label="差分（共通）" value={currencyFormatter.format(ledger.summary.sharedBalance)} tone={ledger.summary.sharedBalance >= 0 ? 'good' : 'bad'} />
      </section>

      <nav className="tabs" aria-label="家計簿メニュー">
        <button className={view === 'expenses' ? 'active' : ''} onClick={() => setView('expenses')}>支出一覧</button>
        <button className={view === 'deposits' ? 'active' : ''} onClick={() => setView('deposits')}>入金一覧</button>
        <button className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>月次サマリ</button>
      </nav>

      {view === 'expenses' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Expenses</p>
              <h2>{toDisplayMonth(currentMonth)}の支出</h2>
            </div>
            <button className="primary-button" onClick={startNewExpense}>支出を追加</button>
          </div>

          <div className="filters">
            <label>カテゴリ<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">すべて</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>支払者<select value={payerFilter} onChange={(event) => setPayerFilter(event.target.value as 'all' | Payer)}><option value="all">すべて</option><option value="father">父</option><option value="mother">母</option></select></label>
            <label>財源<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | ExpenseSource)}><option value="all">すべて</option><option value="rakuten">楽天</option><option value="advance">支払者立替</option><option value="personal">実費</option></select></label>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>No</th><th>日付</th><th>カテゴリ</th><th>もの</th><th>金額</th><th>支払者</th><th>財源</th><th>立替済</th><th>操作</th></tr></thead>
              <tbody>
                {ledger.expenses.map((expense) => {
                  const category = categoryById.get(expense.categoryId);
                  const subCategory = category?.subCategories.find((item) => item.id === expense.subCategoryId);
                  return (
                    <tr key={expense.id}>
                      <td>{expense.no}</td>
                      <td>{expense.date || `${toDisplayMonth(expense.accountingMonth)}分`}</td>
                      <td><strong>{category?.name || '未分類'}</strong><span>{subCategory?.name || '未分類'}</span></td>
                      <td><strong>{expense.item || '-'}</strong>{expense.description && <span>{expense.description}</span>}</td>
                      <td className="amount">{currencyFormatter.format(expense.amount)}</td>
                      <td>{payerLabels[expense.payer]}</td>
                      <td>{sourceLabels[expense.source]}</td>
                      <td>{expense.source === 'advance' ? (expense.reimbursed ? '済' : '未') : '-'}</td>
                      <td className="actions"><button onClick={() => editExpense(expense)}>編集</button><button onClick={() => deleteExpense(expense)}>削除</button></td>
                    </tr>
                  );
                })}
                {ledger.expenses.length === 0 && <EmptyRow colSpan={9} text={ledger.isLoading ? '読み込み中です。' : 'この月の支出はまだありません。'} />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'deposits' && (
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Deposits</p><h2>{toDisplayMonth(currentMonth)}の入金</h2></div><button className="primary-button" onClick={startNewDeposit}>入金を追加</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>No</th><th>日付</th><th>入金者</th><th>説明</th><th>金額</th><th>コメント</th><th>操作</th></tr></thead>
              <tbody>
                {ledger.deposits.map((deposit) => <tr key={deposit.id}><td>{deposit.no}</td><td>{deposit.date}</td><td>{payerLabels[deposit.depositor]}</td><td>{deposit.description || '-'}</td><td className="amount">{currencyFormatter.format(deposit.amount)}</td><td>{deposit.comment || '-'}</td><td className="actions"><button onClick={() => editDeposit(deposit)}>編集</button><button onClick={() => deleteDeposit(deposit)}>削除</button></td></tr>)}
                {ledger.deposits.length === 0 && <EmptyRow colSpan={7} text={ledger.isLoading ? '読み込み中です。' : 'この月の入金はまだありません。'} />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'summary' && (
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Monthly</p><h2>月次サマリ</h2></div></div>
          <div className="chart" aria-label="入金と共通支出の比較">
            {ledger.summaryRows.map((row) => <div className="chart-row" key={row.month}><span>{toDisplayMonth(row.month)}</span><div className="bars"><div className="bar deposit" style={{ width: `${(row.depositTotal / maxChartValue) * 100}%` }}>入金 {currencyFormatter.format(row.depositTotal)}</div><div className="bar expense" style={{ width: `${(row.sharedExpenses / maxChartValue) * 100}%` }}>共通 {currencyFormatter.format(row.sharedExpenses)}</div></div></div>)}
          </div>
          <div className="table-wrap"><table><thead><tr><th>月</th><th>支出合計</th><th>共通支出</th><th>実費支出</th><th>入金合計</th><th>差分（共通）</th><th>共通プール累計</th></tr></thead><tbody>{ledger.summaryRows.map((row) => <tr key={row.month}><td>{toDisplayMonth(row.month)}</td><td className="amount">{currencyFormatter.format(row.totalExpenses)}</td><td className="amount">{currencyFormatter.format(row.sharedExpenses)}</td><td className="amount">{currencyFormatter.format(row.personalExpenses)}</td><td className="amount">{currencyFormatter.format(row.depositTotal)}</td><td className="amount">{currencyFormatter.format(row.sharedBalance)}</td><td className="amount">{currencyFormatter.format(row.cumulative)}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {showExpenseForm && (
        <Modal title={editingExpenseId ? '支出を編集' : '支出を追加'} onClose={() => setShowExpenseForm(false)}>
          <form className="record-form" onSubmit={saveExpense}>
            <label>計上年月<input type="month" required value={expenseForm.accountingMonth} onChange={(event) => setExpenseForm({ ...expenseForm, accountingMonth: event.target.value })} /></label>
            <label>日付<input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} /></label>
            <label>カテゴリ<select required value={expenseForm.categoryId} onChange={(event) => selectCategory(event.target.value)}>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>サブカテゴリ<select required value={expenseForm.subCategoryId} onChange={(event) => setExpenseForm({ ...expenseForm, subCategoryId: event.target.value })}>{selectedSubCategories.map((subCategory) => <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>)}</select></label>
            <label>もの<input value={expenseForm.item} onChange={(event) => setExpenseForm({ ...expenseForm, item: event.target.value })} placeholder="店名や品目" /></label>
            <label>金額<input type="number" min="0" required value={expenseForm.amount || ''} onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })} /></label>
            <label>支払者<select value={expenseForm.payer} onChange={(event) => setExpenseForm({ ...expenseForm, payer: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
            <label>財源<select value={expenseForm.source} onChange={(event) => setExpenseForm({ ...expenseForm, source: event.target.value as ExpenseSource, reimbursed: false })}><option value="rakuten">楽天</option><option value="advance">支払者立替</option><option value="personal">実費</option></select></label>
            {expenseForm.source === 'advance' && <label className="checkbox"><input type="checkbox" checked={expenseForm.reimbursed} onChange={(event) => setExpenseForm({ ...expenseForm, reimbursed: event.target.checked })} />立替済</label>}
            {expenseForm.source === 'personal' && <p className="note">実費は支出合計に含めますが、共通プールの差分には含めません。</p>}
            <label>説明<textarea value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} /></label>
            <label>誰宛<input value={expenseForm.beneficiary} onChange={(event) => setExpenseForm({ ...expenseForm, beneficiary: event.target.value })} placeholder="自由入力" /></label>
            <label>コメント<textarea value={expenseForm.comment} onChange={(event) => setExpenseForm({ ...expenseForm, comment: event.target.value })} /></label>
            <div className="form-actions"><button type="button" onClick={() => setShowExpenseForm(false)}>キャンセル</button><button className="primary-button" type="submit">保存</button></div>
          </form>
        </Modal>
      )}

      {showDepositForm && (
        <Modal title={editingDepositId ? '入金を編集' : '入金を追加'} onClose={() => setShowDepositForm(false)}>
          <form className="record-form" onSubmit={saveDeposit}>
            <label>日付<input type="date" required value={depositForm.date} onChange={(event) => setDepositForm({ ...depositForm, date: event.target.value })} /></label>
            <label>入金者<select value={depositForm.depositor} onChange={(event) => setDepositForm({ ...depositForm, depositor: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
            <label>金額<input type="number" min="0" required value={depositForm.amount || ''} onChange={(event) => setDepositForm({ ...depositForm, amount: Number(event.target.value) })} /></label>
            <label>説明<input value={depositForm.description} onChange={(event) => setDepositForm({ ...depositForm, description: event.target.value })} placeholder="共通口座へ入金" /></label>
            <label>コメント<textarea value={depositForm.comment} onChange={(event) => setDepositForm({ ...depositForm, comment: event.target.value })} /></label>
            <div className="form-actions"><button type="button" onClick={() => setShowDepositForm(false)}>キャンセル</button><button className="primary-button" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return <article className={`summary-card ${tone || ''}`}><span>{label}</span><strong>{value}</strong></article>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="empty-cell">{text}</td></tr>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-card"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button onClick={onClose} aria-label="閉じる">閉じる</button></div>{children}</div></div>;
}
