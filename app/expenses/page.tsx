import { ExpenseWorkspace } from '@/components/expenses/ExpenseWorkspace';
import { todayInJapan } from '@/lib/expenses';
export const dynamic = 'force-dynamic';
export default function ExpensesPage() { return <ExpenseWorkspace initialMonth={todayInJapan().slice(0, 7)} />; }
