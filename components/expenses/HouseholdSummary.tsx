'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, Landmark, LoaderCircle, Search, UsersRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Masters } from '@/lib/ledger';
import { CashRecord, cashKinds, CashKind } from '@/lib/cash-movements';
import { ExpenseRecord, formatYen, shiftMonth } from '@/lib/expenses';
import { errorMessage, requestJson } from '@/lib/client-api';
import { previousDay, SummaryDetail, SummaryDetails, SummaryMonth, SummaryQuery, SummaryResponse, summaryPeriods } from '@/lib/household-summary';
import { CashEditor } from './CashEditor';

type Props={masters:Masters;revision:number;initialMonth:string;onChanged:()=>void;onCash:()=>void;onExpenses:(month:string)=>void};
type Detail={kind:NonNullable<SummaryQuery['detail']>;party?:string};
const detailTitles={expenses:'家計支出の明細',incoming:'口座入金の明細',outgoing:'口座出金の明細',funding:'家計負担の明細',unknown:'未確認の入金'};
const fundingLabels:Record<string,string>={deposit:'口座への入金',direct:'直接負担',refund:'個人資金から返金',contribution:'返金不要に変更'};
const monthName=(month:string)=>`${month.slice(0,4)}年${Number(month.slice(5,7))}月`;
const dateName=(date:string)=>date.replaceAll('-','/');
const elapsed=(date:string,today:string)=>Math.max(0,Math.floor((Date.parse(today)-Date.parse(date))/86400000));

