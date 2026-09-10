'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, List, ChevronLeft, ChevronRight, Download, LoaderCircle, LogOut, Pencil, Plus, ReceiptText, RefreshCw, Search, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExpenseEditor } from './ExpenseEditor';
import { CategorySelect } from './CategorySelect';
import { ReferenceSelect } from './ReferenceSelect';
import { MasterManager } from './MasterManager';
import { SettlementWorkspace } from './SettlementWorkspace';
import { RecurringWorkspace } from './RecurringWorkspace';
import { SummaryWorkspace } from './SummaryWorkspace';
import { costClassLabels,CostClass } from '@/lib/cost-class';
import { HistoryView } from './HistoryView';
import { ProfileDialog } from './ProfileDialog';
import { BottomNavigation } from './BottomNavigation';
import { ExpenseCalendar } from './ExpenseCalendar';
import { HouseholdView } from './HouseholdView';
import { NotesWorkspace, NoteEditor } from './NotesWorkspace';
import { CalendarEntry } from '@/lib/expense-calendar';
import { NoteRecord } from '@/lib/notes';
import { draftRecord, newExpense } from '@/lib/household';
import { paymentSourceGroups } from '@/lib/household';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Masters, categoryName, settlementLabels, settlementState, treatmentLabels } from '@/lib/ledger';
import { ExpenseRecord, ExpenseResponse, PAGE_SIZE, formatExpenseDate, formatYen, shiftMonth } from '@/lib/expenses';
import { RequestError, errorMessage, requestJson } from '@/lib/client-api';

