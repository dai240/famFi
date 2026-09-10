import { ExpenseWorkspace } from '@/components/expenses/ExpenseWorkspace';
import { todayInJapan } from '@/lib/expenses';
import { EnvironmentBanner } from '@/components/expenses/EnvironmentBanner';
export const dynamic = 'force-dynamic';
export default function ExpensesPage() { return <><EnvironmentBanner preview={process.env.FAMFI_DB_SCHEMA==='famfi_preview'} /><ExpenseWorkspace initialMonth={todayInJapan().slice(0, 7)} /></>; }
