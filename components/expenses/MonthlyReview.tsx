'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatExpenseDate, formatYen } from '@/lib/expenses';
import type { MonthlyReview as Review, ReviewPeriod } from '@/lib/monthly-review';

type Props = {
  data: Review | null;
  error: string;
  onRetry: () => void;
  onSchedule: (month: string, view: 'due' | 'plans') => void;
  onExpense: (id: string) => Promise<void>;
  onSummary: (id: string) => void;
};

export function MonthlyReview({ data, error, onRetry, onSchedule, onExpense, onSummary }: Props) {
  const [opening, setOpening] = useState<string | null>(null);
  if (error) return <section className="monthly-review review-status" aria-label="この月の確認"><p role="status">確認事項：{error}</p><Button variant="ghost" size="icon" aria-label="確認事項を再読み込み" title="確認事項を再読み込み" onClick={onRetry}><RefreshCw /></Button></section>;
  if (!data) return <p className="review-status" role="status">確認事項を読み込み中</p>;
  const current = data.periods.find(period => period.month === data.month);
  const other = data.periods.filter(period => period.month !== data.month);
  const count = (current?.recurring ?? 0) + (current?.plans ?? 0) + data.payments.length;
  const otherCount = other.reduce((sum, period) => sum + period.recurring + period.plans, 0);
  const periodLinks = (period: ReviewPeriod) => <div className="review-period-actions">
    {period.recurring > 0 && <button type="button" onClick={() => onSchedule(period.month, 'due')}><span>定期支出</span><strong>{period.recurring}件</strong><ChevronRight aria-hidden="true" /></button>}
    {period.plans > 0 && <button type="button" onClick={() => onSchedule(period.month, 'plans')}><span>単発の予定</span><strong>{period.plans}件</strong><ChevronRight aria-hidden="true" /></button>}
  </div>;
  async function openExpense(id: string) {
    if (opening) return;
    setOpening(id);
    try { await onExpense(id); } finally { setOpening(null); }
  }
  return <section className="monthly-review" aria-label="この月の確認">
    <details>
      <summary><span className="review-title">この月の確認 <span className={count ? 'review-count' : 'review-clear'}>{count ? `確認待ち ${count}件` : '確認待ちなし'}</span>
        {(otherCount > 0 || data.summaries.length > 0) && <small>{[otherCount > 0 ? `別の月 ${otherCount}件` : '', data.summaries.length > 0 ? `任意の整理 ${data.summaries.length}件` : ''].filter(Boolean).join(' / ')}</small>}
      </span><ChevronDown aria-hidden="true" /></summary>
      <div className="review-content">
        {current && <div aria-label="この月の予定・定期の確認待ち">{periodLinks(current)}</div>}
        {data.waiting.count > 0 && <p className="review-muted">確認日前・延期中 {data.waiting.count}件 <span>次の確認日 {formatExpenseDate(data.waiting.nextDate!)}</span></p>}
        {data.payments.length > 0 && <details className="review-group"><summary><span>支払情報の確認 <strong>{data.payments.length}件</strong></span><ChevronDown aria-hidden="true" /></summary>
          <ul className="review-records">{data.payments.map(payment => <li key={payment.id}><button type="button" disabled={Boolean(opening)} onClick={() => openExpense(payment.id)}><span><strong>{payment.name}</strong><small>{formatExpenseDate(payment.date)}</small></span><strong>{formatYen(payment.amount)}</strong>{opening === payment.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button></li>)}</ul>
        </details>}
        {data.samplePaymentCount > 0 && <p className="review-muted">サンプルの要確認支出 {data.samplePaymentCount}件は対象外</p>}
        {otherCount > 0 && <details className="review-group"><summary><span>別の月の確認待ち <strong>{otherCount}件</strong></span><ChevronDown aria-hidden="true" /></summary>
          {other.map(period => <div className="review-other-period" key={period.month}><h3>{formatExpenseDate(period.month)}</h3>{periodLinks(period)}</div>)}
        </details>}
        {data.summaries.length > 0 && <details className="review-group review-optional"><summary><span>まとめ記録の整理 <small>任意</small></span><ChevronDown aria-hidden="true" /></summary>
          <ul className="review-records">{data.summaries.map(summary => <li key={summary.id}><button type="button" onClick={() => onSummary(summary.id)}><span><strong>{summary.name}</strong><small>未整理 {formatYen(summary.remainder)}</small></span><ChevronRight aria-hidden="true" /></button></li>)}</ul>
        </details>}
        {count === 0 && otherCount === 0 && data.waiting.count === 0 && data.summaries.length === 0 && <p className="review-muted">現在、確認待ちの項目はありません。</p>}
      </div>
    </details>
  </section>;
}
