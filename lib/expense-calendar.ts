import { eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth } from 'date-fns';
import { monthSchema } from './expenses';
export type CalendarEntry = { id: string; kind: 'expense'|'plan'|'recurring'|'note'|'task'|'summary'; date: string;
  name: string; amount: number|null; categoryId: string|null; completed?: boolean };
export type CalendarResponse = { entries: CalendarEntry[]; total: number };
export const calendarLabels = { expense: '支出', plan: '予定', recurring: '定期', note: 'メモ', task: 'チェック', summary: '未整理額' };
export function calendarDays(month: string) {
  monthSchema.parse(month);
  const start = startOfMonth(parseISO(month + '-01'));
  const days: (string|null)[] = Array(getDay(start)).fill(null);
  days.push(...eachDayOfInterval({ start, end: endOfMonth(start) }).map(day => format(day, 'yyyy-MM-dd')));
  while (days.length % 7) days.push(null);
  return days;
}
export function calendarActualTotal(entries: CalendarEntry[]) {
  return entries.filter(e => e.kind === 'expense' || e.kind === 'summary').reduce((sum,e) => sum + (e.amount ?? 0), 0);
}