export function HouseholdSummary({masters,revision,initialMonth,onChanged,onCash,onExpenses}:Props){
  const banks=masters.paymentSources.filter(s=>s.method==='bank'&&masters.parties.some(p=>p.id===s.fundingPartyId&&p.kind==='shared'));
  const [period,setPeriod]=useState<SummaryQuery['period']>('three'),[month,setMonth]=useState(initialMonth),[source,setSource]=useState(()=>banks.find(s=>!s.archived)?.id??banks[0]?.id??'');
  const [result,setResult]=useState<{key:string;data:SummaryResponse}|null>(null),[error,setError]=useState(''),[downloading,setDownloading]=useState(false),[detail,setDetail]=useState<Detail|null>(null);
  const query=new URLSearchParams({period,month,...(source?{source}:{})}).toString();
  useEffect(()=>{const controller=new AbortController();setError('');setResult(null);
    requestJson<SummaryResponse>('/api/finance/summary?'+query,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setResult({key:query,data});}).catch(e=>{if(!controller.signal.aborted)setError(errorMessage(e));});
    return()=>controller.abort();
  },[query,revision]);
  const data=result?.key===query?result.data:null;
  async function download(){if(downloading||!data)return;setDownloading(true);try{await downloadSummary(query);}catch(e){setError(errorMessage(e));}finally{setDownloading(false);}}
  const range=data?.range;
  const fundingTotal=data?.people.reduce((sum,p)=>sum+p.total,0)??0;
  function changePeriod(value:string){setPeriod(value as SummaryQuery['period']);setDetail(null);window.scrollTo({top:0,behavior:'auto'});}
  return <section className="household-summary" aria-label="家計サマリー">
    <div className="summary-controls">
      <label>期間<select aria-label="サマリーの期間" value={period} onChange={e=>changePeriod(e.target.value)}>{Object.entries(summaryPeriods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {['month','three','six'].includes(period)&&<div className="summary-month-control"><span>{period==='month'?'対象月':'集計の終了月'}</span><div>
        <Button size="icon" variant="ghost" title="サマリーの前の月" aria-label="サマリーの前の月" disabled={month==='2000-01'} onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft /></Button>
        <input type="month" aria-label="サマリーの対象月" min="2000-01" max="2099-12" value={month} onChange={e=>{if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value);}} />
        <Button size="icon" variant="ghost" title="サマリーの次の月" aria-label="サマリーの次の月" disabled={month==='2099-12'} onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight /></Button>
      </div></div>}
      {period==='year'&&<label>対象年<select aria-label="サマリーの対象年" value={month.slice(0,4)} onChange={e=>setMonth(e.target.value+'-01')}>{Array.from({length:100},(_,i)=>String(2000+i)).map(y=><option key={y} value={y}>{y}年</option>)}</select></label>}
      <div className="summary-account-row">{banks.length===1?<p className="summary-account-name" aria-label="サマリーの共通口座"><Landmark />{banks[0].name}{banks[0].archived?'（使用停止）':''}</p>:<label className="summary-account">共通口座<select aria-label="サマリーの共通口座" value={source} disabled={!banks.length} onChange={e=>setSource(e.target.value)}>{!banks.length&&<option value="">未設定</option>}{banks.map(s=><option key={s.id} value={s.id}>{s.name}{s.archived?'（使用停止）':''}</option>)}</select></label>}
      <Button size="icon" variant="ghost" title="サマリーをCSV出力" aria-label="サマリーをCSV出力" disabled={!data||downloading} onClick={download}>{downloading?<LoaderCircle className="animate-spin" />:<Download />}</Button></div>
    </div>
    {error?<div className="workspace-message" role="alert"><p>{error}</p><Button variant="outline" onClick={onChanged}>再読み込み</Button></div>:!data?<p className="workspace-message" role="status"><LoaderCircle className="animate-spin" />集計中</p>:<>
      <div className="summary-range" data-testid="summary-range"><strong>{range?.available?`${dateName(range.from)} ～ ${dateName(previousDay(range.to))}`:period==='deposit'?'人物が確認された入金はありません':'記録はありません'}</strong>
        {period==='deposit'&&range?.available&&<span>口座は入金日を含む / 支出は{monthName(range.expenseFrom.slice(0,7))} ～ {monthName(previousDay(range.expenseTo).slice(0,7))}</span>}
        <span>取込明細の最終取引日：{data.imports.to?dateName(data.imports.to):'未取込'}</span>
      </div>
      <section className="summary-band" aria-labelledby="summary-spending"><div className="summary-section-heading"><h2 id="summary-spending">家計全体の支出</h2><span>計上月・登録分</span></div>
        <button className="summary-main-amount" aria-label="家計支出の明細を開く" disabled={!data.totals.expenseCount} onClick={()=>setDetail({kind:'expenses'})}><strong data-testid="summary-expenses">{data.totals.expenseCount?formatYen(data.totals.expenses):'記録なし'}</strong><ArrowRight /></button>
        <div className="summary-quality"><span>カード分の確認：{data.months.filter(m=>m.cardConfirmed).length} / {data.months.length}か月</span><span>カード確認済み月の支出平均（登録分）：<strong>{data.average.amount===null?'未算出':formatYen(data.average.amount)}</strong>{data.average.months>0&&` / ${data.average.months}か月`}</span></div>
      </section>
      <section className="summary-band" aria-labelledby="summary-bank"><div className="summary-section-heading"><h2 id="summary-bank"><Landmark />共通口座の入出金</h2><span>取引日・登録分</span></div>
        <dl className="summary-cash-numbers"><div><dt>入金</dt><dd><button disabled={!data.totals.cashCount} onClick={()=>setDetail({kind:'incoming'})} aria-label="口座入金の明細を開く">{formatYen(data.totals.incoming)}</button></dd></div><div><dt>出金</dt><dd><button disabled={!data.totals.cashCount} onClick={()=>setDetail({kind:'outgoing'})} aria-label="口座出金の明細を開く">{formatYen(data.totals.outgoing)}</button></dd></div><div><dt>期間の差額</dt><dd>{formatYen(data.totals.incoming-data.totals.outgoing)}</dd></div></dl>
        <div className="summary-bank-breakdown"><span>家族の入金 {formatYen(data.totals.deposits)}</span><span>給付金・利息等 {formatYen(data.totals.otherIncoming)}</span><span>未確認 {formatYen(data.totals.unknown)}</span></div>
        {!data.totals.cashCount&&<p className="muted-text">この期間の入出金記録はありません</p>}
        <p className="summary-caution">期間の差額は口座残高ではありません。未取込の取引は含みません。</p>
        {data.totals.unknownCount>0&&<Button variant="outline" className="summary-unknown" onClick={()=>setDetail({kind:'unknown'})}><Search />入金の人物・用途を確認 <span>{data.totals.unknownCount}件</span></Button>}
      </section>
      <section className="summary-band" aria-labelledby="summary-people"><div className="summary-section-heading"><h2 id="summary-people"><UsersRound />人物別の家計負担</h2><button className="summary-inline-button" onClick={()=>setDetail({kind:'funding'})}>合計 {formatYen(fundingTotal)}<ArrowRight /></button></div>
        <div className="summary-people">{data.people.map(person=><article key={person.id} aria-label={person.name+'の家計負担'}><h3>{person.name}</h3><dl>
          <div><dt>口座への入金</dt><dd>{formatYen(person.deposits)}</dd></div><div><dt>直接負担等</dt><dd>{formatYen(person.direct+person.refunds+person.waived)}</dd></div><div><dt>合計</dt><dd><button aria-label={person.name+'の負担明細'} onClick={()=>setDetail({kind:'funding',party:person.id})}>{formatYen(person.total)}<ArrowRight /></button></dd></div>
        </dl><p>最終入金：{person.lastDeposit?`${dateName(person.lastDeposit.date)} / ${formatYen(person.lastDeposit.amount)} / ${elapsed(person.lastDeposit.date,data.today)}日前`:'確認済みの記録なし'}</p>
          {(person.refunds>0||person.waived>0)&&<p>直接負担等の内訳：直接 {formatYen(person.direct)} / 個人資金から返金 {formatYen(person.refunds)} / 返金不要 {formatYen(person.waived)}</p>}
        </article>)}</div>
        <p className="summary-caution">入金は選択した口座、直接負担等は家計全体。最終入金は今日までの全期間。</p>
      </section>
      <section className="summary-band" aria-labelledby="summary-last-deposit"><div className="summary-section-heading"><h2 id="summary-last-deposit">前回入金からの動き</h2><Button variant="ghost" size="icon" title="前回入金以降に切り替え" aria-label="前回入金以降に切り替え" onClick={()=>changePeriod('deposit')}><ArrowRight /></Button></div>
        {data.lastDeposit&&data.sinceDeposit?<><dl className="summary-last-deposit"><div><dt>家族の最終入金日</dt><dd>{dateName(data.lastDeposit.date)} <small>{elapsed(data.lastDeposit.date,data.today)}日前</small></dd></div><div><dt>その日の家族の入金</dt><dd>{formatYen(data.lastDeposit.amount)}</dd></div><div><dt>その日から今日までの出金</dt><dd>{formatYen(data.sinceDeposit.outgoing)}</dd></div></dl><p className="summary-caution">選択期間とは別に、入金当日を含む登録済み取引。入金不要の判定ではありません。</p></>:<p className="muted-text">人物が確認された家族の入金はありません</p>}
      </section>
      {data.months.length>0&&<SummaryTrend months={data.months} onMonth={value=>{setMonth(value);changePeriod('month');}} />}
      <div className="summary-footer"><Button variant="outline" onClick={onCash}><Landmark />入出金を開く</Button><Button variant="outline" onClick={()=>onExpenses(month)}>支出を開く<ArrowRight /></Button></div>
    </>}
    {detail&&<SummaryDetailDialog query={query} detail={detail} masters={masters} revision={revision} onClose={()=>setDetail(null)} onChanged={onChanged} onExpenses={onExpenses} />}
  </section>;
}

