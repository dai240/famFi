import { isDue, recurringReviewDate, type AttentionItem, type RecurringOccurrence, type RecurringRule } from './recurring';
import { planReviewDate, type PlanRecord } from './planning';

export type ReviewPeriod = { month: string; recurring: number; plans: number };
export type ReviewPayment = { id: string; name: string; date: string; amount: number };
export type MonthlyReview = {
  month: string;
  today: string;
  periods: ReviewPeriod[];
  waiting: { count: number; nextDate: string | null };
  payments: ReviewPayment[];
  samplePaymentCount: number;
  summaries: { id: string; name: string; remainder: number }[];
};
export type AttentionResponse = { count: number; items: AttentionItem[]; review?: MonthlyReview };

export function reviewPeriods(items: AttentionItem[]): ReviewPeriod[] {
  const periods = new Map<string, ReviewPeriod>();
  for (const item of items) {
    const period = periods.get(item.period) ?? { month: item.period, recurring: 0, plans: 0 };
    if (item.kind === 'recurring') period.recurring++;
    else period.plans++;
    periods.set(item.period, period);
  }
  return [...periods.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function waitingReviews(rules: RecurringRule[], occurrences: RecurringOccurrence[], plans: PlanRecord[], month: string, today: string) {
  const byRule = new Map(occurrences.filter(o => o.period === month).map(o => [o.ruleId, o]));
  const dates = rules.filter(rule => isDue(rule, month) && (!byRule.has(rule.id) || byRule.get(rule.id)?.state === 'open'))
    .map(rule => recurringReviewDate(rule, month, byRule.get(rule.id)));
  dates.push(...plans.filter(plan => plan.state === 'open' && plan.date.slice(0, 7) === month).map(planReviewDate));
  const future = dates.filter(date => date > today).sort();
  return { count: future.length, nextDate: future[0] ?? null };
}
