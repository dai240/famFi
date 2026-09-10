import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, json } from '@/lib/api';
import { monthSchema, monthRange } from '@/lib/expenses';
import { CalendarEntry, calendarActualTotal } from '@/lib/expense-calendar';
import { readRecurringState, readSummaries } from '@/lib/planning-service';
import { dueDate, isDue } from '@/lib/recurring';
import { serializePlan } from '@/lib/planning';
import { serializeNote } from '@/lib/notes';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { month } = z.object({ month: monthSchema }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async (tx,scope) => {
      const date = monthRange(month);
      const expenses = await tx.expense.findMany({ where: { userId: scope.ledgerId, date },
        select: { id:true, date:true, datePrecision:true, description:true, amount:true, categoryId:true },
        orderBy:[{date:'asc'},{id:'asc'}], take:10001 });
      if (expenses.length > 10000) throw new ApiError(422, 'この月は件数が多いため、支出一覧で確認してください。');
      const entries: CalendarEntry[] = expenses.map(e => ({ id:e.id, kind:'expense', date:e.date.toISOString().slice(0,e.datePrecision==='month'?7:10), name:e.description, amount:e.amount, categoryId:e.categoryId }));
      const plans = (await tx.plannedExpense.findMany({ where:{ date, state:'open' } })).map(serializePlan);
      entries.push(...plans.map(p => ({ id:p.id, kind:'plan' as const, date:p.date, name:p.name, amount:p.amount, categoryId:p.categoryId })));
      const { rules, occurrences } = await readRecurringState(tx);
      for (const rule of rules.filter(r => isDue(r,month))) {
        const occurrence = occurrences.find(o => o.ruleId===rule.id && o.period===month);
        if (occurrence && occurrence.state!=='open') continue;
        entries.push({ id:rule.id, kind:'recurring', date:dueDate(month,rule.dueDay), name:rule.name, amount:rule.amount, categoryId:rule.categoryId });
      }
      const notes = (await tx.householdNote.findMany({ where:{ date } })).map(serializeNote);
      entries.push(...notes.map(n => ({ id:n.id, kind:n.kind, date:n.date!, name:n.name, amount:null, categoryId:null, completed:n.completed })));
      for (const summary of await readSummaries(tx,{month:date.gte})) {
        if (summary.remainder) entries.push({id:summary.id,kind:'summary',date:month,name:summary.name,amount:summary.remainder,categoryId:null});
      }
      return { entries:entries.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id)), total:calendarActualTotal(entries) };
    }));
  } catch (error) { return apiError(error); }
}