export function ExpenseWorkspace({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [category, setCategory] = useState('');
  const [view,setView] = useState('expenses');
  const [presentation,setPresentation] = useState('list');
  const [noteEditor,setNoteEditor] = useState<{note:NoteRecord|null;date?:string}|null>(null);
  const [summaryId,setSummaryId] = useState<string|null>(null);
  const calendarLock = useRef(false);
  const [managing,setManaging] = useState(false);
  const [profileOpen,setProfileOpen] = useState(false);
  const [filterOpen,setFilterOpen] = useState(false);
  const [person,setPerson] = useState(''); const [paymentSource,setPaymentSource] = useState(''); const [settlement,setSettlement] = useState('');
  const [treatment,setTreatment] = useState('');
  const [costClass,setCostClass]=useState('');
  const [attention,setAttention]=useState<number|null>(null);
  const [search,setSearch] = useState(''); const [searchDraft,setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ExpenseResponse | null>(null);
  const [dataKey,setDataKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ expense: ExpenseRecord | null; initial?: ExpenseRecord; key: string; continueEntry?:boolean } | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const mutationLock = useRef(false);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  const queryKey = JSON.stringify([month,category,person,paymentSource,settlement,treatment,costClass,search,page]);
  useEffect(()=>{const c=new AbortController();const update=()=>{if(!document.hidden)requestJson<{count:number}>('/api/attention',{signal:c.signal}).then(r=>{if(!c.signal.aborted)setAttention(r.count);}).catch(()=>{if(!c.signal.aborted)setAttention(null);});};update();const timer=setInterval(update,60000);return()=>{c.abort();clearInterval(timer);};},[revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ month, page: String(page) });
    if (category) params.set('category', category);
    if (person) params.set('person', person);
    if (paymentSource) params.set('paymentSource', paymentSource);
    if (settlement) params.set('settlement', settlement);
    if (treatment) params.set('treatment', treatment);
    if (costClass) params.set('costClass',costClass);
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
  }, [month, category, person, paymentSource, settlement, treatment, costClass, search, page, revision, queryKey]);
  useEffect(() => {
    const onFocus = () => { if (!editor && !deleting && !managing && !profileOpen) refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [editor, deleting, managing, profileOpen, refresh]);
  function changeMonth(value: string) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) return;
    setMonth(value); setPage(1);
  }
  function filter(value: string) { setCategory(value); setPage(1); }
  function openEditor(expense: ExpenseRecord | null) { toast.dismiss(); setEditor({ expense, key: expense?.id ?? crypto.randomUUID() }); }
  async function openCalendarEntry(entry:CalendarEntry) {
    if(calendarLock.current)return;
    calendarLock.current=true;
    try {
      if(entry.kind==='expense')openEditor(await requestJson<ExpenseRecord>('/api/expenses/'+entry.id));
      else if(entry.kind==='note'||entry.kind==='task')setNoteEditor({note:await requestJson<NoteRecord>('/api/notes/'+entry.id)});
      else if(entry.kind==='summary')setSummaryId(entry.id);
      else setView('recurring');
    }catch(error){failure(error);}finally{calendarLock.current=false;}
  }
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
      if (filtered) for (const [key,value] of Object.entries({category,person,paymentSource,settlement,treatment,costClass,search})) if(value) params.set(key,value);
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
  const hasFilters = Boolean(category || person || paymentSource || settlement || treatment || costClass || search);
  const self = data?.parties.find(p=>p.id===data.selfPartyId);
  const firstProfile = self?.profileConfirmed === false && ['owner','partner'].includes(self.systemKey ?? '');
  return <div className="expense-app">
    <header className="expense-header"><div className="expense-header-inner">
      <Link href="/expenses" className="famfi-brand"><ReceiptText aria-hidden="true" />famFi</Link>
      <button type="button" className="header-section profile-header" title="表示名の設定" aria-label="表示名の設定" disabled={!self} onClick={()=>{toast.dismiss();setProfileOpen(true);}}><span>{data?.householdName ?? '支出管理'}</span>{self&&<strong>{self.name}</strong>}</button>
      <Button className="desktop-control" variant="ghost" size="icon" title="マスタ管理" aria-label="マスタ管理" disabled={!data} onClick={()=>{toast.dismiss();setManaging(true);}}><Settings2 /></Button>
      <Button className="desktop-control" variant="ghost" size="icon" title="ログアウト" aria-label="ログアウト" disabled={busy} onClick={logout}><LogOut /></Button>
    </div></header>
    <Tabs value={view} onValueChange={value=>{toast.dismiss();setView(value);}} className="workspace-tabs"><TabsList><TabsTrigger value="expenses">支出</TabsTrigger><TabsTrigger value="settlements">立替・精算</TabsTrigger><TabsTrigger value="recurring">予定・定期{Boolean(attention)&&<span className="attention-badge" aria-label={'確認待ち'+attention+'件'}>{attention}</span>}</TabsTrigger><TabsTrigger value="notes">共有メモ</TabsTrigger><TabsTrigger value="household">家計の共有</TabsTrigger><TabsTrigger value="history">変更履歴</TabsTrigger></TabsList></Tabs>
    <main className={'expense-main'+(presentation==='calendar'?' calendar-mode':'')} hidden={view !== 'expenses'}>
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
          <section className="cost-breakdown" aria-label="費用の区分別集計">{data.costBreakdown?.map(item=><div key={item.costClass}><span>{costClassLabels[item.costClass as CostClass]}</span><strong>{formatYen(item.amount)}</strong></div>)}</section>
          <div className="ledger-view-switch" role="group" aria-label="支出の表示方法"><button type="button" aria-pressed={presentation==='list'} onClick={()=>setPresentation('list')}><List aria-hidden="true" />一覧</button><button type="button" aria-pressed={presentation==='calendar'} onClick={()=>setPresentation('calendar')}><CalendarDays aria-hidden="true" />カレンダー</button></div>
          <div hidden={presentation!=='list'}><SummaryWorkspace month={month} masters={data} revision={revision} onChanged={refresh} onEdit={openEditor} onMastersChanged={mastersChanged} openId={summaryId} onOpened={()=>setSummaryId(null)} /></div>
          {presentation==='calendar'&&<ExpenseCalendar month={month} masters={data} revision={revision} onOpen={openCalendarEntry} onAdd={date=>setEditor({expense:null,initial:draftRecord(newExpense(data,date)),key:crypto.randomUUID()})} onNote={date=>setNoteEditor({note:null,date})} />}
          {Boolean(data.directContributions?.length) && <section className="direct-contributions" aria-label="家計への直接負担"><h2>直接負担・返金なし</h2>{data.directContributions?.map(item=><span key={item.partyId}>{data.parties.find(p=>p.id===item.partyId)?.name} <strong>{formatYen(item.amount)}</strong></span>)}</section>}
          <div className="expense-body" hidden={presentation!=='list'}>
            <section className="expense-ledger" aria-labelledby="ledger-title">
              <div className="ledger-heading"><h2 id="ledger-title">支出履歴 <span>{data.filteredCount}件</span></h2><div className="ledger-filter-actions"><CategorySelect label="カテゴリで絞り込み" value={category} onChange={filter} categories={categories} allowAll /><Button variant="ghost" size="icon" title="詳細な絞り込み" aria-label="詳細な絞り込み" aria-expanded={filterOpen} onClick={()=>setFilterOpen(!filterOpen)}><SlidersHorizontal /></Button></div></div>
              {filterOpen && <div className="ledger-filters"><form className="search-form" onSubmit={e=>{e.preventDefault();setSearch(searchDraft);setPage(1);}}><input aria-label="内容・メモを検索" maxLength={120} value={searchDraft} onChange={e=>setSearchDraft(e.target.value)} /><Button variant="outline" size="icon" aria-label="検索" title="検索"><Search /></Button></form><div className="filter-grid">
                <div><label>人物・共用資金</label><ReferenceSelect label="人物・共用資金で絞り込み" value={person} emptyLabel="すべて" options={data.parties} onChange={v=>{setPerson(v??'');setPage(1);}} /></div>
                <div><label>支払元</label><ReferenceSelect label="支払元で絞り込み" value={paymentSource} emptyLabel="すべて" options={[]} groups={paymentSourceGroups(data,paymentSource,true)} onChange={v=>{setPaymentSource(v??'');setPage(1);}} /></div>
                <div><label>支払いの扱い</label><ReferenceSelect label="支払いの扱いで絞り込み" value={treatment} emptyLabel="すべて" options={Object.entries(treatmentLabels).map(([id,name])=>({id,name}))} onChange={v=>{setTreatment(v??'');setPage(1);}} /></div>
                <div><label>精算状態</label><ReferenceSelect label="精算状態で絞り込み" value={settlement} emptyLabel="すべて" options={Object.entries(settlementLabels).map(([id,name])=>({id,name}))} onChange={v=>{setSettlement(v??'');setPage(1);}} /></div>
                <div><label>費用の区分</label><ReferenceSelect label="費用の区分で絞り込み" value={costClass} emptyLabel="すべて" options={Object.entries(costClassLabels).map(([id,name])=>({id,name}))} onChange={v=>{setCostClass(v??'');setPage(1);}} /></div>
              </div></div>}
              {hasFilters && <div className="filter-summary"><span>絞り込み結果 {formatYen(data.filteredTotal)}</span><Button variant="ghost" onClick={()=>{setCategory('');setPerson('');setPaymentSource('');setSettlement('');setTreatment('');setCostClass('');setSearch('');setSearchDraft('');setPage(1);}}>条件を解除</Button></div>}
              {data.expenses.length === 0 ? <div className="empty-ledger"><ReceiptText aria-hidden="true" /><p>{category ? 'このカテゴリの記録はありません' : 'この月の記録はありません'}</p><Button variant="outline" onClick={() => openEditor(null)}><Plus />支出を記録</Button></div>
                : <div className="ledger-rows">{data.expenses.map(expense => {
                  const cat = categoryMap.get(expense.categoryId);
                  return <button className="expense-row" key={expense.id} disabled={loading} onClick={() => openEditor(expense)} aria-label={`${formatExpenseDate(expense.date)} ${expense.description || cat?.name} ${expense.amount}円を編集`}>
                    <time dateTime={expense.date}>{expense.date.length === 7 ? <>{Number(expense.date.slice(5, 7))}月<small>月のみ</small></> : formatExpenseDate(expense.date, true)}</time>
                    <div className="expense-row-content"><strong>{!expense.description&&<i className="category-dot" style={{backgroundColor:cat?.color}} />}{expense.description || (cat?categoryName(cat,categories):'支出')}</strong>{(expense.description||expense.memo)&&<span>{expense.description&&<><i className="category-dot" style={{ backgroundColor: cat?.color }} />{cat ? categoryName(cat,categories) : ''}</>}{expense.memo && <span className="row-memo">{expense.memo}</span>}</span>}
                      { <span className="expense-metadata">{expense.usedByText || data.parties.find(p=>p.id===expense.usedByPartyId)?.name}<span>{data.paymentSources.find(p=>p.id===expense.paymentSourceId)?.name ?? '支払元未設定'}</span>{expense.paymentTreatment==='direct' && <span className="settlement-status direct">直接負担</span>}{expense.paymentTreatment==='review' && <span className="settlement-status unknown">あとで確認</span>}{expense.reimbursementStatus==='required' && <span className={`settlement-status ${settlementState(expense)}`}>{settlementLabels[settlementState(expense)]}</span>}</span>}
                    </div>
                    <strong className="row-amount">{formatYen(expense.amount)}</strong><Pencil className="row-edit" aria-hidden="true" />
                  </button>;
                })}</div>}
              {pages > 1 && <nav className="ledger-pagination" aria-label="支出一覧のページ"><Button variant="outline" size="icon" aria-label="前のページ" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page} / {pages}</span><Button variant="outline" size="icon" aria-label="次のページ" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></nav>}
            </section>
            <aside className="expense-breakdown" aria-labelledby="breakdown-title"><h2 id="breakdown-title">カテゴリ別</h2>
              {Boolean(data.summaryRemainder)&&<p className="summary-unclassified">未整理 <strong>{formatYen(data.summaryRemainder??0)}</strong></p>}
              {data.count === 0 && !data.summaryRemainder ? <p className="muted-text">記録なし</p> : <ul>{[...data.breakdown].sort((a, b) => b.amount - a.amount).map(item => {
                const cat = categoryMap.get(item.categoryId);
                return <li key={item.categoryId}><button className="breakdown-button" onClick={() => filter(category === item.categoryId ? '' : item.categoryId)} aria-pressed={category === item.categoryId}><span><i className="category-dot" style={{ backgroundColor: cat?.color }} />{cat?.name}</span><strong>{formatYen(item.amount)}</strong></button><div className="category-track"><div style={{ width: `${item.amount / data.total * 100}%`, backgroundColor: cat?.color }} /></div></li>;
              })}</ul>}
            </aside>
          </div>
        </>}
    </main>
    {view === 'recurring' && <RecurringWorkspace initialMonth={month} externalRevision={revision} onEdit={openEditor} onChanged={refresh} onMastersChanged={mastersChanged} />}
    {view === 'history' && data && <main className="expense-main"><div className="workspace-heading"><h1>変更履歴</h1><Button variant="ghost" size="icon" title="履歴を更新" aria-label="履歴を更新" onClick={refresh}><RefreshCw /></Button></div><HistoryView masters={data} revision={revision} /></main>}
    {view === 'settlements' && <SettlementWorkspace externalRevision={revision} onEdit={openEditor} onChanged={refresh} />}
    {view === 'household' && <HouseholdView />}
    {view === 'notes' && data && <NotesWorkspace masters={data} revision={revision} onChanged={refresh} />}
    <BottomNavigation view={view} attention={attention} ready={Boolean(data)} busy={busy} onNavigate={value=>{toast.dismiss();setView(value);}} onAdd={()=>openEditor(null)} onMasters={()=>{toast.dismiss();setManaging(true);}} onProfile={()=>{toast.dismiss();setProfileOpen(true);}} onLogout={logout} />
    {editor && data && <ExpenseEditor key={editor.key} expense={editor.expense} initial={editor.initial} continueEntry={editor.continueEntry} initialMonth={month} masters={data} onMastersChanged={mastersChanged} onClose={() => setEditor(null)} onSaved={(row,keepOpen) => { setEditor(keepOpen?{expense:null,continueEntry:true,initial:draftRecord({...newExpense(data,row.date),categoryId:row.categoryId,costClass:data.categories.find(c=>c.id===row.categoryId)?.costClass??'unknown'}),key:crypto.randomUUID()}:null); if(!editor.expense || row.date.slice(0,7)!==month) {setPage(1);setMonth(row.date.slice(0,7));} refresh(); toast.success('支出を保存しました'); }} onDelete={row => { setEditor(null); setDeleting(row); setDeleteError(''); }} onDuplicate={row=>setEditor({expense:null,initial:row,key:crypto.randomUUID()})} />}
    {noteEditor&&data&&<NoteEditor key={noteEditor.note?.id??'new'} note={noteEditor.note} initialDate={noteEditor.date} masters={data} onClose={()=>setNoteEditor(null)} onSaved={()=>{setNoteEditor(null);refresh();toast.success('共有メモを更新しました');}} />}
    {managing && data && <MasterManager masters={data} onChange={mastersChanged} onClose={()=>setManaging(false)} />}
    {self&&(firstProfile||profileOpen)&&<ProfileDialog key={self.id} person={self} firstTime={firstProfile} onSaved={masters=>{mastersChanged(masters);setProfileOpen(false);toast.success('表示名を保存しました');}} onClose={()=>setProfileOpen(false)} onLogout={logout} />}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent className="expense-dialog"><DialogHeader><DialogTitle>支出を削除しますか？</DialogTitle><DialogDescription>{deleting ? `${formatExpenseDate(deleting.date)} / ${deleting.description || categoryMap.get(deleting.categoryId)?.name} / ${formatYen(deleting.amount)}` : ''}</DialogDescription></DialogHeader><p className="muted-text">この操作は取り消せません。</p>{deleteError && <p role="alert" className="form-error">{deleteError}</p>}<div className="editor-save"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>キャンセル</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}削除する</Button></div></DialogContent></Dialog>
  </div>;
}
