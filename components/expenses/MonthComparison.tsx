'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compareMonths, ExpenseComparison } from '@/lib/expense-comparison';
import { costClassLabels, CostClass } from '@/lib/cost-class';
import { formatYen, todayInJapan } from '@/lib/expenses';
import { errorMessage, requestJson } from '@/lib/client-api';
const signed=(amount:number)=>(amount>0?'+':amount<0?'-':'')+formatYen(Math.abs(amount));
export function MonthComparison({month,revision}:{month:string;revision:number}) {
  const [data,setData]=useState<ExpenseComparison|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();setData(null);setError('');requestJson<ExpenseComparison>('/api/expenses/comparison?month='+month,{signal:c.signal}).then(r=>{if(!c.signal.aborted)setData(r);}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[month,revision,retry]);
  if(error)return <div className="comparison-status" role="status">前月比較：{error}<Button variant="ghost" size="icon" title="前月比較を再読み込み" aria-label="前月比較を再読み込み" onClick={()=>setRetry(n=>n+1)}><RefreshCw /></Button></div>;
  if(!data||data.current.month!==month)return <p className="comparison-status" role="status">前月比較を読み込み中</p>;
  const result=compareMonths(data), sampleCount=data.current.sampleCount+(data.previous?.sampleCount??0);
  return <section className="month-comparison" aria-label="前月比較">
    {sampleCount>0&&<p className="sample-notice">{data.current.sampleCount>0?'この月の支出合計・比較には':'前月比較には'}サンプルを含みます。実際の家計への評価ではありません。</p>}
    <details><summary><span>前月比 {result.available?<strong>{signed(result.delta)}{result.percent!==null&&<small>（{result.percent>0?'+':''}{result.percent.toFixed(1)}%）</small>}</strong>:<span className="muted-text">前月の記録なし</span>}</span><ChevronDown aria-hidden="true" /></summary>
      {month===todayInJapan().slice(0,7)&&<p className="muted-text">月途中の実績と前月全体の比較</p>}
      {!result.available?<p className="muted-text">未入力の可能性があるため、増減を算出していません。</p>:<>
        <dl className="comparison-costs">{result.costs.map(item=><div key={item.costClass}><dt>{costClassLabels[item.costClass as CostClass]}</dt><dd>{signed(item.delta)}</dd></div>)}</dl>
        <h3>増加したカテゴリ</h3>{result.categories.length?<ul className="comparison-categories">{result.categories.map(c=><li key={c.categoryId}><span><i className="category-dot" style={{backgroundColor:c.color}} />{c.name}</span><strong>{signed(c.delta)}</strong></li>)}</ul>:<p className="muted-text">増加したカテゴリなし</p>}
        {Boolean(data.current.summaryRemainder||data.previous?.summaryRemainder)&&<p className="muted-text">まとめ記録の未整理額は未分類に含みます。</p>}
      </>}
    </details>
  </section>;
}
