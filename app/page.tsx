'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Payer = 'father' | 'mother';
type Source = 'rakuten' | 'advance' | 'personal';
type View = 'expenses' | 'deposits' | 'summary';

type Expense = {
  id: string;
  no: number;
  accountingMonth: string;
  date?: string;
  category: string;
  subcategory: string;
  item: string;
  description: string;
  amount: number;
  payer: Payer;
  source: Source;
  reimbursed: boolean;
  beneficiary: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

type Deposit = {
  id: string;
  no: number;
  date: string;
  depositor: Payer;
  amount: number;
  description: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseForm = Omit<Expense, 'id' | 'no' | 'createdAt' | 'updatedAt'>;
type DepositForm = Omit<Deposit, 'id' | 'no' | 'createdAt' | 'updatedAt'>;

const expenseStorageKey = 'famfi:mvp:expenses';
const depositStorageKey = 'famfi:mvp:deposits';

const payerLabels: Record<Payer, string> = {
  father: '父',
  mother: '母',
};

const sourceLabels: Record<Source, string> = {
  rakuten: '楽天',
  advance: '支払者立替',
  personal: '実費',
};

const monthFormatter = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit' });
const currencyFormatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

function getCurrentMonth() {
  return monthFormatter.format(new Date()).replace('/', '-');
}

function toMonthInputValue(month: string) {
  return month.replace('/', '-');
}

function toDisplayMonth(month: string) {
  const [year, value] = month.replace('/', '-').split('-');
  return `${year}年${Number(value)}月`;
}

function createExpenseForm(month: string): ExpenseForm {
  return {
    accountingMonth: month,
    date: '',
    category: '',
    subcategory: '',
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

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getNextNo(records: { no: number }[]) {
  return records.reduce((max, record) => Math.max(max, record.no), 0) + 1;
}

function expenseBelongsToMonth(expense: Expense, month: string) {
  return toMonthInputValue(expense.accountingMonth) === month;
}

function depositBelongsToMonth(deposit: Deposit, month: string) {
  return deposit.date.slice(0, 7) === month;
}

function calculateMonth(expenses: Expense[], deposits: Deposit[], month: string) {
  const monthExpenses = expenses.filter((expense) => expenseBelongsToMonth(expense, month));
  const monthDeposits = deposits.filter((deposit) => depositBelongsToMonth(deposit, month));
  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const sharedExpenses = monthExpenses.filter((expense) => expense.source !== 'personal').reduce((sum, expense) => sum + expense.amount, 0);
  const personalExpenses = monthExpenses.filter((expense) => expense.source === 'personal').reduce((sum, expense) => sum + expense.amount, 0);
  const depositTotal = monthDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  return {
    month,
    totalExpenses,
    sharedExpenses,
    personalExpenses,
    depositTotal,
    sharedBalance: depositTotal - sharedExpenses,
  };
}

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [view, setView] = useState<View>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(() => createExpenseForm(getCurrentMonth()));
  const [depositForm, setDepositForm] = useState<DepositForm>(() => createDepositForm());
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState<'all' | Payer>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | Source>('all');

  useEffect(() => {
    setExpenses(safeParse<Expense[]>(window.localStorage.getItem(expenseStorageKey), []));
    setDeposits(safeParse<Deposit[]>(window.localStorage.getItem(depositStorageKey), []));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(expenseStorageKey, JSON.stringify(expenses));
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(depositStorageKey, JSON.stringify(deposits));
  }, [deposits, isLoaded]);

  const categories = useMemo(() => {
    const values = expenses.map((expense) => expense.category).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [expenses]);

  const visibleExpenses = useMemo(() => {
    return expenses
      .filter((expense) => expenseBelongsToMonth(expense, currentMonth))
      .filter((expense) => categoryFilter === 'all' || expense.category === categoryFilter)
      .filter((expense) => payerFilter === 'all' || expense.payer === payerFilter)
      .filter((expense) => sourceFilter === 'all' || expense.source === sourceFilter)
      .sort((a, b) => `${b.date || b.accountingMonth}-999`.localeCompare(`${a.date || a.accountingMonth}-999`) || b.no - a.no);
  }, [categoryFilter, currentMonth, expenses, payerFilter, sourceFilter]);

  const visibleDeposits = useMemo(() => {
    return deposits
      .filter((deposit) => depositBelongsToMonth(deposit, currentMonth))
      .sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
  }, [currentMonth, deposits]);

  const monthSummary = useMemo(() => calculateMonth(expenses, deposits, currentMonth), [currentMonth, deposits, expenses]);

  const summaryRows = useMemo(() => {
    const months = new Set<string>([currentMonth]);
    expenses.forEach((expense) => months.add(toMonthInputValue(expense.accountingMonth)));
    deposits.forEach((deposit) => months.add(deposit.date.slice(0, 7)));
    let cumulative = 0;
    return Array.from(months)
      .sort()
      .map((month) => {
        const summary = calculateMonth(expenses, deposits, month);
        cumulative += summary.sharedBalance;
        return { ...summary, cumulative };
      });
  }, [currentMonth, deposits, expenses]);

  const maxChartValue = Math.max(...summaryRows.map((row) => Math.max(row.depositTotal, row.sharedExpenses)), 1);

  const startNewExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm(createExpenseForm(currentMonth));
    setShowExpenseForm(true);
  };

  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      accountingMonth: toMonthInputValue(expense.accountingMonth),
      date: expense.date || '',
      category: expense.category,
      subcategory: expense.subcategory,
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

  const saveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseForm.accountingMonth || !expenseForm.amount || expenseForm.amount < 0) return;
    const now = new Date().toISOString();
    const normalizedForm = {
      ...expenseForm,
      accountingMonth: toMonthInputValue(expenseForm.accountingMonth),
      amount: Number(expenseForm.amount),
      reimbursed: expenseForm.source === 'advance' ? expenseForm.reimbursed : false,
    };

    if (editingExpenseId) {
      setExpenses((current) => current.map((expense) => expense.id === editingExpenseId ? { ...expense, ...normalizedForm, updatedAt: now } : expense));
    } else {
      setExpenses((current) => [
        ...current,
        {
          ...normalizedForm,
          id: crypto.randomUUID(),
          no: getNextNo(current),
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpenseForm(createExpenseForm(currentMonth));
  };

  const deleteExpense = (id: string) => {
    const target = expenses.find((expense) => expense.id === id);
    if (!target || !window.confirm(`No.${target.no} の支出を削除しますか？`)) return;
    setExpenses((current) => current.filter((expense) => expense.id !== id));
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

  const saveDeposit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!depositForm.date || !depositForm.amount || depositForm.amount < 0) return;
    const now = new Date().toISOString();
    const normalizedForm = { ...depositForm, amount: Number(depositForm.amount) };

    if (editingDepositId) {
      setDeposits((current) => current.map((deposit) => deposit.id === editingDepositId ? { ...deposit, ...normalizedForm, updatedAt: now } : deposit));
    } else {
      setDeposits((current) => [
        ...current,
        {
          ...normalizedForm,
          id: crypto.randomUUID(),
          no: getNextNo(current),
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    setShowDepositForm(false);
    setEditingDepositId(null);
    setDepositForm(createDepositForm());
  };

  const deleteDeposit = (id: string) => {
    const target = deposits.find((deposit) => deposit.id === id);
    if (!target || !window.confirm(`No.${target.no} の入金を削除しますか？`)) return;
    setDeposits((current) => current.filter((deposit) => deposit.id !== id));
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FamFi MVP</p>
          <h1>夫婦の共通支出を、ゆるく続ける。</h1>
          <p className="lead">まずは支出、入金、月次サマリだけ。細かすぎない家計簿として今日から使えます。</p>
        </div>
        <label className="month-picker">
          <span>計上年月</span>
          <input type="month" value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)} />
        </label>
      </header>

      <section className="summary-grid" aria-label="月次サマリ">
        <SummaryCard label="支出合計" value={currencyFormatter.format(monthSummary.totalExpenses)} />
        <SummaryCard label="共通支出" value={currencyFormatter.format(monthSummary.sharedExpenses)} />
        <SummaryCard label="実費支出" value={currencyFormatter.format(monthSummary.personalExpenses)} />
        <SummaryCard label="入金合計" value={currencyFormatter.format(monthSummary.depositTotal)} />
        <SummaryCard label="差分（共通）" value={currencyFormatter.format(monthSummary.sharedBalance)} tone={monthSummary.sharedBalance >= 0 ? 'good' : 'bad'} />
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
            <label>
              カテゴリ
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">すべて</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              支払者
              <select value={payerFilter} onChange={(event) => setPayerFilter(event.target.value as 'all' | Payer)}>
                <option value="all">すべて</option>
                <option value="father">父</option>
                <option value="mother">母</option>
              </select>
            </label>
            <label>
              財源
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | Source)}>
                <option value="all">すべて</option>
                <option value="rakuten">楽天</option>
                <option value="advance">支払者立替</option>
                <option value="personal">実費</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>日付</th>
                  <th>カテゴリ</th>
                  <th>もの</th>
                  <th>金額</th>
                  <th>支払者</th>
                  <th>財源</th>
                  <th>立替済</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.no}</td>
                    <td>{expense.date || `${toDisplayMonth(expense.accountingMonth)}分`}</td>
                    <td>{expense.category || '-'}</td>
                    <td>
                      <strong>{expense.item || '-'}</strong>
                      {expense.description && <span>{expense.description}</span>}
                    </td>
                    <td className="amount">{currencyFormatter.format(expense.amount)}</td>
                    <td>{payerLabels[expense.payer]}</td>
                    <td>{sourceLabels[expense.source]}</td>
                    <td>{expense.source === 'advance' ? (expense.reimbursed ? '済' : '未') : '-'}</td>
                    <td className="actions">
                      <button onClick={() => editExpense(expense)}>編集</button>
                      <button onClick={() => deleteExpense(expense.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {visibleExpenses.length === 0 && <EmptyRow colSpan={9} text="この月の支出はまだありません。" />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'deposits' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Deposits</p>
              <h2>{toDisplayMonth(currentMonth)}の入金</h2>
            </div>
            <button className="primary-button" onClick={startNewDeposit}>入金を追加</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>日付</th>
                  <th>入金者</th>
                  <th>説明</th>
                  <th>金額</th>
                  <th>コメント</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeposits.map((deposit) => (
                  <tr key={deposit.id}>
                    <td>{deposit.no}</td>
                    <td>{deposit.date}</td>
                    <td>{payerLabels[deposit.depositor]}</td>
                    <td>{deposit.description || '-'}</td>
                    <td className="amount">{currencyFormatter.format(deposit.amount)}</td>
                    <td>{deposit.comment || '-'}</td>
                    <td className="actions">
                      <button onClick={() => editDeposit(deposit)}>編集</button>
                      <button onClick={() => deleteDeposit(deposit.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {visibleDeposits.length === 0 && <EmptyRow colSpan={7} text="この月の入金はまだありません。" />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'summary' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Monthly</p>
              <h2>月次サマリ</h2>
            </div>
          </div>
          <div className="chart" aria-label="入金と共通支出の比較">
            {summaryRows.map((row) => (
              <div className="chart-row" key={row.month}>
                <span>{toDisplayMonth(row.month)}</span>
                <div className="bars">
                  <div className="bar deposit" style={{ width: `${(row.depositTotal / maxChartValue) * 100}%` }}>入金 {currencyFormatter.format(row.depositTotal)}</div>
                  <div className="bar expense" style={{ width: `${(row.sharedExpenses / maxChartValue) * 100}%` }}>共通 {currencyFormatter.format(row.sharedExpenses)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>月</th>
                  <th>支出合計</th>
                  <th>共通支出</th>
                  <th>実費支出</th>
                  <th>入金合計</th>
                  <th>差分（共通）</th>
                  <th>共通プール累計</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.month}>
                    <td>{toDisplayMonth(row.month)}</td>
                    <td className="amount">{currencyFormatter.format(row.totalExpenses)}</td>
                    <td className="amount">{currencyFormatter.format(row.sharedExpenses)}</td>
                    <td className="amount">{currencyFormatter.format(row.personalExpenses)}</td>
                    <td className="amount">{currencyFormatter.format(row.depositTotal)}</td>
                    <td className="amount">{currencyFormatter.format(row.sharedBalance)}</td>
                    <td className="amount">{currencyFormatter.format(row.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showExpenseForm && (
        <Modal title={editingExpenseId ? '支出を編集' : '支出を追加'} onClose={() => setShowExpenseForm(false)}>
          <form className="record-form" onSubmit={saveExpense}>
            <label>計上年月<input type="month" required value={expenseForm.accountingMonth} onChange={(event) => setExpenseForm({ ...expenseForm, accountingMonth: event.target.value })} /></label>
            <label>日付<input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} /></label>
            <label>カテゴリ<input value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} placeholder="食費" /></label>
            <label>サブカテゴリ<input value={expenseForm.subcategory} onChange={(event) => setExpenseForm({ ...expenseForm, subcategory: event.target.value })} placeholder="外食" /></label>
            <label>もの<input value={expenseForm.item} onChange={(event) => setExpenseForm({ ...expenseForm, item: event.target.value })} placeholder="店名や品目" /></label>
            <label>説明<textarea value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} /></label>
            <label>金額<input type="number" min="0" required value={expenseForm.amount || ''} onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })} /></label>
            <label>支払者<select value={expenseForm.payer} onChange={(event) => setExpenseForm({ ...expenseForm, payer: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
            <label>財源<select value={expenseForm.source} onChange={(event) => setExpenseForm({ ...expenseForm, source: event.target.value as Source, reimbursed: false })}><option value="rakuten">楽天</option><option value="advance">支払者立替</option><option value="personal">実費</option></select></label>
            {expenseForm.source === 'advance' && <label className="checkbox"><input type="checkbox" checked={expenseForm.reimbursed} onChange={(event) => setExpenseForm({ ...expenseForm, reimbursed: event.target.checked })} />立替済</label>}
            {expenseForm.source === 'personal' && <p className="note">実費は支出合計に含めますが、共通プールの差分には含めません。</p>}
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-heading"><h2 id="modal-title">{title}</h2><button onClick={onClose} aria-label="閉じる">閉じる</button></div>
        {children}
      </div>
    </div>
  );
}