function SummaryTrend({months,onMonth}:{months:SummaryMonth[];onMonth:(month:string)=>void}){
  const [mode,setMode]=useState('expenses'),[page,setPage]=useState(0);
  const pages=Math.ceil(months.length/12),safePage=Math.min(page,pages-1),end=months.length-safePage*12,start=Math.max(0,end-12);
  const visible=useMemo(()=>months.slice(start,end).map(m=>({...m,label:`${m.month.slice(2,4)}/${Number(m.month.slice(5))}`,expenseValue:m.expenseCount?m.expenses:null,inValue:m.cashCount?m.incoming:null,outValue:m.cashCount?m.outgoing:null})),[months,start,end]);
  return <section className="summary-band summary-trend" aria-label="月別推移"><div className="summary-section-heading"><h2>月別推移</h2><Tabs value={mode} onValueChange={setMode}><TabsList aria-label="推移の種類"><TabsTrigger value="expenses">家計支出</TabsTrigger><TabsTrigger value="cash">口座入出金</TabsTrigger></TabsList></Tabs></div>
    <p className="summary-chart-period">{monthName(visible[0].month)} ～ {monthName(visible[visible.length-1].month)}</p>
    <figure aria-label={mode==='expenses'?'計上月ごとの家計支出グラフ':'取引月ごとの口座入出金グラフ'}><div className="summary-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={visible} margin={{left:0,right:8,top:8,bottom:0}} accessibilityLayer>
      <CartesianGrid stroke="#e5e9e7" vertical={false} /><XAxis dataKey="label" tick={{fontSize:11}} axisLine={false} tickLine={false} minTickGap={12} />
      <YAxis width={48} tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={value=>Math.abs(value)>=10000?`${value/10000}万`:String(value)} />
      <Tooltip formatter={value=>formatYen(Number(value))} labelFormatter={label=>String(label)} contentStyle={{fontSize:12,borderRadius:4}} />
      {mode==='expenses'&&<Bar dataKey="expenseValue" name="家計支出（登録分）" fill="#197765" maxBarSize={36} isAnimationActive={false} />}
      {mode==='cash'&&<Bar dataKey="inValue" name="入金" fill="#397ca6" maxBarSize={24} isAnimationActive={false} />}
      {mode==='cash'&&<Bar dataKey="outValue" name="出金" fill="#bb604c" maxBarSize={24} isAnimationActive={false} />}
    </BarChart></ResponsiveContainer></div><figcaption>{mode==='expenses'?'計上月 / 登録分':'取引月 / 入金・出金'}{mode==='cash'&&<><span className="chart-key incoming">入金</span><span className="chart-key outgoing">出金</span></>}</figcaption></figure>
    <div className="summary-month-table"><table><caption className="sr-only">月別の登録額とカード確認状況</caption><thead><tr><th scope="col">月</th><th scope="col">{mode==='expenses'?'家計支出':'入金'}</th><th scope="col">{mode==='expenses'?'カード分':'出金'}</th></tr></thead><tbody>{visible.map(m=><tr key={m.month}><th scope="row"><button aria-label={monthName(m.month)+'のサマリー'} onClick={()=>onMonth(m.month)}>{monthName(m.month)}</button></th><td>{mode==='expenses'?(m.expenseCount?formatYen(m.expenses):'記録なし'):(m.cashCount?formatYen(m.incoming):'記録なし')}</td><td>{mode==='expenses'?<span className={m.cardConfirmed?'summary-confirmed':'summary-unconfirmed'}>{m.cardConfirmed?'確認済み':'未確認'}</span>:(m.cashCount?formatYen(m.outgoing):'記録なし')}</td></tr>)}</tbody></table></div>
    {pages>1&&<div className="summary-chart-paging"><Button variant="ghost" size="icon" title="以前の12か月" aria-label="以前の12か月" disabled={safePage>=pages-1} onClick={()=>setPage(safePage+1)}><ChevronLeft /></Button><span>{safePage+1} / {pages}</span><Button variant="ghost" size="icon" title="以後の12か月" aria-label="以後の12か月" disabled={safePage===0} onClick={()=>setPage(safePage-1)}><ChevronRight /></Button></div>}
  </section>;
}

