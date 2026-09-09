'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, LoaderCircle, LogOut, Pencil, Plus, ReceiptText, RefreshCw, Search, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExpenseEditor } from './ExpenseEditor';
import { CategorySelect } from './CategorySelect';
import { ReferenceSelect } from './ReferenceSelect';
import { MasterManager } from './MasterManager';
import { SettlementWorkspace } from './SettlementWorkspace';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Masters, categoryName, settlementLabels, settlementState } from '@/lib/ledger';
import { ExpenseRecord, ExpenseResponse, PAGE_SIZE, formatExpenseDate, formatYen, shiftMonth } from '@/lib/expenses';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';

export function ExpenseWorkspace({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [category, setCategory] = useState('');
  const [view,setView] = useState('expenses');
  const [managing,setManaging] = useState(false);
  const [filterOpen,setFilterOpen] = useState(false);
  const [person,setPerson] = useState(''); const [paymentSource,setPaymentSource] = useState(''); const [settlement,setSettlement] = useState('');
  const [search,setSearch] = useState(''); const [searchDraft,setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ExpenseResponse | null>(null);
  const [dataKey,setDataKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ expense: ExpenseRecord | null; initial?: ExpenseRecord; key: string } | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const mutationLock = useRef(false);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  const queryKey = JSON.stringify([month,category,person,paymentSource,settlement,search,page]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ month, page: String(page) });
    if (category) params.set('category', category);
    if (person) params.set('person', person);
    if (paymentSource) params.set('paymentSource', paymentSource);
    if (settlement) params.set('settlement', settlement);
    if (search) params.set('search', search);
    requestJson<ExpenseResponse>(`/api/expenses?${params}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (page > 1 && !result.expenses.length) { setPage(1); return; }
      setData(result);
      setDataKey(queryKey);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof RequestError && error.status === 401) window.location.replace('/login');
      else setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, category, person, paymentSource, settlement, search, page, revision, queryKey]);
  useEffect(() => {
    const onFocus = () => { if (!editor && !deleting && !managing) refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [editor, deleting, managing, refresh]);
  function changeMonth(value: string) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) return;
    setMonth(value); setPage(1);
  }
  function filter(value: string) { setCategory(value); setPage(1); }
  function openEditor(expense: ExpenseRecord | null) { toast.dismiss(); setEditor({ expense, key: expense?.id ?? crypto.randomUUID() }); }
  function mastersChanged(masters: Masters) { setData(old => old ? { ...old, ...masters } : old); refresh(); }
  function failure(error: unknown) {
    if (error instanceof RequestError && error.status === 401) window.location.replace('/login');
    else toast.error(errorMessage(error));
  }
  async function logout() {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true);
    try { await requestJson('/api/auth/logout', { method: 'POST' }); window.location.replace('/login'); }
    catch (error) { failure(error); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function remove() {
    if (!deleting || mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setDeleteError('');
    try {
      await requestJson(`/api/expenses/${deleting.id}`, { method: 'DELETE', body: JSON.stringify({ version: deleting.version }) });
      setDeleting(null); refresh(); toast.success('支出を削除しました');
    } catch (error) { setDeleteError(errorMessage(error)); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function download(all: boolean, filtered = false) {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams(all ? {} : { month });
      if (filtered) for (const [key,value] of Object.entries({category,person,paymentSource,settlement,search})) if(value) params.set(key,value);
      const response = await fetch(`/api/expenses/export?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new RequestError(response.status, (await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `famfi-expenses-${all ? 'all' : month}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { failure(error); }
    finally { setExporting(false); }
  }
  const categories = data?.categories ?? [];
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const pages = Math.max(1, Math.ceil((data?.filteredCount ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(category || person || paymentSource || settlement || search);
  return <div className="expense-app">
    <header className="expense-header"><div className="expense-header-inner">
      <Link href="/expenses" className="famfi-brand"><ReceiptText aria-hidden="true" />famFi</Link>
      <span className="header-section">支出管理</span>
      <Button variant="ghost" size="icon" title="マスタ管理" aria-label="マスタ管理" disabled={!data} onClick={()=>{toast.dismiss();setManaging(true);}}><Settings2 /></Button>
      <Button variant="ghost" size="icon" title="ログアウト" aria-label="ログアウト" disabled={busy} onClick={logout}><LogOut /></Button>
    </div></header>
    <Tabs value={view} onValueChange={setView} className="workspace-tabs"><TabsList><TabsTrigger value="expenses">支出</TabsTrigger><TabsTrigger value="settlements">立替・精算</TabsTrigger></TabsList></Tabs>
    <main className="expense-main" hidden={view !== 'expenses'}>
      <div className="workspace-heading"><div><p className="section-eyebrow">家計簿</p><h1>支出</h1></div>
        <Button className="primary-action desktop-add" disabled={!data || loading} onClick={() => openEditor(null)}><Plus />支出を記録</Button>
      </div>
      <div className="expense-toolbar">
        <div className="month-selector"><Button variant="ghost" size="icon" title="前の月" aria-label="前の月" disabled={month === '2000-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
          <input type="month" aria-label="表示する月" min="2000-01" max="2099-12" value={month} onChange={e => changeMonth(e.target.value)} />
          <Button variant="ghost" size="icon" title="次の月" aria-label="次の月" disabled={month === '2099-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
        </div>
        <div className="toolbar-actions"><Button variant="ghost" size="icon" aria-label="一覧を更新" title="一覧を更新" disabled={loading} onClick={refresh}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={!data || exporting}>{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}CSV</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => download(false)}>表示月を出力</DropdownMenuItem>{hasFilters && <DropdownMenuItem onSelect={() => download(false,true)}>絞り込み結果を出力</DropdownMenuItem>}<DropdownMenuItem onSelect={() => download(true)}>全期間を出力</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>
      {error ? <section className="workspace-message" role="alert"><p>{error}</p><Button variant="outline" onClick={refresh}><RefreshCw />再読み込み</Button></section>
        : !data || dataKey !== queryKey ? <section className="workspace-message" role="status"><LoaderCircle className="animate-spin" /><p>支出を読み込み中</p></section>
        : <>
          <section className="expense-summary" aria-label="月の集計"><div><h2>この月の支出</h2><p className="total-amount" data-testid="monthly-total">{formatYen(data.total)}</p></div><div className="entry-count"><span>記録数</span><strong>{data.count}<small> 件</small></strong></div></section>
          <div className="expense-body">
            <section className="expense-ledger" aria-labelledby="ledger-title">
              <div className="ledger-heading"><h2 id="ledger-title">支出履歴 <span>{data.filteredCount}件</span></h2><div className="ledger-filter-actions"><CategorySelect label="カテゴリで絞り込み" value={category} onChange={filter} categories={categories} allowAll /><Button variant="ghost" size="icon" title="詳細な絞り込み" aria-label="詳細な絞り込み" aria-expanded={filterOpen} onClick={()=>setFilterOpen(!filterOpen)}><SlidersHorizontal /></Button></div></div>
              {filterOpen && <div className="ledger-filters"><form className="search-form" onSubmit={e=>{e.preventDefault();setSearch(searchDraft);setPage(1);}}><input aria-label="内容・メモを検索" maxLength={120} value={searchDraft} onChange={e=>setSearchDraft(e.target.value)} /><Button variant="outline" size="icon" aria-label="検索" title="検索"><Search /></Button></form><div className="filter-grid">
                <div><label>人物・共用資金</label><ReferenceSelect label="人物・共用資金で絞り込み" value={person} emptyLabel="すべて" options={data.parties} onChange={v=>{setPerson(v??'');setPage(1);}} /></div>
                <div><label>支払元</label><ReferenceSelect label="支払元で絞り込み" value={paymentSource} emptyLabel="すべて" options={data.paymentSources} onChange={v=>{setPaymentSource(v??'');setPage(1);}} /></div>
                <div><label>精算状態</label><ReferenceSelect label="精算状態で絞り込み" value={settlement} emptyLabel="すべて" options={Object.entries(settlementLabels).map(([id,name])=>({id,name}))} onChange={v=>{setSettlement(v??'');setPage(1);}} /></div>
              </div></div>}
              {hasFilters && <div className="filter-summary"><span>絞り込み結果 {formatYen(data.filteredTotal)}</span><Button variant="ghost" onClick={()=>{setCategory('');setPerson('');setPaymentSource('');setSettlement('');setSearch('');setSearchDraft('');setPage(1);}}>条件を解除</Button></div>}
              {data.expenses.length === 0 ? <div className="empty-ledger"><ReceiptText aria-hidden="true" /><p>{category ? 'このカテゴリの記録はありません' : 'この月の記録はありません'}</p><Button variant="outline" onClick={() => openEditor(null)}><Plus />支出を記録</Button></div>
                : <div className="ledger-rows">{data.expenses.map(expense => {
                  const cat = categoryMap.get(expense.categoryId);
                  return <button className="expense-row" key={expense.id} disabled={loading} onClick={() => openEditor(expense)} aria-label={`${formatExpenseDate(expense.date)} ${expense.description || cat?.name} ${expense.amount}円を編集`}>
                    <time dateTime={expense.date}>{expense.date.length === 7 ? <>{Number(expense.date.slice(5, 7))}月<small>月のみ</small></> : formatExpenseDate(expense.date, true)}</time>
                    <div className="expense-row-content"><strong>{expense.description || cat?.name}</strong><span><i className="category-dot" style={{ backgroundColor: cat?.color }} />{cat ? categoryName(cat,categories) : ''}{expense.memo && <span className="row-memo">{expense.memo}</span>}</span>
                      {(expense.usedByPartyId || expense.paymentSourceId || expense.reimbursementStatus === 'required') && <span className="expense-metadata">{data.parties.find(p=>p.id===expense.usedByPartyId)?.name}{expense.paymentSourceId && <span>{data.paymentSources.find(p=>p.id===expense.paymentSourceId)?.name}</span>}{expense.reimbursementStatus==='required' && <span className={`settlement-status ${settlementState(expense)}`}>{settlementLabels[settlementState(expense)]}</span>}</span>}
                    </div>
                    <strong className="row-amount">{formatYen(expense.amount)}</strong><Pencil className="row-edit" aria-hidden="true" />
                  </button>;
                })}</div>}
              {pages > 1 && <nav className="ledger-pagination" aria-label="支出一覧のページ"><Button variant="outline" size="icon" aria-label="前のページ" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page} / {pages}</span><Button variant="outline" size="icon" aria-label="次のページ" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></nav>}
            </section>
            <aside className="expense-breakdown" aria-labelledby="breakdown-title"><h2 id="breakdown-title">カテゴリ別</h2>
              {data.count === 0 ? <p className="muted-text">記録なし</p> : <ul>{[...data.breakdown].sort((a, b) => b.amount - a.amount).map(item => {
                const cat = categoryMap.get(item.categoryId);
                return <li key={item.categoryId}><button className="breakdown-button" onClick={() => filter(category === item.categoryId ? '' : item.categoryId)} aria-pressed={category === item.categoryId}><span><i className="category-dot" style={{ backgroundColor: cat?.color }} />{cat?.name}</span><strong>{formatYen(item.amount)}</strong></button><div className="category-track"><div style={{ width: `${item.amount / data.total * 100}%`, backgroundColor: cat?.color }} /></div></li>;
              })}</ul>}
            </aside>
          </div>
        </>}
    </main>
    {view === 'settlements' && <SettlementWorkspace externalRevision={revision} onEdit={openEditor} onChanged={refresh} />}
    {view === 'expenses' && <div className="mobile-add"><Button className="primary-action" disabled={!data || loading} onClick={() => openEditor(null)}><Plus />支出を記録</Button></div>}
    {editor && data && <ExpenseEditor key={editor.key} expense={editor.expense} initial={editor.initial} initialMonth={month} masters={data} onMastersChanged={mastersChanged} onClose={() => setEditor(null)} onSaved={row => { setEditor(null); if(!editor.expense || row.date.slice(0,7)!==month) {setPage(1);setMonth(row.date.slice(0,7));} refresh(); toast.success('支出を保存しました'); }} onDelete={row => { setEditor(null); setDeleting(row); setDeleteError(''); }} onDuplicate={row=>setEditor({expense:null,initial:row,key:crypto.randomUUID()})} />}
    {managing && data && <MasterManager masters={data} onChange={mastersChanged} onClose={()=>setManaging(false)} />}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent className="expense-dialog"><DialogHeader><DialogTitle>支出を削除しますか？</DialogTitle><DialogDescription>{deleting ? `${formatExpenseDate(deleting.date)} / ${deleting.description || categoryMap.get(deleting.categoryId)?.name} / ${formatYen(deleting.amount)}` : ''}</DialogDescription></DialogHeader><p className="muted-text">この操作は取り消せません。</p>{deleteError && <p role="alert" className="form-error">{deleteError}</p>}<div className="editor-save"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>キャンセル</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}削除する</Button></div></DialogContent></Dialog>
  </div>;
}