function SummaryDetailDialog({query,detail,masters,revision,onClose,onChanged,onExpenses}:{query:string;detail:Detail;masters:Masters;revision:number;onClose:()=>void;onChanged:()=>void;onExpenses:(month:string)=>void}){
  const [data,setData]=useState<SummaryDetails|null>(null),[page,setPage]=useState(1),[error,setError]=useState(''),[editing,setEditing]=useState<CashRecord|null>(null),[busy,setBusy]=useState(false);
  const params=query+`&detail=${detail.kind}`+(detail.party?'&party='+detail.party:'');
  useEffect(()=>{const c=new AbortController();setData(null);setError('');requestJson<SummaryDetails>('/api/finance/summary?'+params+'&page='+page,{signal:c.signal}).then(r=>{if(!c.signal.aborted){if(page>1&&!r.rows.length){setPage(1);return;}setData(r);}}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[params,page,revision]);
  async function edit(id:string){if(busy)return;setBusy(true);setError('');try{setEditing(await requestJson<CashRecord>('/api/cash-movements/'+id));}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  async function openExpense(row:SummaryDetail){if(busy)return;setBusy(true);setError('');try{const expense=row.expenseId?await requestJson<ExpenseRecord>('/api/expenses/'+row.expenseId):null;onExpenses(expense?.accountingMonth??expense?.date.slice(0,7)??row.date.slice(0,7));}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="expense-dialog master-dialog summary-detail-dialog"><DialogHeader><DialogTitle>{detailTitles[detail.kind]}</DialogTitle><DialogDescription>{detail.party?masters.parties.find(p=>p.id===detail.party)?.name:'選択期間の登録分'}{data?.range.available&&` / ${dateName(detail.kind==='expenses'?data.range.expenseFrom:data.range.from)} ～ ${dateName(previousDay(detail.kind==='expenses'?data.range.expenseTo:data.range.to))}`}{detail.kind==='funding'&&data?.range.available&&` / 直接負担は${monthName(data.range.expenseFrom.slice(0,7))} ～ ${monthName(previousDay(data.range.expenseTo).slice(0,7))}`}</DialogDescription></DialogHeader>
    <Button variant="outline" size="icon" className="summary-detail-export" title="明細をCSV出力" aria-label="明細をCSV出力" disabled={busy||!data} onClick={async()=>{setBusy(true);try{await downloadSummary(params);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}><Download /></Button>
    {error&&<p role="alert" className="form-error">{error}</p>}{!data&&!error&&<p role="status">読み込み中</p>}
    {data&&<><p className="muted-text">{data.count}件{detail.kind==='expenses'?' / 計上月・まとめは未配分額のみ':''}</p><ul className="summary-detail-list">{data.rows.map(row=>{
      const cash=['incoming','outgoing','unknown'].includes(detail.kind)||(detail.kind==='funding'&&row.kind==='deposit');
      return <li key={row.kind+row.id}><button disabled={busy} onClick={()=>cash?void edit(row.id):void openExpense(row)}><span><strong>{row.name||fundingLabels[row.kind]||'支出'}</strong><small>{dateName(row.date)} / {cash?cashKinds[row.kind as CashKind]??(row.partyId?'家計への入金':'未確認の入金'):fundingLabels[row.kind]??(row.kind==='summary'?'まとめの未配分額':'支出')}</small><small>{masters.parties.find(p=>p.id===row.partyId)?.name??'人物不明'} / {masters.paymentSources.find(p=>p.id===row.sourceId)?.name??'支払元不明'}</small></span><span><strong>{formatYen(Math.abs(row.amount))}</strong><small>{cash?'確認・編集':'支出を開く'} <ArrowRight /></small></span></button></li>;
    })}</ul>{data.count===0&&<p className="workspace-message">該当する記録はありません</p>}
    {data.count>50&&<div className="summary-chart-paging"><Button variant="ghost" size="icon" title="明細の前のページ" aria-label="明細の前のページ" disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft /></Button><span>{page} / {Math.ceil(data.count/50)}</span><Button variant="ghost" size="icon" title="明細の次のページ" aria-label="明細の次のページ" disabled={page*50>=data.count} onClick={()=>setPage(page+1)}><ChevronRight /></Button></div>}</>}
    {editing&&<CashEditor row={editing} masters={masters} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}} />}
  </DialogContent></Dialog>;
}

async function downloadSummary(query:string){
  const response=await fetch('/api/finance/summary?'+query+'&export=csv',{cache:'no-store'});
  if(!response.ok)throw new Error((await response.json()).error);
  const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='famfi-household-summary.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
